package com.ykd.claw.vision;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration(proxyBeanMethods = false)
public class VisionAiConfig {

    @Bean
    @Qualifier("visionChatClient")
    ChatClient visionChatClient(
            @Value("${dashscope.api.key:}") String apiKey,
            @Value("${dashscope.compatible-base-url:https://dashscope.aliyuncs.com/compatible-mode}")
            String baseUrl,
            @Value("${dashscope.vision.model:qwen3-vl-flash}") String model,
            @Value("${dashscope.vision.timeout:90}") long timeoutSeconds) {
        String effectiveKey = apiKey == null || apiKey.isBlank() ? "not-configured" : apiKey.trim();
        Duration timeout = Duration.ofSeconds(Math.max(1, timeoutSeconds));
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(timeout).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(timeout);
        OpenAiApi api = OpenAiApi.builder()
                .apiKey(effectiveKey)
                .baseUrl(stripTrailingSlash(baseUrl))
                .restClientBuilder(RestClient.builder().requestFactory(requestFactory))
                .build();
        OpenAiChatModel chatModel = OpenAiChatModel.builder()
                .openAiApi(api)
                .defaultOptions(OpenAiChatOptions.builder().model(model).build())
                .build();
        return ChatClient.builder(chatModel).build();
    }

    private static String stripTrailingSlash(String value) {
        String result = value == null || value.isBlank()
                ? "https://dashscope.aliyuncs.com/compatible-mode"
                : value.trim();
        while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
        return result;
    }
}
