import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import UploadSlot from "@/components/UploadSlot";
import type { AssetView } from "@/lib/types";

type SlotProps = React.ComponentProps<typeof UploadSlot>;

const baseSlot: SlotProps["slot"] = { asset: null, uploading: false, error: null };

describe("UploadSlot 上传交互（R-03）", () => {
  it("空槽位选择文件后回调 onFile", () => {
    const onFile = vi.fn();
    const onRemove = vi.fn();
    render(<UploadSlot slot={baseSlot} accept="image/png" onFile={onFile} onRemove={onRemove} />);

    const input = screen.getByLabelText("选择图片") as HTMLInputElement;
    const file = new File(["fake-image"], "photo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(file);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("上传中显示进度反馈并禁用再次点击", () => {
    render(
      <UploadSlot slot={{ ...baseSlot, uploading: true }} accept="image/png" onFile={vi.fn()} onRemove={vi.fn()} />
    );
    expect(screen.getByText("上传中…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上传中" })).toBeDisabled();
  });

  it("已上传槽位展示预览、可替换并可移除", () => {
    const onFile = vi.fn();
    const onRemove = vi.fn();
    const asset: AssetView = {
      id: 7,
      originalName: "photo.png",
      mimeType: "image/png",
      sizeBytes: 10,
      url: "/files/202610/abc.png",
    };
    render(<UploadSlot slot={{ ...baseSlot, asset }} accept="image/png" onFile={onFile} onRemove={onRemove} />);

    expect(screen.getByAltText("已上传：photo.png")).toHaveAttribute("src", "/files/202610/abc.png");

    // 移除
    fireEvent.click(screen.getByLabelText("移除图片 photo.png"));
    expect(onRemove).toHaveBeenCalledTimes(1);

    // 替换：点击隐藏的上传位仍会打开文件选择
    fireEvent.click(screen.getByLabelText("替换图片"));
    const input = screen.getByLabelText("选择图片") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "next.png", { type: "image/png" })] } });
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it("槽位错误信息以 alert 呈现", () => {
    render(
      <UploadSlot
        slot={{ ...baseSlot, error: "仅支持 image/png 格式" }}
        accept="image/png"
        onFile={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("仅支持 image/png 格式");
  });
});
