package com.openilink;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openilink.auth.LoginCallbacks;
import com.openilink.exception.APIError;
import com.openilink.exception.ILinkException;
import com.openilink.exception.NoContextTokenException;
import com.openilink.http.DefaultHttpClient;
import com.openilink.http.HttpDoer;
import com.openilink.model.*;
import com.openilink.model.request.*;
import com.openilink.model.response.*;
import com.openilink.monitor.MessageHandler;
import com.openilink.monitor.MonitorOptions;
import com.openilink.util.SleepHelper;
import com.openilink.util.URLHelper;
import com.openilink.util.WechatHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Client communicates with the Weixin iLink Bot API.
 *
 * <pre>{@code
 * ILinkClient client = ILinkClient.builder()
 *     .token("")
 *     .build();
 *
 * LoginResult result = client.loginWithQR(new LoginCallbacks() {
 *     @Override
 *     public void onQRCode(String url) {
 *         System.out.println("请扫码: " + url);
 *     }
 * });
 * }</pre>
 */
public class ILinkClient {

    private static final Logger log = LoggerFactory.getLogger(ILinkClient.class);

    public static final String DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
    public static final String DEFAULT_CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";
    public static final String DEFAULT_BOT_TYPE = "3";
    public static final String DEFAULT_VERSION = "1.0.0";

    private static final long LONG_POLL_TIMEOUT_MS = 35_000L;
    private static final long API_TIMEOUT_MS = 15_000L;
    private static final long CONFIG_TIMEOUT_MS = 10_000L;
    private static final long QR_LONG_POLL_TIMEOUT_MS = 35_000L;
    private static final long DEFAULT_LOGIN_TIMEOUT_MS = 8L * 60 * 1000;
    private static final int MAX_QR_REFRESH_COUNT = 3;
    private static final int MAX_CONSECUTIVE_FAILURES = 3;
    private static final long BACKOFF_DELAY_MS = 30_000L;
    private static final long RETRY_DELAY_MS = 2_000L;
    private static final long SESSION_EXPIRED_DELAY_MS = 5L * 60 * 1000;
    private static final long SESSION_PROBE_TIMEOUT_MS = 5_000L;

    private volatile String baseUrl;
    private final String cdnBaseUrl;
    private volatile String token;
    private final String botType;
    private final String version;
    private final HttpDoer httpClient;
    private final java.net.http.HttpClient cdnHttpClient;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, String> contextTokens = new ConcurrentHashMap<>();

    private ILinkClient(Builder builder) {
        this.baseUrl = builder.baseUrl;
        this.cdnBaseUrl = builder.cdnBaseUrl;
        this.token = builder.token;
        this.botType = builder.botType;
        this.version = builder.version;
        this.httpClient = builder.httpClient;
        this.cdnHttpClient = java.net.http.HttpClient.newBuilder()
                .followRedirects(java.net.http.HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(30))
                .build();
        this.objectMapper = new ObjectMapper()
                .setSerializationInclusion(JsonInclude.Include.NON_NULL)
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    // --- Builder ---

    public static Builder builder() {
        return new Builder();
    }

    /**
     * Creates a new client with default settings.
     */
    public static ILinkClient create(String token) {
        return builder().token(token).build();
    }

    public static class Builder {
        private String baseUrl = DEFAULT_BASE_URL;
        private String cdnBaseUrl = DEFAULT_CDN_BASE_URL;
        private String token = "";
        private String botType = DEFAULT_BOT_TYPE;
        private String version = DEFAULT_VERSION;
        private HttpDoer httpClient = new DefaultHttpClient();

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Builder cdnBaseUrl(String cdnBaseUrl) {
            this.cdnBaseUrl = cdnBaseUrl;
            return this;
        }

        public Builder token(String token) {
            this.token = token;
            return this;
        }

        public Builder botType(String botType) {
            this.botType = botType;
            return this;
        }

        public Builder version(String version) {
            this.version = version;
            return this;
        }

        public Builder httpClient(HttpDoer httpClient) {
            this.httpClient = httpClient;
            return this;
        }

        public ILinkClient build() {
            return new ILinkClient(this);
        }
    }

    // --- Getters & Setters ---

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    // --- Internal helpers ---

    private BaseInfo buildBaseInfo() {
        return BaseInfo.builder().channelVersion(version).build();
    }

    private Map<String, String> buildHeaders(byte[] body) {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("AuthorizationType", "ilink_bot_token");
        headers.put("Content-Length", String.valueOf(body.length));
        headers.put("X-WECHAT-UIN", WechatHelper.randomWechatUIN());
        if (token != null && !token.isEmpty()) {
            headers.put("Authorization", "Bearer " + token);
        }
        return headers;
    }

    private byte[] doPost(String endpoint, Object body, long timeoutMs) throws IOException {
        byte[] data = objectMapper.writeValueAsBytes(body);
        String url = URLHelper.joinPath(baseUrl, endpoint);
        Map<String, String> headers = buildHeaders(data);
        return httpClient.doPost(url, data, headers, timeoutMs);
    }

    private byte[] doGet(String rawUrl, Map<String, String> extraHeaders, long timeoutMs) throws IOException {
        return httpClient.doGet(rawUrl, extraHeaders, timeoutMs);
    }

    private static String urlEncode(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            throw new ILinkException("ilink: url encode failed", e);
        }
    }

