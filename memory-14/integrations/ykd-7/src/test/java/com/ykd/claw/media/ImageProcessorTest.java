package com.ykd.claw.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.CRC32;

import static org.junit.jupiter.api.Assertions.*;

class ImageProcessorTest {

    @TempDir
    Path tempDir;

    @Test
    void rejectsNonImageFileInsteadOfUploadingRawBytes() throws Exception {
        Path textFile = tempDir.resolve("secrets.txt");
        Files.write(textFile, "api_key=should-never-leave".getBytes(StandardCharsets.UTF_8));

        IOException ex = assertThrows(IOException.class, () -> ImageProcessor.prepareForVision(textFile));
        assertTrue(ex.getMessage().contains("non-image"));
    }

    @Test
    void acceptsRealJpeg() throws Exception {
        Path image = tempDir.resolve("sample.jpg");
        ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB), "jpg", image.toFile());

        assertTrue(ImageProcessor.isSupportedImage(image));
        assertNotNull(ImageProcessor.prepareForVision(image));
    }

    @Test
    void acceptsWebpMagicEvenWhenImageIoCannotDecode() throws Exception {
        // RIFF....WEBP header: a real image container that ImageIO cannot decode.
        // It must be forwarded raw (the vision provider can decode it), not rejected.
        Path webp = tempDir.resolve("sample.webp");
        byte[] header = new byte[16];
        header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
        header[8] = 'W'; header[9] = 'E'; header[10] = 'B'; header[11] = 'P';
        Files.write(webp, header);

        assertTrue(ImageProcessor.isSupportedImage(webp));
        byte[] bytes = ImageProcessor.prepareForVision(webp);
        assertEquals(header.length, bytes.length);
    }

    @Test
    void rejectsDirectoryAsImageSource() throws Exception {
        IOException ex = assertThrows(IOException.class, () -> ImageProcessor.prepareForVision(tempDir));
        assertTrue(ex.getMessage().contains("not found"));
    }

    @Test
    void rejectsDecompressionBombBeforeDecoding() throws Exception {
        // Tiny file (signature + IHDR/IEND, no pixel data) whose header claims
        // 50k x 50k = 2.5 billion pixels. Without the dimension pre-check a full
        // decode would allocate ~10 GB and OOM; the pre-check must reject it first.
        Path bomb = tempDir.resolve("bomb.png");
        Files.write(bomb, pngWithDimensions(50_000, 50_000));
        assertTrue(ImageProcessor.isSupportedImage(bomb));

        IOException visionEx = assertThrows(IOException.class, () -> ImageProcessor.prepareForVision(bomb));
        assertTrue(visionEx.getMessage().contains("dimensions"));

        IOException optimizeEx = assertThrows(IOException.class, () -> ImageProcessor.optimize(bomb));
        assertTrue(optimizeEx.getMessage().contains("dimensions"));
    }

    @Test
    void acceptsImagesWithinPixelBudget() throws Exception {
        Path image = tempDir.resolve("small.png");
        ImageIO.write(new BufferedImage(64, 64, BufferedImage.TYPE_INT_RGB), "png", image.toFile());

        // A legitimately-sized image must pass the dimension pre-check and flow
        // through both decode paths without being rejected.
        byte[] bytes = ImageProcessor.prepareForVision(image);
        assertNotNull(bytes);
        assertNotNull(ImageProcessor.optimize(image));
    }

    /** Build a structurally valid PNG whose header declares the given dimensions. */
    private static byte[] pngWithDimensions(int width, int height) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
        byte[] ihdr = new byte[13];
        ihdr[0] = (byte) (width >>> 24);
        ihdr[1] = (byte) (width >>> 16);
        ihdr[2] = (byte) (width >>> 8);
        ihdr[3] = (byte) width;
        ihdr[4] = (byte) (height >>> 24);
        ihdr[5] = (byte) (height >>> 16);
        ihdr[6] = (byte) (height >>> 8);
        ihdr[7] = (byte) height;
        ihdr[8] = 8;   // bit depth
        ihdr[9] = 6;   // color type: RGBA
        ihdr[10] = 0;  // compression
        ihdr[11] = 0;  // filter
        ihdr[12] = 0;  // interlace
        writePngChunk(out, "IHDR", ihdr);
        writePngChunk(out, "IEND", new byte[0]);
        return out.toByteArray();
    }

    private static void writePngChunk(ByteArrayOutputStream out, String type, byte[] data) throws IOException {
        ByteArrayOutputStream chunk = new ByteArrayOutputStream();
        try (DataOutputStream dos = new DataOutputStream(chunk)) {
            dos.writeInt(data.length);
            dos.write(type.getBytes(StandardCharsets.US_ASCII));
            dos.write(data);
            CRC32 crc = new CRC32();
            crc.update(type.getBytes(StandardCharsets.US_ASCII));
            crc.update(data);
            dos.writeInt((int) crc.getValue());
        }
        out.write(chunk.toByteArray());
    }
}
