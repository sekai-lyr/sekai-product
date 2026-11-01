package com.ykd.claw.channel.wechat;

import com.openilink.ILinkClient;
import com.openilink.auth.LoginCallbacks;
import com.openilink.exception.NoContextTokenException;
import com.openilink.model.WeixinMessage;
import com.openilink.model.response.LoginResult;
import com.openilink.monitor.MessageHandler;
import com.openilink.monitor.MonitorOptions;
import com.openilink.util.MessageHelper;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.ykd.claw.document.DocumentReaderService;

import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ILinkBotService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ILinkBotService.class.getName());
    private static final String DEFAULT_SYNC_BUF_FILE = "ilink_sync_buf.dat";
    private static final String SESSION_FILE = "ilink_session.json";
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final ILinkClient client;
    private final java.net.http.HttpClient cdnHttpClient;
    private final AtomicBoolean stopFlag = new AtomicBoolean(false);
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicInteger monitorLoopCount = new AtomicInteger(0);
    private final AtomicReference<String> state = new AtomicReference<>("未登录");
    private final AtomicReference<LoginResult> loginResult = new AtomicReference<>();
    private final CopyOnWriteArrayList<ReceivedMessage> receivedMessages = new CopyOnWriteArrayList<>();
    private final List<Consumer<ReceivedMessage>> messageListeners = new CopyOnWriteArrayList<>();
    private final int maxMessages;
    private final String syncBufFile;
    private final WechatContextTokenStore contextTokenStore;

    private volatile CommandHandler commandHandler;
    private volatile ImageMessageHandler imageMessageHandler;
    private volatile VoiceMessageHandler voiceMessageHandler;
    private volatile FileMessageHandler fileMessageHandler;
    private volatile VideoMessageHandler videoMessageHandler;

    private volatile Thread monitorThread;
    private PrintStream consoleOut;

    public ILinkBotService(String token) {
        this(token, 200);
    }

    public ILinkBotService(String token, int maxMessages) {
        this(token, maxMessages, DEFAULT_SYNC_BUF_FILE);
    }

    public ILinkBotService(String token, int maxMessages, String syncBufFile) {
        this(token, maxMessages, syncBufFile, null);
    }

    public ILinkBotService(String token, int maxMessages, String syncBufFile,
                           WechatContextTokenStore contextTokenStore) {
        this.maxMessages = maxMessages;
        this.syncBufFile = (syncBufFile != null && !syncBufFile.isBlank())
                ? syncBufFile : DEFAULT_SYNC_BUF_FILE;
        this.client = ILinkClient.builder()
                .token(token != null ? token : "")
                .build();
        this.cdnHttpClient = java.net.http.HttpClient.newBuilder()
                .followRedirects(java.net.http.HttpClient.Redirect.NORMAL)
                .connectTimeout(java.time.Duration.ofSeconds(30))
                .build();
        this.contextTokenStore = contextTokenStore;
        this.consoleOut = System.out;
    }

    // ==================== 命令处理器 ====================

    public void setCommandHandler(CommandHandler handler) {
        this.commandHandler = handler;
    }

    @FunctionalInterface
    public interface CommandHandler {
        String handle(String fromUserId, String text);
    }

    // ==================== 图片消息处理器 ====================

    public void setImageMessageHandler(ImageMessageHandler handler) {
        this.imageMessageHandler = handler;
    }

    public void setVoiceMessageHandler(VoiceMessageHandler handler) {
        this.voiceMessageHandler = handler;
    }

    public void setFileMessageHandler(FileMessageHandler handler) {
        this.fileMessageHandler = handler;
    }

    public void setVideoMessageHandler(VideoMessageHandler handler) {
        this.videoMessageHandler = handler;
    }

    @FunctionalInterface
    public interface ImageMessageHandler {
        /** 处理收到的图片消息，传入用户ID和解密后的图片文件路径 */
        String handle(String fromUserId, java.nio.file.Path decryptedImagePath);
    }

    public interface VoiceMessageHandler {
        /** Handle received voice message, with decrypted file path and metadata */
        String handle(String fromUserId, java.nio.file.Path decryptedVoicePath,
                      int encodeType, int sampleRate);
    }

    @FunctionalInterface
    public interface VideoMessageHandler {
        /** Handle received video message, with decrypted video file path */
        String handle(String fromUserId, java.nio.file.Path decryptedVideoPath);
    }

