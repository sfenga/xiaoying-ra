package com.xiaoying.ra.task;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 启动清扫：服务重启后，把仍处于 PENDING/PROCESSING 的任务标记为失败。
 * 当前版本明确不实现断点续跑（题目允许，README 中说明取舍）；
 * 若不清理，这些任务会永远停留在处理中，误导前端持续轮询。
 */
@Slf4j
@Component
public class RestartSweeper {

    private final TaskMapper taskMapper;
    private final TaskStepMapper stepMapper;

    public RestartSweeper(TaskMapper taskMapper, TaskStepMapper stepMapper) {
        this.taskMapper = taskMapper;
        this.stepMapper = stepMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void sweep() {
        List<Task> active = taskMapper.findActiveTasks();
        if (active.isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (Task task : active) {
            taskMapper.markFailed(task.getId(), task.getStage(),
                    "服务重启导致任务中断（当前版本未实现断点恢复）", now);
            stepMapper.findByTaskId(task.getId()).stream()
                    .filter(s -> s.getStatus() != TaskStep.Status.SUCCESS
                            && s.getStatus() != TaskStep.Status.FAILED)
                    .forEach(s -> stepMapper.markFailed(s.getId(), "任务因服务重启中断", now));
        }
        log.warn("启动清扫：{} 个未完成任务已标记为失败", active.size());
    }
}
