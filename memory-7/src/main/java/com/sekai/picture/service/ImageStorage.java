package com.sekai.picture.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;

@Service
public class ImageStorage {
    public static final long MAX_BYTES = 20L * 1024 * 1024;
    private static final long MAX_PIXELS = 40_000_000;
    private final Path root;

    public ImageStorage(@Value("${sekai.upload-root:uploads/wallpapers}") String directory) {
        root = Path.of(directory).toAbsolutePath().normalize();
    }

    public Path root() { return root; }

    public Path resolve(String url) throws IOException {
        if (url == null) return null;
        String relative;
        if (url.startsWith("/wallpaper-image/")) relative = url.substring(17);
        else if (url.startsWith("/uploads/wallpapers/")) relative = url.substring(19);
        else return null;
        Path path = root.resolve(relative).normalize();
        if (!path.startsWith(root) || path.equals(root)) throw new IOException("图片路径无效");
        if (Files.exists(path) && !path.toRealPath().startsWith(root.toRealPath())) throw new IOException("图片路径无效");
        return path;
    }

    public record Decoded(BufferedImage image, String extension) { }

    public Decoded decode(Path file) throws IOException {
        if (Files.size(file) > MAX_BYTES) throw new IOException("每张图片不能超过 20 MB");
        try (var input = ImageIO.createImageInputStream(file.toFile())) {
            if (input == null) throw new IOException("无法读取图片");
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new IOException("请选择有效的 JPG、PNG 或 GIF 图片");
            var reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!Set.of("jpeg", "jpg", "png", "gif").contains(format)) throw new IOException("仅支持 JPG、PNG 和 GIF");
                reader.setInput(input, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_PIXELS)
                    throw new IOException("图片不能超过 4000 万像素");
                BufferedImage image = reader.read(0);
                if (image == null) throw new IOException("图片内容损坏，请重新选择");
                return new Decoded(image, format.equals("jpeg") ? "jpg" : format);
            } finally { reader.dispose(); }
        }
    }

    public String hash(Path path) throws IOException {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            try (var input = Files.newInputStream(path)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    public Path thumbnailPath(Long id) { return root.resolve(".thumbnails").resolve(id + ".jpg"); }

    public synchronized Path thumbnail(Long id, Path original) throws IOException {
        Path target = thumbnailPath(id);
        if (Files.isRegularFile(target)) return target;
        var decoded = decode(original);
        BufferedImage source = decoded.image();
        double scale = Math.min(1.0, 640.0 / Math.max(source.getWidth(), source.getHeight()));
        BufferedImage small = new BufferedImage(Math.max(1, (int)(source.getWidth() * scale)),
                Math.max(1, (int)(source.getHeight() * scale)), BufferedImage.TYPE_INT_RGB);
        var graphics = small.createGraphics();
        try {
            graphics.setColor(new java.awt.Color(24, 24, 24));
            graphics.fillRect(0, 0, small.getWidth(), small.getHeight());
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.drawImage(source, 0, 0, small.getWidth(), small.getHeight(), null);
        } finally { graphics.dispose(); }
        Files.createDirectories(target.getParent());
        Path temporary = Files.createTempFile(target.getParent(), "thumb-", ".jpg");
        try {
            if (!ImageIO.write(small, "jpg", temporary.toFile())) throw new IOException("缩略图生成失败");
            Files.move(temporary, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } finally { Files.deleteIfExists(temporary); }
        return target;
    }
}
