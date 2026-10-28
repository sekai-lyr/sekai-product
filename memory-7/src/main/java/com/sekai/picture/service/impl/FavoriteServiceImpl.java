package com.sekai.picture.service.impl;

import com.sekai.picture.dataobject.SekaiPictureFavoriteDO;
import com.sekai.picture.mapper.SekaiPictureFavoriteMapper;
import com.sekai.picture.model.Favorite;
import com.sekai.picture.model.Result;
import com.sekai.picture.service.FavoriteService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FavoriteServiceImpl implements FavoriteService {

    @Resource
    private SekaiPictureFavoriteMapper favoriteMapper;

    @Resource
    private com.sekai.picture.mapper.SekaiPictureWallpaperMapper wallpaperMapper;

    @Override
    @Transactional
    public Result<Void> toggle(Long userId, Long wallpaperId) {
        if (wallpaperMapper.selectByIdAndUserId(wallpaperId, userId) == null) return Result.fail("壁纸不存在或没有权限");
        if (favoriteMapper.selectByUserIdAndWallpaperId(userId, wallpaperId) != null) {
            favoriteMapper.deleteByUserIdAndWallpaperId(userId, wallpaperId);
            return Result.ok(null, "已取消收藏");
        }
        Favorite favorite = new Favorite();
        favorite.setUserId(userId);
        favorite.setWallpaperId(wallpaperId);
        favoriteMapper.insertIgnore(new SekaiPictureFavoriteDO(favorite));
        return Result.ok(null, "收藏成功");
    }

    @Override
    @Transactional
    public Result<Void> batchSet(Long userId, List<Long> wallpaperIds, boolean favorite) {
        if (wallpaperIds == null || wallpaperIds.isEmpty()) {
            return Result.fail("请先选择壁纸");
        }
        wallpaperIds = wallpaperIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (wallpaperIds.size() > 100) return Result.fail("每次最多处理 100 张图片");
        for (Long id : wallpaperIds) {
            if (wallpaperMapper.selectByIdAndUserId(id, userId) == null) return Result.fail("所选图片不存在或没有权限");
        }
        int changed = 0;
        for (Long wallpaperId : wallpaperIds) {
            if (wallpaperId == null) {
                continue;
            }
            if (favorite) {
                Favorite item = new Favorite();
                item.setUserId(userId);
                item.setWallpaperId(wallpaperId);
                changed += favoriteMapper.insertIgnore(new SekaiPictureFavoriteDO(item));
            } else {
                changed += favoriteMapper.deleteByUserIdAndWallpaperId(userId, wallpaperId);
            }
        }
        String action = favorite ? "批量收藏" : "批量取消收藏";
        return Result.ok(null, action + "完成，处理 " + changed + " 张壁纸");
    }

    @Override
    public int countByUserId(Long userId) {
        return favoriteMapper.countByUserId(userId);
    }
}
