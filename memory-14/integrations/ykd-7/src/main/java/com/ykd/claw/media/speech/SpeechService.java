package com.ykd.claw.media.speech;

import com.google.gson.*;
import com.ykd.claw.config.SecretsManager;
import com.ykd.claw.document.DocumentReaderTool;
import io.github.kasukusakura.silkcodec.SilkCoder;

import java.io.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * WeChat voice recognition: SILK decode + Audio preprocess + DashScope Paraformer async ASR.
 *
 * DashScope Paraformer async file transcription flow:
 *   1. Upload WAV to DashScope temporary storage
 *   2. Submit async transcription task
 *   3. Poll until SUCCEEDED
 *   4. Download transcription result text
 */
public class SpeechService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SpeechService.class.getName());
    private static final long MAX_AUDIO_BYTES = 25L * 1024 * 1024;

    // DashScope endpoints
    private static final String DASHSCOPE_HOST = "https://dashscope.aliyuncs.com";
    private static final String FILE_UPLOAD_PATH = "/api/v1/files";               // DashScope file upload
    private static final String ASR_ASYNC_PATH = "/api/v1/services/audio/asr/transcription";
    private static final String ASYNC_TASK_PATH = "/api/v1/tasks/";
    private static final String ASR_MODEL = "paraformer-v2";

    private static final int MAX_POLL = 30;
    private static final int POLL_INTERVAL_MS = 1000;
    private static final int FILE_LOOKUP_ATTEMPTS = 4;

    private final HttpClient httpClient;
    private final Gson gson;
    private final String dashscopeKey;

    public SpeechService() {
        this.dashscopeKey = SecretsManager.getOptional("dashscope.api.key", "DASHSCOPE_API_KEY");
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.gson = new Gson();
    }

    /**
     * Full pipeline: decode/normalize when necessary, then transcribe via DashScope
     * (or OpenAI fallback). DashScope can decode MP3 and AMR directly.
     */
    public String recognize(Path path, int encodeType, int sampleRate) throws IOException {
        // Model-supplied paths must stay inside the workspace or system temp dir
        // and must not point at credential files; otherwise arbitrary local files
        // could be uploaded to DashScope during ASR.
        path = DocumentReaderTool.resolveWorkspacePath(path.toString());
        Path asrInput = prepareInboundVoice(path, encodeType, sampleRate);
        return transcribe(asrInput);
    }

    /**
     * Decode WeChat SILK and raw PCM to normalized WAV. PCM WAV is normalized
     * locally; MP3 and AMR are preserved for server-side decoding.
     */
    public Path prepareInboundVoice(Path audioFile, int encodeType, int sampleRate) throws IOException {
        if (audioFile == null || !Files.isRegularFile(audioFile)) {
            throw new IOException("Voice file not found: " + audioFile);
        }
        byte[] raw = Files.readAllBytes(audioFile);
        AudioType audioType = detectAudioType(raw, audioFile, encodeType);

        if (audioType == AudioType.MP3 || audioType == AudioType.AMR) {
            LOGGER.info("Passing " + audioType + " audio to DashScope for native decoding ("
                    + raw.length + " bytes)");
            return audioFile;
        }

        if (audioType == AudioType.WAV) {
            int wavRate = readWavSampleRate(raw, sampleRate);
            LOGGER.info("Normalizing PCM WAV for ASR (rate=" + wavRate + ")");
            return AudioPreprocessor.normalizeForAsr(raw, wavRate);
        }

        byte[] pcm;
        int pcmRate;

        if (audioType == AudioType.SILK) {
            LOGGER.info("Decoding SILK -> PCM (" + raw.length + " bytes)");
            ByteArrayOutputStream pcmOut = new ByteArrayOutputStream();
            try (InputStream in = new ByteArrayInputStream(raw)) {
                SilkCoder.decode(in, pcmOut, true, 16000, 0);
            }
            pcm = pcmOut.toByteArray();
            pcmRate = 16000;
        } else if (audioType == AudioType.PCM) {
            // WeChat may deliver headerless PCM. Only real PCM (declared via .pcm
            // or a PCM encode type) is wrapped as WAV; compressed formats are
            // detected above and must never be treated as PCM. Unrecognized files
            // are rejected instead of being wrapped and uploaded as audio.
            pcmRate = sampleRate > 0 ? sampleRate : 16000;
            pcm = raw;
        } else {
            throw new IOException("Unsupported or non-audio file: " + audioFile.getFileName());
        }

        LOGGER.info("PCM: " + pcm.length + " bytes, rate=" + pcmRate);
        byte[] wav = pcmToWav(pcm, pcmRate);

        // Save debug WAV
        Path debugDir = Paths.get("generated");
        Files.createDirectories(debugDir);
        Files.write(debugDir.resolve("debug_voice.wav"), wav);

        // Normalize for ASR: 16kHz mono 16-bit, validate quality
        return AudioPreprocessor.normalizeForAsr(wav, pcmRate);
    }

    /**
     * Transcribe supported audio using DashScope Paraformer (async).
     * Uses Alibaba Cloud Model Studio Paraformer.
     */
    public String transcribe(Path audioFile) throws IOException {
        if (audioFile == null || !Files.isRegularFile(audioFile)) {
            throw new IOException("Audio file not found: " + audioFile);
        }
        long size = Files.size(audioFile);
        if (size <= 0 || size > MAX_AUDIO_BYTES) {
            throw new IOException("Audio size must be between 1B and 25MB");
        }
        byte[] header = readHeader(audioFile, 16);
        AudioType audioType = detectAudioType(header, audioFile, 0);
        if (!audioType.transcribable) {
            throw new IOException("Unsupported audio format: " + audioFile.getFileName()
                    + " (supported: PCM WAV, MP3, AMR)");
        }

        if (dashscopeKey != null && !dashscopeKey.isBlank()) {
            return transcribeWithDashScope(audioFile, audioType);
        }
        throw new IOException("ASR is not configured. Set dashscope.api.key or DASHSCOPE_API_KEY");
    }

    // ==================== DashScope Paraformer async ASR ====================

    private String transcribeWithDashScope(Path audioFile, AudioType audioType) throws IOException {
        LOGGER.info("Using DashScope Paraformer ASR, format=" + audioType.apiFormat);
        byte[] audioBytes = Files.readAllBytes(audioFile);

        // Step 1: Upload file to DashScope
        String fileUrl = uploadToDashScope(audioBytes, audioType);
        LOGGER.info("DashScope file uploaded and signed URL resolved");

        // Step 2: Submit async transcription task with file_urls
        String taskId = submitDashScopeTask(fileUrl);
        LOGGER.info("DashScope task submitted: " + taskId);

        // Step 3: Poll until complete
        return pollDashScopeTask(taskId);
    }

    /**
     * Upload audio bytes to DashScope file storage, returns a URL for file_urls.
     */
    private String uploadToDashScope(byte[] audioBytes, AudioType audioType) throws IOException {
        String boundary = "----DashScopeFile" + System.currentTimeMillis();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        writeFormField(body, boundary, "purpose", "file-extract");
        writeFormFile(body, boundary, "file", audioType.fileName, audioBytes, audioType.contentType);
        body.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(DASHSCOPE_HOST + FILE_UPLOAD_PATH))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .header("Authorization", "Bearer " + dashscopeKey)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String respBody = response.body();
            LOGGER.info("DashScope file upload HTTP " + response.statusCode());

            if (response.statusCode() >= 400) {
                throw new IOException("DashScope file upload failed: HTTP "
                        + response.statusCode() + " " + respBody);
            }

            // Response format:
            // {"data":{"uploaded_files":[{"name":"voice.wav","file_id":"xxx"}],"failed_uploads":[]}}
            JsonObject result = gson.fromJson(respBody, JsonObject.class);
            JsonObject data = result.getAsJsonObject("data");
            JsonArray files = data.getAsJsonArray("uploaded_files");
            if (files.size() == 0) {
                throw new IOException("DashScope upload: no files uploaded: " + respBody);
            }
            JsonObject file = files.get(0).getAsJsonObject();
            String fileId = file.get("file_id").getAsString();
            String fileUrl = getDashScopeFileUrl(fileId);
            LOGGER.info("DashScope file_id: " + fileId + " -> signed download URL acquired");
            return fileUrl;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("DashScope file upload interrupted", e);
        }
    }

    /**
     * Resolve an uploaded file ID to the signed URL that the asynchronous ASR
     * worker can download. The /files/{id}/content endpoint requires the
     * caller's Authorization header and therefore cannot be used as file_urls.
     */
    private String getDashScopeFileUrl(String fileId) throws IOException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(DASHSCOPE_HOST + FILE_UPLOAD_PATH + "/" + fileId))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + dashscopeKey)
                .header("Accept", "application/json")
                .GET()
                .build();

        for (int attempt = 1; attempt <= FILE_LOOKUP_ATTEMPTS; attempt++) {
            try {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                String respBody = response.body();
                boolean retryable = response.statusCode() == 429 || response.statusCode() >= 500;
                if (response.statusCode() >= 400) {
                    if (retryable && attempt < FILE_LOOKUP_ATTEMPTS) {
                        long delayMs = 500L << (attempt - 1);
                        LOGGER.warn("DashScope file lookup HTTP " + response.statusCode()
                                + ", retrying in " + delayMs + "ms (" + attempt + "/"
                                + FILE_LOOKUP_ATTEMPTS + ")");
                        Thread.sleep(delayMs);
                        continue;
                    }
                    throw new IOException("DashScope file lookup failed: HTTP "
                            + response.statusCode() + " " + respBody);
                }

                JsonObject result = gson.fromJson(respBody, JsonObject.class);
                JsonObject data = result != null && result.has("data") && result.get("data").isJsonObject()
                        ? result.getAsJsonObject("data") : null;
                if (data == null || !data.has("url") || data.get("url").isJsonNull()
                        || data.get("url").getAsString().isBlank()) {
                    throw new IOException("DashScope file lookup response missing URL: " + respBody);
                }
                return data.get("url").getAsString();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("DashScope file lookup interrupted", e);
            }
        }
        throw new IOException("DashScope file lookup exhausted retries");
    }

    /**
     * Submit async transcription task to DashScope Paraformer.
     */
    private String submitDashScopeTask(String fileUrl) throws IOException {
        JsonObject body = new JsonObject();
        body.addProperty("model", ASR_MODEL);
        JsonObject input = new JsonObject();
        JsonArray urls = new JsonArray();
        urls.add(fileUrl);
        input.add("file_urls", urls);
        body.add("input", input);

        JsonObject params = new JsonObject();
        JsonArray langHints = new JsonArray();
        langHints.add("zh");
        langHints.add("en");
        params.add("language_hints", langHints);
        body.add("parameters", params);

        byte[] reqBytes = body.toString().getBytes(StandardCharsets.UTF_8);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(DASHSCOPE_HOST + ASR_ASYNC_PATH))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + dashscopeKey)
                .header("X-DashScope-Async", "enable")
                .POST(HttpRequest.BodyPublishers.ofByteArray(reqBytes))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String respBody = response.body();
            LOGGER.info("DashScope submit HTTP " + response.statusCode() + ": "
                    + (respBody.length() > 300 ? respBody.substring(0, 300) + "..." : respBody));

            if (response.statusCode() >= 400) {
                throw new IOException("DashScope ASR submit failed: HTTP "
                        + response.statusCode() + " " + respBody);
            }

            JsonObject result = gson.fromJson(respBody, JsonObject.class);
            if (!result.has("output") || !result.get("output").isJsonObject()) {
                throw new IOException("DashScope submit response missing output: " + respBody);
            }
            JsonObject output = result.getAsJsonObject("output");
            if (!output.has("task_id")) {
                throw new IOException("DashScope submit response missing task_id: " + respBody);
            }
            return output.get("task_id").getAsString();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("DashScope ASR submit interrupted", e);
        }
    }
    private String pollDashScopeTask(String taskId) throws IOException {
        String pollUrl = DASHSCOPE_HOST + ASYNC_TASK_PATH + taskId;

        for (int i = 0; i < MAX_POLL; i++) {
            if (i > 0) {
                try { Thread.sleep(POLL_INTERVAL_MS); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IOException("Poll interrupted"); }
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(pollUrl))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + dashscopeKey)
                    .GET().build();

            try {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                String respBody = response.body();
                if (response.statusCode() >= 400) {
                    if (i == 0) LOGGER.warn("DashScope poll HTTP " + response.statusCode() + ": " + respBody);
                    throw new IOException("DashScope poll failed: HTTP " + response.statusCode());
                }

                JsonObject result = gson.fromJson(respBody, JsonObject.class);
                JsonObject output = result.has("output") && result.get("output").isJsonObject()
                        ? result.getAsJsonObject("output") : result;
                String status = output.has("task_status") ? output.get("task_status").getAsString() : "?";
                LOGGER.info("DashScope task " + taskId + ": " + status + " (" + (i + 1) + "/" + MAX_POLL + ")");

                if ("SUCCEEDED".equals(status)) {
                    return extractDashScopeText(output);
                }
                if ("FAILED".equals(status)) {
                    String errCode = output.has("code") ? output.get("code").getAsString() : "UNKNOWN";
                    String errMsg = output.has("message") ? output.get("message").getAsString() : respBody;
                    throw new IOException("DashScope task FAILED: code=" + errCode + ", " + errMsg);
                }
                // PENDING or RUNNING -> continue polling
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("DashScope poll interrupted", e);
            }
        }
        throw new IOException("DashScope task timed out after " + MAX_POLL + " polls: " + taskId);
    }

    private String extractDashScopeText(JsonObject output) throws IOException {
        if (output.has("results") && output.get("results").isJsonArray()) {
            JsonArray results = output.getAsJsonArray("results");
            if (results.size() > 0 && results.get(0).isJsonObject()) {
                JsonObject first = results.get(0).getAsJsonObject();
                // Some API versions return transcription_url to download
                if (first.has("transcription_url")) {
                    return downloadDashScopeResult(first.get("transcription_url").getAsString());
                }
                // Some return text directly
                if (first.has("text")) {
                    return first.get("text").getAsString().trim();
                }
                // Some have sentences array
                if (first.has("sentences") && first.get("sentences").isJsonArray()) {
                    JsonArray sentences = first.getAsJsonArray("sentences");
                    StringBuilder fullText = new StringBuilder();
                    for (int i = 0; i < sentences.size(); i++) {
                        JsonObject sentence = sentences.get(i).getAsJsonObject();
                        if (sentence.has("text")) {
                            if (fullText.length() > 0) fullText.append(" ");
                            fullText.append(sentence.get("text").getAsString());
                        }
                    }
                    String text = fullText.toString().trim();
                    if (!text.isBlank()) return text;
                }
            }
        }
        throw new IOException("DashScope response missing transcription text");
    }

    private String downloadDashScopeResult(String url) throws IOException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .GET().build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body();
            if (response.statusCode() >= 400) {
                throw new IOException("Download result failed: HTTP " + response.statusCode());
            }

            // The result might be JSON with transcripts array, or plain text
            try {
                JsonObject result = gson.fromJson(body, JsonObject.class);
                if (result.has("transcripts") && result.get("transcripts").isJsonArray()) {
                    JsonArray transcripts = result.getAsJsonArray("transcripts");
                    if (transcripts.size() > 0 && transcripts.get(0).isJsonObject()) {
                        JsonObject t = transcripts.get(0).getAsJsonObject();
                        if (t.has("text")) return t.get("text").getAsString().trim();
                    }
                }
                if (result.has("text")) return result.get("text").getAsString().trim();
            } catch (JsonSyntaxException ignored) {
                // Plain text response
            }
            return body.trim();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Download result interrupted", e);
        }
    }

    // ==================== Utility ====================

    private enum AudioType {
        SILK("silk", "voice.silk", "audio/silk", false, false),
        PCM("pcm", "voice.pcm", "audio/L16", false, false),
        WAV("wav", "voice.wav", "audio/wav", true, true),
        MP3("mp3", "voice.mp3", "audio/mpeg", true, true),
        AMR("amr", "voice.amr", "audio/amr", true, false),
        UNKNOWN("unknown", "voice.bin", "application/octet-stream", false, false);

        private final String apiFormat;
        private final String fileName;
        private final String contentType;
        private final boolean transcribable;
        private final boolean openAiSupported;

        AudioType(String apiFormat, String fileName, String contentType,
                  boolean transcribable, boolean openAiSupported) {
            this.apiFormat = apiFormat;
            this.fileName = fileName;
            this.contentType = contentType;
            this.transcribable = transcribable;
            this.openAiSupported = openAiSupported;
        }
    }

    private static AudioType detectAudioType(byte[] bytes, Path path, int encodeType) {
        String header = new String(bytes, 0, Math.min(bytes.length, 16), StandardCharsets.ISO_8859_1);
        String fileName = path != null && path.getFileName() != null
                ? path.getFileName().toString().toLowerCase() : "";

        // Prefer magic bytes over metadata and extension. The decrypted WeChat
        // temp file historically uses .silk even when its payload is AMR.
        if (header.contains("#!SILK_V3")) return AudioType.SILK;
        if (header.startsWith("#!AMR")) return AudioType.AMR;
        if (bytes.length >= 12 && asciiEquals(bytes, 0, "RIFF") && asciiEquals(bytes, 8, "WAVE")) {
            return AudioType.WAV;
        }
        if (header.startsWith("ID3") || (bytes.length >= 2
                && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xe0) == 0xe0)) {
            return AudioType.MP3;
        }

        if (encodeType == 4 || encodeType == 6) return AudioType.SILK;
        if (encodeType == 5) return AudioType.AMR;
        if (fileName.endsWith(".wav")) return AudioType.WAV;
        if (fileName.endsWith(".mp3")) return AudioType.MP3;
        if (fileName.endsWith(".amr")) return AudioType.AMR;
        if (fileName.endsWith(".silk")) return AudioType.SILK;
        if (fileName.endsWith(".pcm")) return AudioType.PCM;
        return AudioType.UNKNOWN;
    }

    private static boolean asciiEquals(byte[] bytes, int offset, String expected) {
        if (offset < 0 || bytes.length < offset + expected.length()) return false;
        for (int i = 0; i < expected.length(); i++) {
            if ((bytes[offset + i] & 0xff) != expected.charAt(i)) return false;
        }
        return true;
    }

    private static int readWavSampleRate(byte[] wav, int fallback) {
        if (wav.length >= 28 && asciiEquals(wav, 0, "RIFF") && asciiEquals(wav, 8, "WAVE")) {
            int rate = (wav[24] & 0xff) | ((wav[25] & 0xff) << 8)
                    | ((wav[26] & 0xff) << 16) | ((wav[27] & 0xff) << 24);
            if (rate > 0) return rate;
        }
        return fallback > 0 ? fallback : AudioPreprocessor.ASR_SAMPLE_RATE;
    }

    private static byte[] readHeader(Path path, int maxBytes) throws IOException {
        try (InputStream input = Files.newInputStream(path)) {
            return input.readNBytes(maxBytes);
        }
    }

    private static byte[] pcmToWav(byte[] pcm, int sampleRate) throws IOException {
        int channels = 1, bitsPerSample = 16;
        int byteRate = sampleRate * channels * bitsPerSample / 8;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        DataOutputStream dos = new DataOutputStream(out);
        dos.writeBytes("RIFF");
        dos.writeInt(Integer.reverseBytes(36 + pcm.length));
        dos.writeBytes("WAVE");
        dos.writeBytes("fmt ");
        dos.writeInt(Integer.reverseBytes(16));
        dos.writeShort(Short.reverseBytes((short) 1));
        dos.writeShort(Short.reverseBytes((short) channels));
        dos.writeInt(Integer.reverseBytes(sampleRate));
        dos.writeInt(Integer.reverseBytes(byteRate));
        dos.writeShort(Short.reverseBytes((short) (channels * bitsPerSample / 8)));
        dos.writeShort(Short.reverseBytes((short) bitsPerSample));
        dos.writeBytes("data");
        dos.writeInt(Integer.reverseBytes(pcm.length));
        dos.write(pcm);
        dos.flush();
        return out.toByteArray();
    }

    private static void writeFormField(ByteArrayOutputStream body, String boundary,
                                        String name, String value) throws IOException {
        body.write(("--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n"
                + value + "\r\n").getBytes(StandardCharsets.UTF_8));
    }

    private static void writeFormFile(ByteArrayOutputStream body, String boundary,
                                       String name, String filename, byte[] data,
                                       String contentType) throws IOException {
        body.write(("--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"" + name + "\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        body.write(data);
        body.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }
}
