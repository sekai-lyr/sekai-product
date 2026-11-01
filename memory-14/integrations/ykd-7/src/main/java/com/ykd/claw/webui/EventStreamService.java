package com.ykd.claw.webui;

import com.ykd.claw.agent.AgentAuditService;
import com.ykd.claw.channel.wechat.ILinkBotService;
import com.ykd.claw.webui.dto.ActivityEvent;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;

/**
 * 向监测看板推送实时事件(SSE):
 * - 微信新消息到达(message 事件)
 * - 扫码登录二维码(wechat-qr 事件)
 * - Agent / 工具 / 消息审计活动(activity 事件,带环形缓冲供历史加载)
 * 附带定时心跳防止代理断连。
 */
@Component
public class EventStreamService {

    private static final int MAX_ACTIVITY = 200;

    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<ActivityEvent> activity = new CopyOnWriteArrayList<>();

    public EventStreamService(ILinkBotService ilinkBotService,
                              AgentAuditService agentAuditService,
                              ThreadPoolTaskScheduler taskScheduler) {
        ilinkBotService.addMessageListener(this::onMessage);
        agentAuditService.addActivityListener(this::onAuditActivity);
        taskScheduler.scheduleWithFixedDelay(this::heartbeat, TimeUnit.SECONDS.toMillis(25));
    }

    /** 为看板建立一个长连接。 */
    public SseEmitter connect() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        return emitter;
    }

    /** 推一个命名事件给所有看板连接。 */
    public void publish(String event, Object data) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(event).data(data));
            } catch (IOException | IllegalStateException e) {
                emitters.remove(emitter);
            }
        }
    }

    /** 最近 N 条动态(按发生顺序,供 /activity 端点返回历史)。 */
    public List<ActivityEvent> recentActivity(int limit) {
        int n = Math.min(Math.max(1, limit), activity.size());
        if (activity.size() <= n) {
            return List.copyOf(activity);
        }
        return List.copyOf(activity.subList(activity.size() - n, activity.size()));
    }

    private void onMessage(ILinkBotService.ReceivedMessage message) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("userId", message.getFromUserId());
        payload.put("text", message.getText());
        payload.put("timestamp", message.getTimestamp());
        publish("message", payload);
        recordActivity(new ActivityEvent("message", message.getFromUserId(),
                excerpt(message.getText()), Instant.ofEpochMilli(message.getTimestamp())));
    }

    private void onAuditActivity(AgentAuditService.AuditActivity audit) {
        recordActivity(new ActivityEvent(audit.type(), audit.userId(), audit.summary(), audit.timestamp()));
    }

    private void recordActivity(ActivityEvent event) {
        activity.add(event);
        while (activity.size() > MAX_ACTIVITY) {
            activity.remove(0);
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", event.type());
        payload.put("userId", event.userId());
        payload.put("summary", event.summary());
        payload.put("timestamp", event.timestamp() == null ? null : event.timestamp().toString());
        publish("activity", payload);
    }

    private static String excerpt(String text) {
        if (text == null || text.isBlank()) return "";
        String flat = text.replaceAll("\\s+", " ").trim();
        return flat.length() > 60 ? flat.substring(0, 60) + "…" : flat;
    }

    private void heartbeat() {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().comment("ping"));
            } catch (IOException | IllegalStateException e) {
                emitters.remove(emitter);
            }
        }
    }
}
