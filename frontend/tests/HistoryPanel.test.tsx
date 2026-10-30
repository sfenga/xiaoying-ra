import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HistoryPanel from "@/components/HistoryPanel";
import { useTaskStore } from "@/lib/taskStore";

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

afterEach(() => {
  useTaskStore.setState({ queryError: null, tasks: {} });
});

describe("HistoryPanel 查询异常表达（R-07）", () => {
  it("查询异常时展示可恢复提示，并提供立即重试", () => {
    useTaskStore.setState({ queryError: "网络异常，暂时无法连接服务器" });
    render(<HistoryPanel title="历史记录" tasks={[]} loading={false} onRefresh={() => undefined} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("任务查询暂时不可用");
    expect(alert).toHaveTextContent("已有任务状态保持不变");
    expect(screen.getByRole("button", { name: "立即重试" })).toBeInTheDocument();
  });

  it("无查询异常时不渲染提示条", () => {
    useTaskStore.setState({ queryError: null });
    render(<HistoryPanel title="历史记录" tasks={[]} loading={false} onRefresh={() => undefined} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("空记录显示引导文案，加载中显示骨架", () => {
    const { rerender } = render(
      <HistoryPanel title="历史记录" tasks={[]} loading={false} onRefresh={() => undefined} emptyText="该模板还没有制作记录" />
    );
    expect(screen.getByText("该模板还没有制作记录")).toBeInTheDocument();

    rerender(<HistoryPanel title="历史记录" tasks={[]} loading onRefresh={() => undefined} emptyText="该模板还没有制作记录" />);
    expect(screen.getByLabelText("记录加载中")).toBeInTheDocument();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
