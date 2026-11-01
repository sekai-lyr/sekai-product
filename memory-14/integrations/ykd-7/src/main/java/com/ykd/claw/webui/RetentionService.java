package com.ykd.claw.webui;

import com.ykd.claw.agent.repository.AgentExecutionJpaRepository;
import com.ykd.claw.agent.repository.ToolExecutionJpaRepository;
import com.ykd.claw.memory.repository.ConversationJpaRepository;
import com.ykd.claw.webui.dto.RetentionConfig;
import com.ykd.claw.webui.entity.MonitorConfigEntity;
import com.ykd.claw.webui.repository.MonitorConfigJpaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.logging.Logger;

/** 数据保留策略:配置 + 每日定时清理过期消息/执行日志。默认关闭。 */
@Service
public class RetentionService {

    private static final Logger LOGGER = Logger.getLogger(RetentionService.class.getName());
    private static final String KEY_ENABLED = "retention.enabled";
    private static final String KEY_DAYS = "retention.days";

    private final MonitorConfigJpaRepository configRepository;
    private final ConversationJpaRepository conversationRepository;
    private final AgentExecutionJpaRepository agentRepository;
    private final ToolExecutionJpaRepository toolRepository;
    private final boolean defaultEnabled;
    private final int defaultDays;

    public RetentionService(MonitorConfigJpaRepository configRepository,
                            ConversationJpaRepository conversationRepository,
                            AgentExecutionJpaRepository agentRepository,
                            ToolExecutionJpaRepository toolRepository,
                            @Value("${webui.retention-enabled:false}") boolean defaultEnabled,
                            @Value("${webui.retention-days:30}") int defaultDays) {
        this.configRepository = configRepository;
        this.conversationRepository = conversationRepository;
        this.agentRepository = agentRepository;
        this.toolRepository = toolRepository;
        this.defaultEnabled = defaultEnabled;
        this.defaultDays = defaultDays;
    }

    @Transactional(readOnly = true)
    public RetentionConfig getRetention() {
        return new RetentionConfig(readBool(KEY_ENABLED, defaultEnabled),
                Math.max(0, readInt(KEY_DAYS, defaultDays)));
    }

    @Transactional
    public RetentionConfig setRetention(boolean enabled, int days) {
        int safeDays = Math.max(1, days);
        save(KEY_ENABLED, String.valueOf(enabled));
        save(KEY_DAYS, String.valueOf(safeDays));
        return new RetentionConfig(enabled, safeDays);
    }

    /** 每日凌晨定时清理(enabled 且 days>0 时删除 N 天前的消息/执行/工具记录)。 */
    @Scheduled(cron = "${webui.retention-cron:0 0 3 * * *}")
    @Transactional
    public void runCleanup() {
        RetentionConfig config = getRetention();
        if (!config.enabled() || config.days() <= 0) return;
        Instant cutoff = Instant.now().minus(config.days(), ChronoUnit.DAYS);
        long messages = conversationRepository.deleteByCreatedTimeBefore(cutoff);
        long executions = agentRepository.deleteByStartedTimeBefore(cutoff);
        long tools = toolRepository.deleteByStartedTimeBefore(cutoff);
        LOGGER.info("retention cleanup (days=%d): messages=%d executions=%d tools=%d"
                .formatted(config.days(), messages, executions, tools));
    }

    private boolean readBool(String key, boolean def) {
        String v = configRepository.findById(key).map(MonitorConfigEntity::getValue).orElse(null);
        return v == null ? def : Boolean.parseBoolean(v);
    }

    private int readInt(String key, int def) {
        String v = configRepository.findById(key).map(MonitorConfigEntity::getValue).orElse(null);
        if (v == null) return def;
        try {
            return Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private void save(String key, String value) {
        configRepository.findById(key).ifPresentOrElse(
                entity -> {
                    entity.update(value);
                    configRepository.save(entity);
                },
                () -> configRepository.save(new MonitorConfigEntity(key, value)));
    }
}
