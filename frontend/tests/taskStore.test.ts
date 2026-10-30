import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/lib/api";
import { POLL_INTERVAL_MS, startTaskPolling, stopTaskPolling, useTaskStore } from "@/lib/taskStore";
import { useAuthStore } from "@/lib/authStore";
import type { TaskView } from "@/lib/types";

// 统一 mock 网络层：taskStore / authStore 的请求都走这里
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    api: vi.fn(),
    onUnauthorized: vi.fn(() => () => undefined),
  };
});

const apiMock = vi.mocked(api);

function makeTask(partial: Partial<TaskView> & { id: string }): TaskView {
  return {
    templateId: "demo-postcard",
    templateTitle: "旅行明信片",
    status: "PROCESSING",
    stage: "GENERATE",
    failureReason: null,
    resultUrl: null,
    createdAt: "2026-10-30T10:00:00",
    startedAt: "2026-10-30T10:00:01",
    finishedAt: null,
    ...partial,
  };
}

describe("taskStore 轮询与状态管理（R-07 / R-08）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTaskStore.getState().reset();
    useAuthStore.setState({
      user: { id: 1, username: "demo", displayName: "演示用户", guest: true, createdAt: "2026-10-30T09:00:00" },
    });
    apiMock.mockReset();
  });

  afterEach(() => {
    stopTaskPolling();
    vi.useRealTimers();
  });

  it("多任务状态各自独立更新，互不串扰", async () => {
    useTaskStore.getState().upsertMany([
      makeTask({ id: "t1", status: "PROCESSING", stage: "ASSET_CHECK" }),
      makeTask({ id: "t2", status: "PROCESSING", stage: "GENERATE" }),
      makeTask({ id: "t3", status: "PENDING", stage: null }),
    ]);

    apiMock.mockResolvedValueOnce({
      tasks: [
        makeTask({ id: "t1", status: "SUCCESS", stage: "FINALIZE", resultUrl: "/demo/results/a.png", finishedAt: "2026-10-30T10:00:20" }),
        makeTask({ id: "t2", status: "FAILED", stage: "GENERATE", failureReason: "模拟失败注入：任务在「模拟生成」阶段被标记为失败" }),
        makeTask({ id: "t3", status: "PROCESSING", stage: "ASSET_CHECK" }),
      ],
    });

    startTaskPolling();
    await vi.advanceTimersByTimeAsync(1);

    const tasks = useTaskStore.getState().tasks;
    // t1 成功且带结果
    expect(tasks.t1?.status).toBe("SUCCESS");
    expect(tasks.t1?.resultUrl).toBe("/demo/results/a.png");
    // t2 失败且原因独立，结果仍为空
    expect(tasks.t2?.status).toBe("FAILED");
    expect(tasks.t2?.failureReason).toContain("模拟生成");
    expect(tasks.t2?.resultUrl).toBeNull();
    // t3 未被另外两个任务的结果影响
    expect(tasks.t3?.status).toBe("PROCESSING");
    expect(tasks.t3?.stage).toBe("ASSET_CHECK");

    // t3 仍在处理中 → 轮询继续跟踪
    expect(apiMock).toHaveBeenCalledTimes(1);
    apiMock.mockResolvedValueOnce({ tasks: [makeTask({ id: "t3", status: "SUCCESS", resultUrl: "/demo/results/d.png" })] });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 1);
    expect(apiMock).toHaveBeenCalledTimes(2);
    expect(useTaskStore.getState().tasks.t3?.status).toBe("SUCCESS");

    // 全部结束 → 轮询自动停止，不再产生新请求
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4);
    expect(apiMock).toHaveBeenCalledTimes(2);
  });

  it("只跟踪未结束任务：终态任务不进入下一次轮询", async () => {
    useTaskStore.getState().upsertMany([
      makeTask({ id: "t1", status: "SUCCESS", resultUrl: "/demo/results/a.png" }),
      makeTask({ id: "t2", status: "PROCESSING", stage: "GENERATE" }),
    ]);
    apiMock.mockResolvedValueOnce({ tasks: [makeTask({ id: "t2", status: "SUCCESS", resultUrl: "/demo/results/b.png" })] });

    startTaskPolling();
    await vi.advanceTimersByTimeAsync(1);

    const requested = apiMock.mock.calls[0][0] as string;
    expect(requested).toContain("ids=t2");
    expect(requested).not.toContain("t1");
    expect(apiMock).toHaveBeenCalledTimes(1);
  });

  it("查询异常 ≠ 任务失败：任务状态保持不变，恢复查询后继续推进", async () => {
    useTaskStore.getState().upsertMany([makeTask({ id: "t1", status: "PROCESSING", stage: "GENERATE" })]);

    apiMock.mockRejectedValueOnce(new ApiError(0, "网络异常，暂时无法连接服务器"));
    startTaskPolling();
    await vi.advanceTimersByTimeAsync(1);

    // 任务不能因为查询失败被标记为失败
    expect(useTaskStore.getState().tasks.t1?.status).toBe("PROCESSING");
    expect(useTaskStore.getState().tasks.t1?.failureReason).toBeNull();
    // 出现查询异常提示，且轮询仍在继续（自动恢复查询）
    expect(useTaskStore.getState().queryError).toBe("网络异常，暂时无法连接服务器");
    expect(apiMock).toHaveBeenCalledTimes(1);

    apiMock.mockResolvedValueOnce({ tasks: [makeTask({ id: "t1", status: "SUCCESS", resultUrl: "/demo/results/c.png" })] });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 1);

    expect(useTaskStore.getState().tasks.t1?.status).toBe("SUCCESS");
    expect(useTaskStore.getState().queryError).toBeNull();
  });

  it("会话失效（401）时清空任务数据与登录态，停止轮询", async () => {
    useTaskStore.getState().upsertMany([makeTask({ id: "t1", status: "PROCESSING" })]);
    apiMock.mockRejectedValueOnce(new ApiError(401, "登录已过期，请重新登录"));

    startTaskPolling();
    await vi.advanceTimersByTimeAsync(1);

    expect(useTaskStore.getState().tasks).toEqual({});
    expect(useTaskStore.getState().queryError).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(apiMock).toHaveBeenCalledTimes(1);
  });

  it("轮询重置后丢弃在途的过期响应，避免旧数据覆盖", async () => {
    useTaskStore.getState().upsertMany([makeTask({ id: "t1", status: "PROCESSING", stage: "GENERATE" })]);

    let resolveFetch!: (value: { tasks: TaskView[] }) => void;
    apiMock.mockImplementationOnce(
      () =>
        new Promise<{ tasks: TaskView[] }>((resolve) => {
          resolveFetch = resolve;
        })
    );

    startTaskPolling();
    await vi.advanceTimersByTimeAsync(1);
    expect(apiMock).toHaveBeenCalledTimes(1);

    stopTaskPolling(); // 模拟离开页面 / 用户切换
    resolveFetch({ tasks: [makeTask({ id: "t1", status: "FAILED", failureReason: "过期响应" })] });
    await vi.advanceTimersByTimeAsync(1);

    // 过期响应被丢弃，任务数据未被覆盖
    expect(useTaskStore.getState().tasks.t1?.status).toBe("PROCESSING");
    expect(useTaskStore.getState().tasks.t1?.failureReason).toBeNull();
  });
});
