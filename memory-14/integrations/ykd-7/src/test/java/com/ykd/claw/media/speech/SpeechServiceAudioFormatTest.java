package com.ykd.claw.media.speech;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class SpeechServiceAudioFormatTest {

    @TempDir
    Path tempDir;

    private final SpeechService service = new SpeechService();

    @Test
    void preservesAmrPayloadEvenWhenWechatTempFileHasSilkExtension() throws Exception {
        byte[] amr = "#!AMR\nmock-amr-payload".getBytes(StandardCharsets.ISO_8859_1);
        Path input = tempDir.resolve("wechat-voice.silk");
        Files.write(input, amr);

        Path prepared = service.prepareInboundVoice(input, 5, 8_000);

        assertEquals(input, prepared);
        assertArrayEquals(amr, Files.readAllBytes(prepared));
    }

    @Test
    void preservesMp3InsteadOfWrappingItAsPcmWav() throws Exception {
        byte[] mp3 = new byte[] {'I', 'D', '3', 4, 0, 0, 0, 0, 0, 0, 1, 2, 3};
        Path input = tempDir.resolve("voice-with-wrong-extension.silk");
        Files.write(input, mp3);

        Path prepared = service.prepareInboundVoice(input, 0, 44_100);

        assertEquals(input, prepared);
        assertArrayEquals(mp3, Files.readAllBytes(prepared));
    }

    @Test
    void recognizesWavMagicBeforeDefaultSilkMetadataAndNormalizesItOnce() throws Exception {
        Path input = tempDir.resolve("voice.silk");
        Files.write(input, toneWav(8_000, 500));

        Path prepared = service.prepareInboundVoice(input, 6, 16_000);

        byte[] normalized = Files.readAllBytes(prepared);
        assertEquals("RIFF", new String(normalized, 0, 4, StandardCharsets.US_ASCII));
        assertEquals("WAVE", new String(normalized, 8, 4, StandardCharsets.US_ASCII));
        try (AudioInputStream audio = AudioSystem.getAudioInputStream(prepared.toFile())) {
            assertEquals(16_000, Math.round(audio.getFormat().getSampleRate()));
            assertEquals(16, audio.getFormat().getSampleSizeInBits());
            assertEquals(1, audio.getFormat().getChannels());
        }
    }

    @Test
    void rejectsUnrecognizedFileTypeInsteadOfUploadingItAsPcm() throws Exception {
        Path textFile = tempDir.resolve("not-audio.txt");
        Files.write(textFile, "api_key=secret".getBytes(StandardCharsets.UTF_8));

        IOException ex = assertThrows(IOException.class,
                () -> service.prepareInboundVoice(textFile, 0, 16_000));
        assertTrue(ex.getMessage().contains("non-audio"));
    }

    @Test
    void recognizeRejectsPathOutsideWorkspace() throws Exception {
        IOException ex = assertThrows(IOException.class,
                () -> service.recognize(Path.of("..").resolve("outside.txt"), 6, 16_000));
        assertTrue(ex.getMessage().contains("restricted"));
    }

    private static byte[] toneWav(int sampleRate, int durationMs) throws Exception {
        int samples = sampleRate * durationMs / 1_000;
        ByteArrayOutputStream pcm = new ByteArrayOutputStream(samples * 2);
        for (int i = 0; i < samples; i++) {
            short value = (short) (4_000 * Math.sin(2 * Math.PI * 440 * i / sampleRate));
            pcm.write(value & 0xff);
            pcm.write((value >>> 8) & 0xff);
        }

        byte[] pcmBytes = pcm.toByteArray();
        ByteArrayOutputStream wav = new ByteArrayOutputStream();
        try (DataOutputStream out = new DataOutputStream(wav)) {
            out.writeBytes("RIFF");
            out.writeInt(Integer.reverseBytes(36 + pcmBytes.length));
            out.writeBytes("WAVEfmt ");
            out.writeInt(Integer.reverseBytes(16));
            out.writeShort(Short.reverseBytes((short) 1));
            out.writeShort(Short.reverseBytes((short) 1));
            out.writeInt(Integer.reverseBytes(sampleRate));
            out.writeInt(Integer.reverseBytes(sampleRate * 2));
            out.writeShort(Short.reverseBytes((short) 2));
            out.writeShort(Short.reverseBytes((short) 16));
            out.writeBytes("data");
            out.writeInt(Integer.reverseBytes(pcmBytes.length));
            out.write(pcmBytes);
        }
        return wav.toByteArray();
    }
}
