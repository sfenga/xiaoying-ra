"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import type { ReactNode } from "react";

/** 需要登录的页面在未登录时给出可理解的提示与快捷入口（R-10），登录后回到原页面。 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);

  if (initializing) {
    return <div className="py-16 text-center text-sm text-zinc-500">正在恢复登录状态…</div>;
  }
  if (!user) {
    const loginHref = `/login?redirect=${encodeURIComponent(pathname ?? "/")}`;
    return (
      <div className="mx-auto mt-8 max-w-md rounded-xl border border-[#2a2a30] bg-[#1a1a1e] px-6 py-12 text-center">
        <p className="text-zinc-200">请先登录后使用该功能</p>
        <p className="mt-1 text-xs text-zinc-500">任务与历史记录按用户隔离；可一键创建游客账号体验</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href={loginHref}
            className="rounded-lg bg-[#9baf62] px-4 py-2 text-sm font-medium text-[#17170f] transition-colors hover:bg-[#8a9c52]"
          >
            去登录
          </Link>
          {/* 游客登录成功后直接回到当前页（而非登录页） */}
          <GuestButton redirect={pathname ?? "/"} />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function GuestButton({ redirect }: { redirect: string }) {
  const router = useRouter();
  const guest = useAuthStore((s) => s.guest);
  return (
    <button
      type="button"
      onClick={async () => {
        await guest();
        router.replace(redirect);
      }}
      className="rounded-lg border border-[#2f2f35] px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-[#4a4a52] hover:text-zinc-100"
    >
      一键游客登录
    </button>
  );
}
