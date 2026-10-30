"use client";

import { useEffect } from "react";
import { releaseTaskPolling, startTaskPolling } from "@/lib/taskStore";

/** 页面挂载期间启用任务轮询，卸载时自动释放（最后一个使用者离开即停止轮询）。 */
export function useTaskPollingLifecycle(): void {
  useEffect(() => {
    startTaskPolling();
    return () => {
      releaseTaskPolling();
    };
  }, []);
}
