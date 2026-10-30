"use client";

import { create } from "zustand";
import { api } from "./api";
import { getToken, setToken } from "./token";
import type { UserView } from "./types";

interface AuthState {
  user: UserView | null;
  /** 首次进入时根据本地 token 恢复登录态 */
  initializing: boolean;
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  guest: () => Promise<void>;
  logout: () => Promise<void>;
  /** 供其它模块在 401 时通知登录态失效 */
  forceSignOut: () => void;
}

async function authRequest(path: string, body?: unknown): Promise<{ token: string; user: UserView }> {
  return api<{ token: string; user: UserView }>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initializing: false,

  init: async () => {
    if (!getToken() || get().user) return;
    set({ initializing: true });
    try {
      const user = await api<UserView>("/api/auth/me");
      set({ user });
    } catch {
      setToken(null);
      set({ user: null });
    } finally {
      set({ initializing: false });
    }
  },

  login: async (username, password) => {
    const res = await authRequest("/api/auth/login", { username, password });
    setToken(res.token);
    set({ user: res.user });
  },

  register: async (username, password, displayName) => {
    const res = await authRequest("/api/auth/register", { username, password, displayName });
    setToken(res.token);
    set({ user: res.user });
  },

  guest: async () => {
    const res = await authRequest("/api/auth/guest");
    setToken(res.token);
    set({ user: res.user });
  },

  logout: async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // 登出接口失败也不影响本地登出
    }
    setToken(null);
    set({ user: null });
  },

  forceSignOut: () => {
    setToken(null);
    set({ user: null });
  },
}));
