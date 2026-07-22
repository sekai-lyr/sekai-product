package com.sekai.animevideo.service.impl;

import com.sekai.animevideo.dataobject.SekaiAnimeSiteDO;
import com.sekai.animevideo.mapper.SekaiAnimeSiteMapper;
import com.sekai.animevideo.model.AnimeSite;
import com.sekai.animevideo.model.Result;
import com.sekai.animevideo.service.AnimeSiteService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class AnimeSiteServiceImpl implements AnimeSiteService {

    @Resource
    private SekaiAnimeSiteMapper siteMapper;

    @Override
    @Transactional
    public Result<AnimeSite> create(AnimeSite site) {
        if (site == null || trimToNull(site.getSiteName()) == null || trimToNull(site.getSiteUrl()) == null)
            return Result.fail("站点名称和URL不能为空");
        site.setClickCount(0);
        site.setStatus("ACTIVE");
        SekaiAnimeSiteDO siteDO = new SekaiAnimeSiteDO(site);
        siteMapper.insert(siteDO);
        return Result.ok(siteMapper.selectByPrimaryKey(siteDO.getId()).convertToSite(), "站点添加成功");
    }

    @Override
    public AnimeSite getById(Long id) {
        SekaiAnimeSiteDO siteDO = siteMapper.selectByPrimaryKey(id);
        return siteDO != null ? siteDO.convertToSite() : null;
    }

    @Override
    public List<AnimeSite> listByUserId(Long userId, Long categoryId, String keyword, int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        return siteMapper.listByUserId(userId, categoryId, keyword, offset, pageSize).stream()
                .map(SekaiAnimeSiteDO::convertToSite).toList();
    }

    @Override
    public int countByUserId(Long userId, Long categoryId, String keyword) {
        return siteMapper.countByUserId(userId, categoryId, keyword);
    }

    @Override
    @Transactional
    public void incrementClick(Long id) {
        siteMapper.incrementClickCount(id);
    }

    @Override
    public List<AnimeSite> listHotByUserId(Long userId, int limit) {
        return siteMapper.listHotByUserId(userId, limit).stream()
                .map(SekaiAnimeSiteDO::convertToSite).toList();
    }

    @Override
    @Transactional
    public Result<Void> deleteById(Long id, Long userId) {
        SekaiAnimeSiteDO siteDO = siteMapper.selectByPrimaryKey(id);
        if (siteDO == null || !siteDO.getUserId().equals(userId))
            return Result.fail("站点不存在或无权限删除");
        siteMapper.deleteByPrimaryKey(id);
        return Result.ok(null, "删除成功");
    }

    @Override
    @Transactional
    public Result<AnimeSite> update(AnimeSite site) {
        if (site == null || site.getId() == null) return Result.fail("站点信息不完整");
        SekaiAnimeSiteDO siteDO = new SekaiAnimeSiteDO(site);
        siteMapper.updateByPrimaryKeySelective(siteDO);
        return Result.ok(siteMapper.selectByPrimaryKey(site.getId()).convertToSite(), "更新成功");
    }

    @Override
    public int countTotalClicksByUserId(Long userId) {
        return siteMapper.countTotalClicksByUserId(userId);
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
