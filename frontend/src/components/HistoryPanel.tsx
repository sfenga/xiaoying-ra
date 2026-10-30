"use client";

import { useMemo } from "react";
import { isTerminal, useTaskStore } from "@/lib/taskStore";
import { startTaskPolling } from "@/lib/taskStore";
import type { TaskView } from "@/lib/types";
import TaskHistoryCard from "@/components/TaskHistoryCard";
import Spinner from "@/components/Spinner";

/** 历史/进行中任务面板（R-08 / R-09）：状态互不串扰，查询异常不影响任务展示。 */
export default function HistoryPanel({
  title,
  tasks,
  loading,
  onRefresh,
  emptyText = "暂无记录，提交第一个制作任务吧",
}: {
  title: string;
  tasks: TaskView[];
  loading: boolean;
  onRefresh: () => void;
  emptyText?: string;
}) {
  const queryError = useTaskStore((s) => s.queryError);
  const hasActive = useMemo(() => tasks.some((t) => !isTerminal(t)), [tasks]);

  return (
    <section aria-label={title} className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">
          {title}
          {hasActive && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-zinc-500">
              <Spinner className="h-3 w-3" /> 自动跟踪中
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="刷新历史记录"
          title="手动刷新"
          className="rounded-lg border border-[#2f2f35] p-2 text-zinc-400 transition-colors hover:border-[#4a4a52] hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9baf62]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {queryError && (
        <div role="alert" className="mb-3 rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-2.5 text-sm text-amber-200">
          任务查询暂时不可用（{queryError}）。已有任务状态保持不变，正在自动恢复查询；
          <button type="button" onClick={() => startTaskPolling()} className="ml-1 underline underline-offset-2 hover:text-amber-100">
            立即重试
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-[#1d1d21]" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2f2f35] px-6 py-14 text-center text-sm text-zinc-500">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskHistoryCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}
