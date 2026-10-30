import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TaskHistoryCard from "@/components/TaskHistoryCard";
import type { TaskView } from "@/lib/types";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    api: vi.fn(),
    onUnauthorized: vi.fn(() => () => undefined),
  };
});

function makeTask(partial: Partial<TaskView> & { id: string }): TaskView {
  return {
    templateId: "demo-postcard",
    templateTitle: "旅行明信片",
    status: "PROCESSING",
    stage: "GENERATE",
    failureReason: null,
    resultUrl: null,
    createdAt: "2026-10-30T10:00:00",
    startedAt: "2026-10-30T10:00:01",
    finishedAt: null,
    ...partial,
  };
}

describe("TaskHistoryCard 状态表达（R-07）", () => {
  it("等待中的任务显示等待处理", () => {
    render(<TaskHistoryCard task={makeTask({ id: "c1", status: "PENDING", stage: null })} />);
    expect(screen.getByText("等待处理…")).toBeInTheDocument();
  });

  it("处理中的任务显示当前阶段与进度指示", () => {
    render(<TaskHistoryCard task={makeTask({ id: "c2", status: "PROCESSING", stage: "GENERATE" })} />);
    expect(screen.getByText(/处理中/)).toBeInTheDocument();
    expect(screen.getByText(/模拟生成/)).toBeInTheDocument();
    expect(screen.getByLabelText("当前阶段：模拟生成")).toBeInTheDocument();
  });

  it("失败任务显示失败原因与失败阶段", () => {
    render(
      <TaskHistoryCard
        task={makeTask({
          id: "c3",
          status: "FAILED",
          stage: "GENERATE",
          failureReason: "模拟失败注入：任务在「模拟生成」阶段被标记为失败",
        })}
      />
    );
    expect(screen.getByText("制作失败")).toBeInTheDocument();
    expect(screen.getByText(/模拟失败注入/)).toBeInTheDocument();
    expect(screen.getByText(/失败阶段：模拟生成/)).toBeInTheDocument();
  });

  it("成功任务展示结果图片预览", () => {
    render(<TaskHistoryCard task={makeTask({ id: "c4", status: "SUCCESS", stage: "FINALIZE", resultUrl: "/demo/results/a.png" })} />);
    const img = screen.getByAltText(/制作结果/);
    expect(img).toHaveAttribute("src", "/demo/results/a.png");
  });
});
