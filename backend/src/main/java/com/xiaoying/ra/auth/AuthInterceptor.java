package com.xiaoying.ra.auth;

import com.xiaoying.ra.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.LocalDateTime;

/** Bearer Token 认证：解析会话并把当前用户放入请求属性。 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final SessionMapper sessionMapper;
    private final UserMapper userMapper;

    public AuthInterceptor(SessionMapper sessionMapper, UserMapper userMapper) {
        this.sessionMapper = sessionMapper;
        this.userMapper = userMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ") || auth.length() <= 7) {
            throw ApiException.unauthorized("请先登录");
        }
        String token = auth.substring(7).trim();
        Session session = sessionMapper.findByToken(token);
        if (session == null) {
            throw ApiException.unauthorized("登录状态已失效，请重新登录");
        }
        if (session.getExpiresAt().isBefore(LocalDateTime.now())) {
            sessionMapper.deleteByToken(token);
            throw ApiException.unauthorized("登录已过期，请重新登录");
        }
        User user = userMapper.findById(session.getUserId());
        if (user == null) {
            throw ApiException.unauthorized("用户不存在，请重新登录");
        }
        request.setAttribute("currentUser", user);
        return true;
    }
}