    // --- API methods ---

    /**
     * Performs a long-poll request to receive new messages.
     * Returns an empty response (not an error) on client-side timeout.
     */
    public GetUpdatesResp getUpdates(String getUpdatesBuf) {
        GetUpdatesReq reqBody = GetUpdatesReq.builder()
                .getUpdatesBuf(getUpdatesBuf)
                .baseInfo(buildBaseInfo())
                .build();
        long timeout = LONG_POLL_TIMEOUT_MS + 5_000L;

        try {
            byte[] data = doPost("ilink/bot/getupdates", reqBody, timeout);
            return objectMapper.readValue(data, GetUpdatesResp.class);
        } catch (java.net.http.HttpTimeoutException e) {
            log.debug("getUpdates long-poll timeout (normal)");
            return GetUpdatesResp.builder()
                    .ret(0)
                    .getUpdatesBuf(getUpdatesBuf)
                    .build();
        } catch (IOException e) {
            log.warn("getUpdates I/O error: {}", e.getMessage());
            return GetUpdatesResp.builder()
                    .ret(0)
                    .getUpdatesBuf(getUpdatesBuf)
                    .build();
        } catch (Exception e) {
            log.warn("getUpdates unexpected error: {}", e.getMessage(), e);
            return GetUpdatesResp.builder()
                    .ret(0)
                    .getUpdatesBuf(getUpdatesBuf)
                    .build();
        }
    }

    /**
     * Probes whether the current token can establish a fresh sync session.
     * <p>
     * Opens a getUpdates with an empty sync buffer and a short timeout, so a
     * server-side expired session (errcode -14) is detected quickly without
     * blocking for the full long-poll duration.
     *
     * @return the fresh session response when the token is usable, or
     *         {@code null} when the server reports a session-expired response
     *         (errcode -14), i.e. the token itself is dead. Any other outcome
     *         — network/HTTP failure, client-side timeout, or a transient
     *         server error — is treated as "token usable" so we never force a
     *         re-login on a flaky network; those are left to the monitor's
     *         normal retry/backoff handling.
     */
    public GetUpdatesResp probeFreshSession() {
        GetUpdatesReq reqBody = GetUpdatesReq.builder()
                .getUpdatesBuf("")
                .baseInfo(buildBaseInfo())
                .build();
        try {
            byte[] data = doPost("ilink/bot/getupdates", reqBody, SESSION_PROBE_TIMEOUT_MS);
            GetUpdatesResp resp = objectMapper.readValue(data, GetUpdatesResp.class);
            int ret = resp.getRet() != null ? resp.getRet() : 0;
            int errCode = resp.getErrCode() != null ? resp.getErrCode() : 0;
            if (errCode == -14 || ret == -14) {
                return null;
            }
            return resp;
        } catch (Exception e) {
            log.debug("probeFreshSession: token assumed usable ({})", e.getMessage());
            return GetUpdatesResp.builder().ret(0).getUpdatesBuf("").build();
        }
    }

    /**
     * Sends a raw message request.
     */
    public void sendMessage(SendMessageReq msg) {
        msg.setBaseInfo(buildBaseInfo());
        try {
            doPost("ilink/bot/sendmessage", msg, API_TIMEOUT_MS);
        } catch (IOException e) {
            throw new ILinkException("ilink: sendMessage failed", e);
        }
    }