// ==================== 登录 ====================

    /**
     * 扫码登录。线程安全：同一时刻只允许一个登录；
     * 若已登录则先停止当前会话；callbacks 不能为 null。
     */
    public synchronized LoginResult login(LoginCallbacks callbacks) {
        if (callbacks == null) {
            throw new IllegalArgumentException("callbacks 不能为 null");
        }

        // 若已登录，先停止
        if (isLoggedIn()) {
            LOGGER.info("已登录，先停止当前会话再重新登录");
            stop();
        }

        state.set("登录中（等待扫码）...");

        LoginResult result = client.loginWithQR(callbacks);

        if (result.isConnected()) {
            restoreContextTokens();
            loginResult.set(result);
            LOGGER.info("iLink 登录成功 - BotID=" + result.getBotId()
                    + ", UserID=" + result.getUserId()
                    + ", baseUrl=" + result.getBaseUrl());
            doStartMonitor();
        } else {
            state.set("登录失败: " + result.getMessage());
            LOGGER.warn("iLink 登录失败: " + result.getMessage());
        }

                // Persist session on success
        if (result.isConnected()) {
            saveSession(result);
        }

        return result;
    }

    // ==================== Session persistence ====================

    /**
     * Try to restore a previously saved login session (skip QR code).
     * Returns true if session was restored successfully.
     */
    public synchronized boolean tryRestoreSession() {
        try {
            Path path = Paths.get(SESSION_FILE);
            if (!Files.exists(path)) {
                return false;
            }
            String json = Files.readString(path, StandardCharsets.UTF_8);
            LoginResult saved = GSON.fromJson(json, LoginResult.class);
            if (saved == null || !saved.isConnected() || saved.getBotToken() == null || saved.getBotToken().isBlank()) {
                LOGGER.info("Saved session invalid, removing");
                Files.deleteIfExists(path);
                return false;
            }

            LOGGER.info("Restoring saved session - BotID=" + saved.getBotId());
            client.setToken(saved.getBotToken());
            if (saved.getBaseUrl() != null && !saved.getBaseUrl().isBlank()) {
                client.setBaseUrl(saved.getBaseUrl());
            }

            // The saved token may have expired server-side (errcode -14 session
            // timeout). Probe it before starting the monitor so a stale session
            // fails fast and falls back to QR login, instead of silently polling
            // a dead token in a 5-minute retry loop.
            if (client.probeFreshSession() == null) {
                LOGGER.warn("已保存的会话已过期(session timeout), 请重新扫码登录");
                clearSession();
                clearSyncBuf();
                loginResult.set(null);
                state.set("会话已过期，需要重新登录");
                return false;
            }

            loginResult.set(saved);
            state.set("已登录(已恢复)");
            restoreContextTokens();
            doStartMonitor();
            LOGGER.info("Session restored and monitor started");
            return true;
        } catch (Exception e) {
            LOGGER.warn( "Failed to restore session", e);
            return false;
        }
    }

    private void saveSession(LoginResult result) {
        try {
            String json = GSON.toJson(result);
            Files.writeString(Paths.get(SESSION_FILE), json, StandardCharsets.UTF_8);
            LOGGER.info("Session saved to " + SESSION_FILE);
        } catch (IOException e) {
            LOGGER.warn( "Failed to save session", e);
        }
    }

    private void clearSession() {
        try {
            Files.deleteIfExists(Paths.get(SESSION_FILE));
            LOGGER.info("Session file deleted");
        } catch (IOException e) {
            LOGGER.warn( "Failed to delete session file", e);
        }
    }

    // ====================================== 监听 ====================

    public void startMonitor() {
        if (running.get()) {
            consoleOut.println("[iLink] 已在监听中");
            return;
        }
        if (!isLoggedIn()) {
            consoleOut.println("[iLink] 请先执行 ilink login");
            return;
        }
        doStartMonitor();
    }

    private synchronized void doStartMonitor() {
        if (running.get()) {
            return;
        }

        stopFlag.set(false);
        running.set(true);
        monitorLoopCount.set(0);
        state.set("监听中");

        String initialBuf = loadSyncBuf();
        LOGGER.info("启动监听, initialSyncBuf=" + (initialBuf.isEmpty() ? "(empty)" : initialBuf));

        MonitorOptions options = MonitorOptions.builder()
                .initialBuf(initialBuf)
                .onBufUpdate(this::saveSyncBuf)
                .build();

        monitorThread = new Thread(() -> {
            try {
                client.monitor((MessageHandler) msg -> {
                    monitorLoopCount.incrementAndGet();

                    if (msg == null) {
                        return;
                    }

                    String userId = msg.getFromUserId();
                    String text = MessageHelper.extractText(msg);
                    String ctxToken = msg.getContextToken();
                    
                    // 调试日志：显示 contextToken 状态
                    consoleOut.println("[调试] 收到消息 from=" + userId + ", contextToken=" + 
                                      (ctxToken != null && !ctxToken.isBlank() ? "有(" + ctxToken.length() + "字符)" : "无"));
                    
                    persistContextToken(userId, ctxToken);


                    // ===== 图片/语音/文件消息处理 =====
                    boolean mediaHandled = false;
                    java.util.List<com.openilink.model.MessageItem> items = msg.getItemList();
                    if (items != null) {
                        for (com.openilink.model.MessageItem item : items) {
                            if (item.getType() == com.openilink.model.MessageItemType.IMAGE
                                    && item.getImageItem() != null) {
                                consoleOut.println("[微信-图片] " + userId);
                                ImageMessageHandler imgHandler = imageMessageHandler;
                                if (imgHandler != null) {
                                    try {
                                        java.nio.file.Path decrypted = downloadAndDecryptImage(item.getImageItem());
                                        String reply = imgHandler.handle(userId, decrypted);
                                        try { java.nio.file.Files.deleteIfExists(decrypted); } catch (Exception e) { LOGGER.debug( "删除临时图片文件失败", e); }
                                        if (reply != null && !reply.isBlank()) {
                                            try {
                                                client.push(userId, reply);
                                            } catch (Exception ex) {
                                                LOGGER.warn( "图片回复失败", ex);
                                            }
                                        }
                                    } catch (Exception imgEx) {
                                        LOGGER.error( "图片处理失败", imgEx);
                                        try { client.push(userId, "图片识别失败: " + imgEx.getMessage()); } catch (Exception pushEx) { LOGGER.warn( "图片错误通知推送失败", pushEx); }
                                    }
                                }
                                mediaHandled = true;
                                break;
                            }
                            if (item.getType() == com.openilink.model.MessageItemType.VOICE
                                    && item.getVoiceItem() != null) {
                                consoleOut.println("[微信-语音] " + userId);
                                VoiceMessageHandler voiceHandler = voiceMessageHandler;
                                if (voiceHandler != null) {
                                    try {
                                        com.openilink.model.VoiceItem vi = item.getVoiceItem();
                                        java.nio.file.Path decrypted = downloadAndDecryptVoice(vi);
                                        String reply = voiceHandler.handle(userId, decrypted,
                                                vi.getEncodeType() != null ? vi.getEncodeType() : 6,
                                                vi.getSampleRate() != null ? vi.getSampleRate() : 16000);
                                        try { java.nio.file.Files.deleteIfExists(decrypted); } catch (Exception e) { LOGGER.debug( "删除临时语音文件失败", e); }
                                        if (reply != null && !reply.isBlank()) {
                                            try {
                                                client.push(userId, reply);
                                            } catch (Exception ex) {
                                                LOGGER.warn( "语音回复失败", ex);
                                            }
                                        }
                                    } catch (Exception voiceEx) {
                                        LOGGER.error( "语音处理失败", voiceEx);
                                        try { client.push(userId, "语音处理失败: " + voiceEx.getMessage()); } catch (Exception pushEx) { LOGGER.warn( "语音错误通知推送失败", pushEx); }
                                    }
                                }
                                mediaHandled = true;
                                break;
                            }

                            if (item.getType() == com.openilink.model.MessageItemType.FILE
                                    && item.getFileItem() != null) {
                                FileMessageHandler handler = fileMessageHandler;
                                if (handler != null) {
                                    java.nio.file.Path decrypted = null;
                                    try {
                                        com.openilink.model.FileItem fileItem = item.getFileItem();
                                        decrypted = downloadAndDecryptFile(fileItem);
                                        String reply = handler.handle(userId, decrypted, fileItem.getFileName());
                                        if (reply != null && !reply.isBlank()) client.push(userId, reply);
                                    } catch (Exception fileEx) {
                                        LOGGER.error( "Document processing failed", fileEx);
                                        try { client.push(userId, "Document reading failed: " + fileEx.getMessage()); }
                                        catch (Exception pushEx) { LOGGER.warn( "文件错误通知推送失败", pushEx); }
                                    } finally {
                                        if (decrypted != null) {
                                            try { java.nio.file.Files.deleteIfExists(decrypted); }
                                            catch (Exception delEx) { LOGGER.debug( "删除临时文件失败", delEx); }
                                        }
                                    }
                                    mediaHandled = true;
                                    return;
                                }
                                break;
                            }

                            if (item.getType() == com.openilink.model.MessageItemType.VIDEO
                                    && item.getVideoItem() != null) {
                                consoleOut.println("[微信-视频] " + userId);
                                VideoMessageHandler vidHandler = videoMessageHandler;
                                if (vidHandler != null) {
                                    java.nio.file.Path decrypted = null;
                                    try {
                                        decrypted = downloadAndDecryptVideo(item.getVideoItem());
                                        String reply = vidHandler.handle(userId, decrypted);
                                        if (reply != null && !reply.isBlank()) {
                                            try {
                                                client.push(userId, reply);
                                            } catch (Exception ex) {
                                                LOGGER.warn("视频回复失败", ex);
                                            }
                                        }
                                    } catch (Exception vidEx) {
                                        LOGGER.error("视频处理失败", vidEx);
                                        try { client.push(userId, "视频识别失败: " + vidEx.getMessage()); } catch (Exception pushEx) { LOGGER.warn("视频错误通知推送失败", pushEx); }
                                    } finally {
                                        if (decrypted != null) {
                                            try { java.nio.file.Files.deleteIfExists(decrypted); }
                                            catch (Exception delEx) { LOGGER.debug("删除临时视频文件失败", delEx); }
                                        }
                                    }
                                }
                                mediaHandled = true;
                                break;
                            }

                        }
                    }

                    // 只有没处理过媒体消息时，才处理文本
                    if (!mediaHandled && userId != null && text != null && !text.isBlank()) {
                        ReceivedMessage received = new ReceivedMessage(
                                userId,
                                msg.getToUserId(),
                                text,
                                System.currentTimeMillis()
                        );

                        // 缓存
                        receivedMessages.add(received);
                        while (receivedMessages.size() > maxMessages) {
                            receivedMessages.remove(0);
                        }

                        // 控制台输出
                        consoleOut.println("[微信] " + userId + ": " + text);

                        // 命令处理器
                        CommandHandler handler = commandHandler;
                        if (handler != null) {
                            String reply;
                            try {
                                reply = handler.handle(userId, text);
                            } catch (Exception handlerEx) {
                                LOGGER.warn( "消息处理异常", handlerEx);
                                consoleOut.println("[处理异常] " + handlerEx.getMessage());
                                return;
                            }
                            if (reply != null && !reply.isBlank()) {
                                try {
                                    client.push(userId, reply);
                                    consoleOut.println("[回复] -> " + userId + ": " + reply);
                                } catch (com.openilink.exception.NoContextTokenException noCtxEx) {
                                    LOGGER.warn("回复失败：缺少 contextToken，用户=" + userId);
                                    consoleOut.println("[回复失败] 用户 " + userId + " 缺少 contextToken，无法回复");
                                    consoleOut.println("[提示] iLink 平台可能只对登录者本人提供 contextToken");
                                } catch (Exception ex) {
                                    LOGGER.warn( "回复失败", ex);
                                    consoleOut.println("[回复失败] " + ex.getMessage());
                                }
                            }
                        }

                        // 通知其他监听器
                        for (Consumer<ReceivedMessage> listener : messageListeners) {
                            try { listener.accept(received); } catch (Exception ex) {
                                LOGGER.warn( "消息监听器异常", ex);
                            }
                        }
                    }
                }, options, stopFlag);
            } catch (Exception e) {
                LOGGER.error( "监控异常退出 (loop=" + monitorLoopCount.get() + ")", e);
                consoleOut.println("[iLink] 异常: " + e.getClass().getSimpleName() + " - " + e.getMessage());
                state.set("异常");
            } finally {
                running.set(false);
                LOGGER.info("监控结束, loops=" + monitorLoopCount.get() + ", msgs=" + receivedMessages.size());
            }
        }, "ilink-monitor");

        monitorThread.setDaemon(false);
        monitorThread.start();
        LOGGER.info("监控线程已启动, alive=" + monitorThread.isAlive());
    }

    // ==================== 发送消息 ====================

    /**
     * 发送文本消息。
     * @return 成功时返回 Optional.empty()，失败时返回含错误信息的 Optional
     */
    public Optional<String> sendText(String toUserId, String text) {
        if (!isLoggedIn()) {
            return Optional.of("错误: 请先执行 ilink login");
        }
        try {
            client.push(toUserId, text);
            LOGGER.info("消息已发送 -> " + toUserId);
            return Optional.empty();
        } catch (NoContextTokenException e) {
            return Optional.of("无法发送: 需先收到该用户的消息（缺少上下文令牌）");
        } catch (Exception e) {
            LOGGER.error( "发送失败", e);
            return Optional.of("发送失败: " + e.getMessage());
        }
    }

    void restoreContextTokens() {
        if (contextTokenStore == null) return;
        try {
            contextTokenStore.findAll().forEach(client::setContextToken);
        } catch (RuntimeException e) {
            LOGGER.warn( "Unable to restore persisted WeChat context tokens", e);
        }
    }

    void persistContextToken(String userId, String contextToken) {
        if (contextTokenStore == null || userId == null || userId.isBlank()
                || contextToken == null || contextToken.isBlank()) return;
        try {
            contextTokenStore.save(userId, contextToken);
        } catch (RuntimeException e) {
            LOGGER.warn( "Unable to persist WeChat context token for user " + userId, e);
        }
    }

    // ==================== 发送图片 ====================

    /**
     * 发送图片给用户（上传到微信CDN）。
     */
    public Optional<String> sendImage(String toUserId, String imageFilePath) {
        if (!isLoggedIn()) {
            return Optional.of("错误: 请先执行 ilink login");
        }
        try {
            java.nio.file.Path imagePath = java.nio.file.Path.of(imageFilePath);
            if (!java.nio.file.Files.exists(imagePath)) {
                return Optional.of("图片文件不存在: " + imageFilePath);
            }
            client.pushImage(toUserId, imagePath);
            LOGGER.info("图片已发送 -> " + toUserId);
            return Optional.empty();
        } catch (NoContextTokenException e) {
            return Optional.of("发送失败: 用户尚未发起会话");
        } catch (Exception e) {
            LOGGER.error( "发送图片失败", e);
            return Optional.of("图片发送失败: " + e.getMessage());
        }
    }


    // ==================== 停止 / 登出 ====================

    public void stop() {
        if (stopFlag.getAndSet(true)) {
            return;
        }
        state.set("已停止");
        if (monitorThread != null) {
            monitorThread.interrupt();
            try { monitorThread.join(3000); } catch (InterruptedException ignored) {}
        }
        LOGGER.info("监控已停止 (loops=" + monitorLoopCount.get() + ")");
    }

    /**
     * 登出：停止监控 + 释放 ILinkClient 资源 + 重置登录态。
     */
    public void logout() {
        stop();
        loginResult.set(null);
        state.set("未登录");
        LOGGER.info("已登出，资源已释放");
    }

    @FunctionalInterface
    public interface FileMessageHandler {
        String handle(String fromUserId, java.nio.file.Path decryptedFilePath, String fileName);
    }

    /** Sends a local file through the officially supported FILE attachment path. */
    public Optional<String> sendFileAttachment(String toUserId, String filePath) {
        if (!isLoggedIn()) {
            return Optional.of("Not logged in to iLink");
        }
        try {
            java.nio.file.Path attachment = java.nio.file.Path.of(filePath);
            if (!java.nio.file.Files.isRegularFile(attachment)) {
                return Optional.of("File does not exist: " + filePath);
            }
            if (java.nio.file.Files.size(attachment) == 0) {
                return Optional.of("File is empty: " + filePath);
            }
            client.pushFile(toUserId, attachment);
            LOGGER.info("File attachment sent -> " + toUserId + ": " + attachment.getFileName());
            return Optional.empty();
        } catch (NoContextTokenException e) {
            return Optional.of("Cannot send: missing conversation context token");
        } catch (Exception e) {
            LOGGER.error( "Failed to send file attachment", e);
            return Optional.of("Failed to send file attachment: " + e.getMessage());
        }
    }

    /** TTS audio is deliberately sent as FILE because outbound VOICE is not supported. */
    public Optional<String> sendAudioAttachment(String toUserId, String audioFilePath) {
        return sendFileAttachment(toUserId, audioFilePath);
    }

