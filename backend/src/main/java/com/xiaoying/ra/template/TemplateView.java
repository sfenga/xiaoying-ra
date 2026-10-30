package com.xiaoying.ra.template;

import java.util.List;

public record TemplateView(String id, String title, String category, String description, String coverUrl,
                           int requiredImageCount, List<String> acceptedMimeTypes, long maxFileSizeBytes) {
    public static TemplateView of(Template t) {
        return new TemplateView(t.getId(), t.getTitle(), t.getCategory(), t.getDescription(), t.getCoverUrl(),
                t.getRequiredImageCount(), t.acceptedMimeList(), t.getMaxFileSizeBytes());
    }
}
