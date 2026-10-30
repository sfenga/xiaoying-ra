package com.xiaoying.ra.auth.dto;

public record AuthResponse(String token, UserView user) {
}
