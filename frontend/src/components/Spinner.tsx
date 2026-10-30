"use client";

export default function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      className={`inline-block ${className} animate-spin rounded-full border-2 border-zinc-500 border-t-transparent`}
      role="presentation"
    />
  );
}
