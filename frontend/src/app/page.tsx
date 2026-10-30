"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TemplateView } from "@/lib/types";
import TemplateCard from "@/components/TemplateCard";
import ErrorBanner from "@/components/ErrorBanner";

export default function TemplateListPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("全部");
  const [templates, setTemplates] = useState<TemplateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (currentCategory: string) => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, tplRes] = await Promise.all([
        api<{ categories: string[] }>("/api/templates/categories"),
        api<{ templates: TemplateView[] }>(
          currentCategory === "全部"
            ? "/api/templates"
            : `/api/templates?category=${encodeURIComponent(currentCategory)}`
        ),
      ]);
      setCategories(catRes.categories);
      setTemplates(tplRes.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载模板失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(category);
  }, [category, load]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-100">模板列表</h1>

      {/* 分类筛选 */}
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="模板分类">
        {["全部", ...categories].map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9baf62] ${
              category === c
                ? "bg-zinc-100 font-medium text-zinc-900"
                : "bg-[#1d1d21] text-zinc-300 hover:bg-[#26262b]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} onRetry={() => load(category)} />

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-busy="true" aria-label="模板加载中">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-[#1d1d21]" />
          ))}
        </div>
      ) : templates.length === 0 && !error ? (
        <div className="rounded-xl border border-[#2a2a30] bg-[#1a1a1e] px-6 py-16 text-center text-zinc-400">
          该分类下暂无模板
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}
