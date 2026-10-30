package com.xiaoying.ra.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * 提交制作任务请求。
 * failStage 为演示用可选字段：指定该任务在哪个阶段模拟失败（ASSET_CHECK/GENERATE/FINALIZE），
 * 不传或 NONE 表示正常执行。正式页面不使用该字段。
 */
public record SubmitTaskRequest(
        @NotBlank(message = "templateId 不能为空") String templateId,
        @NotEmpty(message = "assetIds 不能为空") List<Long> assetIds,
        String failStage) {
}
