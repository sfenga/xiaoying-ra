package com.xiaoying.ra.task;

import com.xiaoying.ra.asset.Asset;
import com.xiaoying.ra.asset.AssetMapper;
import com.xiaoying.ra.asset.AssetService;
import com.xiaoying.ra.auth.User;
import com.xiaoying.ra.common.ApiException;
import com.xiaoying.ra.task.dto.StepView;
import com.xiaoying.ra.task.dto.SubmitTaskRequest;
import com.xiaoying.ra.task.dto.TaskView;
import com.xiaoying.ra.template.Template;
import com.xiaoying.ra.template.TemplateService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.RejectedExecutionException;

/**
 * 制作任务受理与查询（R-04 / R-05 / R-09）：
 * 受理只做参数校验与记录创建，立即返回任务 ID；实际执行交给 TaskRunner 异步完成。
 * 查询只读取持久化状态，绝不推进任务。
 */
@Slf4j
@Service
public class TaskService {

    private final TaskMapper taskMapper;
    private final TaskStepMapper stepMapper;
    private final TemplateService templateService;
    private final AssetService assetService;
    private final AssetMapper assetMapper;
    private final TaskRunner taskRunner;

    public TaskService(TaskMapper taskMapper, TaskStepMapper stepMapper,
                       TemplateService templateService, AssetService assetService,
                       AssetMapper assetMapper, TaskRunner taskRunner) {
        this.taskMapper = taskMapper;
        this.stepMapper = stepMapper;
        this.templateService = templateService;
        this.assetService = assetService;
        this.assetMapper = assetMapper;
        this.taskRunner = taskRunner;
    }

    public Map<String, Object> submit(User user, SubmitTaskRequest request) {
        Template template = templateService.get(request.templateId());
        List<Long> assetIds = new LinkedHashSet<>(request.assetIds()).stream().toList();
        if (assetIds.size() != template.getRequiredImageCount()) {
            throw ApiException.badRequest(String.format("该模板需要 %d 张图片，当前提交 %d 张",
                    template.getRequiredImageCount(), assetIds.size()));
        }
        List<Asset> assets = assetService.loadValidatedForSubmit(user, template, assetIds);

        Task task = new Task();
        task.setId(newTaskId());
        task.setUserId(user.getId());
        task.setTemplateId(template.getId());
        task.setStatus(TaskStatus.PENDING);
        task.setFailStage(SimulationSettings.parseStage(request.failStage()));
        task.setCreatedAt(LocalDateTime.now());
        taskMapper.insert(task);
        for (TaskStage stage : TaskStage.values()) {
            TaskStep step = new TaskStep();
            step.setTaskId(task.getId());
            step.setStep(stage);
            step.setStatus(TaskStep.Status.PENDING);
            stepMapper.insert(step);
        }
        assets.forEach(asset -> assetMapper.bindTask(asset.getId(), task.getId()));

        // 受理完成即返回，不等待执行结束；线程池满则任务落库为失败并返回 503
        try {
            taskRunner.run(task.getId());
        } catch (RejectedExecutionException e) {
            log.warn("任务线程池已满：{}", task.getId());
            taskMapper.markFailed(task.getId(), null, "系统繁忙，任务未能开始执行", LocalDateTime.now());
            throw new ApiException(503, "系统繁忙，请稍后重试");
        }
        return get(user, task.getId());
    }

    public Map<String, Object> get(User user, String taskId) {
        Task task = mustGetOwned(user, taskId);
        List<StepView> steps = stepMapper.findByTaskId(task.getId()).stream().map(StepView::of).toList();
        return Map.of("task", TaskView.of(task), "steps", steps);
    }

    public Map<String, Object> list(User user, List<String> ids, String templateId) {
        if (ids != null && ids.isEmpty()) {
            ids = null;
        }
        List<TaskView> tasks = taskMapper.findByUser(user.getId(), templateId, ids).stream()
                .map(TaskView::of).toList();
        return Map.of("tasks", tasks);
    }

    private Task mustGetOwned(User user, String taskId) {
        Task task = taskMapper.findById(taskId);
        if (task == null || !task.getUserId().equals(user.getId())) {
            throw ApiException.notFound("任务不存在");
        }
        return task;
    }

    private static String newTaskId() {
        return java.util.UUID.randomUUID().toString().replace("-", "");
    }
}
