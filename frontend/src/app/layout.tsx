import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Header from "@/components/Header";
import Providers from "@/components/Providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "素材工坊 - 模板制作",
  description: "浏览模板、上传图片、提交制作任务，查看历史记录与制作结果",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} min-h-screen antialiased`}>
        <Providers />
        <Header />
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        <footer className="mt-8 border-t border-[#222226] py-6 text-center text-xs text-zinc-500">
          素材工坊 · 全栈笔试演示项目（模拟生成，不调用真实 AI 服务）
        </footer>
      </body>
    </html>
  );
}
