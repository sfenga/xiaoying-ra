package com.xiaoying.ra.task;

import lombok.Data;

import java.time.LocalDateTime;

/** 任务的分步执行记录：每一步有独立的 PENDING/RUNNING/SUCCESS/FAILED 边界。 */
@Data
public class TaskStep {
    public enum Status { PENDING, RUNNING, SUCCESS, FAILED }

    private Long id;
    private String taskId;
    private TaskStage step;
    private Status status;
    private String message;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
}
