package com.sekai.sekai_form.config;

import com.sekai.sekai_form.dataobject.Live2DChatConfigDO;
import com.sekai.sekai_form.dataobject.SekaiFormFoodDO;
import com.sekai.sekai_form.mapper.Live2DChatConfigMapper;
import com.sekai.sekai_form.mapper.SekaiFormFoodMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {
    private final SekaiFormFoodMapper foodMapper;
    private final Live2DChatConfigMapper chatConfigMapper;
    public DataInitializer(SekaiFormFoodMapper foodMapper, Live2DChatConfigMapper chatConfigMapper) {
        this.foodMapper = foodMapper;
        this.chatConfigMapper = chatConfigMapper;
    }
    @Override
    public void run(String... args) {
        if (foodMapper.listAll().isEmpty()) {
            SekaiFormFoodDO f1 = new SekaiFormFoodDO(); f1.setName("??"); f1.setSatietyValue(10); f1.setMoodValue(5); foodMapper.insert(f1);
            SekaiFormFoodDO f2 = new SekaiFormFoodDO(); f2.setName("??"); f2.setSatietyValue(20); f2.setMoodValue(15); f2.setAffectionValue(10); foodMapper.insert(f2);
            SekaiFormFoodDO f3 = new SekaiFormFoodDO(); f3.setName("??"); f3.setSatietyValue(8); f3.setMoodValue(10); foodMapper.insert(f3);
        }
        // Initialize Qwen (Alibaba Cloud DashScope) chat config for modelId=1
        Live2DChatConfigDO existing = chatConfigMapper.getByModelId(1L);
        if (existing == null) {
            Live2DChatConfigDO config = new Live2DChatConfigDO();
            config.setModelId(1L);
            config.setApiUrl("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
            config.setApiKey(System.getenv("DASHSCOPE_API_KEY") != null ? System.getenv("DASHSCOPE_API_KEY") : "");
            config.setModelName("qwen-vl-max");
            config.setImageModelName("wanx2.1-t2i-turbo");
            config.setSystemPrompt("你是一个可爱的看板娘，性格活泼开朗，喜欢和主人聊天。用简短可爱的语气回复，适当使用颜文字和语气词。");
            config.setMaxTokens(500);
            config.setTemperature(0.7);
            config.setEnabled(true);
            chatConfigMapper.insert(config);
        }
    }
}