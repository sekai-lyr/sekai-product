package com.ykd.claw.travel.service;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TravelDateResolver {
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Shanghai");
    private static final Pattern ISO_DATE = Pattern.compile("(?<!\\d)(\\d{4}-\\d{1,2}-\\d{1,2})(?!\\d)");
    private static final Pattern CHINESE_DATE =
            Pattern.compile("(?:(\\d{4})年)?(\\d{1,2})月(\\d{1,2})[日号]?");
    private static final Pattern WEEKDAY =
            Pattern.compile("((?:下|这|本)?(?:周|星期|礼拜))([一二三四五六日天])");
    private static final Pattern DAYS_LATER =
            Pattern.compile("([0-9一二两三四五六七八九十]+)天后");
    private static final DateTimeFormatter FLEXIBLE_ISO = DateTimeFormatter.ofPattern("yyyy-M-d");

    private final Clock clock;

    public TravelDateResolver() {
        this(Clock.system(DEFAULT_ZONE));
    }

    public TravelDateResolver(Clock clock) {
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock);
    }

    public Optional<LocalDate> resolveFirst(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        LocalDate today = today();

        Matcher iso = ISO_DATE.matcher(text);
        if (iso.find()) {
            try {
                return Optional.of(LocalDate.parse(iso.group(1), FLEXIBLE_ISO));
            } catch (DateTimeParseException ignored) {
                // Continue with the remaining supported expressions.
            }
        }

        Matcher chinese = CHINESE_DATE.matcher(text);
        if (chinese.find()) {
            int year = chinese.group(1) == null ? today.getYear() : Integer.parseInt(chinese.group(1));
            try {
                LocalDate resolved = LocalDate.of(year,
                        Integer.parseInt(chinese.group(2)), Integer.parseInt(chinese.group(3)));
                if (chinese.group(1) == null && resolved.isBefore(today)) {
                    resolved = MonthDay.from(resolved).atYear(year + 1);
                }
                return Optional.of(resolved);
            } catch (RuntimeException ignored) {
                return Optional.empty();
            }
        }

        if (text.contains("大后天")) return Optional.of(today.plusDays(3));
        if (text.contains("后天")) return Optional.of(today.plusDays(2));
        if (text.contains("明天") || text.contains("明日")) return Optional.of(today.plusDays(1));
        if (text.contains("今天") || text.contains("今日")) return Optional.of(today);

        Matcher daysLater = DAYS_LATER.matcher(text);
        if (daysLater.find()) {
            Integer days = positiveDays(daysLater.group(1));
            if (days != null) return Optional.of(today.plusDays(days));
        }

        Matcher weekday = WEEKDAY.matcher(text);
        if (weekday.find()) {
            DayOfWeek target = dayOfWeek(weekday.group(2));
            LocalDate resolved = today.with(TemporalAdjusters.nextOrSame(target));
            if (weekday.group(1).startsWith("下")) resolved = resolved.plusWeeks(1);
            return Optional.of(resolved);
        }
        return Optional.empty();
    }

    private static Integer positiveDays(String value) {
        try {
            int days = Integer.parseInt(value);
            return days > 0 ? days : null;
        } catch (NumberFormatException ignored) {
            // Continue with common Chinese numerals.
        }
        if (value.equals("十")) return 10;
        int tens = value.indexOf('十');
        if (tens >= 0) {
            int left = tens == 0 ? 1 : chineseDigit(value.charAt(0));
            int right = tens == value.length() - 1 ? 0 : chineseDigit(value.charAt(tens + 1));
            int result = left * 10 + right;
            return result > 0 ? result : null;
        }
        return value.length() == 1 ? chineseDigit(value.charAt(0)) : null;
    }

    private static Integer chineseDigit(char value) {
        return switch (value) {
            case '一' -> 1;
            case '二', '两' -> 2;
            case '三' -> 3;
            case '四' -> 4;
            case '五' -> 5;
            case '六' -> 6;
            case '七' -> 7;
            case '八' -> 8;
            case '九' -> 9;
            default -> null;
        };
    }

    private static DayOfWeek dayOfWeek(String value) {
        return switch (value) {
            case "一" -> DayOfWeek.MONDAY;
            case "二" -> DayOfWeek.TUESDAY;
            case "三" -> DayOfWeek.WEDNESDAY;
            case "四" -> DayOfWeek.THURSDAY;
            case "五" -> DayOfWeek.FRIDAY;
            case "六" -> DayOfWeek.SATURDAY;
            case "日", "天" -> DayOfWeek.SUNDAY;
            default -> throw new IllegalArgumentException("Unsupported weekday: " + value);
        };
    }
}
