package com.ykd.claw.media.speech;

import javax.sound.sampled.*;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Normalizes audio to ASR contract (16kHz / 16-bit / mono PCM WAV)
 * and rejects silent or low-quality input.
 */
final class AudioPreprocessor {

    static final int ASR_SAMPLE_RATE = 16_000;
    private static final double MIN_RMS = 80.0;
    private static final double VOICED_FRAME_RMS = 160.0;
    private static final int FRAME_MS = 20;
    private static final int MIN_AUDIO_MS = 300;
    private static final int MAX_AUDIO_MS = 60_000;
    private static final int MAX_LEADING_SILENCE_MS = 5_000;
    private static final int MIN_VOICED_MS = 160;

    private AudioPreprocessor() {}

    /**
     * Normalize PCM WAV bytes to 16kHz/16-bit/mono and validate quality.
     */
    static Path normalizeForAsr(byte[] wavBytes, int sourceSampleRate) throws IOException {
        if (wavBytes == null || wavBytes.length <= 44) {
            throw new IOException("Audio data is empty");
        }

        AudioFormat sourceFormat = new AudioFormat(sourceSampleRate, 16, 1, true, false);
        AudioFormat targetFormat = new AudioFormat(
                AudioFormat.Encoding.PCM_SIGNED, ASR_SAMPLE_RATE, 16, 1, 2, ASR_SAMPLE_RATE, false);

        // Write temp WAV from bytes for javax.sound.sampled to read
        Path tempWav = Files.createTempFile("voice-raw-", ".wav");
        try {
            Files.write(tempWav, wavBytes);

            try (AudioInputStream original = AudioSystem.getAudioInputStream(tempWav.toFile())) {
                // Check if conversion is possible; if not, resample manually
                AudioInputStream pcm;
                if (AudioSystem.isConversionSupported(targetFormat, original.getFormat())) {
                    pcm = AudioSystem.getAudioInputStream(targetFormat, original);
                } else {
                    // Manual resample: read raw PCM and resample
                    byte[] resampled = resample(wavBytes, sourceSampleRate, ASR_SAMPLE_RATE);
                    Path normalized = normalizedPath();
                    byte[] normalizedWav = pcmToWav(resampled, ASR_SAMPLE_RATE);
                    Files.write(normalized, normalizedWav);
                    rejectSilence(normalized);
                    return normalized;
                }
                Path normalized = normalizedPath();
                AudioSystem.write(pcm, AudioFileFormat.Type.WAVE, normalized.toFile());
                rejectSilence(normalized);
                return normalized;
            } catch (UnsupportedAudioFileException e) {
                // Fallback: manual resample
                byte[] resampled = resample(wavBytes, sourceSampleRate, ASR_SAMPLE_RATE);
                Path normalized = normalizedPath();
                byte[] normalizedWav = pcmToWav(resampled, ASR_SAMPLE_RATE);
                Files.write(normalized, normalizedWav);
                rejectSilence(normalized);
                return normalized;
            }
        } finally {
            try { Files.deleteIfExists(tempWav); } catch (IOException ignored) {}
        }
    }

    private static void rejectSilence(Path wav) throws IOException {
        try (AudioInputStream audio = AudioSystem.getAudioInputStream(wav.toFile())) {
            byte[] data = audio.readAllBytes();
            if (data.length < 2) throw new IOException("Audio is empty, please re-record");

            AudioFormat format = audio.getFormat();
            int sampleRate = Math.round(format.getSampleRate());
            if (format.getSampleSizeInBits() != 16 || format.getChannels() != 1 || sampleRate <= 0) {
                throw new IOException("VAD requires 16-bit mono PCM audio");
            }

            int totalSamples = data.length / 2;
            long durationMs = Math.round(totalSamples * 1000.0 / sampleRate);

            if (durationMs < MIN_AUDIO_MS) {
                throw new IOException("Recording too short (min " + MIN_AUDIO_MS + "ms)");
            }
            if (durationMs > MAX_AUDIO_MS) {
                throw new IOException("Recording too long (max " + (MAX_AUDIO_MS / 1000) + "s)");
            }

            // Compute RMS energy
            double squares = 0;
            int samples = 0;
            for (int i = 0; i + 1 < data.length; i += 2) {
                short value = (short) ((data[i] & 0xff) | (data[i + 1] << 8));
                squares += (double) value * value;
                samples++;
            }
            double rms = Math.sqrt(squares / Math.max(1, samples));
            if (rms < MIN_RMS) {
                throw new IOException("Silence detected or volume too low, please move closer to mic");
            }

            // Check for sufficient voiced speech
            int frameSamples = Math.max(1, sampleRate * FRAME_MS / 1000);
            int firstVoicedSample = -1;
            int voicedSamples = 0;
            for (int frameStart = 0; frameStart < totalSamples; frameStart += frameSamples) {
                int frameEnd = Math.min(totalSamples, frameStart + frameSamples);
                double frameSquares = 0;
                for (int sample = frameStart; sample < frameEnd; sample++) {
                    int byteIndex = sample * 2;
                    short value = (short) ((data[byteIndex] & 0xff) | (data[byteIndex + 1] << 8));
                    frameSquares += (double) value * value;
                }
                double frameRms = Math.sqrt(frameSquares / Math.max(1, frameEnd - frameStart));
                if (frameRms >= VOICED_FRAME_RMS) {
                    if (firstVoicedSample < 0) firstVoicedSample = frameStart;
                    voicedSamples += frameEnd - frameStart;
                }
            }

            if (firstVoicedSample < 0
                    || Math.round(voicedSamples * 1000.0 / sampleRate) < MIN_VOICED_MS) {
                throw new IOException("No valid speech detected, please re-record");
            }

            long leadingSilenceMs = Math.round(firstVoicedSample * 1000.0 / sampleRate);
            if (leadingSilenceMs > MAX_LEADING_SILENCE_MS) {
                throw new IOException("Leading silence exceeds " + (MAX_LEADING_SILENCE_MS / 1000) + "s, please re-record");
            }
        } catch (UnsupportedAudioFileException e) {
            throw new IOException("Cannot check audio silence: " + wav, e);
        }
    }

    /**
     * Simple linear resampling for 44-byte-header WAV PCM data.
     */
    private static byte[] resample(byte[] wavBytes, int fromRate, int toRate) throws IOException {
        // Skip 44-byte WAV header, get raw 16-bit PCM samples
        int headerSize = 44;
        if (wavBytes.length <= headerSize) throw new IOException("WAV too small for resampling");

        int pcmLen = wavBytes.length - headerSize;
        int inSamples = pcmLen / 2;
        double ratio = (double) toRate / fromRate;
        int outSamples = (int) (inSamples * ratio);

        ByteArrayOutputStream out = new ByteArrayOutputStream(outSamples * 2);
        for (int i = 0; i < outSamples; i++) {
            double srcIndex = i / ratio;
            int idx = (int) srcIndex;
            int pos = headerSize + idx * 2;
            if (pos + 1 < wavBytes.length) {
                out.write(wavBytes[pos]);
                out.write(wavBytes[pos + 1]);
            }
        }
        return out.toByteArray();
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

    private static Path normalizedPath() throws IOException {
        Path dir = Paths.get("generated");
        Files.createDirectories(dir);
        return dir.resolve("voice_16k.wav");
    }
}
