package com.xiaoying.ra.task;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 核心行为测试（R-12）：任务受理 → 三步顺序执行 → 失败中断 → 查询语义。
 * 使用 H2 MySQL 兼容模式运行完整 Spring 上下文。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskFlowIntegrationTest {

    private static final byte[] PNG_HEAD = new byte[]{
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52};

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper om;
    @Autowired
    private TaskMapper taskMapper;
    @Autowired
    private TaskStepMapper stepMapper;
    @Autowired
    private RestartSweeper sweeper;

    private final AtomicInteger seq = new AtomicInteger();

    // ---------- helpers ----------

    /** MockMvc 默认按 ISO-8859-1 读取响应体，统一改用 UTF-8。 */
    private static String body(MvcResult result) throws java.io.UnsupportedEncodingException {
        return result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
    }

    private String registerAndGetToken() throws Exception {
        String username = "user_" + System.nanoTime() + "_" + seq.incrementAndGet();
        MvcResult result = mvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("{\"username\":\"" + username + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return om.readTree(body(result)).get("token").asText();
    }

    private long uploadAsset(String token, String templateId, String filename, byte[] bytes) throws Exception {
        MvcResult result = mvc.perform(multipart("/api/assets")
                        .file(new MockMultipartFile("file", filename, "image/png", bytes))
                        .param("templateId", templateId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        return om.readTree(body(result)).get("id").asLong();
    }

    private JsonNode submitTask(String token, String templateId, List<Long> assetIds, String failStage) throws Exception {
        StringBuilder bodyJson = new StringBuilder("{\"templateId\":\"" + templateId + "\",\"assetIds\":[");
        for (int i = 0; i < assetIds.size(); i++) {
            bodyJson.append(i > 0 ? "," : "").append(assetIds.get(i));
        }
        bodyJson.append("]");
        if (failStage != null) {
            bodyJson.append(",\"failStage\":\"").append(failStage).append("\"");
        }
        bodyJson.append("}");
        MvcResult result = mvc.perform(post("/api/tasks")
                        .contentType("application/json").content(bodyJson.toString())
                        .header("Authorization", "Bearer " + token))
                .andReturn();
        assertThat(result.getResponse().getStatus())
                .as("提交任务应返回 201：%s", body(result))
                .isEqualTo(201);
        return om.readTree(body(result));
    }

    private JsonNode getTask(String token, String taskId) throws Exception {
        MvcResult result = mvc.perform(get("/api/tasks/" + taskId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return om.readTree(body(result));
    }

    private JsonNode awaitStatus(String token, String taskId, String expectedStatus) {
        Awaitility.await().atMost(Duration.ofSeconds(15)).pollInterval(Duration.ofMillis(100))
                .until(() -> {
                    try {
                        return getTask(token, taskId).get("task").get("status").asText().equals(expectedStatus);
                    } catch (Exception e) {
                        return false;
                    }
                });
        try {
            return getTask(token, taskId);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // ---------- tests ----------

    @Test
    void taskRunsThreeStepsInOrderAndSucceeds() throws Exception {
        String token = registerAndGetToken();
        long a1 = uploadAsset(token, "demo-postcard", "photo1.png", pngBytes());
        long a2 = uploadAsset(token, "demo-postcard", "photo2.png", pngBytes());

        JsonNode submitted = submitTask(token, "demo-postcard", List.of(a1, a2), null);
        String taskId = submitted.get("task").get("id").asText();
        // 受理即返回：立即处于非终态（PENDING 或已被异步线程标记为 PROCESSING），且已有 3 条步骤记录
        assertThat(submitted.get("task").get("status").asText()).isIn("PENDING", "PROCESSING");
        assertThat(submitted.get("steps")).hasSize(3);
        assertThat(submitted.get("task").get("resultUrl").isNull()).isTrue();

        JsonNode done = awaitStatus(token, taskId, "SUCCESS");
        JsonNode task = done.get("task");
        assertThat(task.get("status").asText()).isEqualTo("SUCCESS");
        assertThat(task.get("stage").asText()).isEqualTo("FINALIZE");
        assertThat(task.get("resultUrl").asText()).startsWith("/demo/results/");
        assertThat(task.get("finishedAt").isNull()).isFalse();

        JsonNode steps = done.get("steps");
        assertThat(steps).hasSize(3);
        String[] expected = {"ASSET_CHECK", "GENERATE", "FINALIZE"};
        for (int i = 0; i < 3; i++) {
            assertThat(steps.get(i).get("step").asText()).isEqualTo(expected[i]);
            assertThat(steps.get(i).get("status").asText()).isEqualTo("SUCCESS");
            assertThat(steps.get(i).get("message").asText()).isNotBlank();
        }
        // 步骤顺序：后一步的开始时间不早于前一步的结束时间
        for (int i = 0; i < 2; i++) {
            String prevFinished = steps.get(i).get("finishedAt").asText();
            String nextStarted = steps.get(i + 1).get("startedAt").asText();
            assertThat(nextStarted.compareTo(prevFinished)).as("步骤 %s 应在 %s 之后开始", i + 1, i).isGreaterThanOrEqualTo(0);
        }
    }

    @Test
    void injectedFailureStopsLaterSteps() throws Exception {
        String token = registerAndGetToken();
        long a1 = uploadAsset(token, "demo-birthday", "cake.png", pngBytes());

        JsonNode submitted = submitTask(token, "demo-birthday", List.of(a1), "GENERATE");
        String taskId = submitted.get("task").get("id").asText();

        JsonNode done = awaitStatus(token, taskId, "FAILED");
        JsonNode task = done.get("task");
        assertThat(task.get("status").asText()).isEqualTo("FAILED");
        assertThat(task.get("stage").asText()).isEqualTo("GENERATE");
        assertThat(task.get("failureReason").asText()).contains("模拟生成");
        assertThat(task.get("resultUrl").isNull()).isTrue();

        JsonNode steps = done.get("steps");
        assertThat(steps.get(0).get("step").asText()).isEqualTo("ASSET_CHECK");
        assertThat(steps.get(0).get("status").asText()).isEqualTo("SUCCESS");
        assertThat(steps.get(1).get("step").asText()).isEqualTo("GENERATE");
        assertThat(steps.get(1).get("status").asText()).isEqualTo("FAILED");
        assertThat(steps.get(1).get("message").asText()).contains("失败");
        // 失败后不再执行后续步骤
        assertThat(steps.get(2).get("step").asText()).isEqualTo("FINALIZE");
        assertThat(steps.get(2).get("status").asText()).isEqualTo("PENDING");
        assertThat(steps.get(2).get("startedAt").isNull()).isTrue();
    }

    @Test
    void queryDoesNotAdvanceOrRegressTask() throws Exception {
        String token = registerAndGetToken();
        long a1 = uploadAsset(token, "demo-magazine", "cover.png", pngBytes());
        JsonNode submitted = submitTask(token, "demo-magazine", List.of(a1), null);
        String taskId = submitted.get("task").get("id").asText();

        // 处理期间反复查询：状态只会在 PENDING/PROCESSING 内变化，查询本身不推进任务
        for (int i = 0; i < 5; i++) {
            String status = getTask(token, taskId).get("task").get("status").asText();
            assertThat(status).isIn("PENDING", "PROCESSING");
        }
        awaitStatus(token, taskId, "SUCCESS");
        // 完成后再查询不会回到处理中
        for (int i = 0; i < 3; i++) {
            assertThat(getTask(token, taskId).get("task").get("status").asText()).isEqualTo("SUCCESS");
        }
    }

    @Test
    void submitValidationRejectsBadRequests() throws Exception {
        String tokenA = registerAndGetToken();
        String tokenB = registerAndGetToken();

        // 模板不存在
        long asset = uploadAsset(tokenA, "demo-magazine", "a.png", pngBytes());
        MvcResult missing = mvc.perform(post("/api/tasks")
                        .contentType("application/json")
                        .content("{\"templateId\":\"no-such-template\",\"assetIds\":[" + asset + "]}")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isNotFound())
                .andReturn();
        assertThat(body(missing)).contains("模板不存在");

        // 数量不符（模板需要 1 张，提交 0 张）
        mvc.perform(post("/api/tasks")
                        .contentType("application/json")
                        .content("{\"templateId\":\"demo-magazine\",\"assetIds\":[]}")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isBadRequest());

        // 数量不符（重复素材去重后不足）
        mvc.perform(post("/api/tasks")
                        .contentType("application/json")
                        .content("{\"templateId\":\"demo-postcard\",\"assetIds\":[" + asset + "," + asset + "]}")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isBadRequest());

        // 使用他人素材
        MvcResult foreign = mvc.perform(post("/api/tasks")
                        .contentType("application/json")
                        .content("{\"templateId\":\"demo-magazine\",\"assetIds\":[" + asset + "]}")
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isBadRequest())
                .andReturn();
        assertThat(body(foreign)).contains("不属于当前用户");

        // 素材被占用：同一素材提交第二个任务
        submitTask(tokenA, "demo-magazine", List.of(asset), "ASSET_CHECK");
        mvc.perform(post("/api/tasks")
                        .contentType("application/json")
                        .content("{\"templateId\":\"demo-magazine\",\"assetIds\":[" + asset + "]}")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isConflict());

        // 非法 failStage
        long asset2 = uploadAsset(tokenA, "demo-magazine", "b.png", pngBytes());
        mvc.perform(post("/api/tasks")
                        .contentType("application/json")
                        .content("{\"templateId\":\"demo-magazine\",\"assetIds\":[" + asset2 + "],\"failStage\":\"NOT_A_STAGE\"}")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadValidationRejectsBadFiles() throws Exception {
        String token = registerAndGetToken();

        // 未登录
        mvc.perform(multipart("/api/assets")
                        .file(new MockMultipartFile("file", "x.png", "image/png", pngBytes()))
                        .param("templateId", "demo-magazine"))
                .andExpect(status().isUnauthorized());

        // 伪造的 Content-Type：文本内容不是合法图片（魔数嗅探）
        mvc.perform(multipart("/api/assets")
                        .file(new MockMultipartFile("file", "fake.png", "image/png", "not an image".getBytes()))
                        .param("templateId", "demo-magazine")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        // 超出模板大小限制（demo-magazine 限制 5MB）
        byte[] big = new byte[5 * 1024 * 1024 + 64];
        System.arraycopy(PNG_HEAD, 0, big, 0, PNG_HEAD.length);
        mvc.perform(multipart("/api/assets")
                        .file(new MockMultipartFile("file", "big.png", "image/png", big))
                        .param("templateId", "demo-magazine")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        // 数量上限：demo-postcard 需要 2 张，第 3 次上传应被拒绝
        uploadAsset(token, "demo-postcard", "p1.png", pngBytes());
        uploadAsset(token, "demo-postcard", "p2.png", pngBytes());
        MvcResult overflow = mvc.perform(multipart("/api/assets")
                        .file(new MockMultipartFile("file", "p3.png", "image/png", pngBytes()))
                        .param("templateId", "demo-postcard")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andReturn();
        assertThat(body(overflow)).contains("仅需 2 张");
    }

    @Test
    void taskRecordsAreIsolatedBetweenUsers() throws Exception {
        String tokenA = registerAndGetToken();
        String tokenB = registerAndGetToken();
        long a1 = uploadAsset(tokenA, "demo-sky", "sky.png", pngBytes());
        JsonNode submitted = submitTask(tokenA, "demo-sky", List.of(a1), null);
        String taskId = submitted.get("task").get("id").asText();

        // B 查询 A 的任务 → 404
        mvc.perform(get("/api/tasks/" + taskId).header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());
        // B 的历史列表为空
        MvcResult listB = mvc.perform(get("/api/tasks").header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(om.readTree(listB.getResponse().getContentAsString()).get("tasks")).isEmpty();
        // A 的历史包含该任务（R-09 刷新恢复的数据来源）
        MvcResult listA = mvc.perform(get("/api/tasks").header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(om.readTree(listA.getResponse().getContentAsString()).get("tasks")).hasSize(1);
    }

    @Test
    void restartSweeperMarksStaleTasksFailed() throws Exception {
        // 直接落库一个"停留在 PENDING 的遗留任务"，不经过异步执行器
        String username = "stale_" + System.nanoTime();
        MvcResult reg = mvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("{\"username\":\"" + username + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode user = om.readTree(reg.getResponse().getContentAsString()).get("user");
        long userId = user.get("id").asLong();

        Task stale = new Task();
        stale.setId("stale" + System.nanoTime());
        stale.setUserId(userId);
        stale.setTemplateId("demo-sky");
        stale.setStatus(TaskStatus.PENDING);
        stale.setCreatedAt(java.time.LocalDateTime.now());
        taskMapper.insert(stale);
        for (TaskStage stage : TaskStage.values()) {
            TaskStep step = new TaskStep();
            step.setTaskId(stale.getId());
            step.setStep(stage);
            step.setStatus(TaskStep.Status.PENDING);
            stepMapper.insert(step);
        }

        sweeper.sweep();
        Task after = taskMapper.findById(stale.getId());
        assertThat(after.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(after.getFailureReason()).contains("服务重启");
        assertThat(stepMapper.findByTaskId(stale.getId()))
                .allSatisfy(s -> assertThat(s.getStatus()).isEqualTo(TaskStep.Status.FAILED));
    }

    @Test
    void devApiReadsAndUpdatesSimulation() throws Exception {
        // 读取当前配置
        MvcResult before = mvc.perform(get("/api/dev/simulation"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode beforeNode = om.readTree(before.getResponse().getContentAsString());
        assertThat(beforeNode.get("failStage").asText()).isEqualTo("NONE");
        assertThat(beforeNode.get("durations").get("generateMs").asLong()).isEqualTo(120);

        // 调整耗时与全局失败注入
        mvc.perform(putJson("/api/dev/simulation",
                        "{\"failStage\":\"ASSET_CHECK\",\"durations\":{\"generateMs\":1000}}"))
                .andExpect(status().isOk());
        MvcResult after = mvc.perform(get("/api/dev/simulation"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode afterNode = om.readTree(after.getResponse().getContentAsString());
        assertThat(afterNode.get("failStage").asText()).isEqualTo("ASSET_CHECK");
        assertThat(afterNode.get("durations").get("generateMs").asLong()).isEqualTo(1000);

        // 恢复，避免影响其他用例
        mvc.perform(putJson("/api/dev/simulation", "{\"failStage\":\"NONE\"}"))
                .andExpect(status().isOk());
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder putJson(String uri, String body) {
        return org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(uri)
                .contentType("application/json").content(body);
    }

    private static byte[] pngBytes() {
        byte[] bytes = new byte[128];
        System.arraycopy(PNG_HEAD, 0, bytes, 0, PNG_HEAD.length);
        return bytes;
    }
}
