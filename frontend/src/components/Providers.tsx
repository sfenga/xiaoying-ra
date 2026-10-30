"use client";

import { useEffect } from "react";
import { onUnauthorized } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useTaskStore } from "@/lib/taskStore";

/**
 * 全局会话与数据联动：
 * - 进入应用时按本地 token 恢复登录态
 * - 任何请求返回 401 时统一清理登录态与任务数据（切换用户/会话过期的兜底）
 */
export default function Providers() {
  useEffect(() => {
    void useAuthStore.getState().init();
    const off = onUnauthorized(() => {
      useAuthStore.getState().forceSignOut();
      useTaskStore.getState().reset();
    });
    return off;
  }, []);
  return null;
}
