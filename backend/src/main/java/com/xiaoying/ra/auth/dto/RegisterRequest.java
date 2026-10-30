package com.xiaoying.ra.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "用户名不能为空")
        @Pattern(regexp = "^[a-zA-Z0-9_]{3,32}$", message = "需为 3-32 位字母、数字或下划线")
        String username,
        @NotBlank(message = "密码不能为空")
        @Size(min = 6, max = 64, message = "密码长度需为 6-64 位")
        String password,
        String displayName) {
}
