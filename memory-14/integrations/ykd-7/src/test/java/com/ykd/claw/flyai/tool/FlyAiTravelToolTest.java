package com.ykd.claw.flyai.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ykd.claw.flyai.service.FlyAiCliService;
import com.ykd.claw.travel.service.TravelDateValidationException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FlyAiTravelToolTest {
    @Test
    void returnsStructuredDateErrorInsteadOfThrowing() throws Exception {
        FlyAiCliService service = mock(FlyAiCliService.class);
        when(service.searchTrain("上海", "杭州", "2020-01-01"))
                .thenThrow(new TravelDateValidationException(
                        "departureDate", "departureDate must not be before 2026-08-01",
                        LocalDate.of(2026, 8, 1)));

        String result = new FlyAiTravelTool(service, mock(com.ykd.claw.flyai.service.FliggyHotelBookingService.class),
                mock(com.ykd.claw.flyai.service.HotelRecommendationService.class))
                .searchTrain("上海", "杭州", "2020-01-01");
        var json = new ObjectMapper().readTree(result);

        assertFalse(json.path("success").asBoolean());
        assertEquals("INVALID_TRAVEL_DATE", json.path("error").path("code").asText());
        assertEquals("departureDate", json.path("error").path("field").asText());
        assertEquals("2026-08-01", json.path("error").path("today").asText());
    }
}