    /**
     * Sends a plain text message to a user.
     *
     * @param to           the target user ID
     * @param text         the text content
     * @param contextToken must come from the inbound message's contextToken
     * @return the generated client ID
     */
    public String sendText(String to, String text, String contextToken) {
        String clientId = "sdk-" + System.currentTimeMillis();

        SendMessageReq msg = SendMessageReq.builder()
                .msg(WeixinMessage.builder()
                        .toUserId(to)
                        .clientId(clientId)
                        .messageType(MessageType.BOT)
                        .messageState(MessageState.FINISH)
                        .contextToken(contextToken)
                        .itemList(Collections.singletonList(
                                MessageItem.builder()
                                        .type(MessageItemType.TEXT)
                                        .textItem(TextItem.builder().text(text).build())
                                        .build()
                        ))
                        .build())
                .build();

        sendMessage(msg);
        return clientId;
    }

    /**
     * Fetches bot config (includes typing_ticket) for a given user.
     */
    public GetConfigResp getConfig(String userId, String contextToken) {
        GetConfigReq reqBody = GetConfigReq.builder()
                .ilinkUserId(userId)
                .contextToken(contextToken)
                .baseInfo(buildBaseInfo())
                .build();

        try {
            byte[] data = doPost("ilink/bot/getconfig", reqBody, CONFIG_TIMEOUT_MS);
            return objectMapper.readValue(data, GetConfigResp.class);
        } catch (IOException e) {
            throw new ILinkException("ilink: getConfig failed", e);
        }
    }

    /**
     * Sends or cancels a typing indicator.
     */
    public void sendTyping(String userId, String typingTicket, TypingStatus status) {
        SendTypingReq reqBody = SendTypingReq.builder()
                .ilinkUserId(userId)
                .typingTicket(typingTicket)
                .status(status)
                .baseInfo(buildBaseInfo())
                .build();

        try {
            doPost("ilink/bot/sendtyping", reqBody, CONFIG_TIMEOUT_MS);
        } catch (IOException e) {
            throw new ILinkException("ilink: sendTyping failed", e);
        }
    }

    /**
     * Requests a pre-signed CDN upload URL.
     */
    public GetUploadURLResp getUploadUrl(GetUploadURLReq req) {
        req.setBaseInfo(buildBaseInfo());
        try {
            byte[] data = doPost("ilink/bot/getuploadurl", req, API_TIMEOUT_MS);
            return objectMapper.readValue(data, GetUploadURLResp.class);
        } catch (IOException e) {
            throw new ILinkException("ilink: getUploadUrl failed", e);
        }
    }

    // --- Context token cache ---

    /**
     * Caches a context token for a user.
     * Called automatically by {@link #monitor}; can also be called manually.
     */
    public void setContextToken(String userId, String ctxToken) {
        contextTokens.put(userId, ctxToken);
    }

    /**
     * Returns the cached context token for a user, if any.
     */
    public Optional<String> getContextToken(String userId) {
        return Optional.ofNullable(contextTokens.get(userId));
    }

    /**
     * Sends a proactive text message using a cached context token.
     * The target user must have previously sent a message so that a context
     * token is available. Throws {@link NoContextTokenException} otherwise.
     */
    public String push(String to, String text) {
        String ctxToken = contextTokens.get(to);
        if (ctxToken == null) {
            throw new NoContextTokenException(to);
        }
        return sendText(to, text, ctxToken);
    }

    /**
     * Sends an image to a user.
     * Uses getUploadUrl for CDN reference and falls back to text link.
     */
    public String pushImage(String to, java.nio.file.Path imagePath) {
        String ctxToken = contextTokens.get(to);
        if (ctxToken == null) {
            throw new NoContextTokenException(to);
        }
        try {
            return sendImageMessage(to, imagePath, ctxToken);
        } catch (Exception e) {
            throw new ILinkException("ilink: pushImage failed", e);
        }
    }
    /** Sends a local file through the officially supported FILE attachment path. */
    public String pushFile(String to, java.nio.file.Path filePath) {
        String ctxToken = contextTokens.get(to);
        if (ctxToken == null) {
            throw new NoContextTokenException(to);
        }
        try {
            return sendFileMessage(to, filePath, ctxToken);
        } catch (Exception e) {
            throw new ILinkException("ilink: pushFile failed", e);
        }
    }



