package com.sekai.draw.lots.service;

import com.sekai.draw.lots.model.DrawRecord;
import com.sekai.draw.lots.model.User;
import org.springframework.stereotype.Service;
import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class ShareCardService {
    private static final int WIDTH = 1080, HEIGHT = 1440;
    public String theme(String value) { return "paper".equals(value) ? "paper" : "night"; }
    private String background(String theme) { return "paper".equals(theme) ? "#eee7dc" : "#172438"; }
    private List<String> lines(String text, int width) {
        List<String> lines = new ArrayList<>();
        if (text == null) return lines;
        int[] points = text.codePoints().toArray();
        for (int i = 0; i < points.length && lines.size() < 5; i += width) lines.add(new String(points, i, Math.min(width, points.length - i)));
        return lines;
    }
    public byte[] svg(DrawRecord record, User user, String theme, boolean hideName) {
        StringBuilder svg = new StringBuilder("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1080\" height=\"1440\" viewBox=\"0 0 1080 1440\">");
        svg.append("<rect width=\"1080\" height=\"1440\" fill=\"").append(background(theme)).append("\"/><rect x=\"64\" y=\"64\" width=\"952\" height=\"1312\" rx=\"28\" fill=\"#faf7ef\"/>");
        svg.append("<g font-family=\"Microsoft YaHei,PingFang SC,sans-serif\" fill=\"#1c293a\">");
        text(svg, "灵感伙伴签", 120, 155, 30, false);
        text(svg, record.getDrawTime() == null ? "今日相遇" : record.getDrawTime().format(DateTimeFormatter.ofPattern("yyyy.MM.dd")), 120, 215, 24, false);
        text(svg, record.getCharacter().getDisplayName(), 120, 360, 58, true);
        text(svg, record.getCharacter().getDisplayAnimeTitle(), 120, 425, 27, false);
        svg.append("<path d=\"M120 490H960\" stroke=\"#c4a56c\" stroke-width=\"2\"/>");
        text(svg, record.getFortune().getLevelName() + " · " + record.getLuckScore(), 120, 575, 42, true);
        int y = 665;
        for (String line : lines(record.getMessage(), 23)) { text(svg, line, 120, y, 32, false); y += 49; }
        y = Math.max(890, y + 36);
        for (String line : lines(record.getFortune().getAdvice(), 26).stream().limit(3).toList()) { text(svg, line, 120, y, 28, false); y += 44; }
        text(svg, "幸运色：" + record.getFortune().getLuckyColor() + "    幸运物：" + record.getFortune().getLuckyItem(), 120, 1145, 24, false);
        text(svg, hideName ? "留给此刻的自己" : "属于 " + user.getNickName() + " 的一签", 120, 1240, 26, false);
        text(svg, "把一点灵感，带进今天。", 120, 1300, 22, false);
        svg.append("</g></svg>");
        return svg.toString().getBytes(StandardCharsets.UTF_8);
    }
    private void text(StringBuilder svg, String value, int x, int y, int size, boolean bold) {
        svg.append("<text x=\"").append(x).append("\" y=\"").append(y).append("\" font-size=\"").append(size).append("\"")
                .append(bold ? " font-weight=\"700\"" : "").append(" textLength=\"")
                .append(Math.min(820, Math.max(1, (value == null ? 0 : value.codePointCount(0, value.length())) * size * .82)))
                .append("\" lengthAdjust=\"spacingAndGlyphs\">").append(escape(value)).append("</text>");
    }
    private String escape(String value) { return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;"); }
    public byte[] png(DrawRecord record, User user, String theme, boolean hideName) throws java.io.IOException {
        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setColor(Color.decode(background(theme))); g.fillRect(0, 0, WIDTH, HEIGHT);
            g.setColor(Color.decode("#faf7ef")); g.fillRoundRect(64, 64, 952, 1312, 56, 56);
            draw(g, "灵感伙伴签", 155, 30, false); draw(g, record.getDrawTime() == null ? "今日相遇" : record.getDrawTime().format(DateTimeFormatter.ofPattern("yyyy.MM.dd")), 215, 24, false);
            draw(g, record.getCharacter().getDisplayName(), 360, 58, true); draw(g, record.getCharacter().getDisplayAnimeTitle(), 425, 27, false);
            g.setColor(Color.decode("#c4a56c")); g.fillRect(120, 490, 840, 2);
            draw(g, record.getFortune().getLevelName() + " · " + record.getLuckScore(), 575, 42, true);
            int y = 665;
            for (String line : lines(record.getMessage(), 23)) { draw(g, line, y, 32, false); y += 49; }
            y = Math.max(890, y + 36);
            for (String line : lines(record.getFortune().getAdvice(), 26).stream().limit(3).toList()) { draw(g, line, y, 28, false); y += 44; }
            draw(g, "幸运色：" + record.getFortune().getLuckyColor() + "    幸运物：" + record.getFortune().getLuckyItem(), 1145, 24, false);
            draw(g, hideName ? "留给此刻的自己" : "属于 " + user.getNickName() + " 的一签", 1240, 26, false);
            draw(g, "把一点灵感，带进今天。", 1300, 22, false);
        } finally { g.dispose(); }
        var output = new ByteArrayOutputStream(); ImageIO.write(image, "png", output); return output.toByteArray();
    }
    private void draw(Graphics2D g, String value, int y, int size, boolean bold) {
        if (value == null) return;
        Font font = new Font("Microsoft YaHei", bold ? Font.BOLD : Font.PLAIN, size);
        g.setFont(font);
        int width = g.getFontMetrics().stringWidth(value);
        if (width > 820) g.setFont(font.deriveFont(Math.max(12f, size * 820f / width)));
        g.setColor(Color.decode("#1c293a")); g.drawString(value, 120, y);
    }
}
