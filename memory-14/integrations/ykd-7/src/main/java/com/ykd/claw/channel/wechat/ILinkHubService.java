package com.ykd.claw.channel.wechat;

import com.openilink.auth.LoginCallbacks;
import com.openilink.model.response.LoginResult;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Logger;

/**
 * ILink Hub 服务 - 管理多个 Bot 实例，支持多用户并发访问
 * 
 * 功能：
 * 1. 管理多个 ILinkBotService 实例
 * 2. 基于用户ID哈希分配到不同 Bot
 * 3. 支持动态添加/删除 Bot 实例
 * 4. 提供统一的消息处理接口
 */
public class ILinkHubService {

    private static final Logger LOGGER = Logger.getLogger(ILinkHubService.class.getName());

    // Bot 实例映射：botId -> ILinkBotService
    private final ConcurrentHashMap<String, ILinkBotService> botInstances = new ConcurrentHashMap<>();
    
    // 用户到 Bot 的映射：userId -> botId
    private final ConcurrentHashMap<String, String> userBotMapping = new ConcurrentHashMap<>();
    
    // Hub 级别的消息处理器（使用 ILinkBotService 的接口类型）
    private volatile ILinkBotService.CommandHandler commandHandler;
    private volatile ILinkBotService.ImageMessageHandler imageMessageHandler;
    private volatile ILinkBotService.VoiceMessageHandler voiceMessageHandler;
    private volatile ILinkBotService.FileMessageHandler fileMessageHandler;
    private volatile ILinkBotService.VideoMessageHandler videoMessageHandler;
    
    // 运行状态
    private final AtomicBoolean running = new AtomicBoolean(false);

    /**
     * 添加一个 Bot 实例
     * @param botId Bot 的唯一标识
     * @param token Bot 的 Token
     * @return 是否添加成功
     */
    public boolean addBot(String botId, String token) {
        if (botId == null || botId.isBlank() || token == null || token.isBlank()) {
            LOGGER.warning("添加 Bot 失败：botId 或 token 为空");
            return false;
        }
        
        if (botInstances.containsKey(botId)) {
            LOGGER.warning("Bot " + botId + " 已存在");
            return false;
        }
        
        try {
            // 创建 Bot 实例
            ILinkBotService botService = new ILinkBotService(token, 200, "ilink_sync_buf_" + botId + ".dat");
            
            // 设置消息处理器（包装 Hub 级别的处理器，添加用户映射逻辑）
            setupMessageHandlers(botId, botService);
            
            // 保存实例
            botInstances.put(botId, botService);
            
            LOGGER.info("Bot " + botId + " 添加成功");
            return true;
        } catch (Exception e) {
            LOGGER.severe("添加 Bot " + botId + " 失败: " + e.getMessage());
            return false;
        }
    }

    /**
     * 设置消息处理器，包装原始处理器以添加 Bot ID 信息
     */
    private void setupMessageHandlers(String botId, ILinkBotService botService) {
        // 文本消息处理器
        botService.setCommandHandler((userId, text) -> {
            userBotMapping.put(userId, botId);
            ILinkBotService.CommandHandler handler = commandHandler;
            if (handler != null) {
                return handler.handle(userId, text);
            }
            return null;
        });
        
        // 图片消息处理器
        botService.setImageMessageHandler((userId, imagePath) -> {
            userBotMapping.put(userId, botId);
            ILinkBotService.ImageMessageHandler handler = imageMessageHandler;
            if (handler != null) {
                return handler.handle(userId, imagePath);
            }
            return null;
        });
        
        // 语音消息处理器
        botService.setVoiceMessageHandler((userId, voicePath, encodeType, sampleRate) -> {
            userBotMapping.put(userId, botId);
            ILinkBotService.VoiceMessageHandler handler = voiceMessageHandler;
            if (handler != null) {
                return handler.handle(userId, voicePath, encodeType, sampleRate);
            }
            return null;
        });
        
        // 文件消息处理器
        botService.setFileMessageHandler((userId, filePath, fileName) -> {
            userBotMapping.put(userId, botId);
            ILinkBotService.FileMessageHandler handler = fileMessageHandler;
            if (handler != null) {
                return handler.handle(userId, filePath, fileName);
            }
            return null;
        });
        
        // 视频消息处理器
        botService.setVideoMessageHandler((userId, videoPath) -> {
            userBotMapping.put(userId, botId);
            ILinkBotService.VideoMessageHandler handler = videoMessageHandler;
            if (handler != null) {
                return handler.handle(userId, videoPath);
            }
            return null;
        });
    }

    /**
     * 移除一个 Bot 实例
     * @param botId Bot 的唯一标识
     * @return 是否移除成功
     */
    public boolean removeBot(String botId) {
        ILinkBotService botService = botInstances.remove(botId);
        if (botService != null) {
            botService.stop();
            botService.logout();
            
            // 清理用户映射
            userBotMapping.entrySet().removeIf(entry -> entry.getValue().equals(botId));
            
            LOGGER.info("Bot " + botId + " 已移除");
            return true;
        }
        return false;
    }

    /**
     * 启动所有 Bot 实例
     */
    public void startAll() {
        if (running.get()) {
            LOGGER.warning("Hub 已在运行中");
            return;
        }
        
        running.set(true);
        
        for (Map.Entry<String, ILinkBotService> entry : botInstances.entrySet()) {
            String botId = entry.getKey();
            ILinkBotService botService = entry.getValue();
            
            try {
                if (!botService.tryRestoreSession()) {
                    LOGGER.info("Bot " + botId + " 需要重新登录");
                } else {
                    LOGGER.info("Bot " + botId + " 会话已恢复");
                }
            } catch (Exception e) {
                LOGGER.warning("Bot " + botId + " 启动失败: " + e.getMessage());
            }
        }
        
        LOGGER.info("Hub 已启动，共 " + botInstances.size() + " 个 Bot 实例");
    }

