package com.sekai.draw.lots.control;

import com.sekai.draw.lots.mapper.SekaiDrawLotsRecordMapper;
import com.sekai.draw.lots.model.AnimeCharacter;
import com.sekai.draw.lots.model.DrawRecord;
import com.sekai.draw.lots.model.Fortune;
import com.sekai.draw.lots.model.User;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

@RestController
public class ShareCardControl {

    private static final DateTimeFormatter CARD_TIME = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");

    @Resource
    private SekaiDrawLotsRecordMapper recordMapper;

    @GetMapping("/share/records/{id}.svg")
    public ResponseEntity<byte[]> recordShareCard(@PathVariable("id") Long id, HttpSession session) {
        User user = requireLogin(session);
        if (user == null) {
            return simpleCard(HttpStatus.UNAUTHORIZED, "请先登录", "登录后可以生成抽签分享卡。");
        }
        DrawRecord record = recordMapper.selectByIdForUser(id, user.getId());
        if (record == null) {
            return simpleCard(HttpStatus.NOT_FOUND, "记录不存在", "只能生成属于自己的抽签分享卡。");
        }
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=sekai-share-" + record.getId() + ".svg")
                .contentType(MediaType.valueOf("image/svg+xml"))
                .body(buildShareSvg(record, user).getBytes(StandardCharsets.UTF_8));
    }

    private ResponseEntity<byte[]> simpleCard(HttpStatus status, String title, String subtitle) {
        String svg = """
                <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">
                  <rect width="1080" height="1440" fill="#10182f"/>
                  <rect x="86" y="126" width="908" height="1188" rx="40" fill="#ffffff"/>
                  <text x="540" y="592" text-anchor="middle" font-family="Arial, sans-serif" font-size="68" font-weight="800" fill="#172033">__TITLE__</text>
                  <text x="540" y="682" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#667085">__SUBTITLE__</text>
                  <text x="540" y="1224" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#2563eb">灵感伙伴签</text>
                </svg>
                """
                .replace("__TITLE__", escapeXml(title))
                .replace("__SUBTITLE__", escapeXml(subtitle));
        return ResponseEntity.status(status)
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.valueOf("image/svg+xml"))
                .body(svg.getBytes(StandardCharsets.UTF_8));
    }

    private String buildShareSvg(DrawRecord record, User user) {
        AnimeCharacter character = record.getCharacter();
        Fortune fortune = record.getFortune();
        String characterName = character == null ? "Unknown Companion" : character.getEnglishName();
        String series = character == null ? "灵感伙伴" : character.getAnimeTitle();
        String element = character == null ? "Fortune" : character.getElement();
        String levelName = fortune == null ? "今日运势" : fortune.getLevelName();
        String advice = fortune == null ? record.getMessage() : fortune.getAdvice();
        String score = String.valueOf(record.getLuckScore() == null ? 0 : record.getLuckScore());
        String time = record.getDrawTime() == null ? "" : CARD_TIME.format(record.getDrawTime());
        String initials = initials(characterName);
        String message = fit(record.getMessage(), 42);
        String adviceLineOne = fit(advice, 32);
        String adviceLineTwo = fit(advice == null || advice.length() <= 32 ? "" : advice.substring(32), 32);
        String owner = user.getNickName() == null ? user.getUserName() : user.getNickName();

        return """
                <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">
                  <defs>
                    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                      <stop stop-color="#10182f"/>
                      <stop offset=".58" stop-color="#1d4ed8"/>
                      <stop offset="1" stop-color="#78e08f"/>
                    </linearGradient>
                    <linearGradient id="coin" x1="0" y1="0" x2="1" y2="1">
                      <stop stop-color="#fff7b8"/>
                      <stop offset="1" stop-color="#f59e0b"/>
                    </linearGradient>
                  </defs>
                  <rect width="1080" height="1440" fill="url(#bg)"/>
                  <circle cx="134" cy="154" r="88" fill="#ffffff" opacity=".16"/>
                  <circle cx="922" cy="226" r="142" fill="#ffffff" opacity=".13"/>
                  <circle cx="832" cy="1284" r="210" fill="#ffffff" opacity=".12"/>

                  <rect x="72" y="88" width="936" height="1264" rx="42" fill="#ffffff" opacity=".97"/>
                  <text x="132" y="178" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#2563eb">灵感伙伴签</text>
                  <text x="948" y="178" text-anchor="end" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#667085">__TIME__</text>

                  <circle cx="540" cy="382" r="168" fill="url(#coin)"/>
                  <circle cx="540" cy="382" r="124" fill="#ffffff" opacity=".78"/>
                  <text x="540" y="416" text-anchor="middle" font-family="Arial, sans-serif" font-size="106" font-weight="900" fill="#7c2d12">__INITIALS__</text>

                  <text x="540" y="642" text-anchor="middle" font-family="Arial, sans-serif" font-size="68" font-weight="900" fill="#172033">__NAME__</text>
                  <text x="540" y="704" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#667085">__SERIES__ · __ELEMENT__</text>

                  <rect x="156" y="780" width="768" height="170" rx="28" fill="#f8fafc" stroke="#dfe5ef" stroke-width="3"/>
                  <text x="210" y="852" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="#475467">今日运势</text>
                  <text x="870" y="852" text-anchor="end" font-family="Arial, sans-serif" font-size="72" font-weight="900" fill="#12b886">__SCORE__</text>
                  <text x="210" y="910" font-family="Arial, sans-serif" font-size="42" font-weight="900" fill="#172033">__LEVEL__</text>

                  <rect x="156" y="990" width="768" height="176" rx="28" fill="#eef4ff"/>
                  <text x="210" y="1060" font-family="Arial, sans-serif" font-size="32" font-weight="800" fill="#1d4ed8">__MESSAGE__</text>
                  <text x="210" y="1120" font-family="Arial, sans-serif" font-size="30" fill="#344054">__ADVICE_ONE__</text>
                  <text x="210" y="1164" font-family="Arial, sans-serif" font-size="30" fill="#344054">__ADVICE_TWO__</text>

                  <text x="156" y="1262" font-family="Arial, sans-serif" font-size="28" fill="#667085">由 __OWNER__ 生成</text>
                  <text x="924" y="1262" text-anchor="end" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#172033">抽签分享卡</text>
                </svg>
                """
                .replace("__TIME__", escapeXml(time))
                .replace("__INITIALS__", escapeXml(initials))
                .replace("__NAME__", escapeXml(fit(characterName, 22)))
                .replace("__SERIES__", escapeXml(fit(series, 22)))
                .replace("__ELEMENT__", escapeXml(element))
                .replace("__SCORE__", escapeXml(score))
                .replace("__LEVEL__", escapeXml(levelName))
                .replace("__MESSAGE__", escapeXml(message))
                .replace("__ADVICE_ONE__", escapeXml(adviceLineOne))
                .replace("__ADVICE_TWO__", escapeXml(adviceLineTwo))
                .replace("__OWNER__", escapeXml(fit(owner, 18)));
    }

    private String fit(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        String normalized = value.trim();
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, Math.max(0, maxLength - 1)) + "...";
    }

    private String initials(String value) {
        String compact = value == null ? "" : value.replaceAll("[^A-Za-z0-9]", "");
        if (compact.length() >= 2) {
            return compact.substring(0, 2).toUpperCase();
        }
        return compact.isEmpty() ? "SK" : compact.toUpperCase();
    }

    private String escapeXml(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private User requireLogin(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        return loginUser instanceof User user ? user : null;
    }
}
