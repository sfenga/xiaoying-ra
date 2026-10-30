package com.xiaoying.ra.task;

import com.xiaoying.ra.asset.Asset;
import com.xiaoying.ra.asset.AssetMapper;
import com.xiaoying.ra.asset.AssetService;
import com.xiaoying.ra.template.Template;
import com.xiaoying.ra.template.TemplateMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Supplier;

/**
 * 后台任务执行器（R-04 / R-05 / R-06）：
 * 按顺序执行 素材检查 → 模拟生成 → 结果整理 三个阶段。
 * 每个阶段都有独立的执行边界：先把步骤标记为 RUNNING，模拟耗时后写回 SUCCESS/FAILED，
 * 全过程状态持久化到 MySQL，前端查询只读取这些记录。
 * 某一步失败（注入或真实异常）后立即停止，不执行后续步骤。
 */
@Slf4j
@Component
public class TaskRunner {

    private final TaskMapper taskMapper;
    private final TaskStepMapper stepMapper;
    private final AssetMapper assetMapper;
    private final AssetService assetService;
    private final TemplateMapper templateMapper;
    private final SimulationSettings settings;

    public TaskRunner(TaskMapper taskMapper, TaskStepMapper stepMapper, AssetMapper assetMapper,
                      AssetService assetService, TemplateMapper templateMapper, SimulationSettings settings) {
        this.taskMapper = taskMapper;
        this.stepMapper = stepMapper;
        this.assetMapper = assetMapper;
        this.assetService = assetService;
        this.templateMapper = templateMapper;
        this.settings = settings;
    }

    @Async("taskExecutor")
    public void run(String taskId) {
        Task task = taskMapper.findById(taskId);
        if (task == null || task.getStatus() != TaskStatus.PENDING) {
            return;
        }
        taskMapper.markProcessing(taskId, TaskStage.ASSET_CHECK, LocalDateTime.now());
        log.info("任务开始处理：{}", taskId);
        try {
            if (!runStep(task, TaskStage.ASSET_CHECK, () -> checkAssets(task))) {
                return;
            }
            if (!runStep(task, TaskStage.GENERATE, () -> "模拟生成完成，已选取输出样式")) {
                return;
            }
            if (!runStep(task, TaskStage.FINALIZE, () -> "结果整理完成，可预览")) {
                return;
            }
            String resultUrl = pickResultUrl(task);
            taskMapper.markSuccess(taskId, resultUrl, LocalDateTime.now());
            log.info("任务处理成功：{} -> {}", taskId, resultUrl);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            taskMapper.markFailed(taskId, currentStage(taskId), "任务处理被中断（服务关闭）", LocalDateTime.now());
            log.warn("任务被中断：{}", taskId);
        } catch (Exception e) {
            log.error("任务执行异常：{}", taskId, e);
            taskMapper.markFailed(taskId, currentStage(taskId), "系统内部错误：" + e.getMessage(), LocalDateTime.now());
        }
    }

    /** 执行单个阶段：RUNNING → 模拟耗时 →（注入检查）→ 真实动作 → SUCCESS / FAILED。 */
    private boolean runStep(Task task, TaskStage stage, Supplier<String> action) throws InterruptedException {
        TaskStep step = stepMapper.findByTaskIdAndStep(task.getId(), stage);
        if (step == null) {
            throw new IllegalStateException("缺少步骤记录：" + stage);
        }
        taskMapper.updateStage(task.getId(), stage);
        stepMapper.markRunning(step.getId(), LocalDateTime.now());
        log.info("任务 {} 进入阶段 {}（模拟耗时 {}ms）", task.getId(), stage, settings.durationOf(stage));

        Thread.sleep(settings.durationOf(stage));

        // 注入失败：任务级 failStage 优先于全局配置
        TaskStage injected = task.getFailStage() != null ? task.getFailStage() : settings.getFailStage();
        if (injected == stage) {            String reason = "模拟失败注入：任务在「" + stage.label() + "」阶段被标记为失败";
            stepMapper.markFailed(step.getId(), reason, LocalDateTime.now());
            taskMapper.markFailed(task.getId(), stage, reason, LocalDateTime.now());
            log.info("任务 {} 在阶段 {} 注入失败", task.getId(), stage);
            return false;
        }
        try {
            String message = action.get();
            stepMapper.markSuccess(step.getId(), message, LocalDateTime.now());
            return true;
        } catch (Exception e) {
            String reason = stage.label() + "失败：" + e.getMessage();
            stepMapper.markFailed(step.getId(), reason, LocalDateTime.now());
            taskMapper.markFailed(task.getId(), stage, reason, LocalDateTime.now());
            log.info("任务 {} 在阶段 {} 真实失败：{}", task.getId(), stage, e.getMessage());
            return false;
        }
    }

    private String checkAssets(Task task) {
        List<Asset> assets = assetMapper.findByTaskId(task.getId());
        if (assets.isEmpty()) {
            throw new IllegalStateException("未找到任务关联的素材");
        }
        for (Asset asset : assets) {
            if (!assetService.fileExists(asset)) {
                throw new IllegalStateException("素材文件缺失：" + asset.getOriginalName());
            }
        }
        return "素材检查通过（共 " + assets.size() + " 张图片）";
    }

    private String pickResultUrl(Task task) {
        Template template = templateMapper.findById(task.getTemplateId());
        List<String> urls = template == null ? List.of() : template.resultList();
        if (urls.isEmpty()) {
            return null;
        }
        return urls.get(Math.floorMod(task.getId().hashCode(), urls.size()));
    }

    private TaskStage currentStage(String taskId) {
        Task task = taskMapper.findById(taskId);
        return task == null ? null : task.getStage();
    }
}