// ==================== 状态查询 ====================

    public List<ReceivedMessage> getReceivedMessages() {
        return Collections.unmodifiableList(receivedMessages);
    }

    /** 注册收到微信文本消息的监听器(供监测看板 SSE 推送)。 */
    public void addMessageListener(Consumer<ReceivedMessage> listener) {
        if (listener != null) {
            messageListeners.add(listener);
        }
    }

    /** 移除之前注册的消息监听器。 */
    public void removeMessageListener(Consumer<ReceivedMessage> listener) {
        if (listener != null) {
            messageListeners.remove(listener);
        }
    }

    public boolean isRunning() {
        return running.get();
    }

    public boolean isLoggedIn() {
        LoginResult result = loginResult.get();
        return result != null && result.isConnected();
    }

    public String getState() {
        return state.get();
    }

    public LoginResult getLoginResult() {
        return loginResult.get();
    }

    public int getLoopCount() {
        return monitorLoopCount.get();
    }

    // ==================== 内部 ====================

    private String loadSyncBuf() {
        try {
            Path path = Paths.get(syncBufFile);
            if (Files.exists(path)) {
                return Files.readString(path).trim();
            }
        } catch (IOException e) {
            LOGGER.warn( "读取 sync_buf 失败", e);
        }
        return "";
    }

    private void saveSyncBuf(String buf) {
        try {
            Files.writeString(Paths.get(syncBufFile), buf);
        } catch (IOException e) {
            LOGGER.warn( "保存 sync_buf 失败", e);
        }
    }

    private void clearSyncBuf() {
        try {
            Files.deleteIfExists(Paths.get(syncBufFile));
        } catch (IOException e) {
            LOGGER.warn( "删除 sync_buf 失败", e);
        }
    }

    // ==================== 数据类 ====================

    public static class ReceivedMessage {
        private final String fromUserId;
        private final String toUserId;
        private final String text;
        private final long timestamp;

        public ReceivedMessage(String fromUserId, String toUserId, String text, long timestamp) {
            this.fromUserId = fromUserId;
            this.toUserId = toUserId;
            this.text = text;
            this.timestamp = timestamp;
        }

        public String getFromUserId() {
            return fromUserId;
        }

        public String getToUserId() {
            return toUserId;
        }

        public String getText() {
            return text;
        }

        public long getTimestamp() {
            return timestamp;
        }

        @Override
        public String toString() {
            return "[" + fromUserId + "] " + text;
        }
    }

    // ==================== CDN 图片下载解密 ====================

    /**
     * 从微信CDN下载加密图片并AES解密，返回解密后的临时文件路径。
     */
    private java.nio.file.Path downloadAndDecryptImage(com.openilink.model.ImageItem imageItem) throws Exception {
        com.openilink.model.CDNMedia media = imageItem.getMedia();
        if (media == null) media = imageItem.getThumbMedia();
        if (media == null) throw new IOException("no CDN media in image");

        String encryptQueryParam = media.getEncryptQueryParam();
        String aesKeyStr = media.getAesKey();
        if (encryptQueryParam == null || aesKeyStr == null) {
            throw new IOException("missing encrypt param or aes key");
        }

        // Download encrypted file from CDN
        String downloadUrl = "https://novac2c.cdn.weixin.qq.com/c2c/download?encrypted_query_param="
                + java.net.URLEncoder.encode(encryptQueryParam, java.nio.charset.StandardCharsets.UTF_8);
        LOGGER.info("Downloading encrypted image from CDN...");
        java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(downloadUrl)).GET().build();
        java.net.http.HttpResponse<byte[]> resp = cdnHttpClient.send(req, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
        if (resp.statusCode() != 200) throw new IOException("CDN download failed: HTTP " + resp.statusCode());
        byte[] encrypted = resp.body();
        LOGGER.info("Downloaded " + encrypted.length + " encrypted bytes");

        // Decrypt with AES/ECB
        byte[] key = decodeAesKey(aesKeyStr);
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(javax.crypto.Cipher.DECRYPT_MODE, new javax.crypto.spec.SecretKeySpec(key, "AES"));
        byte[] decrypted = cipher.doFinal(encrypted);

        // Save to temp file
        java.nio.file.Path tempFile = java.nio.file.Files.createTempFile("wechat-img-", ".jpg");
        java.nio.file.Files.write(tempFile, decrypted);
        LOGGER.info("Image decrypted to: " + tempFile);
        return tempFile;
    }

    /**
     * 下载并解密视频消息
     */
    private java.nio.file.Path downloadAndDecryptVideo(com.openilink.model.VideoItem videoItem) throws Exception {
        com.openilink.model.CDNMedia media = videoItem.getMedia();
        if (media == null) throw new IOException("no CDN media in video");

        String encryptQueryParam = media.getEncryptQueryParam();
        String aesKeyStr = media.getAesKey();
        if (encryptQueryParam == null || aesKeyStr == null) {
            throw new IOException("missing encrypt param or aes key");
        }

        // Download encrypted file from CDN
        String downloadUrl = "https://novac2c.cdn.weixin.qq.com/c2c/download?encrypted_query_param="
                + java.net.URLEncoder.encode(encryptQueryParam, java.nio.charset.StandardCharsets.UTF_8);
        LOGGER.info("Downloading encrypted video from CDN...");
        java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(downloadUrl)).GET().build();
        java.net.http.HttpResponse<byte[]> resp = cdnHttpClient.send(req, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
        if (resp.statusCode() != 200) throw new IOException("CDN download failed: HTTP " + resp.statusCode());
        byte[] encrypted = resp.body();
        LOGGER.info("Downloaded " + encrypted.length + " encrypted video bytes");

        // Decrypt with AES/ECB
        byte[] key = decodeAesKey(aesKeyStr);
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(javax.crypto.Cipher.DECRYPT_MODE, new javax.crypto.spec.SecretKeySpec(key, "AES"));
        byte[] decrypted = cipher.doFinal(encrypted);

        // Save to temp file with .mp4 extension
        java.nio.file.Path tempFile = java.nio.file.Files.createTempFile("wechat-video-", ".mp4");
        java.nio.file.Files.write(tempFile, decrypted);
        LOGGER.info("Video decrypted to: " + tempFile);
        return tempFile;
    }

    /**
     * ???CDN???????AES?????????SILK/AMR???????
     */
    private java.nio.file.Path downloadAndDecryptVoice(com.openilink.model.VoiceItem voiceItem) throws Exception {
        LOGGER.info("Voice encodeType=" + voiceItem.getEncodeType()
                + " sampleRate=" + voiceItem.getSampleRate()
                + " bitsPerSample=" + voiceItem.getBitsPerSample()
                + " playTime=" + voiceItem.getPlayTime());
        com.openilink.model.CDNMedia media = voiceItem.getMedia();
        if (media == null) throw new IOException("no CDN media in voice");

        String encryptQueryParam = media.getEncryptQueryParam();
        String aesKeyStr = media.getAesKey();
        if (encryptQueryParam == null || aesKeyStr == null) {
            throw new IOException("missing encrypt param or aes key");
        }

        // Download encrypted file from CDN
        String downloadUrl = "https://novac2c.cdn.weixin.qq.com/c2c/download?encrypted_query_param="
                + java.net.URLEncoder.encode(encryptQueryParam, java.nio.charset.StandardCharsets.UTF_8);
        LOGGER.info("Downloading encrypted voice from CDN...");
        java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(downloadUrl)).GET().build();
        java.net.http.HttpResponse<byte[]> resp = cdnHttpClient.send(req, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
        if (resp.statusCode() != 200) throw new IOException("CDN download failed: HTTP " + resp.statusCode());
        byte[] encrypted = resp.body();
        LOGGER.info("Downloaded " + encrypted.length + " encrypted bytes");

        // Decrypt with AES/ECB
        byte[] key = decodeAesKey(aesKeyStr);
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(javax.crypto.Cipher.DECRYPT_MODE, new javax.crypto.spec.SecretKeySpec(key, "AES"));
        byte[] decrypted = cipher.doFinal(encrypted);

        // Save to temp file (SILK/AMR format)
        java.nio.file.Path tempFile = java.nio.file.Files.createTempFile("wechat-voice-", ".silk");
        java.nio.file.Files.write(tempFile, decrypted);
        LOGGER.info("Voice decrypted to: " + tempFile + " (" + decrypted.length + " bytes)");
        return tempFile;
    }

    private java.nio.file.Path downloadAndDecryptFile(com.openilink.model.FileItem fileItem) throws Exception {
        com.openilink.model.CDNMedia media = fileItem.getMedia();
        if (media == null) throw new IOException("no CDN media in file attachment");
        if (fileItem.getLen() != null) {
            try {
                long declaredLength = Long.parseLong(fileItem.getLen());
                if (declaredLength > DocumentReaderService.MAX_FILE_SIZE) {
                    throw new IOException("Document exceeds the 50 MB extraction limit");
                }
            } catch (NumberFormatException e) {
                LOGGER.debug( "无法解析文件声明长度: " + fileItem.getLen(), e);
            }
        }

        String encryptQueryParam = media.getEncryptQueryParam();
        String aesKeyString = media.getAesKey();
        if (encryptQueryParam == null || aesKeyString == null) {
            throw new IOException("missing encrypt param or AES key in file attachment");
        }
        String downloadUrl = "https://novac2c.cdn.weixin.qq.com/c2c/download?encrypted_query_param="
                + java.net.URLEncoder.encode(encryptQueryParam, java.nio.charset.StandardCharsets.UTF_8);
        java.net.http.HttpResponse<byte[]> response = cdnHttpClient.send(
                java.net.http.HttpRequest.newBuilder().uri(java.net.URI.create(downloadUrl)).GET().build(),
                java.net.http.HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) {
            throw new IOException("CDN document download failed: HTTP " + response.statusCode());
        }

        byte[] key = decodeAesKey(aesKeyString);
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(javax.crypto.Cipher.DECRYPT_MODE, new javax.crypto.spec.SecretKeySpec(key, "AES"));
        byte[] decrypted = cipher.doFinal(response.body());
        if (decrypted.length > DocumentReaderService.MAX_FILE_SIZE) {
            throw new IOException("Document exceeds the 50 MB extraction limit");
        }

        String suffix = safeDocumentSuffix(fileItem.getFileName());
        java.nio.file.Path tempFile = java.nio.file.Files.createTempFile("wechat-document-", suffix);
        java.nio.file.Files.write(tempFile, decrypted);
        return tempFile;
    }

    private static String safeDocumentSuffix(String fileName) {
        if (fileName == null) return ".bin";
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) return ".bin";
        String extension = fileName.substring(dot + 1);
        return extension.matches("[A-Za-z0-9]{1,10}") ? "." + extension.toLowerCase() : ".bin";
    }

    private byte[] decodeAesKey(String value) {
        // Try base64 decode first (could be base64 of hex string)
        byte[] decoded = java.util.Base64.getDecoder().decode(value);
        if (decoded.length == 16) return decoded;
        // It's base64 of hex string
        String hexStr = new String(decoded, java.nio.charset.StandardCharsets.US_ASCII);
        return hexToBytes(hexStr);
    }

    private byte[] hexToBytes(String hex) {
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            bytes[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return bytes;
    }

}
