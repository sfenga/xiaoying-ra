"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { useTaskStore } from "@/lib/taskStore";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    // 切换用户：清理本地任务数据与轮询订阅
    useTaskStore.getState().reset();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#26262b] bg-[#141416]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold text-zinc-50">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#9baf62] text-sm font-bold text-[#17170f]">
              素
            </span>
            素材工坊
          </Link>
          <nav className="flex items-center gap-3 text-sm text-zinc-400 sm:gap-4" aria-label="主导航">
            <Link href="/" className="transition-colors hover:text-zinc-100">
              模板
            </Link>
            <Link href="/history" className="transition-colors hover:text-zinc-100">
              我的记录
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm sm:gap-3">
          {user ? (
            <>
              <span className="hidden text-zinc-300 sm:inline" title={user.username}>
                {user.displayName}
                {user.guest && <span className="ml-1 rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">游客</span>}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-[#2f2f35] px-2.5 py-1.5 text-zinc-300 transition-colors hover:border-[#4a4a52] hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9baf62] sm:px-3"
              >
                退出
              </button>
            </>
          ) : (
            <Link
              href={pathname === "/login" ? "/login" : `/login?redirect=${encodeURIComponent(pathname ?? "/")}`}
              className="rounded-lg bg-[#9baf62] px-4 py-1.5 font-medium text-[#17170f] transition-colors hover:bg-[#8a9c52] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c6d894]"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
