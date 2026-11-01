package com.ykd.claw.channel.cli;

import com.ykd.claw.agent.DeepSeekRouter;
import com.ykd.claw.agent.AgentAuditService;
import com.ykd.claw.agent.GeneratedArtifacts;
import com.ykd.claw.channel.wechat.ILinkBotService;
import com.ykd.claw.memory.ConversationService;
import com.ykd.claw.memory.MemoryService;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class CliLoopVoiceDeliveryTest {

    @Test
    void synthesizesNormalAiReplyAndSendsItAsAudioAttachment() {
        StubRouter router = new StubRouter(null);
        StubBotService bot = new StubBotService(Optional.empty());
        CliLoop loop = loop(router, bot, (text, voice) -> {
            assertEquals("天气很好", text);
            return "TTS audio: C:\\tmp\\reply.mp3";
        });

        assertTrue(loop.sendAudioReply("user-1", "天气很好"));
        assertEquals("user-1", bot.sentUser);
        assertEquals("C:\\tmp\\reply.mp3", bot.sentPath);
    }

    @Test
    void returnsFalseSoCallerCanFallBackToTextWhenVoiceSendFails() {
        StubBotService bot = new StubBotService(Optional.of("CDN upload failed"));
        CliLoop loop = loop(new StubRouter(null), bot,
                (text, voice) -> "TTS audio: C:\\tmp\\reply.mp3");

        assertFalse(loop.sendAudioReply("user-2", "文字兜底"));
        assertEquals(1, bot.sendCount);
    }

    @Test
    void returnsFalseWithoutSendingWhenTtsDoesNotProduceAudio() {
        StubBotService bot = new StubBotService(Optional.empty());
        CliLoop loop = loop(new StubRouter(null), bot,
                (text, voice) -> "TTS audio download returned an empty file");

        assertFalse(loop.sendAudioReply("user-3", "文字兜底"));
        assertEquals(0, bot.sendCount);
    }

    @Test
    void reusesAudioAlreadyGeneratedByRouterWithoutSynthesizingAgain() {
        AtomicInteger synthCalls = new AtomicInteger();
        StubBotService bot = new StubBotService(Optional.empty());
        CliLoop loop = loop(new StubRouter("C:\\tmp\\tool-audio.mp3"), bot, (text, voice) -> {
            synthCalls.incrementAndGet();
            return null;
        });

        assertTrue(loop.sendAudioReply("user-4", "ignored"));
        assertEquals(0, synthCalls.get());
        assertEquals("C:\\tmp\\tool-audio.mp3", bot.sentPath);
    }

    private static CliLoop loop(StubRouter router, StubBotService bot,
                                CliLoop.TtsSynthesizer synthesizer) {
        return new CliLoop(Map.of(), router, bot, true, synthesizer);
    }

    private static final class StubRouter extends DeepSeekRouter {
        private String audioPath;

        private StubRouter(String audioPath) {
            super(ChatClient.builder(mock(ChatModel.class)), mock(ConversationService.class),
                    mock(MemoryService.class), List.of(), new GeneratedArtifacts(),
                    mock(AgentAuditService.class));
            this.audioPath = audioPath;
        }

        @Override
        public String getLastGeneratedAudio() {
            String value = audioPath;
            audioPath = null;
            return value;
        }
    }

    private static final class StubBotService extends ILinkBotService {
        private final Optional<String> result;
        private int sendCount;
        private String sentUser;
        private String sentPath;

        private StubBotService(Optional<String> result) {
            super("");
            this.result = result;
        }

        @Override
        public Optional<String> sendAudioAttachment(String toUserId, String audioFilePath) {
            sendCount++;
            sentUser = toUserId;
            sentPath = audioFilePath;
            return result;
        }
    }
}
