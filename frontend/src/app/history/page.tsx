"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { isTerminal, startTaskPolling, useTaskStore } from "@/lib/taskStore";
import type { TaskView } from "@/lib/types";
import HistoryPanel from "@/components/HistoryPanel";
import AuthGate from "@/components/AuthGate";
import { useTaskPollingLifecycle } from "@/hooks/useTaskPollingLifecycle";

function HistoryContent() {
  const allTasks = useTaskStore((s) => s.tasks);
  const upsertMany = useTaskStore((s) => s.upsertMany);
  const [loading, setLoading] = useState(true);

  useTaskPollingLifecycle();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ tasks: TaskView[] }>("/api/tasks");
      upsertMany(res.tasks);
      // 刷新恢复（R-09）：未结束任务继续自动跟踪
      if (res.tasks.some((t) => !isTerminal(t))) {
        startTaskPolling();
      }
    } catch {
      // 查询异常由全局 queryError 呈现
    } finally {
      setLoading(false);
    }
  }, [upsertMany]);

  useEffect(() => {
    void load();
  }, [load]);

  const tasks = useMemo(
    () => Object.values(allTasks).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [allTasks]
  );

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-100">我的制作记录</h1>
      <HistoryPanel title="全部记录" tasks={tasks} loading={loading} onRefresh={() => void load()} />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AuthGate>
      <HistoryContent />
    </AuthGate>
  );
}
