package com.xiaoying.ra.asset;

import com.xiaoying.ra.auth.User;
import com.xiaoying.ra.common.ApiException;
import com.xiaoying.ra.template.Template;
import com.xiaoying.ra.template.TemplateService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * 素材上传与校验（R-03）：
 * - 类型校验基于文件头魔数嗅探，而非仅信任浏览器上报的 Content-Type
 * - 大小校验依据模板限制；数量校验在提交任务时统一进行
 * - 文件保存到后端本地目录（upload-dir），通过 /files/** 提供访问
 */
@Slf4j
@Service
public class AssetService {

    private final AssetMapper assetMapper;
    private final TemplateService templateService;
    private final String uploadDir;

    public AssetService(AssetMapper assetMapper, TemplateService templateService,
                        @Value("${app.upload-dir}") String uploadDir) {
        this.assetMapper = assetMapper;
        this.templateService = templateService;
        this.uploadDir = uploadDir;
    }

    public AssetView upload(User user, String templateId, MultipartFile file) {
        Template template = templateService.get(templateId);
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("请选择要上传的图片");
        }
        if (file.getSize() > template.getMaxFileSizeBytes()) {
            throw ApiException.badRequest(String.format(
                    "图片大小超出模板限制（最大 %.0f KB）", template.getMaxFileSizeBytes() / 1024.0));
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(500, "读取上传文件失败");
        }
        String sniffed = sniffMime(bytes);
        if (sniffed == null || !template.acceptedMimeList().contains(sniffed)) {
            throw ApiException.badRequest("图片类型不受支持，模板仅接受：" + String.join("、", template.acceptedMimeList()));
        }
        long unbound = assetMapper.countUnbound(user.getId(), templateId);
        if (unbound >= template.getRequiredImageCount()) {
            throw ApiException.badRequest(String.format(
                    "该模板仅需 %d 张图片，请先移除已有图片再重新上传", template.getRequiredImageCount()));
        }

        String month = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
        String ext = "image/png".equals(sniffed) ? "png" : "jpg";
        String name = UUID.randomUUID().toString().replace("-", "") + "." + ext;
        String storedPath = month + "/" + name;
        try {
            Path target = resolveStored(storedPath);
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
        } catch (IOException e) {
            log.error("保存上传文件失败", e);
            throw new ApiException(500, "保存上传文件失败");
        }

        Asset asset = new Asset();
        asset.setUserId(user.getId());
        asset.setTemplateId(templateId);
        asset.setOriginalName(sanitize(file.getOriginalFilename()));
        asset.setMimeType(sniffed);
        asset.setSizeBytes((long) bytes.length);
        asset.setStoredPath(storedPath);
        asset.setCreatedAt(LocalDateTime.now());
        assetMapper.insert(asset);
        return AssetView.of(asset);
    }

    public void delete(User user, Long assetId) {
        Asset asset = assetMapper.findById(assetId);
        if (asset == null || !asset.getUserId().equals(user.getId())) {
            throw ApiException.notFound("素材不存在");
        }
        if (asset.getTaskId() != null) {
            throw ApiException.conflict("素材已被制作任务使用，无法移除");
        }
        assetMapper.deleteById(assetId);
        try {
            Files.deleteIfExists(resolveStored(asset.getStoredPath()));
        } catch (IOException e) {
            log.warn("删除素材文件失败：{}", asset.getStoredPath(), e);
        }
    }

    /**
     * 提交任务前对素材做完整的服务端校验：归属、模板匹配、未被占用、类型与大小。
     */
    public List<Asset> loadValidatedForSubmit(User user, Template template, List<Long> assetIds) {
        List<Asset> assets = assetMapper.findByIds(assetIds);
        if (assets.size() != assetIds.size()) {
            throw ApiException.badRequest("存在无效的素材，请重新上传");
        }
        for (Asset asset : assets) {
            if (!asset.getUserId().equals(user.getId())) {
                throw ApiException.badRequest("素材不属于当前用户");
            }
            if (!asset.getTemplateId().equals(template.getId())) {
                throw ApiException.badRequest("素材与模板不匹配：" + asset.getOriginalName());
            }
            if (asset.getTaskId() != null) {
                throw ApiException.conflict("素材已被其他任务使用：" + asset.getOriginalName());
            }
            if (!template.acceptedMimeList().contains(asset.getMimeType())) {
                throw ApiException.badRequest("素材类型不符合模板要求：" + asset.getOriginalName());
            }
            if (asset.getSizeBytes() > template.getMaxFileSizeBytes()) {
                throw ApiException.badRequest("素材大小超出模板限制：" + asset.getOriginalName());
            }
        }
        return assets;
    }

    /** 后台素材检查步骤使用：确认文件仍然存在于磁盘。 */
    public boolean fileExists(Asset asset) {
        try {
            Path path = resolveStored(asset.getStoredPath());
            return Files.exists(path) && Files.size(path) > 0;
        } catch (IOException e) {
            return false;
        }
    }

    /** 将库中存储的相对路径解析到上传根目录内；越界路径直接拒绝（纵深防御）。 */
    private Path resolveStored(String relativePath) {
        Path base = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path resolved = base.resolve(relativePath).normalize();
        if (!resolved.startsWith(base)) {
            throw ApiException.badRequest("非法的素材路径");
        }
        return resolved;
    }

    /** 通过文件头魔数判断真实类型，避免仅信任 Content-Type。 */
    public static String sniffMime(byte[] bytes) {
        if (bytes == null || bytes.length < 8) {
            return null;
        }
        if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if ((bytes[0] & 0xFF) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G') {
            return "image/png";
        }
        return null;
    }

    private static String sanitize(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            return "未命名图片";
        }
        String name = originalName.replace("\\", "/");
        int slash = name.lastIndexOf('/');
        name = name.substring(slash + 1);
        return name.length() > 200 ? name.substring(name.length() - 200) : name;
    }
}
