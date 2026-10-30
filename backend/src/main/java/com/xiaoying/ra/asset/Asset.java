package com.xiaoying.ra.asset;

import lombok.Data;

import java.time.LocalDateTime;

/** 用户上传的素材。task_id 为提交任务后绑定的任务 ID，未提交前为空。 */
@Data
public class Asset {
    private Long id;
    private Long userId;
    private String templateId;
    private String originalName;
    private String mimeType;
    private Long sizeBytes;
    /** 相对 upload-dir 的存储路径，如 202610/uuid.png */
    private String storedPath;
    private String taskId;
    private LocalDateTime createdAt;
}
