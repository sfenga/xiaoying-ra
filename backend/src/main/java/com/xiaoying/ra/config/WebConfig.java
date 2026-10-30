package com.xiaoying.ra.config;

import com.xiaoying.ra.auth.AuthInterceptor;
import com.xiaoying.ra.common.CurrentUserResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;
import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload-dir}")
    private String uploadDir;

    private final AuthInterceptor authInterceptor;
    private final CurrentUserResolver currentUserResolver;

    public WebConfig(AuthInterceptor authInterceptor, CurrentUserResolver currentUserResolver) {
        this.authInterceptor = authInterceptor;
        this.currentUserResolver = currentUserResolver;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/auth/register",
                        "/api/auth/login",
                        "/api/auth/guest",
                        // 演示用开发调参接口不要求登录，便于脚本/README 演示
                        "/api/dev/**");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 模板封面 / 模拟结果图：打包在 jar 内的本地示例文件
        registry.addResourceHandler("/demo/**")
                .addResourceLocations("classpath:/demo/");
        // 用户上传的素材：后端本地磁盘目录
        registry.addResourceHandler("/files/**")
                .addResourceLocations(Paths.get(uploadDir).toAbsolutePath().normalize().toUri() + "/");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserResolver);
    }
}
