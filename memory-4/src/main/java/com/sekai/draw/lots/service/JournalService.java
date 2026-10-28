package com.sekai.draw.lots.service;

import com.sekai.draw.lots.mapper.JournalMapper;
import com.sekai.draw.lots.model.Wish;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class JournalService {
    private final JournalMapper mapper;
    public JournalService(JournalMapper mapper) { this.mapper = mapper; }
    public List<Wish> wishes(Long userId) { return mapper.wishes(userId); }
    @Transactional
    public Wish create(Long userId, String title) {
        if (title == null || title.isBlank() || title.trim().length() > 40) throw new IllegalArgumentException("愿望需为 1–40 个字符");
        mapper.addWish(userId, title.trim());
        return mapper.findWish(userId, title.trim());
    }
    public Wish get(Long userId, Long id) {
        Wish wish = mapper.wish(userId, id);
        if (wish == null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "愿望不存在");
        return wish;
    }
    @Transactional
    public void update(Long userId, Long id, boolean completed, String review) {
        get(userId, id);
        if (review != null && review.length() > 1000) throw new IllegalArgumentException("回顾不能超过 1000 个字符");
        mapper.updateWish(userId, id, completed, review == null ? "" : review.trim());
    }
}
