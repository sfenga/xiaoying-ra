package com.xiaoying.ra.task;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 演示用开发调参接口（R-06，可选能力）：运行中查看/调整模拟耗时与全局失败注入。
 * 默认关闭（simulator.dev-api-enabled=false），演示环境可通过配置/compose 打开；
 * 该接口不要求登录，仅用于脚本与评审演示，正式部署应保持关闭。
 */
@Slf4j
@RestController
@RequestMapping("/api/dev")
@ConditionalOnProperty(name = "simulator.dev-api-enabled", havingValue = "true", matchIfMissing = false)
public class DevController {

    private final SimulationSettings settings;

    public DevController(SimulationSettings settings) {
        this.settings = settings;
    }

    @GetMapping("/simulation")
    public Map<String, Object> get() {
        return view();
    }

    @PutMapping("/simulation")
    public Map<String, Object> update(@RequestBody SimulationUpdateRequest request) {
        settings.update(
                request.durations() == null ? null : request.durations().assetCheckMs(),
                request.durations() == null ? null : request.durations().generateMs(),
                request.durations() == null ? null : request.durations().finalizeMs(),
                request.failStage());
        log.info("模拟配置已更新：asset-check={}ms generate={}ms finalize={}ms fail-stage={}",
                settings.durationOf(TaskStage.ASSET_CHECK),
                settings.durationOf(TaskStage.GENERATE),
                settings.durationOf(TaskStage.FINALIZE),
                settings.getFailStage() == null ? "NONE" : settings.getFailStage());
        return view();
    }

    private Map<String, Object> view() {
        Map<String, Long> durations = new LinkedHashMap<>();
        durations.put("assetCheckMs", settings.durationOf(TaskStage.ASSET_CHECK));
        durations.put("generateMs", settings.durationOf(TaskStage.GENERATE));
        durations.put("finalizeMs", settings.durationOf(TaskStage.FINALIZE));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("failStage", settings.getFailStage() == null ? "NONE" : settings.getFailStage().name());
        body.put("durations", durations);
        return body;
    }

    public record SimulationUpdateRequest(String failStage, Durations durations) {
        public record Durations(Long assetCheckMs, Long generateMs, Long finalizeMs) {
        }
    }
}
