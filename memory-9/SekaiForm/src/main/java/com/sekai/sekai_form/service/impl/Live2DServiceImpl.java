package com.sekai.sekai_form.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sekai.sekai_form.dataobject.Live2DChatConfigDO;
import com.sekai.sekai_form.dataobject.Live2DDialogueDO;
import com.sekai.sekai_form.dataobject.Live2DModelDO;
import com.sekai.sekai_form.mapper.Live2DChatConfigMapper;
import com.sekai.sekai_form.mapper.Live2DDialogueMapper;
import com.sekai.sekai_form.mapper.Live2DModelMapper;
import com.sekai.sekai_form.model.ChatResponse;
import com.sekai.sekai_form.model.Result;
import com.sekai.sekai_form.service.Live2DService;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class Live2DServiceImpl implements Live2DService {
    private final Live2DModelMapper modelMapper;
    private final Live2DDialogueMapper dialogueMapper;
    private final Live2DChatConfigMapper chatConfigMapper;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private static final Path MODELS_DIR = Paths.get("models", "2d");

    public Live2DServiceImpl(Live2DModelMapper modelMapper, Live2DDialogueMapper dialogueMapper,
                             Live2DChatConfigMapper chatConfigMapper) {
        this.modelMapper = modelMapper;
        this.dialogueMapper = dialogueMapper;
        this.chatConfigMapper = chatConfigMapper;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
        try { Files.createDirectories(MODELS_DIR); } catch (IOException ignored) {}
    }

    @Override
    public Result<List<Live2DModelDO>> listModels() { return Result.ok(modelMapper.listAll()); }

    @Override
    public Result<Live2DModelDO> getModel(Long id) {
        Live2DModelDO m = modelMapper.findById(id);
        if (m == null) return Result.fail("模型不存在");
        return Result.ok(m);
    }

    @Override
    public Result<Live2DModelDO> uploadModel(MultipartFile file, String displayName) {
        try {
            String modelName = file.getOriginalFilename();
            if (modelName == null || !modelName.endsWith(".zip")) return Result.fail("请上传zip文件");
            String baseName = modelName.replace(".zip", "");
            Path targetDir = MODELS_DIR.resolve(baseName);
            Files.createDirectories(targetDir);
            try (ZipInputStream zis = new ZipInputStream(file.getInputStream())) {
                ZipEntry entry;
                while ((entry = zis.getNextEntry()) != null) {
                    Path outPath = targetDir.resolve(entry.getName()).normalize();
                    if (!outPath.startsWith(targetDir)) continue;
                    if (entry.isDirectory()) { Files.createDirectories(outPath); continue; }
                    Files.createDirectories(outPath.getParent());
                    try (OutputStream os = Files.newOutputStream(outPath)) { zis.transferTo(os); }
                }
            }
            Live2DModelDO model = new Live2DModelDO();
            model.setModelName(baseName); model.setModelPath(targetDir.toString()); model.setDisplayName(displayName);
            modelMapper.insert(model);
            return Result.ok("上传成功", model);
        } catch (IOException e) { return Result.fail("上传失败: " + e.getMessage()); }
    }

    @Override
    public Result<Void> deleteModel(Long id) {
        Live2DModelDO m = modelMapper.findById(id);
        if (m != null) {
            try { Files.walk(Paths.get(m.getModelPath())).sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete); } catch (IOException ignored) {}
        }
        modelMapper.deleteById(id);
        return Result.ok("删除成功", null);
    }

    @Override
    public Result<List<Live2DDialogueDO>> listDialogues(Long modelId) { return Result.ok(dialogueMapper.listByModelId(modelId)); }

    @Override
    public Result<Live2DDialogueDO> getRandomDialogue(Long modelId, String category) {
        List<Live2DDialogueDO> list = dialogueMapper.listByCategory(modelId, category);
        if (list == null || list.isEmpty()) return Result.fail("无对话");
        return Result.ok(list.get(new Random().nextInt(list.size())));
    }

    @Override
    public Result<ChatResponse> chat(Long modelId, String message, List<ChatResponse.Message> history) {
        Live2DChatConfigDO config = chatConfigMapper.getByModelId(modelId);
        if (config == null || config.getApiUrl() == null || config.getApiUrl().isBlank()) {
            return Result.fail("AI对话未配置，请在设置中配置API");
        }

        try {
            List<ChatResponse.Message> messages = new ArrayList<>();
            if (config.getSystemPrompt() != null && !config.getSystemPrompt().isBlank()) {
                messages.add(new ChatResponse.Message("system", config.getSystemPrompt()));
            }
            if (history != null) messages.addAll(history);
            messages.add(new ChatResponse.Message("user", message));

            ChatResponse.AiRequest req = new ChatResponse.AiRequest();
            req.setModel(config.getModelName() != null ? config.getModelName() : "gpt-3.5-turbo");
            req.setMessages(messages);
            req.setMaxTokens(config.getMaxTokens() != null ? config.getMaxTokens() : 500);
            req.setTemperature(config.getTemperature() != null ? config.getTemperature() : 0.7);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (config.getApiKey() != null && !config.getApiKey().isBlank()) {
                headers.setBearerAuth(config.getApiKey());
            }

            HttpEntity<ChatResponse.AiRequest> entity = new HttpEntity<>(req, headers);
            ResponseEntity<ChatResponse.AiResponse> resp = restTemplate.exchange(
                config.getApiUrl(), HttpMethod.POST, entity, ChatResponse.AiResponse.class);

            ChatResponse.AiResponse body = resp.getBody();
            if (body != null && body.getChoices() != null && !body.getChoices().isEmpty()) {
                String reply = String.valueOf(body.getChoices().get(0).getMessage().getContent());
                String motion = reply.contains("?") || reply.contains("！") ? "Tap" : "Idle";
                return Result.ok(new ChatResponse(reply, motion));
            }
            return Result.fail("AI返回为空");
        } catch (Exception e) {
            return Result.fail("AI请求失败: " + e.getMessage());
        }
    }

    @Override
    public Result<Live2DChatConfigDO> getChatConfig(Long modelId) {
        Live2DChatConfigDO config = chatConfigMapper.getByModelId(modelId);
        if (config == null) return Result.fail("未配置");
        return Result.ok(config);
    }

    @Override
    public Result<Void> saveChatConfig(Live2DChatConfigDO config) {
        Live2DChatConfigDO existing = chatConfigMapper.getByModelId(config.getModelId());
        if (existing != null) {
            config.setId(existing.getId());
            chatConfigMapper.update(config);
        } else {
            config.setEnabled(true);
            chatConfigMapper.insert(config);
        }
        return Result.ok("保存成功", null);
    }

    // ==================== 图片识别 ====================

    @Override
    public Result<ChatResponse> recognizeImage(Long modelId, MultipartFile image, String question) {
        Live2DChatConfigDO config = chatConfigMapper.getByModelId(modelId);
        if (config == null || config.getApiUrl() == null || config.getApiUrl().isBlank()) {
            return Result.fail("AI对话未配置，请在设置中配置API");
        }
        try {
            String type = image.getContentType() != null ? image.getContentType() : "image/jpeg";
            String base64 = "data:" + type + ";base64," +
                    Base64.getEncoder().encodeToString(image.getBytes());

            // 构建 multimodal content: [image, text]
            ObjectNode imageUrl = objectMapper.createObjectNode();
            imageUrl.put("url", base64);
            ObjectNode imageObj = objectMapper.createObjectNode();
            imageObj.put("type", "image_url");
            imageObj.set("image_url", imageUrl);

            ObjectNode textObj = objectMapper.createObjectNode();
            textObj.put("type", "text");
            textObj.put("text", (question == null || question.isBlank()) ? "描述图片并提取文字" : question);

            ArrayNode contentArray = objectMapper.createArrayNode();
            contentArray.add(imageObj);
            contentArray.add(textObj);

            ObjectNode userMsg = objectMapper.createObjectNode();
            userMsg.put("role", "user");
            userMsg.set("content", contentArray);

            ArrayNode messages = objectMapper.createArrayNode();
            messages.add(userMsg);

            ObjectNode body = objectMapper.createObjectNode();
            body.put("model", config.getModelName() != null ? config.getModelName() : "qwen-vl-max");
            body.set("messages", messages);
            body.put("max_tokens", config.getMaxTokens() != null ? config.getMaxTokens() : 1024);

            String apiUrl = config.getApiUrl();
            if (!apiUrl.contains("/chat/completions")) {
                apiUrl = apiUrl.replaceAll("/$", "") + "/chat/completions";
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (config.getApiKey() != null && !config.getApiKey().isBlank()) {
                headers.setBearerAuth(config.getApiKey());
            }

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            ResponseEntity<String> resp = restTemplate.exchange(apiUrl, HttpMethod.POST, entity, String.class);

            JsonNode respJson = objectMapper.readTree(resp.getBody());
            String reply = respJson.path("choices").get(0).path("message").path("content").asText().trim();

            ChatResponse chatResp = new ChatResponse(reply, "Tap");
            return Result.ok(chatResp);
        } catch (Exception e) {
            return Result.fail("图片识别失败: " + e.getMessage());
        }
    }

    // ==================== 图片生成 ====================

    @Override
    public Result<ChatResponse> generateImage(Long modelId, String prompt) {
        Live2DChatConfigDO config = chatConfigMapper.getByModelId(modelId);
        if (config == null || config.getApiKey() == null || config.getApiKey().isBlank()) {
            return Result.fail("AI对话未配置，请在设置中配置API");
        }

        try {
            String imageModel = config.getImageModelName() != null ? config.getImageModelName() : "wanx2.1-t2i-turbo";
            String imageApiUrl = config.getImageApiUrl();
            if (imageApiUrl == null || imageApiUrl.isBlank()) {
                // 从 apiUrl 推断 imageApiUrl: 去掉 /compatible-mode/v1, 加 /api/v1
                String base = config.getApiUrl() != null ? config.getApiUrl() : "";
                imageApiUrl = base.replace("/compatible-mode/v1", "").replace("/compatible-mode", "") + "/api/v1";
            }

            ObjectNode input = objectMapper.createObjectNode();
            input.put("prompt", prompt);

            ObjectNode parameters = objectMapper.createObjectNode();
            parameters.put("size", "1024*1024");
            parameters.put("n", 1);

            ObjectNode body = objectMapper.createObjectNode();
            body.put("model", imageModel);
            body.set("input", input);
            body.set("parameters", parameters);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(config.getApiKey());
            headers.set("X-DashScope-Async", "enable");

            String submitUrl = imageApiUrl.replaceAll("/$", "") + "/services/aigc/text2image/image-synthesis";
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            ResponseEntity<String> createResp = restTemplate.exchange(submitUrl, HttpMethod.POST, entity, String.class);

            JsonNode createJson = objectMapper.readTree(createResp.getBody());
            String taskId = createJson.path("output").path("task_id").asText();

            // 轮询任务状态，最多等待3分钟
            for (int i = 0; i < 90; i++) {
                Thread.sleep(2000);
                String taskUrl = imageApiUrl.replaceAll("/$", "") + "/tasks/" + taskId;
                ResponseEntity<String> taskResp = restTemplate.exchange(taskUrl, HttpMethod.GET, null, String.class);
                JsonNode taskJson = objectMapper.readTree(taskResp.getBody());
                String status = taskJson.path("output").path("task_status").asText();

                if ("SUCCEEDED".equals(status)) {
                    String imageUrl = taskJson.path("output").path("results").get(0).path("url").asText();
                    ChatResponse chatResp = new ChatResponse("图片已生成~", "Idle");
                    chatResp.setImageUrl(imageUrl);
                    return Result.ok(chatResp);
                }
                if ("FAILED".equals(status)) {
                    return Result.fail("图片生成失败: " + taskJson.path("output").toString());
                }
            }
            return Result.fail("图片生成超时");
        } catch (Exception e) {
            return Result.fail("图片生成失败: " + e.getMessage());
        }
    }
}
