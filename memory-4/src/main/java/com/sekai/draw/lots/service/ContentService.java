package com.sekai.draw.lots.service;

import com.sekai.draw.lots.mapper.ContentMapper;
import com.sekai.draw.lots.model.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.net.URI;
import java.nio.file.*;
import java.util.*;

@Service
public class ContentService {
    private final ContentMapper mapper;
    public ContentService(ContentMapper mapper) { this.mapper = mapper; }
    public PageResult<AnimeCharacter> characters(String keyword, int page) {
        int total = mapper.countCharacters(keyword);
        page = Math.max(1, Math.min(page, Math.max(1, (total + 19) / 20)));
        return new PageResult<>(mapper.characters(keyword, (page - 1) * 20), total, page, 20);
    }
    public AnimeCharacter character(Long id) {
        var c = mapper.character(id);
        if (c == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "角色不存在");
        return c;
    }
    public List<ContentFortune> fortunes() { return mapper.fortunes(); }
    public ContentFortune fortune(Long id) {
        var f = mapper.fortune(id);
        if (f == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "签文不存在");
        return f;
    }
    public void validate(AnimeCharacter c) {
        required(c.getEnglishName(), 120, "名称"); required(c.getAnimeTitle(), 180, "系列"); required(c.getArchetype(), 40, "类型");
        optional(c.getElement(), 60, "能量"); optional(c.getQuote(), 240, "标签"); optional(c.getImageUrl(), 500, "图片地址");
        if (c.getPopularity() == null || c.getPopularity() < 0 || c.getPopularity() > 10000000) throw new IllegalArgumentException("热度需在 0–10000000 之间");
        if (c.getImageUrl() != null && !c.getImageUrl().isBlank()) {
            URI uri;
            try { uri = URI.create(c.getImageUrl()); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("图片地址格式不正确"); }
            if (!"https".equals(uri.getScheme()) || !Set.of("myanimelist.net", "cdn.myanimelist.net", "images.unsplash.com").contains(uri.getHost()) || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
                throw new IllegalArgumentException("图片需使用 MyAnimeList 或 Unsplash 的 HTTPS 地址，也可留空使用默认头像");
            }
        }
    }
    public void validate(ContentFortune f) {
        required(f.getLevelName(), 40, "等级"); required(f.getSummary(), 180, "标题"); required(f.getAdvice(), 260, "建议");
        required(f.getLuckyColor(), 60, "幸运色"); required(f.getLuckyItem(), 80, "幸运物");
        if (f.getScoreMin() < 0 || f.getScoreMax() > 100 || f.getScoreMin() > f.getScoreMax()) throw new IllegalArgumentException("分数范围需在 0–100，且下限不大于上限");
    }
    @Transactional
    public void save(AnimeCharacter c) {
        validate(c);
        if (c.getId() == null) mapper.insertCharacter(c);
        else {
            var old = character(c.getId());
            mapper.updateCharacter(c);
            if (!Objects.equals(old.getImageUrl(), c.getImageUrl())) {
                try { Files.deleteIfExists(Path.of("build-data", "image-cache", c.getId() + ".jpg")); }
                catch (java.io.IOException e) { throw new IllegalStateException("图片缓存更新失败，请重试", e); }
            }
        }
    }
    @Transactional
    public void save(ContentFortune f) { validate(f); if (f.getId() == null) mapper.insertFortune(f); else { fortune(f.getId()); mapper.updateFortune(f); } }
    private void required(String value, int max, String field) { if (value == null || value.isBlank()) throw new IllegalArgumentException("请填写" + field); optional(value, max, field); }
    private void optional(String value, int max, String field) { if (value != null && value.length() > max) throw new IllegalArgumentException(field + "不能超过 " + max + " 个字符"); }
}
