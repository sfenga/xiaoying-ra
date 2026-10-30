"use client";

import Link from "next/link";
import type { TemplateView } from "@/lib/types";

export default function TemplateCard({ template }: { template: TemplateView }) {
  return (
    <Link
      href={`/templates/${template.id}`}
      className="group relative block overflow-hidden rounded-xl border border-[#2a2a30] bg-[#1a1a1e] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9baf62]"
      aria-label={`模板：${template.title}，需要 ${template.requiredImageCount} 张图片`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={template.coverUrl}
        alt={`${template.title} 封面`}
        className="aspect-[4/5] w-full object-cover transition-opacity group-hover:opacity-90"
        loading="lazy"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8">
        <p className="truncate text-sm font-medium text-zinc-50">{template.title}</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          {template.category} · 需 {template.requiredImageCount} 张图片
        </p>
      </div>
    </Link>
  );
}