    private String sendImageMessage(String to, java.nio.file.Path imagePath, String ctxToken) throws Exception {
        byte[] raw = java.nio.file.Files.readAllBytes(imagePath);

        // MD5 of raw file
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("MD5");
        byte[] md5 = md.digest(raw);
        String md5Hex = hex(md5);

        // AES/ECB encrypt with 16-byte key (hex encoded for API)
        java.security.SecureRandom sr = new java.security.SecureRandom();
        byte[] aesKey = new byte[16];
        sr.nextBytes(aesKey);
        String keyHex = hex(aesKey);
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, new javax.crypto.spec.SecretKeySpec(aesKey, "AES"));
        byte[] encrypted = cipher.doFinal(raw);

        // Build file key (UUID without dashes)
        String fileKey = java.util.UUID.randomUUID().toString().replace("-", "");

        // Get upload param from WeChat
        GetUploadURLReq uploadReq = GetUploadURLReq.builder()
                .fileKey(fileKey)
                .mediaType(UploadMediaType.IMAGE.getValue())
                .toUserId(to)
                .rawSize((long) raw.length)
                .rawFileMd5(md5Hex)
                .fileSize((long) encrypted.length)
                .aesKey(keyHex)
                .noNeedThumb(true)
                .build();
        GetUploadURLResp uploadResp = getUploadUrl(uploadReq);

        String uploadParam = uploadResp.getUploadParam();
        if (uploadParam == null || uploadParam.isBlank()) {
            throw new ILinkException("ilink: no upload param");
        }

        // Upload encrypted file to CDN: POST with query params
        String cdnUploadUrl = cdnBaseUrl + "/upload?encrypted_query_param="
                + java.net.URLEncoder.encode(uploadParam, java.nio.charset.StandardCharsets.UTF_8)
                + "&filekey=" + fileKey;
        log.debug("[CDN] Uploading image to: {}", cdnUploadUrl.substring(0, Math.min(120, cdnUploadUrl.length())));

