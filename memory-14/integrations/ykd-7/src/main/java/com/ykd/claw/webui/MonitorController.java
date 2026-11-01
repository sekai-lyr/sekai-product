package com.ykd.claw.webui;

import com.ykd.claw.channel.wechat.ILinkBotService;
import com.ykd.claw.memory.ConversationService;
import com.ykd.claw.webui.dto.ConversationSummary;
import com.ykd.claw.webui.dto.MessageView;
import com.ykd.claw.webui.dto.SearchResult;
import com.ykd.claw.webui.dto.WebUserSummary;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 微信多用户会话监测看板 API。
 * 只读监测 + 清空/删除 + 扫码重登 + 别名 + 搜索,不提供网页对话能力。
 */
@RestController
@RequestMapping("/api/monitor")
@ConditionalOnProperty(prefix = "webui", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MonitorController {

    private static final int DEFAULT_HISTORY_LIMIT = 20;

    private final ConversationDirectoryService directoryService;
    private final ConversationService conversationService;
    private final ILinkBotService ilinkBotService;
    private final EventStreamService eventStreamService;
    private final WechatLoginService wechatLoginService;
    private final UserAliasService userAliasService;

    public MonitorController(ConversationDirectoryService directoryService,
                             ConversationService conversationService,
                             ILinkBotService ilinkBotService,
                             EventStreamService eventStreamService,
                             WechatLoginService wechatLoginService,
                             UserAliasService userAliasService) {
        this.directoryService = directoryService;
        this.conversationService = conversationService;
        this.ilinkBotService = ilinkBotService;
        this.eventStreamService = eventStreamService;
        this.wechatLoginService = wechatLoginService;
        this.userAliasService = userAliasService;
    }

    /** 健康检查 + 渠道在线状态。 */
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "ok");
        body.put("wechatOnline", ilinkBotService.isLoggedIn());
        body.put("wechatState", ilinkBotService.getState());
        body.put("wechatLoopCount", ilinkBotService.getLoopCount());
        body.put("users", directoryService.listUsers().size());
        return body;
    }

    /** 用户目录(全部有消息记录的用户 + 会话摘要 + 别名)。 */
    @GetMapping("/users")
    public List<WebUserSummary> users() {
        return directoryService.listUsers();
    }

    /** 某用户的全部会话摘要。 */
    @GetMapping("/users/{userId}/conversations")
    public List<ConversationSummary> userConversations(@PathVariable String userId) {
        return directoryService.listConversations(userId);
    }

    /** 某会话的消息历史(只读,支持 before 游标分页)。 */
    @GetMapping("/conversations/{userId}/{conversationId}")
    public List<MessageView> history(@PathVariable String userId, @PathVariable String conversationId,
                                     @RequestParam(defaultValue = "20") int limit,
                                     @RequestParam(required = false) Long before) {
        return conversationService.getHistory(userId, conversationId, before, limit).stream()
                .map(MessageView::from)
                .toList();
    }

    /** 全文搜索消息内容 / userId。 */
    @GetMapping("/search")
    public List<SearchResult> search(@RequestParam String q,
                                     @RequestParam(defaultValue = "50") int limit) {
        return conversationService.search(q, limit).stream()
                .map(SearchResult::from)
                .toList();
    }

    /** 清空单个会话。 */
    @DeleteMapping("/conversations/{userId}/{conversationId}")
    public void clearConversation(@PathVariable String userId, @PathVariable String conversationId) {
        conversationService.clear(userId, conversationId);
    }

    /** 删除某用户的全部会话。 */
    @DeleteMapping("/users/{userId}")
    public void deleteUser(@PathVariable String userId) {
        conversationService.deleteAll(userId);
    }

    /** 设置用户别名(alias 为空则删除)。 */
    @PutMapping("/aliases/{userId}")
    public void setAlias(@PathVariable String userId, @RequestBody AliasRequest request) {
        userAliasService.setAlias(userId, request == null ? null : request.alias());
    }

    /** 删除用户别名。 */
    @DeleteMapping("/aliases/{userId}")
    public void clearAlias(@PathVariable String userId) {
        userAliasService.setAlias(userId, null);
    }

    /** SSE 事件流(新消息 / 扫码二维码 / 心跳)。 */
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() {
        return eventStreamService.connect();
    }

    /** 触发微信扫码登录(异步)。 */
    @PostMapping("/wechat/login")
    public WechatLoginService.WechatLoginState wechatLogin() {
        return wechatLoginService.startLogin();
    }

    /** 当前微信登录进度。 */
    @GetMapping("/wechat/login-status")
    public WechatLoginService.WechatLoginState wechatLoginStatus() {
        return wechatLoginService.getState();
    }

    /** 停止/取消微信登录。 */
    @PostMapping("/wechat/logout")
    public WechatLoginService.WechatLoginState wechatLogout() {
        return wechatLoginService.stopLogin();
    }

    /** 设置别名的请求体。 */
    public record AliasRequest(String alias) {
    }
}
