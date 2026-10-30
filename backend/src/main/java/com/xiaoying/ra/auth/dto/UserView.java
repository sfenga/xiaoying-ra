package com.xiaoying.ra.auth.dto;

import com.xiaoying.ra.auth.User;

import java.time.LocalDateTime;

public record UserView(Long id, String username, String displayName, boolean guest, LocalDateTime createdAt) {
    public static UserView of(User user) {
        return new UserView(user.getId(), user.getUsername(), user.getDisplayName(),
                Boolean.TRUE.equals(user.getIsGuest()), user.getCreatedAt());
    }
}
