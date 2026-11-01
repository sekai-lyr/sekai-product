package com.ykd.claw.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.document.DocumentReaderTool;
import com.ykd.claw.document.DocumentGenerationTool;
import com.ykd.claw.document.DocumentModificationTool;
import com.ykd.claw.map.MapTool;
import com.ykd.claw.map.WeatherTool;
import com.ykd.claw.media.image.ImageGenerationTool;
import com.ykd.claw.media.speech.TextToSpeechTool;
import com.ykd.claw.media.speech.SpeechRecognitionTool;
import com.ykd.claw.media.video.VideoGenerationTool;
import com.ykd.claw.reminder.ReminderTool;
import com.ykd.claw.time.CurrentTimeTool;
import com.ykd.claw.vision.VisionTool;
import com.ykd.claw.vision.OcrExtractTool;
import com.ykd.claw.web.WebPageTool;
import com.ykd.claw.web.WebSearchTool;
import com.ykd.claw.web.NewsTool;
import com.ykd.claw.knowledge.tool.KnowledgeTool;
import com.ykd.claw.skill.SkillTool;
import com.ykd.claw.flyai.tool.FlyAiTravelTool;
import com.ykd.claw.math.MathComputeTool;
import com.ykd.claw.question.ClassifySubjectTool;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.ai.tool.metadata.ToolMetadata;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;
import java.util.Arrays;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class SpringToolRegistrationTest {

    @Test
    void everyProviderExposesAUniqueSpringAiTool() {
        GeneratedArtifacts artifacts = new GeneratedArtifacts();
        List<ToolProvider> providers = List.of(
                new ImageGenerationTool(artifacts),
                new VideoGenerationTool(artifacts, mock(com.ykd.claw.media.video.VideoGenerationService.class)),
                new WebSearchTool(mock(com.ykd.claw.web.WebSearchService.class)),
                new WebPageTool(mock(com.ykd.claw.web.WebPageService.class),
                        new com.ykd.claw.web.WebContentSelector(8_000, 1_200, 6)),
                new MapTool(mock(com.ykd.claw.map.MapService.class), new ObjectMapper()),
                new CurrentTimeTool(mock(com.ykd.claw.time.TimeService.class)),
                new ReminderTool(mock(com.ykd.claw.reminder.ReminderService.class)),
                new WeatherTool(""),
                new VisionTool(mock(com.ykd.claw.vision.VisionService.class)),
                new OcrExtractTool(mock(com.ykd.claw.vision.VisionService.class)),
                new TextToSpeechTool(artifacts),
                new SpeechRecognitionTool(),
                new DocumentReaderTool(new com.ykd.claw.document.DocumentReaderService()),
                new DocumentGenerationTool(artifacts),
                new DocumentModificationTool(artifacts),
                new SkillTool(mock(com.ykd.claw.skill.SkillRegistry.class)),
                new MathComputeTool(mock(com.ykd.claw.math.MathComputeService.class)),
                new ClassifySubjectTool(),
                new NewsTool(mock(com.ykd.claw.web.WebSearchService.class)),
                new FlyAiTravelTool(mock(com.ykd.claw.flyai.service.FlyAiCliService.class),
                        mock(com.ykd.claw.flyai.service.FliggyHotelBookingService.class),
                        mock(com.ykd.claw.flyai.service.HotelRecommendationService.class)),
                new KnowledgeTool(mock(com.ykd.claw.knowledge.service.KnowledgeRetriever.class),
                        mock(com.ykd.claw.knowledge.service.KnowledgeIngestionService.class),
                        new ObjectMapper(), 5),
                new com.ykd.claw.travel.tool.ItineraryTool(
                        mock(com.ykd.claw.travel.service.ItineraryService.class)));

        List<ToolCallback> callbacks = providers.stream()
                .flatMap(provider -> Arrays.stream(MethodToolCallbackProvider.builder().toolObjects(provider).build()
                        .getToolCallbacks()))
                .toList();
        Set<String> names = callbacks.stream()
                .map(callback -> callback.getToolDefinition().name())
                .collect(Collectors.toSet());

        assertEquals(callbacks.size(), names.size());
        assertEquals(Set.of("generate_image", "generate_video", "search_web", "fetch_web_page",
                "search_place", "get_route", "geocode", "get_current_time", "create_reminder",
                "query_weather", "query_weather_forecast",
                "list_reminders", "cancel_reminder", "pause_reminder", "resume_reminder",
                "retry_reminder",
                "analyze_image", "ocr_extract", "speak_text", "recognize_speech",
                "read_document", "generate_document", "modify_document", "read_skill",
                "math_compute", "classify_subject", "search_news", "get_top_headlines",
                "search_knowledge", "index_knowledge_document",
                "flyai_search_hotel", "flyai_search_flight", "flyai_search_train",
                "flyai_search_poi", "flyai_ai_search", "flyai_book_hotel", "flyai_recommend_hotel",
                "list_my_itineraries", "get_my_itinerary", "delete_my_itinerary"), names);
        assertTrue(callbacks.stream().allMatch(callback ->
                callback.getToolDefinition().description() != null
                        && !callback.getToolDefinition().description().isBlank()));
    }

    @Test
    void mediaToolsReturnControlForMultiIntentMessages() throws Exception {
        assertFalse(toolMetadata(ImageGenerationTool.class, "generateImage").returnDirect());
        assertFalse(toolMetadata(VideoGenerationTool.class, "generateVideo").returnDirect());
    }

    private ToolMetadata toolMetadata(Class<?> type, String methodName) throws Exception {
        Method method = List.of(type.getDeclaredMethods()).stream()
                .filter(candidate -> candidate.getName().equals(methodName))
                .findFirst().orElseThrow();
        return ToolMetadata.from(method);
    }
}
