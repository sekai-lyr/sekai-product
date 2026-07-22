package com.sekai.animevideo.service;

import com.sekai.animevideo.model.AnimeSite;
import com.sekai.animevideo.model.Category;
import com.sekai.animevideo.model.Result;
import java.util.List;

public interface AnimeSiteService {
    Result<AnimeSite> create(AnimeSite site);
    AnimeSite getById(Long id);
    List<AnimeSite> listByUserId(Long userId, Long categoryId, String keyword, int page, int pageSize);
    int countByUserId(Long userId, Long categoryId, String keyword);
    void incrementClick(Long id);
    List<AnimeSite> listHotByUserId(Long userId, int limit);
    Result<Void> deleteById(Long id, Long userId);
    Result<AnimeSite> update(AnimeSite site);
    int countTotalClicksByUserId(Long userId);
}
