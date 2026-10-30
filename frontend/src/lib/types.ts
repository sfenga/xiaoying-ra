export type TaskStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
export type TaskStage = "ASSET_CHECK" | "GENERATE" | "FINALIZE";

export interface UserView {
  id: number;
  username: string;
  displayName: string;
  guest: boolean;
  createdAt: string;
}

export interface TemplateView {
  id: string;
  title: string;
  category: string;
  description: string;
  coverUrl: string;
  requiredImageCount: number;
  acceptedMimeTypes: string[];
  maxFileSizeBytes: number;
}

export interface AssetView {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface TaskView {
  id: string;
  templateId: string;
  templateTitle: string | null;
  status: TaskStatus;
  stage: TaskStage | null;
  failureReason: string | null;
  resultUrl: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface StepView {
  step: TaskStage;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface SimulationConfig {
  failStage: string;
  durations: { assetCheckMs: number; generateMs: number; finalizeMs: number };
}

export const TASK_STAGE_LABELS: Record<TaskStage, string> = {
  ASSET_CHECK: "素材检查",
  GENERATE: "模拟生成",
  FINALIZE: "结果整理",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "等待处理",
  PROCESSING: "处理中",
  SUCCESS: "成功",
  FAILED: "失败",
};
