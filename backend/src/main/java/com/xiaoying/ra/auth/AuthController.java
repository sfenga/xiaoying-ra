package com.xiaoying.ra.auth;

import com.xiaoying.ra.auth.dto.AuthResponse;
import com.xiaoying.ra.auth.dto.LoginRequest;
import com.xiaoying.ra.auth.dto.RegisterRequest;
import com.xiaoying.ra.auth.dto.UserView;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/guest")
    public AuthResponse guest() {
        return authService.guest();
    }

    @PostMapping("/logout")
    public void logout(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            authService.logout(auth.substring(7).trim());
        }
    }

    @GetMapping("/me")
    public UserView me(User currentUser) {
        return UserView.of(currentUser);
    }
}
