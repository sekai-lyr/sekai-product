package com.ykd.claw.channel.wechat;

import com.ykd.claw.channel.wechat.entity.WechatContextTokenEntity;
import com.ykd.claw.channel.wechat.repository.WechatContextTokenJpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class JpaWechatContextTokenStore implements WechatContextTokenStore {
    private final WechatContextTokenJpaRepository repository;

    public JpaWechatContextTokenStore(WechatContextTokenJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void save(String userId, String contextToken) {
        if (userId == null || userId.isBlank() || contextToken == null || contextToken.isBlank()) return;
        Instant now = Instant.now();
        WechatContextTokenEntity entity = repository.findById(userId)
                .orElseGet(() -> new WechatContextTokenEntity(userId, contextToken, now));
        entity.update(contextToken, now);
        repository.save(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, String> findAll() {
        Map<String, String> result = new LinkedHashMap<>();
        repository.findAll().forEach(entity -> result.put(entity.getUserId(), entity.getContextToken()));
        return Map.copyOf(result);
    }
}
