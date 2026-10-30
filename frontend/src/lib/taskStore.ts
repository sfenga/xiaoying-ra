"use client";

import { create } from "zustand";
import { api, ApiError } from "./api";
import { useAuthStore } from "./authStore";
import type { TaskView } from "./types";

export const TERMINAL_STATUSES: readonly string[] = ["SUCCESS", "FAILED"];
export const POLL_INTERVAL_MS = 1500;

interface TaskStoreState {
  tasks: Record<string, TaskView>;
  /** 查询接口异常信息（注意：查询异常不代表任务失败，任务状态保持不变） */
  queryError: string | null;
  upsertMany: (incoming: TaskView[]) => void;
  setQueryError: (message: string | null) => void;
  reset: () => void;
}

export const useTaskStore = create<TaskStoreState>((set) => ({
  tasks: {},
  queryError: null,

  upsertMany: (incoming) =>
    set((state) => {
      if (incoming.length === 0) return state;
      const tasks = { ...state.tasks };
      for (const task of incoming) {
        tasks[task.id] = task;
      }
      return { tasks };
    }),

  setQueryError: (message) => set({ queryError: message }),

  reset: () => {
    stopTaskPolling();
    set({ tasks: {}, queryError: null });
  },
}));

export function selectActiveIds(tasks: Record<string, TaskView>): string[] {
  return Object.values(tasks)
    .filter((t) => !TERMINAL_STATUSES.includes(t.status))
    .map((t) => t.id);
}

export function isTerminal(task: TaskView): boolean {
  return TERMINAL_STATUSES.includes(task.status);
}

// ---------------- 轮询生命周期（R-08） ----------------
// 单一共享轮询循环：只请求未结束任务；全部结束后自动停止；
// 页面卸载/用户切换时通过 stopTaskPolling 作废在途请求，避免旧响应覆盖新数据。

let polling = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let pollSeq = 0;
let requestInFlight = false;
/** 正在使用轮询的页面计数，归零即停止 */
let lifecycleUsers = 0;

export function startTaskPolling(): void {
  lifecycleUsers += 1;
  if (polling) return;
  polling = true;
  scheduleNext(0);
}

export function stopTaskPolling(): void {
  polling = false;
  pollSeq += 1; // 在途响应作废
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** 页面级生命周期：挂载启用轮询，卸载时若无其他页面使用则停止。 */
export function releaseTaskPolling(): void {
  lifecycleUsers = Math.max(0, lifecycleUsers - 1);
  if (lifecycleUsers === 0) {
    stopTaskPolling();
  }
}

export function isPollingActive(): boolean {
  return polling;
}

function scheduleNext(delayMs: number): void {
  if (!polling) return;
  timer = setTimeout(() => {
    void pollOnce();
  }, delayMs);
}

export async function pollOnce(): Promise<void> {
  if (!polling || requestInFlight) {
    if (polling) scheduleNext(POLL_INTERVAL_MS);
    return;
  }
  const { tasks } = useTaskStore.getState();
  const ids = selectActiveIds(tasks);
  if (ids.length === 0) {
    stopTaskPolling();
    return;
  }
  requestInFlight = true;
  const seq = ++pollSeq;
  try {
    const res = await api<{ tasks: TaskView[] }>(`/api/tasks?ids=${encodeURIComponent(ids.join(","))}`);
    if (!polling || seq !== pollSeq) return; // 过期响应：轮询已被重置
    useTaskStore.getState().upsertMany(res.tasks);
    useTaskStore.getState().setQueryError(null);
    if (selectActiveIds(useTaskStore.getState().tasks).length === 0) {
      stopTaskPolling();
    }
  } catch (error) {
    if (!polling || seq !== pollSeq) return;
    if (error instanceof ApiError && error.status === 401) {
      // 会话失效（切换用户/登录过期）：清理登录态与本地任务数据，停止轮询
      useAuthStore.getState().forceSignOut();
      useTaskStore.getState().reset();
      return;
    }
    // 查询异常 ≠ 任务失败：任务状态保持不变，仅提示并提供恢复途径
    const message = error instanceof ApiError ? error.message : "查询任务状态失败";
    useTaskStore.getState().setQueryError(message);
  } finally {
    requestInFlight = false;
    if (polling) scheduleNext(POLL_INTERVAL_MS);
  }
}
