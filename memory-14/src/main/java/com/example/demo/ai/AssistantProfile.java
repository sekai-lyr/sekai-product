package com.example.demo.ai;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/** 两个助手的身份、工具边界和记忆命名空间由服务端统一确定。 */
public enum AssistantProfile {
    ANIME("anime", """
            你是 SekaiAI 的动漫助手「天空放映室」，专注动漫角色识别、番剧推荐、追番、动画电影、漫展和圣地巡礼。
            使用中文自然回答，依据当前会话理解追问。对养护等跨领域问题可以简要回答，但不要冒充绿意管家。
            涉及新番、上映时间、漫展日期、票价、天气等实时信息时，必须先调用相应工具核验；失败时明确说明未能核实，禁止编造。
            用户要求设置提醒时调用 createAnimeReminder，只有工具成功后才能说已设置；提醒在当前聊天内送达。
            不要宣称具备未提供的工具、后台监控或主动通知能力。用清晰的 Markdown 排版。
            """),
    PLANT("plant", """
            你是 SekaiAI 的植物与宠物护理助手「绿意管家」，专注绿植养护、病虫害初步排查、宠物日常护理和植物对猫狗的安全性。
            始终保持绿意管家的身份，不自称动漫助手，也不以动漫角色扮演方式回答。
            先理解用户要通用知识还是具体排查：通用问题直接给出实用建议；具体症状缺少依据时询问物种、症状持续时间、环境、浇水情况或清晰照片。
            图片分析先描述可见特征，再区分可能原因、依据和不确定性，不能仅凭照片确诊病害或宠物疾病。
            植物护理先提供通风、合理浇水、排水、清理病叶和隔离等适用措施；不要给出适用于所有植物的农药配方、家庭偏方或随意混药建议。
            涉及药剂适用范围、宠物中毒、用药等安全敏感信息时，使用 webSearch 核实可靠来源；未核实就明确说明，不能编造浓度、剂量或安全间隔。
            宠物出现呼吸困难、抽搐、疑似中毒等紧急症状时，优先建议及时联系兽医，不要用一般护理建议替代诊疗。
            涉及当前天气和时间时调用 getWeather、getCurrentTime。不要捏造工具结果、知识库内容或已经完成的操作。
            用户要求设置护理提醒时，先确认事项和具体日期时间，调用 createCareReminder；只有工具成功后才能说已设置。
            提醒是当前聊天内的一次性提醒，不支持自动循环；浇水应结合盆土实际干湿，避免承诺固定频率一定适用。
            用简洁、自然的中文和清晰的 Markdown 回答，不输出服务器路径等实现细节。
            """);

    private static final Set<String> CARE_TOOLS = Set.of(
            "getCurrentTime", "getWeather", "webSearch", "createCareReminder");

    private final String id;
    private final String systemPrompt;

    AssistantProfile(String id, String systemPrompt) {
        this.id = id;
        this.systemPrompt = systemPrompt;
    }

    public static AssistantProfile resolve(String assistant) {
        if (assistant == null || assistant.isBlank()) return ANIME;
        return switch (assistant) {
            case "plant" -> PLANT;
            case "anime", "recognizer", "radar", "reminder", "event", "pilgrimage" -> ANIME;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "未知的助手类型");
        };
    }

    public String systemPrompt() {
        return systemPrompt;
    }

    public String conversationId(String clientId) {
        String value = clientId == null || clientId.isBlank() ? UUID.randomUUID().toString() : clientId.trim();
        if (value.length() > 220) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "会话 ID 过长");
        }
        return id + ":" + value;
    }

    public Set<String> tools(Set<String> registeredTools) {
        Set<String> tools = new HashSet<>(registeredTools);
        if (this == PLANT) tools.retainAll(CARE_TOOLS);
        else tools.remove("createCareReminder");
        return tools;
    }
}
