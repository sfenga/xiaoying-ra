"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { TASK_STAGE_LABELS } from "@/lib/types";
import type { StepView, TaskView } from "@/lib/types";
import Spinner from "@/components/Spinner";

/** 历史/进行中任务卡片：状态、阶段、失败原因、成功结果预览。 */
export default function TaskHistoryCard({ task }: { task: TaskView }) {
  const [steps, setSteps] = useState<StepView[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const toggleSteps = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (steps === null && stepsError === null) {
      try {
        const res = await api<{ steps: StepView[] }>(`/api/tasks/${task.id}`);
        setSteps(res.steps);
      } catch (err) {
        setStepsError(err instanceof Error ? err.message : "加载步骤失败");
      }
    }
    setExpanded(true);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#2a2a30] bg-[#1a1a1e]" data-task-id={task.id}>
      <div className="relative flex min-h-[9rem] flex-1 items-center justify-center p-3">
        {task.status === "SUCCESS" && task.resultUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={task.resultUrl}
              alt={`${task.templateTitle ?? "任务"} 的制作结果`}
              className="max-h-56 w-full rounded-lg object-contain"
            />
            <span className="absolute right-2 top-2 rounded-full bg-[#3f5228]/90 px-2 py-0.5 text-xs text-[#d3e6a3]">
              ✓ 完成
            </span>
          </>
        ) : task.status === "FAILED" ? (
          <div className="px-3 text-center">
            <p className="text-sm font-medium text-red-400">制作失败</p>
            <p className="mt-1.5 break-all text-xs leading-relaxed text-red-300/90">{task.failureReason ?? "未知原因"}</p>
            {task.stage && <p className="mt-1.5 text-xs text-zinc-500">失败阶段：{TASK_STAGE_LABELS[task.stage]}</p>}
          </div>
        ) : (
          <div className="text-center">
            <Spinner />
            <p className="mt-3 text-sm text-zinc-300">
              {task.status === "PENDING" ? "等待处理…" : `处理中 · ${task.stage ? TASK_STAGE_LABELS[task.stage] : "准备中"}`}
            </p>
            {task.status === "PROCESSING" && task.stage && (
              <div className="mt-3 flex items-center justify-center gap-1" aria-label={`当前阶段：${TASK_STAGE_LABELS[task.stage]}`}>
                {(["ASSET_CHECK", "GENERATE", "FINALIZE"] as const).map((stage, i) => {
                  const currentIndex = ["ASSET_CHECK", "GENERATE", "FINALIZE"].indexOf(task.stage!);
                  const done = i < currentIndex;
                  const current = i === currentIndex;
                  return (
                    <span
                      key={stage}
                      className={`h-1.5 w-8 rounded-full ${
                        done ? "bg-[#9baf62]" : current ? "bg-[#9baf62]/60" : "bg-zinc-700"
                      }`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#26262b] px-3 py-2 text-xs text-zinc-500">
        <span title={task.id}>{task.templateTitle ?? task.templateId} · {formatDateTime(task.createdAt)}</span>
        <button
          type="button"
          onClick={toggleSteps}
          aria-expanded={expanded}
          className="rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:bg-[#26262b] hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9baf62]"
        >
          {expanded ? "收起步骤" : "执行明细"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[#26262b] px-3 py-2 text-xs">
          {stepsError ? (
            <p className="text-red-300">{stepsError}</p>
          ) : steps === null ? (
            <p className="flex items-center gap-2 text-zinc-500">
              <Spinner className="h-3 w-3" /> 加载执行明细…
            </p>
          ) : (
            <ol className="space-y-1.5">
              {steps.map((step) => (
                <li key={step.step} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                      step.status === "SUCCESS"
                        ? "bg-[#9baf62]"
                        : step.status === "FAILED"
                          ? "bg-red-500"
                          : step.status === "RUNNING"
                            ? "animate-pulse bg-amber-400"
                            : "bg-zinc-600"
                    }`}
                  />
                  <span className="text-zinc-400">
                    <span className="text-zinc-300">{TASK_STAGE_LABELS[step.step]}</span>
                    <span className="ml-1.5 text-zinc-600">
                      {step.status === "PENDING" ? "等待" : step.status === "RUNNING" ? "执行中" : step.status === "SUCCESS" ? "完成" : "失败"}
                    </span>
                    {step.message && <span className="ml-1.5 text-zinc-500">{step.message}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
