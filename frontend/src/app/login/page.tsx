"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import Spinner from "@/components/Spinner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 仅允许站内相对路径回跳，避免开放重定向
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const guest = useAuthStore((s) => s.guest);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToRedirectTarget = () => router.replace(redirect);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, displayName.trim() || undefined);
      }
      goToRedirectTarget();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuest = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await guest();
      goToRedirectTarget();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-10 w-full max-w-sm rounded-2xl border border-[#2a2a30] bg-[#1a1a1e] p-6">
      <h1 className="text-lg font-semibold text-zinc-100">{mode === "login" ? "登录" : "注册"}</h1>
      <p className="mt-1 text-xs text-zinc-500">演示项目 · 用户数据保存在本地数据库</p>

      <div className="mt-4 flex rounded-lg bg-[#141416] p-1 text-sm" role="tablist" aria-label="登录或注册">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-md py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9baf62] ${
              mode === m ? "bg-[#2c2c32] font-medium text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {m === "login" ? "登录" : "注册"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="username" className="mb-1 block text-xs text-zinc-400">
            用户名
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="w-full rounded-lg border border-[#2f2f35] bg-[#141416] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#9baf62] focus:outline-none"
            placeholder="3-32 位字母、数字或下划线"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-xs text-zinc-400">
            密码
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            className="w-full rounded-lg border border-[#2f2f35] bg-[#141416] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#9baf62] focus:outline-none"
            placeholder="至少 6 位"
          />
        </div>
        {mode === "register" && (
          <div>
            <label htmlFor="displayName" className="mb-1 block text-xs text-zinc-400">
              昵称（可选）
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-[#2f2f35] bg-[#141416] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-[#9baf62] focus:outline-none"
              placeholder="展示名称"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-red-950/50 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#9baf62] py-2 text-sm font-medium text-[#17170f] transition-colors hover:bg-[#8a9c52] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c6d894]"
        >
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-zinc-600">
        <span className="h-px flex-1 bg-[#2a2a30]" />
        或
        <span className="h-px flex-1 bg-[#2a2a30]" />
      </div>

      <button
        type="button"
        onClick={handleGuest}
        disabled={submitting}
        className="w-full rounded-lg border border-[#2f2f35] py-2 text-sm text-zinc-300 transition-colors hover:border-[#4a4a52] hover:text-zinc-100 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9baf62]"
      >
        一键游客登录
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mt-10 text-center text-zinc-500">加载中…</div>}>
      <LoginForm />
    </Suspense>
  );
}
