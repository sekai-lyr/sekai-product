package com.ykd.claw.flyai.service;

import com.ykd.claw.travel.service.TravelDateResolver;
import com.ykd.claw.travel.service.TravelDateValidationService;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FlyAiCliServiceTest {
    private final CapturingExecutor executor = new CapturingExecutor();
    private final FlyAiCliService service = new FlyAiCliService(
            executor, new TravelDateValidationService(new TravelDateResolver()));

    @Test
    void buildsOfficialHotelCliArgumentsWithoutShellConcatenation() {
        String result = service.searchHotel(
                "杭州市", "2099-07-01", "2099-07-03", "西湖", 800);

        assertEquals("{\"status\":0}", result);
        assertEquals(List.of(
                "search-hotel",
                "--dest-name", "杭州市",
                "--check-in-date", "2099-07-01",
                "--check-out-date", "2099-07-03",
                "--poi-name", "西湖",
                "--max-price", "800"), executor.arguments);
    }

    @Test
    void buildsOfficialFlightTrainPoiAndAiSearchArguments() {
        service.searchFlight("上海", "北京", "2099-08-01", "2099-08-05", 1200);
        assertEquals(List.of("search-flight", "--origin", "上海", "--destination", "北京",
                "--dep-date", "2099-08-01", "--back-date", "2099-08-05",
                "--max-price", "1200"), executor.arguments);

        service.searchTrain("上海", "杭州", "2099-08-01");
        assertEquals(List.of("search-train", "--origin", "上海", "--destination", "杭州",
                "--dep-date", "2099-08-01"), executor.arguments);

        service.searchPoi("杭州市", "西湖", "山湖田园");
        assertEquals(List.of("search-poi", "--city-name", "杭州市", "--keyword", "西湖",
                "--category", "山湖田园"), executor.arguments);

        service.aiSearch("杭州亲子酒店");
        assertEquals(List.of("ai-search", "--query", "杭州亲子酒店"), executor.arguments);
    }

    @Test
    void rejectsInvalidOrPastDatesBeforeStartingCli() {
        assertThrows(IllegalArgumentException.class,
                () -> service.searchHotel("杭州", "2020-01-01", "2020-01-02", "", null));
        assertThrows(IllegalArgumentException.class,
                () -> service.searchHotel("杭州", "2099-02-02", "2099-02-01", "", null));
        assertThrows(IllegalArgumentException.class,
                () -> service.searchFlight("上海", "北京", "tomorrow", "", null));
        assertEquals(0, executor.calls);
    }

    private static final class CapturingExecutor implements FlyAiCommandExecutor {
        private List<String> arguments = new ArrayList<>();
        private int calls;

        @Override
        public String execute(List<String> arguments) {
            this.arguments = List.copyOf(arguments);
            calls++;
            return "{\"status\":0}";
        }
    }
}
