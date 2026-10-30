package com.xiaoying.ra.task;

import lombok.Data;

import java.time.LocalDateTime;

/** 制作任务。stage 表示当前所处阶段，仅在 PROCESSING 及以后有意义。 */
@Data
public class Task {
    private String id;
    private Long userId;
    private String templateId;
    private TaskStatus status;
    private TaskStage stage;
    /** 演示用：该任务提交时注入的固定失败阶段（null 表示不注入） */
    private TaskStage failStage;
    private String failureReason;
    private String resultUrl;
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    /** 关联查询字段：模板标题（便于历史展示） */
    private String templateTitle;
}
