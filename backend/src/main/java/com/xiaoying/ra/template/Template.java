package com.xiaoying.ra.template;

import lombok.Data;

import java.util.Arrays;
import java.util.List;

/** 制作模板。acceptedMimeTypes / resultUrls 在库中以逗号分隔存储。 */
@Data
public class Template {
    private String id;
    private String title;
    private String category;
    private String description;
    private String coverUrl;
    private Integer requiredImageCount;
    private String acceptedMimeTypes;
    private Long maxFileSizeBytes;
    private String resultUrls;
    private Integer sortOrder;

    public List<String> acceptedMimeList() {
        return split(acceptedMimeTypes);
    }

    public List<String> resultList() {
        return split(resultUrls);
    }

    private static List<String> split(String csv) {
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
