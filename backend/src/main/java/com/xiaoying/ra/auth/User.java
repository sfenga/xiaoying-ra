package com.xiaoying.ra.auth;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class User {
    private Long id;
    private String username;
    private String passwordHash;
    private String displayName;
    private Boolean isGuest;
    private LocalDateTime createdAt;
}
