package com.xiaoying.ra.template;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {

    private final TemplateService templateService;

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String category) {
        return Map.of("templates", templateService.list(category));
    }

    @GetMapping("/categories")
    public Map<String, Object> categories() {
        return Map.of("categories", templateService.categories());
    }

    @GetMapping("/{id}")
    public TemplateView detail(@PathVariable String id) {
        return TemplateView.of(templateService.get(id));
    }
}
