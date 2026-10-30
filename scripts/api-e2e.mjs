/**
 * API 端到端自测脚本（可通过前端代理或直连后端运行）
 *
 * 用法：node scripts/api-e2e.mjs [BASE_URL]
 *   默认 BASE_URL=http://localhost:3000（走前端代理）
 *   直连后端示例：node scripts/api-e2e.mjs http://localhost:8080
 *
 * 覆盖：注册 → 上传 → 提交成功任务 → 轮询到终态 → 注入指定阶段失败 → 参数校验 → 会话隔离。
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] || "http://localhost:3000";
const SAMPLES = join(dirname(fileURLToPath(import.meta.url)), "../docs/sample-uploads");
const PNG = "image/png";

let passed = 0;
function ok(condition, label, extra = "") {
  if (!condition) {
    console.error(`  ✗ ${label} ${extra}`);
    process.exitCode = 1;
    throw new Error(label);
  }
  passed += 1;
  console.log(`  ✓ ${label}`);
}

async function api(path, { method = "GET", token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON（如图片） */
  }
  return { status: res.status, data, res };
}

async function upload(token, templateId, filename) {
  const bytes = await readFile(join(SAMPLES, filename));
  const form = new FormData();
  form.append("templateId", templateId);
  form.append("file", new Blob([bytes], { type: PNG }), filename);
  const res = await api("/api/assets", { method: "POST", token, form });
  ok(res.status === 201, `上传素材 ${filename}`, JSON.stringify(res.data));
  return res.data;
}

async function awaitStatus(taskId, token, expected, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    const res = await api(`/api/tasks/${taskId}`, { token });
    if (res.data?.task?.status === expected) return res.data;
    if (res.data?.task?.status === "SUCCESS" || res.data?.task?.status === "FAILED") {
      if (res.data.task.status !== expected) {
        throw new Error(`任务终态为 ${res.data.task.status}，期望 ${expected}：${JSON.stringify(res.data)}`);
      }
    }
    if (Date.now() - start > timeoutMs) throw new Error(`等待 ${expected} 超时`);
    await new Promise((r) => setTimeout(r, 800));
  }
}

console.log(`目标：${BASE}\n`);

// 1) 注册
const username = `e2e_${Date.now()}`;
const reg = await api("/api/auth/register", { method: "POST", json: { username, password: "secret123", displayName: "E2E 脚本" } });
ok(reg.status === 201 && reg.data.token, "注册并取得 token");
const token = reg.data.token;

// 2) 缩短模拟耗时便于快速验证
const simPut = await api("/api/dev/simulation", { method: "PUT", json: { durations: { assetCheckMs: 1000, generateMs: 1500, finalizeMs: 1000 } } });
ok(simPut.status === 200, "开发接口调整模拟耗时");

// 3) 模板公开可读
const tpl = await api("/api/templates");
ok(tpl.status === 200 && tpl.data.templates.length >= 5, "未登录可浏览模板列表", `count=${tpl.data?.templates?.length}`);
const postcard = tpl.data.templates.find((t) => t.id === "demo-postcard");

// 4) 成功流程
console.log("\n[成功流程]");
const a1 = await upload(token, "demo-postcard", "trip-photo-a.png");
const a2 = await upload(token, "demo-postcard", "trip-photo-b.png");
const submit = await api("/api/tasks", { method: "POST", token, json: { templateId: "demo-postcard", assetIds: [a1.id, a2.id] } });
ok(submit.status === 201, "提交任务立即返回 201");
ok(["PENDING", "PROCESSING"].includes(submit.data.task.status), "受理后任务为非终态（未等待执行完成）", submit.data.task.status);
ok(submit.data.steps.length === 3, "创建 3 条步骤记录");
const done = await awaitStatus(submit.data.task.id, token, "SUCCESS");
ok(done.task.stage === "FINALIZE", "最终阶段为结果整理");
ok((done.task.resultUrl || "").startsWith("/demo/results/"), "记录可预览的结果地址", done.task.resultUrl);
const stepOrder = done.steps.map((s) => `${s.step}:${s.status}`).join(" ");
ok(
  stepOrder === "ASSET_CHECK:SUCCESS GENERATE:SUCCESS FINALIZE:SUCCESS",
  "三步按序全部成功",
  stepOrder
);
const resultImg = await fetch(`${BASE}${done.task.resultUrl}`);
ok(resultImg.status === 200 && (resultImg.headers.get("content-type") || "").startsWith("image/"), "结果图可访问预览");

