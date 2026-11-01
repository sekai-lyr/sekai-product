package com.ykd.claw.media;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Iterator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;

public class ImageProcessor {

    private static final Logger LOGGER = LoggerFactory.getLogger(ImageProcessor.class.getName());

    private static final int VISION_MAX_WIDTH  = 1024;
    private static final int VISION_MAX_HEIGHT = 1024;
    private static final int GEN_MAX_WIDTH     = 2048;
    private static final int GEN_MAX_HEIGHT    = 2048;
    private static final float JPEG_QUALITY    = 0.85f;

    /** Cap on pixels allowed before full decode; blocks decompression bombs. */
    private static final long MAX_IMAGE_PIXELS = 50_000_000L;

    public static Path optimize(Path source) throws IOException {
        checkImageSize(source);
        BufferedImage img = ImageIO.read(source.toFile());
        if (img == null) return source;

        img = resizeIfNeeded(img, GEN_MAX_WIDTH, GEN_MAX_HEIGHT);

        Path optimized = source.resolveSibling(
            source.getFileName().toString().replaceFirst("\\.png$", ".jpg"));

        writeJpeg(img, optimized, JPEG_QUALITY);

        long origSize = Files.size(source);
        long optSize  = Files.size(optimized);
        LOGGER.info(String.format("Optimized: %dKB -> %dKB (%.0f%%)",
            origSize / 1024, optSize / 1024, 100.0 * optSize / origSize));

        return optimized;
    }

    public static byte[] prepareForVision(Path imagePath) throws IOException {
        if (!Files.isRegularFile(imagePath)) {
            throw new IOException("Image file not found: " + imagePath);
        }
        if (!isSupportedImage(imagePath)) {
            throw new IOException("Unsupported or non-image file: " + imagePath.getFileName());
        }
        checkImageSize(imagePath);
        BufferedImage img = ImageIO.read(imagePath.toFile());
        if (img == null) {
            return Files.readAllBytes(imagePath);
        }

        int w = img.getWidth();
        int h = img.getHeight();
        if (w <= VISION_MAX_WIDTH && h <= VISION_MAX_HEIGHT) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            writeJpeg(img, bos, 0.9f);
            LOGGER.info(String.format("Vision image %dx%d -> %d bytes JPEG", w, h, bos.size()));
            return bos.toByteArray();
        }

        double scale = Math.min(
            (double) VISION_MAX_WIDTH  / w,
            (double) VISION_MAX_HEIGHT / h
        );
        int newW = (int) (w * scale);
        int newH = (int) (h * scale);

        BufferedImage resized = new BufferedImage(newW, newH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = resized.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(img, 0, 0, newW, newH, null);
        g.dispose();

        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        writeJpeg(resized, bos, 0.85f);
        LOGGER.info(String.format("Vision image resized %dx%d -> %dx%d, %d bytes",
            w, h, newW, newH, bos.size()));
        return bos.toByteArray();
    }

    /**
     * Validate the file's magic bytes (signature) before reading, so a tool cannot
     * hand an arbitrary file (e.g. secrets.properties) to the vision pipeline and
     * have its bytes uploaded to a third-party service. Only real image containers
     * pass; formats ImageIO cannot decode (e.g. WebP) are still forwarded raw so
     * the vision provider can try to decode them.
     */
    public static boolean isSupportedImage(Path path) throws IOException {
        byte[] head = new byte[16];
        int n;
        try (InputStream in = Files.newInputStream(path)) {
            n = in.readNBytes(head, 0, head.length);
        }
        if (n < 4) return false;
        // JPEG: FFD8FF
        if ((head[0] & 0xff) == 0xff && (head[1] & 0xff) == 0xd8 && (head[2] & 0xff) == 0xff) return true;
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (n >= 8 && (head[0] & 0xff) == 0x89 && head[1] == 'P' && head[2] == 'N'
                && head[3] == 'G' && head[4] == 0x0d && head[5] == 0x0a && head[6] == 0x1a && head[7] == 0x0a) return true;
        // GIF87a / GIF89a
        if (n >= 6 && head[0] == 'G' && head[1] == 'I' && head[2] == 'F' && head[3] == '8') return true;
        // BMP: "BM"
        if (head[0] == 'B' && head[1] == 'M') return true;
        // TIFF: II*0 (little-endian) or MM0* (big-endian)
        if (n >= 4 && ((head[0] == 'I' && head[1] == 'I' && head[2] == 0x2a && head[3] == 0x00)
                || (head[0] == 'M' && head[1] == 'M' && head[2] == 0x00 && head[3] == 0x2a))) return true;
        // WebP: RIFF....WEBP
        if (n >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') return true;
        return false;
    }

    /**
     * Read only the image header's declared width/height and reject images whose
     * pixel count would require excessive heap when fully decoded. This blocks
     * decompression bombs: tiny files whose header claims huge dimensions (e.g.
     * 50k x 50k) that would OOM the JVM if ImageIO.read were allowed to allocate
     * the full pixel buffer. Unlike ImageIO.read, getWidth/getHeight parse the
     * header without allocating pixels. Formats with no built-in reader (e.g.
     * WebP) cannot report dimensions and are left to the caller's decode path.
     */
    private static void checkImageSize(Path path) throws IOException {
        try (ImageInputStream in = ImageIO.createImageInputStream(path.toFile())) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                return;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                long pixels = (long) width * height;
                if (pixels > MAX_IMAGE_PIXELS) {
                    throw new IOException("Image dimensions too large: " + width + "x" + height
                            + " pixels (max " + MAX_IMAGE_PIXELS + ")");
                }
            } finally {
                reader.dispose();
            }
        }
    }

    private static BufferedImage resizeIfNeeded(BufferedImage img, int maxW, int maxH) {
        int w = img.getWidth();
        int h = img.getHeight();
        if (w <= maxW && h <= maxH) return img;

        double scale = Math.min((double) maxW / w, (double) maxH / h);
        int newW = (int) (w * scale);
        int newH = (int) (h * scale);

        BufferedImage resized = new BufferedImage(newW, newH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = resized.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(img, 0, 0, newW, newH, null);
        g.dispose();
        return resized;
    }

    private static void writeJpeg(BufferedImage img, Path out, float quality) throws IOException {
        try (OutputStream os = Files.newOutputStream(out)) {
            writeJpeg(img, os, quality);
        }
    }

    private static void writeJpeg(BufferedImage img, OutputStream os, float quality) throws IOException {
        if (img.getType() == BufferedImage.TYPE_4BYTE_ABGR
            || img.getType() == BufferedImage.TYPE_INT_ARGB) {
            BufferedImage rgb = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgb.createGraphics();
            g.drawImage(img, 0, 0, null);
            g.dispose();
            img = rgb;
        }

        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            ImageIO.write(img, "png", os);
            return;
        }
        ImageWriter writer = writers.next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(quality);

        try (ImageOutputStream ios = ImageIO.createImageOutputStream(os)) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
    }
}