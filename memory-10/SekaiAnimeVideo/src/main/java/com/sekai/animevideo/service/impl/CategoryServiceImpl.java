package com.sekai.animevideo.service.impl;

import com.sekai.animevideo.dataobject.SekaiAnimeCategoryDO;
import com.sekai.animevideo.mapper.SekaiAnimeCategoryMapper;
import com.sekai.animevideo.model.Category;
import com.sekai.animevideo.model.Result;
import com.sekai.animevideo.service.CategoryService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class CategoryServiceImpl implements CategoryService {

    @Resource
    private SekaiAnimeCategoryMapper categoryMapper;

    @Override
    @Transactional
    public Result<Category> create(Category category) {
        if (category == null || trimToNull(category.getName()) == null)
            return Result.fail("分类名称不能为空");
        category.setName(category.getName().trim());
        categoryMapper.insert(new SekaiAnimeCategoryDO(category));
        return Result.ok(category, "分类创建成功");
    }

    @Override
    public List<Category> listByUserId(Long userId) {
        return categoryMapper.listByUserId(userId).stream()
                .map(SekaiAnimeCategoryDO::convertToCategory).toList();
    }

    @Override
    public int countByUserId(Long userId) {
        return categoryMapper.countByUserId(userId);
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
