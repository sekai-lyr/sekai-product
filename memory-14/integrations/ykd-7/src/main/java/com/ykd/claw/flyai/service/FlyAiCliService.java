package com.ykd.claw.flyai.service;

import com.ykd.claw.travel.service.TravelDateValidationService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public final class FlyAiCliService {
    private final FlyAiCommandExecutor executor;
    private final TravelDateValidationService dateValidation;

    public FlyAiCliService(FlyAiCommandExecutor executor,
                           TravelDateValidationService dateValidation) {
        this.executor = executor;
        this.dateValidation = dateValidation;
    }

    public String searchHotel(String destination, String checkInDate, String checkOutDate,
                              String poiName, Integer maxPrice) {
        LocalDate checkInValue = dateValidation.requireCurrentOrFuture(checkInDate, "checkInDate");
        LocalDate checkOutValue = dateValidation.requireCurrentOrFuture(checkOutDate, "checkOutDate");
        dateValidation.requireAfter(checkOutValue, "checkOutDate", checkInValue, "checkInDate");
        String checkIn = checkInValue.toString();
        String checkOut = checkOutValue.toString();
        List<String> args = command("search-hotel");
        option(args, "--dest-name", required(destination, "destination"));
        option(args, "--check-in-date", checkIn);
        option(args, "--check-out-date", checkOut);
        option(args, "--poi-name", optional(poiName));
        positiveOption(args, "--max-price", maxPrice);
        return executor.execute(args);
    }

    public String searchFlight(String origin, String destination, String departureDate,
                               String returnDate, Integer maxPrice) {
        LocalDate departureValue = dateValidation.requireCurrentOrFuture(departureDate, "departureDate");
        LocalDate returnValue = dateValidation.optionalCurrentOrFuture(returnDate, "returnDate");
        if (returnValue != null) {
            dateValidation.requireNotBefore(returnValue, "returnDate", departureValue, "departureDate");
        }
        String departure = departureValue.toString();
        String returning = returnValue == null ? null : returnValue.toString();
        List<String> args = command("search-flight");
        option(args, "--origin", required(origin, "origin"));
        option(args, "--destination", required(destination, "destination"));
        option(args, "--dep-date", departure);
        option(args, "--back-date", returning);
        positiveOption(args, "--max-price", maxPrice);
        return executor.execute(args);
    }

    public String searchTrain(String origin, String destination, String departureDate) {
        List<String> args = command("search-train");
        option(args, "--origin", required(origin, "origin"));
        option(args, "--destination", required(destination, "destination"));
        option(args, "--dep-date",
                dateValidation.requireCurrentOrFuture(departureDate, "departureDate").toString());
        return executor.execute(args);
    }

    public String searchPoi(String city, String keyword, String category) {
        List<String> args = command("search-poi");
        option(args, "--city-name", required(city, "city"));
        option(args, "--keyword", required(keyword, "keyword"));
        option(args, "--category", optional(category));
        return executor.execute(args);
    }

    public String aiSearch(String query) {
        List<String> args = command("ai-search");
        option(args, "--query", required(query, "query"));
        return executor.execute(args);
    }

    private static List<String> command(String name) {
        return new ArrayList<>(List.of(name));
    }

    private static void option(List<String> args, String name, String value) {
        if (value == null || value.isBlank()) return;
        args.add(name);
        args.add(value);
    }

    private static void positiveOption(List<String> args, String name, Integer value) {
        if (value == null) return;
        if (value <= 0) throw new IllegalArgumentException(name + " must be positive");
        option(args, name, Integer.toString(value));
    }

    private static String required(String value, String name) {
        String result = optional(value);
        if (result == null) throw new IllegalArgumentException(name + " is required");
        return result;
    }

    private static String optional(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

}
