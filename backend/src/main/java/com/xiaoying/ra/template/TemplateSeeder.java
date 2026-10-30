package com.xiaoying.ra.template;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 模板种子数据（R-02）：首次启动且模板表为空时写入演示模板。
 * 封面与模拟结果图片均为打包在 jar 内的本地示例文件（/demo/** 直接可访问）。
 */
@Slf4j
@Component
public class TemplateSeeder implements ApplicationRunner {

    private final TemplateMapper templateMapper;

    public TemplateSeeder(TemplateMapper templateMapper) {
        this.templateMapper = templateMapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (templateMapper.count() > 0) {
            return;
        }
        String mimes = "image/jpeg,image/png";
        seed("demo-postcard", "旅行明信片", "创意图片",
                "上传 2 张旅行照片，模拟生成一张复古风景明信片",
                "/demo/covers/demo-postcard.png", 2, mimes, 5242880L,
                "/demo/results/result-postcard.png,/demo/results/result-postcard-b.png", 1);
        seed("demo-magazine", "大片杂志封面", "创意图片",
                "上传 1 张人像或风景照片，模拟生成一张杂志封面大片",
                "/demo/covers/demo-magazine.png", 1, mimes, 5242880L,
                "/demo/results/result-magazine.png,/demo/results/result-magazine-b.png", 2);
        seed("demo-polaroid", "拍立得三连拼贴", "创意图片",
                "上传 3 张照片，模拟生成一张拍立得三连拼贴",
                "/demo/covers/demo-polaroid.png", 3, mimes, 5242880L,
                "/demo/results/result-polaroid.png,/demo/results/result-polaroid-b.png", 3);
        seed("demo-birthday", "生日祝福贺卡", "节日祝福",
                "上传 1 张照片，模拟生成一张生日祝福贺卡",
                "/demo/covers/demo-birthday.png", 1, mimes, 5242880L,
                "/demo/results/result-birthday.png,/demo/results/result-birthday-b.png", 4);
        seed("demo-lunar", "新春拜年海报", "节日祝福",
                "上传 2 张照片，模拟生成一张新春拜年海报",
                "/demo/covers/demo-lunar.png", 2, mimes, 5242880L,
                "/demo/results/result-lunar.png,/demo/results/result-lunar-b.png", 5);
        seed("demo-growth", "宝宝成长相册", "亲子时光",
                "上传 2 张照片，模拟生成一页成长纪念相册",
                "/demo/covers/demo-growth.png", 2, mimes, 5242880L,
                "/demo/results/result-growth.png,/demo/results/result-growth-b.png", 6);
        seed("demo-sky", "童趣天空画板", "亲子时光",
                "上传 1 张照片，模拟生成一副童趣天空插画",
                "/demo/covers/demo-sky.png", 1, mimes, 5242880L,
                "/demo/results/result-sky.png,/demo/results/result-sky-b.png", 7);
        log.info("已写入模板种子数据：7 个模板");
    }

    private void seed(String id, String title, String category, String description, String coverUrl,
                      int requiredImageCount, String mimes, long maxFileSizeBytes, String resultUrls, int sortOrder) {
        Template t = new Template();
        t.setId(id);
        t.setTitle(title);
        t.setCategory(category);
        t.setDescription(description);
        t.setCoverUrl(coverUrl);
        t.setRequiredImageCount(requiredImageCount);
        t.setAcceptedMimeTypes(mimes);
        t.setMaxFileSizeBytes(maxFileSizeBytes);
        t.setResultUrls(resultUrls);
        t.setSortOrder(sortOrder);
        templateMapper.insert(t);
    }
}
