package com.sekai.animevideo.service;

import com.sekai.animevideo.model.Favorite;
import com.sekai.animevideo.model.Result;
import java.util.List;

public interface FavoriteService {
    Result<Favorite> toggle(Long userId, Long siteId);
    int countByUserId(Long userId);
    boolean isFavorited(Long userId, Long siteId);
    List<Favorite> listByUserId(Long userId);
}
