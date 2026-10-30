package com.xiaoying.ra.task;

import com.xiaoying.ra.auth.User;
import com.xiaoying.ra.task.dto.SubmitTaskRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public java.util.Map<String, Object> submit(@Valid @RequestBody SubmitTaskRequest request, User currentUser) {
        return taskService.submit(currentUser, request);
    }

    /** 支持按 ids 批量查询（前端轮询）、按 templateId 过滤（模板详情页历史）。 */
    @GetMapping
    public java.util.Map<String, Object> list(@RequestParam(required = false) List<String> ids,
                                              @RequestParam(required = false) String templateId,
                                              User currentUser) {
        return taskService.list(currentUser, ids, templateId);
    }

    @GetMapping("/{id}")
    public java.util.Map<String, Object> detail(@PathVariable String id, User currentUser) {
        return taskService.get(currentUser, id);
    }
}
