"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatBytesLimit } from "@/lib/format";
import { isTerminal, resumeTaskPolling, useTaskStore } from "@/lib/taskStore";
import type { AssetView, TaskView, TemplateView } from "@/lib/types";
import UploadSlot, { type SlotState } from "@/components/UploadSlot";
import HistoryPanel from "@/components/HistoryPanel";
import AuthGate from "@/components/AuthGate";
import { useTaskPollingLifecycle } from "@/hooks/useTaskPollingLifecycle";

function emptySlots(count: number): SlotState[] {
  return Array.from({ length: count }, () => ({ asset: null, uploading: false, error: null }));
}

function DetailPageContent() {
  const params = useParams<{ id: string }>();
  const templateId = params.id;

  const [template, setTemplate] = useState<TemplateView | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [slots, setSlots] = useState<SlotState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  const allTasks = useTaskStore((s) => s.tasks);
  const upsertMany = useTaskStore((s) => s.upsertMany);

  // 页面期间自动跟踪任务（卸载时释放）
  useTaskPollingLifecycle();

  // 防竞态：模板切换或组件卸载后，丢弃过期的历史响应
  const mountedRef = useRef(true);
  const activeTemplateRef = useRef(templateId);
  useEffect(() => {
    activeTemplateRef.current = templateId;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [templateId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api<{ tasks: TaskView[] }>(`/api/tasks?templateId=${encodeURIComponent(templateId)}`);
      if (!mountedRef.current || activeTemplateRef.current !== templateId) return;
      upsertMany(res.tasks);
      // 刷新恢复（R-09）：存在未结束任务则恢复自动跟踪
      if (res.tasks.some((t) => !isTerminal(t))) {
        resumeTaskPolling();
      }
    } catch {
      // 查询异常由全局 queryError 呈现，此处无需重复提示
    } finally {
      setHistoryLoading(false);
    }
  }, [templateId, upsertMany]);

  useEffect(() => {
    let cancelled = false;
    setTemplateLoading(true);
    setTemplateError(null);
    api<TemplateView>(`/api/templates/${encodeURIComponent(templateId)}`)
      .then((t) => {
        if (cancelled) return;
        setTemplate(t);
        setSlots(emptySlots(t.requiredImageCount));
      })
      .catch((err) => {
        if (!cancelled) setTemplateError(err instanceof Error ? err.message : "加载模板失败");
      })
      .finally(() => {
        if (!cancelled) setTemplateLoading(false);
      });
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [templateId, loadHistory]);

  const templateTasks = useMemo(
    () =>
      Object.values(allTasks)
        .filter((t) => t.templateId === templateId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [allTasks, templateId]
  );

  const filledAssets = slots.filter((s) => s.asset).map((s) => s.asset!.id);
  const anyUploading = slots.some((s) => s.uploading);
  const canSubmit = template !== null && filledAssets.length === template.requiredImageCount && !anyUploading && !submitting;

  const uploadToSlot = useCallback(
    async (slotIndex: number, file: File) => {
      if (!template) return;
      // 客户端预校验（服务端仍有完整校验）
      if (!template.acceptedMimeTypes.includes(file.type)) {
        setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { ...s, error: `仅支持 ${template.acceptedMimeTypes.join("、")} 格式` } : s)));
        return;
      }
      if (file.size > template.maxFileSizeBytes) {
        setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { ...s, error: `图片不能超过 ${formatBytesLimit(template.maxFileSizeBytes)}` } : s)));
        return;
      }
      setSubmitError(null);
      const previousAsset = slots[slotIndex]?.asset;
      setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { ...s, uploading: true, error: null } : s)));
      try {
        const form = new FormData();
        form.append("templateId", template.id);
        form.append("file", file);
        const asset = await api<AssetView>("/api/assets", { method: "POST", body: form });
        setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { asset, uploading: false, error: null } : s)));
        // 替换场景：清理被换下的素材，避免其占用上传配额
        if (previousAsset) {
          api(`/api/assets/${previousAsset.id}`, { method: "DELETE" }).catch(() => {
            // 清理失败不影响新素材使用（提交时服务端会校验配额）
          });
        }
      } catch (err) {
        setSlots((prev) =>
          prev.map((s, i) => (i === slotIndex ? { ...s, uploading: false, error: err instanceof Error ? err.message : "上传失败" } : s))
        );
      }
    },
    [template, slots]
  );

  const removeAsset = useCallback(
    async (slotIndex: number) => {
      const asset = slots[slotIndex]?.asset;
      if (!asset) return;
      setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { asset: null, uploading: false, error: null } : s)));
      try {
        await api(`/api/assets/${asset.id}`, { method: "DELETE" });
      } catch (err) {
        // 删除失败则回滚该槽位展示
        setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { asset, uploading: false, error: err instanceof Error ? err.message : "移除失败" } : s)));
      }
    },
    [slots]
  );

  const handleSubmit = async () => {
    if (!canSubmit || !template) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api<{ task: TaskView }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ templateId: template.id, assetIds: filledAssets }),
      });
      upsertMany([res.task]);
      resumeTaskPolling();
      setSlots(emptySlots(template.requiredImageCount));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (templateLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-busy="true" aria-label="页面加载中">
        <div className="h-96 animate-pulse rounded-2xl bg-[#1d1d21]" />
        <div className="h-96 animate-pulse rounded-2xl bg-[#1d1d21]" />
      </div>
    );
  }

  if (templateError || !template) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-[#2a2a30] bg-[#1a1a1e] px-6 py-10 text-center">
        <p className="text-zinc-200">{templateError ?? "模板不存在"}</p>
        <Link href="/" className="mt-4 inline-block rounded-lg bg-[#9baf62] px-4 py-2 text-sm font-medium text-[#17170f] hover:bg-[#8a9c52]">
          返回模板列表
        </Link>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* 左侧：模板与上传 */}
      <section className="rounded-2xl border border-[#26262b] bg-[#161619] p-4" aria-label="模板与上传">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-100" aria-label="返回模板列表">
          <span aria-hidden="true">‹</span> {template.title}
        </Link>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={template.coverUrl} alt={`${template.title} 示例封面`} className="mt-3 aspect-[4/3] w-full rounded-xl object-cover" />

        <h1 className="mt-3 text-base font-semibold text-zinc-100">{template.title}</h1>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{template.description}</p>
        <p className="mt-2 text-xs text-zinc-500">
          需要 {template.requiredImageCount} 张图片 · 支持 {template.acceptedMimeTypes.join(" / ")} · 单张不超过{" "}
          {formatBytesLimit(template.maxFileSizeBytes)}
        </p>

        <h2 className="mt-4 text-sm font-medium text-zinc-200">上传素材</h2>
        <div className={`mt-2 grid gap-3 ${template.requiredImageCount > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {slots.map((slot, i) => (
            <UploadSlot
              key={i}
              slot={slot}
              accept={template.acceptedMimeTypes.join(",")}
              onFile={(file) => void uploadToSlot(i, file)}
              onRemove={() => void removeAsset(i)}
            />
          ))}
        </div>

        {submitError && (
          <p role="alert" className="mt-3 rounded-md bg-red-950/50 px-3 py-2 text-xs text-red-300">
            {submitError}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#9baf62] py-3 text-sm font-semibold text-[#17170f] transition-colors hover:bg-[#8a9c52] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c6d894]"
          aria-label={submitting ? "正在提交任务" : "提交制作任务"}
        >
          {submitting ? "提交中…" : `开始制作（${filledAssets.length}/${template.requiredImageCount}）`}
        </button>
        <p className="mt-2 text-center text-xs text-zinc-600">
          {submitting ? "任务正在受理，请稍候" : anyUploading ? "图片上传中，请稍候" : "提交后在右侧查看处理进度，可连续创建多个任务"}
        </p>
      </section>

      {/* 右侧：历史与结果 */}
      <div className="rounded-2xl border border-[#26262b] bg-[#161619] p-4">
        <HistoryPanel
          title="历史记录"
          tasks={templateTasks}
          loading={historyLoading}
          onRefresh={() => void loadHistory()}
          emptyText="该模板还没有制作记录"
        />
      </div>
    </div>
  );
}

export default function TemplateDetailPage() {
  return (
    <AuthGate>
      <DetailPageContent />
    </AuthGate>
  );
}
