package com.sekai.picture.service;

import com.sekai.picture.mapper.SekaiPictureFavoriteMapper;
import com.sekai.picture.mapper.SekaiPictureWallpaperMapper;
import com.sekai.picture.model.Result;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.UUID;

@Service
public class ArchiveService {
    private final SekaiPictureWallpaperMapper wallpapers;
    private final SekaiPictureFavoriteMapper favorites;
    private final ImageStorage storage;
    public ArchiveService(SekaiPictureWallpaperMapper wallpapers, SekaiPictureFavoriteMapper favorites, ImageStorage storage) {
        this.wallpapers = wallpapers; this.favorites = favorites; this.storage = storage;
    }
    @Transactional
    public Result<Void> restore(Long userId, Long id) {
        return wallpapers.restore(id, userId) == 1 ? Result.ok(null, "已恢复到图库") : Result.fail("回收站中没有这张图片");
    }
    @Transactional
    public Result<Void> purge(Long userId, Long id) {
        var picture = wallpapers.findOwned(id, userId);
        if (picture == null || picture.getDeletedAt() == null) return Result.fail("只能彻底删除自己的回收站图片");
        // Restore quarantined files if the database transaction rolls back.
        var moved = new LinkedHashMap<Path, Path>();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                moved.forEach((original, temporary) -> {
                    try {
                        if (status == STATUS_COMMITTED) Files.deleteIfExists(temporary);
                        else if (Files.exists(temporary)) Files.move(temporary, original);
                    } catch (IOException e) {
                        org.slf4j.LoggerFactory.getLogger(ArchiveService.class).error("Image cleanup requires attention: {}", temporary, e);
                    }
                });
            }
        });
        try {
            Path original = storage.resolve(picture.getImageUrl());
            long references = 0;
            if (original != null) {
                for (String url : wallpapers.listImageUrls()) {
                    if (original.equals(storage.resolve(url))) references++;
                }
                if (references <= 1) quarantine(original, moved);
            }
            quarantine(storage.thumbnailPath(id), moved);
            favorites.deleteByUserIdAndWallpaperId(userId, id);
            if (wallpapers.purge(id, userId) != 1) throw new IOException("图片状态已变化");
            return Result.ok(null, "已彻底删除图片及不再使用的文件");
        } catch (IOException e) {
            org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            return Result.fail("文件正在使用或无法清理，图片仍保留在回收站，请稍后重试");
        }
    }
    private void quarantine(Path source, LinkedHashMap<Path, Path> moved) throws IOException {
        if (!Files.exists(source)) return;
        Path directory = storage.root().resolve(".purging");
        Files.createDirectories(directory);
        Path temporary = directory.resolve(UUID.randomUUID().toString());
        Files.move(source, temporary);
        moved.put(source, temporary);
    }
}
