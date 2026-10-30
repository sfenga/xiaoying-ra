package com.xiaoying.ra.task.dto;

import com.xiaoying.ra.task.TaskStep;

import java.time.LocalDateTime;

public record StepView(String step, String status, String message, LocalDateTime startedAt, LocalDateTime finishedAt) {
    public static StepView of(TaskStep step) {
        return new StepView(step.getStep() == null ? null : step.getStep().name(),
                step.getStatus() == null ? null : step.getStatus().name(),
                step.getMessage(), step.getStartedAt(), step.getFinishedAt());
    }
}
