package com.sekai.animevideo.service.impl;

import com.sekai.animevideo.dataobject.SekaiAnimeFavoriteDO;
import com.sekai.animevideo.mapper.SekaiAnimeFavoriteMapper;
import com.sekai.animevideo.model.Favorite;
import com.sekai.animevideo.model.Result;
import com.sekai.animevideo.service.FavoriteService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class FavoriteServiceImpl implements FavoriteService {

    @Resource
    private SekaiAnimeFavoriteMapper favoriteMapper;

    @Override
    @Transactional
    public Result<Favorite> toggle(Long userId, Long siteId) {
        if (favoriteMapper.existsByUserAndSite(userId, siteId)) {
            favoriteMapper.deleteByUserAndSite(userId, siteId);
            return Result.ok(null, "已取消收藏");
        } else {
            SekaiAnimeFavoriteDO favDO = new SekaiAnimeFavoriteDO();
            favDO.setUserId(userId);
            favDO.setSiteId(siteId);
            favoriteMapper.insert(favDO);
            return Result.ok(favDO.convertToFavorite(), "收藏成功");
        }
    }

    @Override
    public int countByUserId(Long userId) {
        return favoriteMapper.countByUserId(userId);
    }

    @Override
    public boolean isFavorited(Long userId, Long siteId) {
        return favoriteMapper.existsByUserAndSite(userId, siteId);
    }

    @Override
    public List<Favorite> listByUserId(Long userId) {
        return favoriteMapper.listByUserId(userId).stream()
                .map(SekaiAnimeFavoriteDO::convertToFavorite).toList();
    }
}
