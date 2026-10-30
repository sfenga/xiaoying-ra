package com.xiaoying.ra.task.dto;

import com.xiaoying.ra.task.Task;

import java.time.LocalDateTime;

public record TaskView(String id, String templateId, String templateTitle, String status, String stage,
                       String failureReason, String resultUrl, LocalDateTime createdAt,
                       LocalDateTime startedAt, LocalDateTime finishedAt) {
    public static TaskView of(Task task) {
        return new TaskView(task.getId(), task.getTemplateId(), task.getTemplateTitle(),
                task.getStatus() == null ? null : task.getStatus().name(),
                task.getStage() == null ? null : task.getStage().name(),
                task.getFailureReason(), task.getResultUrl(),
                task.getCreatedAt(), task.getStartedAt(), task.getFinishedAt());
    }
}