    /**
     * 停止所有 Bot 实例
     */
    public void stopAll() {
        if (!running.get()) {
            return;
        }
        
        running.set(false);
        
        for (Map.Entry<String, ILinkBotService> entry : botInstances.entrySet()) {
            try {
                entry.getValue().stop();
            } catch (Exception e) {
                LOGGER.warning("停止 Bot " + entry.getKey() + " 失败: " + e.getMessage());
            }
        }
        
        LOGGER.info("Hub 已停止");
    }

    /**
     * 登录指定的 Bot
     * @param botId Bot 的唯一标识
     * @param callbacks 登录回调
     * @return 登录结果
     */
    public LoginResult loginBot(String botId, LoginCallbacks callbacks) {
        ILinkBotService botService = botInstances.get(botId);
        if (botService == null) {
            return LoginResult.builder()
                    .message("Bot " + botId + " 不存在")
                    .build();
        }
        
        return botService.login(callbacks);
    }

    /**
     * 根据用户 ID 获取对应的 Bot 实例
     * @param userId 用户 ID
     * @return Bot 实例，如果不存在则返回 null
     */
    public ILinkBotService getBotForUser(String userId) {
        // 首先检查是否已有映射
        String botId = userBotMapping.get(userId);
        if (botId != null) {
            return botInstances.get(botId);
        }
        
        // 如果没有映射，使用一致性哈希分配
        if (botInstances.isEmpty()) {
            return null;
        }
        
        List<String> botIds = new ArrayList<>(botInstances.keySet());
        Collections.sort(botIds);
        
        int hash = userId.hashCode() & 0x7FFFFFFF;
        int index = hash % botIds.size();
        botId = botIds.get(index);
        
        // 记录映射
        userBotMapping.put(userId, botId);
        
        return botInstances.get(botId);
    }

    /**
     * 发送消息给用户
     * @param userId 用户 ID
     * @param text 消息内容
     * @return 是否发送成功
     */
    public boolean sendMessage(String userId, String text) {
        ILinkBotService botService = getBotForUser(userId);
        if (botService == null) {
            LOGGER.warning("无法找到用户 " + userId + " 对应的 Bot");
            return false;
        }
        
        Optional<String> result = botService.sendText(userId, text);
        if (result.isPresent()) {
            LOGGER.warning("发送消息失败: " + result.get());
            return false;
        }
        return true;
    }

    /**
     * 发送图片给用户
     */
    public boolean sendImage(String userId, String imageFilePath) {
        ILinkBotService botService = getBotForUser(userId);
        if (botService == null) {
            LOGGER.warning("无法找到用户 " + userId + " 对应的 Bot");
            return false;
        }
        
        Optional<String> result = botService.sendImage(userId, imageFilePath);
        if (result.isPresent()) {
            LOGGER.warning("发送图片失败: " + result.get());
            return false;
        }
        return true;
    }

    /**
     * 发送文件给用户
     */
    public boolean sendFile(String userId, String filePath) {
        ILinkBotService botService = getBotForUser(userId);
        if (botService == null) {
            LOGGER.warning("无法找到用户 " + userId + " 对应的 Bot");
            return false;
        }
        
        Optional<String> result = botService.sendFileAttachment(userId, filePath);
        if (result.isPresent()) {
            LOGGER.warning("发送文件失败: " + result.get());
            return false;
        }
        return true;
    }

    // ==================== 设置消息处理器（使用 ILinkBotService 的接口类型） ====================

    public void setCommandHandler(ILinkBotService.CommandHandler handler) {
        this.commandHandler = handler;
    }

    public void setImageMessageHandler(ILinkBotService.ImageMessageHandler handler) {
        this.imageMessageHandler = handler;
    }

    public void setVoiceMessageHandler(ILinkBotService.VoiceMessageHandler handler) {
        this.voiceMessageHandler = handler;
    }

    public void setFileMessageHandler(ILinkBotService.FileMessageHandler handler) {
        this.fileMessageHandler = handler;
    }

    public void setVideoMessageHandler(ILinkBotService.VideoMessageHandler handler) {
        this.videoMessageHandler = handler;
    }

    // ==================== 状态查询 ====================

    /**
     * 获取所有 Bot 实例的状态
     * @return Bot ID -> 状态的映射
     */
    public Map<String, String> getBotStatus() {
        Map<String, String> status = new LinkedHashMap<>();
        for (Map.Entry<String, ILinkBotService> entry : botInstances.entrySet()) {
            status.put(entry.getKey(), entry.getValue().getState());
        }
        return status;
    }

    /**
     * 获取用户到 Bot 的映射
     * @return 用户 ID -> Bot ID 的映射
     */
    public Map<String, String> getUserBotMapping() {
        return Collections.unmodifiableMap(userBotMapping);
    }

    /**
     * 获取 Bot 实例数量
     */
    public int getBotCount() {
        return botInstances.size();
    }

    /**
     * 获取在线 Bot 数量
     */
    public int getOnlineBotCount() {
        return (int) botInstances.values().stream()
                .filter(ILinkBotService::isLoggedIn)
                .count();
    }

    /**
     * 是否正在运行
     */
    public boolean isRunning() {
        return running.get();
    }
}