// 5) 注入失败
console.log("\n[注入失败：GENERATE 阶段]");
const a3 = await upload(token, "demo-postcard", "family-photo.png");
const a4 = await upload(token, "demo-postcard", "pet-photo.png");
const submit2 = await api("/api/tasks", { method: "POST", token, json: { templateId: "demo-postcard", assetIds: [a3.id, a4.id], failStage: "GENERATE" } });
ok(submit2.status === 201, "提交注入失败的任务");
const failed = await awaitStatus(submit2.data.task.id, token, "FAILED");
ok(failed.task.stage === "GENERATE", "失败阶段记录为 GENERATE");
ok((failed.task.failureReason || "").includes("模拟生成"), "失败原因可读", failed.task.failureReason);
ok(failed.task.resultUrl === null, "失败任务无结果地址");
const failOrder = failed.steps.map((s) => `${s.step}:${s.status}`).join(" ");
ok(failOrder === "ASSET_CHECK:SUCCESS GENERATE:FAILED FINALIZE:PENDING", "失败后停止执行后续步骤", failOrder);

// 6) 参数校验
console.log("\n[服务端校验]");
const badCount = await api("/api/tasks", { method: "POST", token, json: { templateId: "demo-postcard", assetIds: [a1.id] } });
ok(badCount.status === 400, "素材数量不符 → 400");
const noTpl = await api("/api/tasks", { method: "POST", token, json: { templateId: "not-exist", assetIds: [a1.id] } });
ok(noTpl.status === 404, "模板不存在 → 404");
const foreign = await upload(token, "demo-magazine", "trip-photo-a.png");
const foreignRes = await api("/api/auth/guest", { method: "POST" });
const otherSubmit = await api("/api/tasks", { method: "POST", token: foreignRes.data.token, json: { templateId: "demo-magazine", assetIds: [foreign.id] } });
ok(otherSubmit.status === 400, "使用他人素材 → 400");
const doneTask = await api(`/api/tasks/${submit.data.task.id}`, { token: foreignRes.data.token });
ok(doneTask.status === 404, "查看他人任务 → 404（用户隔离）");

// 7) 轮询不推进任务（提交后立即查询应只见 PENDING/PROCESSING）
console.log("\n[查询语义]");
const submit3 = await api("/api/tasks", { method: "POST", token, json: { templateId: "demo-magazine", assetIds: [foreign.id] } });
ok(submit3.status === 201, "复用未占用素材提交任务", JSON.stringify(submit3.data));
const seen = new Set();
for (let i = 0; i < 6; i++) {
  const probe = await api(`/api/tasks/${submit3.data.task.id}`, { token });
  seen.add(probe.data.task.status);
  if (probe.data.task.status === "SUCCESS") break;
  await new Promise((r) => setTimeout(r, 300));
}
ok([...seen].every((s) => ["PENDING", "PROCESSING", "SUCCESS"].includes(s)), "查询只读状态，不驱动任务", [...seen].join(","));
const after = await awaitStatus(submit3.data.task.id, token, "SUCCESS");
ok(after.task.status === "SUCCESS", "完成后查询仍为 SUCCESS（不会回到处理中）");

// 8) 恢复全局配置
await api("/api/dev/simulation", { method: "PUT", json: { failStage: "NONE" } });

console.log(`\n全部通过：${passed} 项断言 ✓`);
