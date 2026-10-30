package com.xiaoying.ra.auth;

import com.xiaoying.ra.auth.dto.AuthResponse;
import com.xiaoying.ra.auth.dto.LoginRequest;
import com.xiaoying.ra.auth.dto.RegisterRequest;
import com.xiaoying.ra.auth.dto.UserView;
import com.xiaoying.ra.common.ApiException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 用户身份方案（R-10）：
 * 用户名 + 密码注册（BCrypt 存储），登录后签发随机 Token（t_session 落库，默认 72 小时有效），
 * 前端以 Authorization: Bearer <token> 访问受保护接口；另提供一键游客账号便于演示。
 */
@Service
public class AuthService {

    private final UserMapper userMapper;
    private final SessionMapper sessionMapper;
    private final PasswordEncoder passwordEncoder;
    private final long tokenTtlHours;

    public AuthService(UserMapper userMapper, SessionMapper sessionMapper,
                       PasswordEncoder passwordEncoder,
                       @org.springframework.beans.factory.annotation.Value("${app.auth.token-ttl-hours}") long tokenTtlHours) {
        this.userMapper = userMapper;
        this.sessionMapper = sessionMapper;
        this.passwordEncoder = passwordEncoder;
        this.tokenTtlHours = tokenTtlHours;
    }

    public AuthResponse register(RegisterRequest request) {
        String username = request.username().trim();
        if (userMapper.findByUsername(username) != null) {
            throw ApiException.conflict("用户名已被占用");
        }
        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName() == null || request.displayName().isBlank()
                ? username : request.displayName().trim());
        user.setIsGuest(false);
        user.setCreatedAt(LocalDateTime.now());
        userMapper.insert(user);
        return issueSession(user);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userMapper.findByUsername(request.username().trim());
        if (user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw ApiException.unauthorized("用户名或密码错误");
        }
        return issueSession(user);
    }

    public AuthResponse guest() {
        User user = new User();
        String random = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        user.setUsername("guest_" + random);
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setDisplayName("游客 " + random.substring(0, 4).toUpperCase());
        user.setIsGuest(true);
        user.setCreatedAt(LocalDateTime.now());
        userMapper.insert(user);
        return issueSession(user);
    }

    public AuthResponse issueSession(User user) {
        String token = UUID.randomUUID().toString().replace("-", "");
        LocalDateTime now = LocalDateTime.now();
        Session session = new Session();
        session.setToken(token);
        session.setUserId(user.getId());
        session.setCreatedAt(now);
        session.setExpiresAt(now.plusHours(tokenTtlHours));
        sessionMapper.insert(session);
        return new AuthResponse(token, UserView.of(user));
    }

    public void logout(String token) {
        sessionMapper.deleteByToken(token);
    }
}
