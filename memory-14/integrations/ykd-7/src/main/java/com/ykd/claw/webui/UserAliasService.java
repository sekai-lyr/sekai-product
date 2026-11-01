package com.ykd.claw.webui;

import com.ykd.claw.webui.entity.UserAliasEntity;
import com.ykd.claw.webui.repository.UserAliasJpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** 监测看板用户的备注/别名。 */
@Service
public class UserAliasService {

    private static final int MAX_ALIAS_LENGTH = 64;

    private final UserAliasJpaRepository repository;

    public UserAliasService(UserAliasJpaRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public String getAlias(String userId) {
        if (userId == null || userId.isBlank()) return null;
        return repository.findById(userId).map(UserAliasEntity::getAlias).orElse(null);
    }

    @Transactional(readOnly = true)
    public Map<String, String> allAliases() {
        Map<String, String> result = new HashMap<>();
        repository.findAll().forEach(e -> result.put(e.getUserId(), e.getAlias()));
        return result;
    }

    /** 设置或更新别名;alias 为空或全空白则删除。 */
    @Transactional
    public void setAlias(String userId, String alias) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("userId is required");
        }
        if (alias == null || alias.isBlank()) {
            repository.deleteById(userId);
            return;
        }
        String trimmed = alias.trim();
        if (trimmed.length() > MAX_ALIAS_LENGTH) {
            trimmed = trimmed.substring(0, MAX_ALIAS_LENGTH);
        }
        String effective = trimmed;
        repository.findById(userId)
                .ifPresentOrElse(
                        entity -> {
                            entity.updateAlias(effective, Instant.now());
                            repository.save(entity);
                        },
                        () -> repository.save(new UserAliasEntity(userId, effective, Instant.now())));
    }
}
