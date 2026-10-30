package com.xiaoying.ra.template;

import com.xiaoying.ra.common.ApiException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TemplateService {

    private final TemplateMapper templateMapper;

    public TemplateService(TemplateMapper templateMapper) {
        this.templateMapper = templateMapper;
    }

    public List<TemplateView> list(String category) {
        return templateMapper.findAll().stream()
                .filter(t -> category == null || category.isBlank() || t.getCategory().equals(category))
                .map(TemplateView::of)
                .toList();
    }

    public List<String> categories() {
        return templateMapper.findAll().stream()
                .map(Template::getCategory)
                .distinct()
                .toList();
    }

    public Template get(String id) {
        Template template = templateMapper.findById(id);
        if (template == null) {
            throw ApiException.notFound("模板不存在或已下架");
        }
        return template;
    }
}
