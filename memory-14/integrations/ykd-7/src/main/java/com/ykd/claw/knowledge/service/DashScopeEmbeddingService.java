package com.ykd.claw.knowledge.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DashScopeEmbeddingService implements KnowledgeEmbeddingService {
    private final String apiKey;
    private final URI endpoint;
    private final String model;
    private final int dimensions;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public DashScopeEmbeddingService(
            @Value("${dashscope.api.key:}") String apiKey,
            @Value("${dashscope.compatible-base-url:https://dashscope.aliyuncs.com/compatible-mode}") String baseUrl,
            @Value("${knowledge.embedding.model:text-embedding-v4}") String model,
            @Value("${knowledge.embedding.dimensions:1024}") int dimensions,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.endpoint = URI.create(baseUrl.replaceAll("/+$", "") + "/v1/embeddings");
        this.model = model;
        this.dimensions = dimensions;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
    }

    @Override
    public List<float[]> embed(List<String> texts) {
        if (texts == null || texts.isEmpty()) return List.of();
        if (apiKey.isBlank()) throw new IllegalStateException("DASHSCOPE_API_KEY is required for knowledge indexing");
        List<float[]> all = new ArrayList<>(texts.size());
        for (int start = 0; start < texts.size(); start += 10) {
            all.addAll(requestBatch(texts.subList(start, Math.min(start + 10, texts.size()))));
        }
        return List.copyOf(all);
    }

    private List<float[]> requestBatch(List<String> texts) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("input", texts);
            body.put("dimensions", dimensions);
            body.put("encoding_format", "float");
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(60))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException("DashScope embedding failed: HTTP " + response.statusCode()
                        + " " + response.body());
            }
            JsonNode data = objectMapper.readTree(response.body()).path("data");
            List<float[]> vectors = new ArrayList<>(data.size());
            for (JsonNode item : data) {
                JsonNode embedding = item.path("embedding");
                float[] vector = new float[embedding.size()];
                for (int i = 0; i < embedding.size(); i++) vector[i] = embedding.get(i).floatValue();
                vectors.add(vector);
            }
            if (vectors.size() != texts.size()) throw new IllegalStateException("Embedding count mismatch");
            return List.copyOf(vectors);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("DashScope embedding request interrupted", e);
        } catch (Exception e) {
            if (e instanceof IllegalStateException state) throw state;
            throw new IllegalStateException("Unable to create DashScope embeddings", e);
        }
    }
}
