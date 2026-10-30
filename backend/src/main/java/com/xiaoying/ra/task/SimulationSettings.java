package com.xiaoying.ra.task;

import com.xiaoying.ra.common.ApiException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 模拟生成器的运行时可变配置（R-06）：
 * - 每个阶段的模拟耗时（毫秒）
 * - 全局失败注入阶段；单个任务可在提交时用 failStage 覆盖
 * 通过 /api/dev/simulation 可在运行中调整，便于演示。
 */
@Slf4j
@Component
public class SimulationSettings {

    @Value("${simulator.asset-check-ms}")
    private long assetCheckMsInit;
    @Value("${simulator.generate-ms}")
    private long generateMsInit;
    @Value("${simulator.finalize-ms}")
    private long finalizeMsInit;
    @Value("${simulator.fail-stage}")
    private String failStageInit;

    private volatile long assetCheckMs;
    private volatile long generateMs;
    private volatile long finalizeMs;
    private volatile TaskStage failStage;

    @PostConstruct
    void init() {
        assetCheckMs = clamp(assetCheckMsInit);
        generateMs = clamp(generateMsInit);
        finalizeMs = clamp(finalizeMsInit);
        failStage = parseStage(failStageInit);
        log.info("模拟器配置：asset-check={}ms, generate={}ms, finalize={}ms, fail-stage={}",
                assetCheckMs, generateMs, finalizeMs, failStage == null ? "NONE" : failStage);
    }

    public long durationOf(TaskStage stage) {
        return switch (stage) {
            case ASSET_CHECK -> assetCheckMs;
            case GENERATE -> generateMs;
            case FINALIZE -> finalizeMs;
        };
    }

    public TaskStage getFailStage() {
        return failStage;
    }

    /** failStage 传 null 表示不修改当前注入设置；"NONE" 表示清除注入。 */
    public void update(Long assetCheckMs, Long generateMs, Long finalizeMs, String failStage) {
        if (assetCheckMs != null) this.assetCheckMs = clamp(assetCheckMs);
        if (generateMs != null) this.generateMs = clamp(generateMs);
        if (finalizeMs != null) this.finalizeMs = clamp(finalizeMs);
        if (failStage != null) this.failStage = parseStage(failStage);
    }

    /** 解析失败阶段参数：null/空白/NONE → 不注入；非法值 → 400。 */
    public static TaskStage parseStage(String value) {
        if (value == null || value.isBlank() || "NONE".equalsIgnoreCase(value.trim())) {
            return null;
        }
        try {
            return TaskStage.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("无效的失败阶段：" + value + "，可选 NONE/ASSET_CHECK/GENERATE/FINALIZE");
        }
    }

    private static long clamp(long ms) {
        return Math.max(0, Math.min(ms, 5 * 60 * 1000));
    }
}
