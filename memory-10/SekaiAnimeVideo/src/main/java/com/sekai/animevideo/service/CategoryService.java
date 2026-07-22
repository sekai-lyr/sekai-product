package com.sekai.animevideo.service;

import com.sekai.animevideo.model.Category;
import com.sekai.animevideo.model.Result;
import java.util.List;

public interface CategoryService {
    Result<Category> create(Category category);
    List<Category> listByUserId(Long userId);
    int countByUserId(Long userId);
}
