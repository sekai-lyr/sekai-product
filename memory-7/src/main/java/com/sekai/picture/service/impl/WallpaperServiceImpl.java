package com.sekai.picture.service.impl;

import com.sekai.picture.dataobject.SekaiPictureCategoryDO;
import com.sekai.picture.dataobject.SekaiPictureWallpaperDO;
import com.sekai.picture.mapper.SekaiPictureCategoryMapper;
import com.sekai.picture.mapper.SekaiPictureFavoriteMapper;
import com.sekai.picture.mapper.SekaiPictureWallpaperMapper;
import com.sekai.picture.model.Result;
import com.sekai.picture.model.Wallpaper;
import com.sekai.picture.service.WallpaperService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class WallpaperServiceImpl implements WallpaperService {

    @Resource
    private com.sekai.picture.service.ImageStorage storage;
    private static final DateTimeFormatter DATE_PATH = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Resource
    private SekaiPictureWallpaperMapper wallpaperMapper;

    @Resource
    private SekaiPictureCategoryMapper categoryMapper;

    @Resource
    private SekaiPictureFavoriteMapper favoriteMapper;

    @Override
    @Transactional
    public Result<Wallpaper> upload(Wallpaper wallpaper, MultipartFile file) {
        String invalid = validateMetadata(wallpaper);
        if (invalid != null) return Result.fail(invalid);
        if (!canUseCategory(wallpaper.getUserId(), wallpaper.getCategoryId())) return Result.fail("请选择自己的分类");
        if (file == null || file.isEmpty()) return Result.fail("请选择图片");
        if (file.getSize() > com.sekai.picture.service.ImageStorage.MAX_BYTES) return Result.fail("每张图片不能超过 20 MB");
        Path staged = null;
        Path target = null;
        Long savedId = null;
        boolean saved = false;
        try {
            Files.createDirectories(storage.root().resolve(".incoming"));
            staged = Files.createTempFile(storage.root().resolve(".incoming"), "upload-", ".tmp");
            file.transferTo(staged);
            var decoded = storage.decode(staged);
            String hash = storage.hash(staged);
            // Backfill fingerprints for this user's older local images without changing their URLs.
            for (var old : wallpaperMapper.listUnhashed(wallpaper.getUserId())) {
                Path oldFile = storage.resolve(old.getImageUrl());
                if (oldFile == null || !Files.isRegularFile(oldFile)) continue;
                String oldHash = storage.hash(oldFile);
                if (wallpaperMapper.findHash(wallpaper.getUserId(), oldHash) == null) {
                    wallpaperMapper.setHash(old.getId(), oldHash);
                }
            }
            var duplicate = wallpaperMapper.findHash(wallpaper.getUserId(), hash);
            if (duplicate != null) return Result.fail(duplicate.getDeletedAt() == null
                    ? "这张图片已在图库中：" + duplicate.getTitle() : "这张图片已在回收站，请先恢复或彻底删除");
            Path dayDir = storage.root().resolve(LocalDateTime.now().format(DATE_PATH));
            Files.createDirectories(dayDir);
            String storedName = UUID.randomUUID() + "." + decoded.extension();
            target = dayDir.resolve(storedName);
            Files.move(staged, target);
            wallpaper.setWidth(decoded.image().getWidth());
            wallpaper.setHeight(decoded.image().getHeight());
            wallpaper.setTitle(wallpaper.getTitle().trim());
            wallpaper.setImageUrl("/wallpaper-image/" + dayDir.getFileName() + "/" + storedName);
            String originalName = file.getOriginalFilename() == null ? "wallpaper." + decoded.extension() : file.getOriginalFilename();
            originalName = originalName.replace('\\', '/');
            originalName = originalName.substring(originalName.lastIndexOf('/') + 1);
            wallpaper.setFileName(originalName.length() > 255 ? storedName : originalName);
            wallpaper.setFileSize(file.getSize());
            wallpaper.setContentHash(hash);
            wallpaper.setDeletedAt(null);
            wallpaper.setDownloadCount(0);
            wallpaper.setOriginal(Boolean.TRUE.equals(wallpaper.getOriginal()));
            var record = new SekaiPictureWallpaperDO(wallpaper);
            wallpaperMapper.insert(record);
            savedId = record.getId();
            storage.thumbnail(savedId, target);
            Path committedFile = target;
            Long committedId = savedId;
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override public void afterCompletion(int status) {
                            if (status != STATUS_COMMITTED) cleanUpload(committedFile, committedId);
                        }
                    });
            saved = true;
            return Result.ok(wallpaperMapper.selectByIdAndUserId(savedId, wallpaper.getUserId()).convertToWallpaper(), "上传成功");
        } catch (org.springframework.dao.DuplicateKeyException e) {
            return Result.fail("这张图片已经上传，请刷新图库查看");
        } catch (IOException e) {
            if (savedId != null) org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            return Result.fail("图片处理失败，请检查格式、大小和图片内容后重试");
        } finally {
            cleanUpload(staged, null);
            if (!saved) cleanUpload(target, savedId);
        }
    }

    private void cleanUpload(Path path, Long id) {
        try {
            if (path != null) Files.deleteIfExists(path);
            if (id != null) Files.deleteIfExists(storage.thumbnailPath(id));
        } catch (IOException e) {
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("Unable to clean temporary image", e);
        }
    }

    private String validateMetadata(Wallpaper wallpaper) {
        if (wallpaper == null || trimToNull(wallpaper.getTitle()) == null) return "壁纸标题不能为空";
        if (wallpaper.getTitle().length() > 120) return "标题最多 120 字";
        if (wallpaper.getCharacterName() != null && wallpaper.getCharacterName().length() > 120) return "角色名最多 120 字";
        if (wallpaper.getSourceName() != null && wallpaper.getSourceName().length() > 120) return "来源最多 120 字";
        if (wallpaper.getTags() != null && wallpaper.getTags().length() > 255) return "标签最多 255 字";
        if (wallpaper.getColorTone() != null && wallpaper.getColorTone().length() > 40) return "色调最多 40 字";
        return null;
    }

    @Override
    public Wallpaper getByIdAndUserId(Long id, Long userId) {
        SekaiPictureWallpaperDO wallpaperDO = wallpaperMapper.selectByIdAndUserId(id, userId);
        return wallpaperDO == null ? null : wallpaperDO.convertToWallpaper();
    }

    @Override
    public List<Wallpaper> listByUserId(Long userId, Long categoryId, String keyword, boolean onlyFavorite,
                                        Boolean original, String orientation, String colorTone, String sort,
                                        int page, int pageSize) {
        int safePage = Math.max(page, 1);
        int offset = (safePage - 1) * pageSize;
        return wallpaperMapper.listByUserId(userId, categoryId, trimToNull(keyword), onlyFavorite,
                        original, normalizeFilter(orientation), trimToNull(colorTone), normalizeSort(sort),
                        offset, pageSize)
                .stream()
                .map(SekaiPictureWallpaperDO::convertToWallpaper)
                .toList();
    }

    @Override
    public int countByUserId(Long userId, Long categoryId, String keyword, boolean onlyFavorite,
                             Boolean original, String orientation, String colorTone) {
        return wallpaperMapper.countByUserId(userId, categoryId, trimToNull(keyword), onlyFavorite,
                original, normalizeFilter(orientation), trimToNull(colorTone));
    }

    @Override
    public List<Wallpaper> listHotByUserId(Long userId, int limit) {
        return wallpaperMapper.listHotByUserId(userId, Math.max(1, Math.min(limit, 12)))
                .stream()
                .map(SekaiPictureWallpaperDO::convertToWallpaper)
                .toList();
    }

    @Override
    public List<String> listColorTonesByUserId(Long userId) {
        return wallpaperMapper.listColorTonesByUserId(userId);
    }

    @Override
    public Wallpaper randomByUserId(Long userId, Long categoryId, String keyword, boolean onlyFavorite,
                                    Boolean original, String orientation, String colorTone) {
        SekaiPictureWallpaperDO wallpaperDO = wallpaperMapper.randomByUserId(userId, categoryId,
                trimToNull(keyword), onlyFavorite, original, normalizeFilter(orientation), trimToNull(colorTone));
        return wallpaperDO == null ? null : wallpaperDO.convertToWallpaper();
    }

    @Override
    @Transactional
    public Result<Wallpaper> updateMeta(Long userId, Wallpaper wallpaper) {
        if (wallpaper == null || wallpaper.getId() == null) {
            return Result.fail("壁纸不存在");
        }
        String invalid = validateMetadata(wallpaper);
        if (invalid != null) return Result.fail(invalid);
        if (!canUseCategory(userId, wallpaper.getCategoryId())) {
            return Result.fail("请选择自己的分类");
        }
        SekaiPictureWallpaperDO existing = wallpaperMapper.selectByIdAndUserId(wallpaper.getId(), userId);
        if (existing == null) {
            return Result.fail("壁纸不存在或没有权限");
        }
        existing.setTitle(wallpaper.getTitle().trim());
        existing.setCategoryId(wallpaper.getCategoryId());
        existing.setCharacterName(trimToNull(wallpaper.getCharacterName()));
        existing.setSourceName(trimToNull(wallpaper.getSourceName()));
        existing.setTags(trimToNull(wallpaper.getTags()));
        existing.setColorTone(trimToNull(wallpaper.getColorTone()));
        existing.setOriginal(Boolean.TRUE.equals(wallpaper.getOriginal()));
        wallpaperMapper.updateMeta(existing);
        Wallpaper updated = wallpaperMapper.selectByIdAndUserId(wallpaper.getId(), userId).convertToWallpaper();
        return Result.ok(updated, "壁纸信息已更新");
    }

    @Override
    @Transactional
    public Result<Void> delete(Long userId, Long wallpaperId) {
        if (wallpaperId == null) {
            return Result.fail("请选择要删除的壁纸");
        }
        int affected = wallpaperMapper.deleteByIdAndUserId(wallpaperId, userId);
        if (affected == 0) {
            return Result.fail("壁纸不存在或没有权限");
        }
        return Result.ok(null, "已移入回收站，可以随时恢复");
    }

    @Override
    @Transactional
    public Result<Void> batchMoveCategory(Long userId, List<Long> wallpaperIds, Long categoryId) {
        if (wallpaperIds == null || wallpaperIds.isEmpty()) {
            return Result.fail("请先选择壁纸");
        }
        if (!canUseCategory(userId, categoryId)) {
            return Result.fail("请选择自己的分类");
        }
        List<Long> ids = wallpaperIds.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Result.fail("请先选择壁纸");
        }
        int affected = wallpaperMapper.batchMoveCategory(userId, ids, categoryId);
        return Result.ok(null, "已移动 " + affected + " 张壁纸到新分类");
    }

    @Override
    public int countOriginalByUserId(Long userId) {
        return wallpaperMapper.countOriginalByUserId(userId);
    }

    @Override
    public int sumDownloadCountByUserId(Long userId) {
        Integer count = wallpaperMapper.sumDownloadCountByUserId(userId);
        return count == null ? 0 : count;
    }

    @Override
    public void increaseDownloadCount(Long id, Long userId) {
        wallpaperMapper.increaseDownloadCount(id, userId);
    }

    private boolean canUseCategory(Long userId, Long categoryId) {
        if (categoryId == null) {
            return true;
        }
        SekaiPictureCategoryDO categoryDO = categoryMapper.selectByPrimaryKey(categoryId);
        return categoryDO != null && Objects.equals(categoryDO.getUserId(), userId);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeFilter(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        return switch (normalized) {
            case "portrait", "landscape", "square" -> normalized;
            default -> null;
        };
    }

    private String normalizeSort(String sort) {
        String normalized = trimToNull(sort);
        if (normalized == null) {
            return "latest";
        }
        return switch (normalized) {
            case "popular", "resolution", "title" -> normalized;
            default -> "latest";
        };
    }
}
