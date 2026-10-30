"use client";

import { useRef } from "react";
import type { AssetView } from "@/lib/types";
import Spinner from "@/components/Spinner";

export interface SlotState {
  asset: AssetView | null;
  uploading: boolean;
  error: string | null;
}

/** 单个上传位（R-03）：选择、预览、替换、移除与上传反馈。 */
export default function UploadSlot({
  slot,
  accept,
  onFile,
  onRemove,
}: {
  slot: SlotState;
  accept: string;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label="选择图片"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ""; // 允许重复选择同一文件
        }}
      />
      {slot.asset ? (
        <div className="group relative overflow-hidden rounded-xl border border-[#2f2f35]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.asset.url} alt={`已上传：${slot.asset.originalName}`} className="aspect-[4/3] w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
            <span className="text-xs text-zinc-200">点击替换</span>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="替换图片"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            title="点击替换"
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`移除图片 ${slot.asset.originalName}`}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm text-zinc-200 transition-colors hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9baf62]"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={slot.uploading}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#3a3a42] bg-[#17171a] text-zinc-400 transition-colors hover:border-[#5a5a64] hover:text-zinc-200 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9baf62]"
          aria-label={slot.uploading ? "上传中" : "点击上传图片"}
        >
          {slot.uploading ? (
            <>
              <Spinner />
              <span className="text-xs">上传中…</span>
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="9" cy="9" r="1.6" />
                <path d="m21 15-4.5-4.5L7 20" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs">点击上传图片</span>
            </>
          )}
        </button>
      )}
      {slot.error && (
        <p role="alert" className="mt-1.5 text-xs text-red-400">
          {slot.error}
        </p>
      )}
    </div>
  );
}
