package com.xiaoying.ra.auth;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class Session {
    private String token;
    private Long userId;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}