        java.net.http.HttpRequest uploadReq2 = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(cdnUploadUrl))
                .header("Content-Type", "application/octet-stream")
                .POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(encrypted))
                .build();
        java.net.http.HttpResponse<String> uploadResp2 = cdnHttpClient.send(uploadReq2,
                java.net.http.HttpResponse.BodyHandlers.ofString());
        if (uploadResp2.statusCode() != 200) {
            throw new ILinkException("ilink: image CDN upload failed with HTTP " + uploadResp2.statusCode());
        }
        // Get download param from response header
        String downloadParam = uploadResp2.headers().firstValue("x-encrypted-param")
                .filter(value -> !value.isBlank())
                .orElseThrow(() -> new ILinkException("ilink: image CDN response missing x-encrypted-param"));

        // Build and send image message
        String clientId = "sdk-" + System.currentTimeMillis();
        CDNMedia media = CDNMedia.builder()
                .encryptQueryParam(downloadParam)
                .aesKey(java.util.Base64.getEncoder().encodeToString(keyHex.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .encryptType(1)
                .build();
        ImageItem imageItem = ImageItem.builder()
                .media(media)
                .midSize((long) encrypted.length)
                .build();
        MessageItem msgItem = MessageItem.builder()
                .type(MessageItemType.IMAGE)
                .imageItem(imageItem)
                .build();
        SendMessageReq sendReq = SendMessageReq.builder()
                .msg(WeixinMessage.builder()
                        .toUserId(to)
                        .clientId(clientId)
                        .messageType(MessageType.BOT)
                        .messageState(MessageState.FINISH)
                        .itemList(java.util.List.of(msgItem))
                        .build())
                .build();
        sendMessage(sendReq);
        return clientId;
    }
    private String sendFileMessage(String to, java.nio.file.Path filePath, String ctxToken) throws Exception {
        if (!java.nio.file.Files.isRegularFile(filePath)) {
            throw new IOException("ilink: file does not exist: " + filePath);
        }
        byte[] raw = java.nio.file.Files.readAllBytes(filePath);
        if (raw.length == 0) {
            throw new IOException("ilink: refusing to send an empty file: " + filePath);
        }

        // MD5 of raw file
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("MD5");
        byte[] md5bytes = md.digest(raw);
        String md5Hex = hex(md5bytes);

        // AES/ECB encrypt with 16-byte key (hex encoded for API)
        java.security.SecureRandom sr = new java.security.SecureRandom();
        byte[] aesKey = new byte[16];
        sr.nextBytes(aesKey);
        String keyHex = hex(aesKey);
        javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, new javax.crypto.spec.SecretKeySpec(aesKey, "AES"));
        byte[] encrypted = cipher.doFinal(raw);

        // Build file key (UUID without dashes)
        String fileKey = java.util.UUID.randomUUID().toString().replace("-", "");

        // Get upload param from WeChat
        GetUploadURLReq uploadReq = GetUploadURLReq.builder()
                .fileKey(fileKey)
                .mediaType(UploadMediaType.FILE.getValue())
                .toUserId(to)
                .rawSize((long) raw.length)
                .rawFileMd5(md5Hex)
                .fileSize((long) encrypted.length)
                .aesKey(keyHex)
                .noNeedThumb(true)
                .build();
        GetUploadURLResp uploadResp = getUploadUrl(uploadReq);

        String uploadParam = uploadResp.getUploadParam();
        String uploadFullUrl = uploadResp.getUploadFullUrl();
        if ((uploadFullUrl == null || uploadFullUrl.isBlank())
                && (uploadParam == null || uploadParam.isBlank())) {
            throw new ILinkException("ilink: no file upload URL");
        }

        // Newer gateways return a complete URL; older ones return upload_param.
        String cdnUploadUrl = uploadFullUrl != null && !uploadFullUrl.isBlank()
                ? uploadFullUrl
                : cdnBaseUrl + "/upload?encrypted_query_param="
                    + java.net.URLEncoder.encode(uploadParam, java.nio.charset.StandardCharsets.UTF_8)
                    + "&filekey=" + fileKey;
        log.debug("[CDN] Uploading file to: {}", cdnUploadUrl.substring(0, Math.min(120, cdnUploadUrl.length())));

        java.net.http.HttpRequest uploadReq2 = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(cdnUploadUrl))
                .header("Content-Type", "application/octet-stream")
                .POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(encrypted))
                .build();
        java.net.http.HttpResponse<String> uploadResp2 = cdnHttpClient.send(uploadReq2,
                java.net.http.HttpResponse.BodyHandlers.ofString());
        log.debug("[CDN] Upload response: HTTP {}", uploadResp2.statusCode());
        if (uploadResp2.statusCode() != 200) {
            throw new ILinkException("ilink: file CDN upload failed with HTTP " + uploadResp2.statusCode());
        }

        // Get download param from response header
        String downloadParam = uploadResp2.headers().firstValue("x-encrypted-param")
                .filter(value -> !value.isBlank())
                .orElseThrow(() -> new ILinkException("ilink: file CDN response missing x-encrypted-param"));

        // Build and send an officially supported file attachment.
        String clientId = "sdk-" + System.currentTimeMillis();
        CDNMedia media = CDNMedia.builder()
                .encryptQueryParam(downloadParam)
                .aesKey(java.util.Base64.getEncoder().encodeToString(keyHex.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .encryptType(1)
                .build();
        SendMessageReq sendReq = buildFileMessageReq(to, ctxToken, clientId,
                filePath.getFileName().toString(), raw.length, md5Hex, media);
        sendMessage(sendReq);
        return clientId;
    }

    static SendMessageReq buildFileMessageReq(String to, String ctxToken, String clientId,
                                               String fileName, long rawLength, String md5,
                                               CDNMedia media) {
        FileItem fileItem = FileItem.builder()
                .media(media)
                .fileName(fileName)
                .md5(md5)
                .len(Long.toString(rawLength))
                .build();
        MessageItem msgItem = MessageItem.builder()
                .type(MessageItemType.FILE)
                .fileItem(fileItem)
                .build();
        return SendMessageReq.builder()
                .msg(WeixinMessage.builder()
                        .toUserId(to)
                        .clientId(clientId)
                        .messageType(MessageType.BOT)
                        .messageState(MessageState.FINISH)
                        .itemList(java.util.List.of(msgItem))
                        .contextToken(ctxToken)
                        .build())
                .build();
    }

    private static final char[] HEX_DIGITS = "0123456789abcdef".toCharArray();

    /** Convert bytes to hex string */
    static String hex(byte[] bytes) {
        char[] hex = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            hex[i * 2] = HEX_DIGITS[(bytes[i] >> 4) & 0x0F];
            hex[i * 2 + 1] = HEX_DIGITS[bytes[i] & 0x0F];
        }
        return new String(hex);
    }



    // --- QR Login ---

    /**
     * Requests a new login QR code from the API.
     */
    public QRCodeResponse fetchQRCode() {
        String bt = (botType != null && !botType.isEmpty()) ? botType : DEFAULT_BOT_TYPE;
        String url = URLHelper.joinPath(baseUrl, "ilink/bot/get_bot_qrcode")
                + "?bot_type=" + urlEncode(bt);

        try {
            byte[] data = doGet(url, null, API_TIMEOUT_MS);
            return objectMapper.readValue(data, QRCodeResponse.class);
        } catch (IOException e) {
            throw new ILinkException("ilink: fetch QR code failed", e);
        }
    }

    /**
     * Polls the scan status of a QR code.
     */
    public QRStatusResponse pollQRStatus(String qrCode) {
        String url = URLHelper.joinPath(baseUrl, "ilink/bot/get_qrcode_status")
                + "?qrcode=" + urlEncode(qrCode);

        Map<String, String> headers = new HashMap<>();
        headers.put("iLink-App-ClientVersion", "1");

        try {
            byte[] data = doGet(url, headers, QR_LONG_POLL_TIMEOUT_MS + 5_000L);
            return objectMapper.readValue(data, QRStatusResponse.class);
        } catch (java.net.http.HttpTimeoutException e) {
            log.debug("pollQRStatus long-poll timeout (normal)");
            return QRStatusResponse.builder().status("wait").build();
        } catch (IOException e) {
            log.warn("pollQRStatus I/O error: {}", e.getMessage());
            return QRStatusResponse.builder().status("wait").build();
        } catch (Exception e) {
            log.warn("pollQRStatus unexpected error: {}", e.getMessage(), e);
            return QRStatusResponse.builder().status("wait").build();
        }
    }

    /**
     * Performs the full QR code login flow.
     * On success the client's token and base URL are updated automatically.
     */
    public LoginResult loginWithQR(LoginCallbacks callbacks) {
        if (callbacks == null) {
            callbacks = new LoginCallbacks() {};
        }

        long deadline = System.currentTimeMillis() + DEFAULT_LOGIN_TIMEOUT_MS;

        QRCodeResponse qr = fetchQRCode();
        callbacks.onQRCode(qr.getQrCodeImgContent());

        boolean scannedNotified = false;
        int refreshCount = 1;
        String currentQR = qr.getQrCode();

        while (System.currentTimeMillis() < deadline) {
            QRStatusResponse status = pollQRStatus(currentQR);

            switch (status.getStatus()) {
                case "wait":
                    break;

                case "scaned":
                    if (!scannedNotified) {
                        scannedNotified = true;
                        callbacks.onScanned();
                    }
                    break;

                case "expired":
                    refreshCount++;
                    if (refreshCount > MAX_QR_REFRESH_COUNT) {
                        return LoginResult.builder()
                                .message("QR code expired too many times")
                                .build();
                    }
                    callbacks.onExpired(refreshCount, MAX_QR_REFRESH_COUNT);
                    QRCodeResponse newQR = fetchQRCode();
                    currentQR = newQR.getQrCode();
                    scannedNotified = false;
                    callbacks.onQRCode(newQR.getQrCodeImgContent());
                    break;

                case "confirmed":
                    if (status.getIlinkBotId() == null || status.getIlinkBotId().isEmpty()) {
                        return LoginResult.builder()
                                .message("server did not return bot ID")
                                .build();
                    }
                    setToken(status.getBotToken());
                    if (status.getBaseUrl() != null && !status.getBaseUrl().isEmpty()) {
                        setBaseUrl(status.getBaseUrl());
                    }
                    return LoginResult.builder()
                            .connected(true)
                            .botToken(status.getBotToken())
                            .botId(status.getIlinkBotId())
                            .baseUrl(status.getBaseUrl())
                            .userId(status.getIlinkUserId())
                            .message("connected")
                            .build();

                default:
                    log.warn("Unknown QR status: {}", status.getStatus());
                    break;
            }

            SleepHelper.sleepInterruptibly(1_000L);
        }

        return LoginResult.builder().message("login timeout").build();
    }

    // --- Monitor ---

    /**
     * Runs a long-poll loop, invoking handler for each inbound message.
     * It blocks until stopped and handles retries/backoff automatically.
     * Context tokens are cached automatically for use with {@link #push}.
     *
     * @param handler the message handler
     * @param options monitor options (nullable)
     * @param stopFlag set to true to stop monitoring
     */
    public void monitor(MessageHandler handler, MonitorOptions options, AtomicBoolean stopFlag) {
        if (options == null) {
            options = MonitorOptions.builder().build();
        }

        java.util.function.Consumer<Exception> onError = options.getOnError() != null
                ? options.getOnError()
                : e -> log.warn("Monitor error: {}", e.getMessage(), e);

        String buf = options.getInitialBuf() != null ? options.getInitialBuf() : "";
        int failures = 0;
        int sessionExpiredCount = 0;

        while (!stopFlag.get()) {
            GetUpdatesResp resp;
            try {
                resp = getUpdates(buf);
            } catch (Exception e) {
                if (stopFlag.get()) {
                    return;
                }
                failures++;
                onError.accept(new ILinkException(
                        String.format("getUpdates (%d/%d): %s", failures, MAX_CONSECUTIVE_FAILURES, e.getMessage()), e));
                if (failures >= MAX_CONSECUTIVE_FAILURES) {
                    failures = 0;
                    if (SleepHelper.sleepInterruptibly(BACKOFF_DELAY_MS)) return;
                } else {
                    if (SleepHelper.sleepInterruptibly(RETRY_DELAY_MS)) return;
                }
                continue;
            }

            // API-level error
            int ret = resp.getRet() != null ? resp.getRet() : 0;
            int errCode = resp.getErrCode() != null ? resp.getErrCode() : 0;

            if (ret != 0 || errCode != 0) {
                APIError apiErr = new APIError(ret, errCode, resp.getErrMsg());

                if (apiErr.isSessionExpired()) {
                    if (options.getOnSessionExpired() != null) {
                        options.getOnSessionExpired().run();
                    }
                    onError.accept(apiErr);
                    // A single -14 can be a transient expiry: retry immediately
                    // with the same cursor first, then re-establish with a fresh
                    // empty cursor if the server keeps rejecting it. Only fall
                    // back to the slow retry when even a fresh session is
                    // rejected (i.e. the token itself is dead), instead of
                    // stalling 5 minutes on a stale cursor every time.
                    sessionExpiredCount++;
                    if (sessionExpiredCount == 1) {
                        continue;
                    }
                    if (sessionExpiredCount == 2) {
                        buf = "";
                        continue;
                    }
                    if (SleepHelper.sleepInterruptibly(SESSION_EXPIRED_DELAY_MS)) return;
                    sessionExpiredCount = 0;
                    continue;
                }

                failures++;
                onError.accept(new ILinkException(
                        String.format("getUpdates (%d/%d): %s", failures, MAX_CONSECUTIVE_FAILURES, apiErr.getMessage()), apiErr));
                if (failures >= MAX_CONSECUTIVE_FAILURES) {
                    failures = 0;
                    if (SleepHelper.sleepInterruptibly(BACKOFF_DELAY_MS)) return;
                } else {
                    if (SleepHelper.sleepInterruptibly(RETRY_DELAY_MS)) return;
                }
                continue;
            }

            failures = 0;
            sessionExpiredCount = 0;

            // Update sync cursor
            if (resp.getGetUpdatesBuf() != null && !resp.getGetUpdatesBuf().isEmpty()) {
                buf = resp.getGetUpdatesBuf();
                if (options.getOnBufUpdate() != null) {
                    options.getOnBufUpdate().accept(buf);
                }
            }

            // Dispatch messages
            if (resp.getMsgs() != null) {
                for (WeixinMessage msg : resp.getMsgs()) {
                    if (msg.getContextToken() != null && !msg.getContextToken().isEmpty()
                            && msg.getFromUserId() != null && !msg.getFromUserId().isEmpty()) {
                        setContextToken(msg.getFromUserId(), msg.getContextToken());
                    }
                    handler.handle(msg);
                }
            }
        }
    }
}
