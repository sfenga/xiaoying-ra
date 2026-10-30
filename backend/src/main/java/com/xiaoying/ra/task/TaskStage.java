package com.xiaoying.ra.task;

/** 制作任务的执行阶段（R-05）：素材检查 → 模拟生成 → 结果整理。 */
public enum TaskStage {
    ASSET_CHECK, GENERATE, FINALIZE;

    public String label() {
        return switch (this) {
            case ASSET_CHECK -> "素材检查";
            case GENERATE -> "模拟生成";
            case FINALIZE -> "结果整理";
        };
    }
}
