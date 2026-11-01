package com.ykd.claw.media;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

/**
 * Extracts key frames from video files using FFmpeg.
 * Falls back to extracting a single frame at 1 second if FFmpeg is not available.
 */
public class VideoProcessor {

    private static final Logger LOGGER = Logger.getLogger(VideoProcessor.class.getName());
    private static final int MAX_FRAMES = 8;
    private static final int MAX_FRAME_BYTES = 1024 * 1024; // 1MB per frame
    private static final long MAX_VIDEO_SIZE = 200L * 1024 * 1024; // 200MB

    /**
     * Extract key frames from a video file as JPEG byte arrays.
     * Uses FFmpeg to extract evenly-spaced frames.
     *
     * @param videoPath path to the video file
     * @return list of JPEG byte arrays, one per frame
     * @throws IOException if the video cannot be read or FFmpeg fails
     */
    public static List<byte[]> extractFrames(Path videoPath) throws IOException {
        if (!Files.exists(videoPath)) {
            throw new IOException("Video file not found: " + videoPath);
        }
        long size = Files.size(videoPath);
        if (size > MAX_VIDEO_SIZE) {
            throw new IOException("Video file too large (max 200MB): " + (size / 1024 / 1024) + "MB");
        }

        // Try FFmpeg first
        if (isFfmpegAvailable()) {
            return extractWithFfmpeg(videoPath);
        }

        // Fallback: try to read as animated GIF using ImageIO
        LOGGER.warning("FFmpeg not found, attempting basic video frame extraction");
        return extractBasic(videoPath);
    }

    private static boolean isFfmpegAvailable() {
        try {
            Process process = new ProcessBuilder("ffmpeg", "-version")
                    .redirectErrorStream(true)
                    .start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            return finished && process.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private static List<byte[]> extractWithFfmpeg(Path videoPath) throws IOException {
        // First get video duration
        double duration = getVideoDuration(videoPath);
        if (duration <= 0) duration = 10; // default to 10 seconds

        // Calculate frame timestamps (evenly spaced)
        int frameCount = Math.min(MAX_FRAMES, Math.max(1, (int) (duration / 3)));
        List<byte[]> frames = new ArrayList<>();

        for (int i = 0; i < frameCount; i++) {
            double timestamp = (i + 0.5) * duration / frameCount;
            byte[] frame = extractSingleFrame(videoPath, timestamp);
            if (frame != null && frame.length > 0) {
                frames.add(frame);
            }
        }

        if (frames.isEmpty()) {
            throw new IOException("Failed to extract any frames from video");
        }

        LOGGER.info("Extracted " + frames.size() + " frames from video: " + videoPath.getFileName());
        return frames;
    }

    private static double getVideoDuration(Path videoPath) {
        try {
            Process process = new ProcessBuilder(
                    "ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    videoPath.toAbsolutePath().toString())
                    .redirectErrorStream(true)
                    .start();
            String output = readProcessOutput(process);
            if (process.waitFor(10, TimeUnit.SECONDS) && process.exitValue() == 0) {
                return Double.parseDouble(output.trim());
            }
        } catch (Exception e) {
            LOGGER.fine("Could not get video duration: " + e.getMessage());
        }
        return -1;
    }

    private static byte[] extractSingleFrame(Path videoPath, double timestamp) {
        try {
            Process process = new ProcessBuilder(
                    "ffmpeg", "-ss", String.format("%.2f", timestamp),
                    "-i", videoPath.toAbsolutePath().toString(),
                    "-vframes", "1", "-f", "image2pipe",
                    "-vcodec", "mjpeg", "-q:v", "5",
                    "pipe:1")
                    .redirectErrorStream(false)
                    .start();

            byte[] frameData = readProcessBytes(process.getInputStream());
            process.waitFor(10, TimeUnit.SECONDS);

            if (frameData.length > MAX_FRAME_BYTES) {
                // Resize if too large (skip for now, return as-is)
                LOGGER.warning("Frame too large: " + frameData.length + " bytes");
            }

            return frameData.length > 0 ? frameData : null;
        } catch (Exception e) {
            LOGGER.fine("Failed to extract frame at " + timestamp + "s: " + e.getMessage());
            return null;
        }
    }

    private static List<byte[]> extractBasic(Path videoPath) throws IOException {
        // Try reading as animated GIF or other image format
        String fileName = videoPath.getFileName().toString().toLowerCase();
        if (fileName.endsWith(".gif")) {
            // For GIF, just read the first frame as image
            byte[] imageData = Files.readAllBytes(videoPath);
            List<byte[]> frames = new ArrayList<>();
            frames.add(imageData);
            return frames;
        }
        throw new IOException("FFmpeg is required for video analysis. Please install FFmpeg and ensure it's on PATH.");
    }

    private static String readProcessOutput(Process process) throws IOException {
        return new String(readProcessBytes(process.getInputStream()), java.nio.charset.StandardCharsets.UTF_8);
    }

    private static byte[] readProcessBytes(InputStream is) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int len;
        while ((len = is.read(buffer)) != -1) {
            bos.write(buffer, 0, len);
        }
        return bos.toByteArray();
    }
}
