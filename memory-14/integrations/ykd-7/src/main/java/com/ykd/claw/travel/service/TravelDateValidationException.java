package com.ykd.claw.travel.service;

import java.time.LocalDate;

public final class TravelDateValidationException extends IllegalArgumentException {
    private final String field;
    private final LocalDate today;

    public TravelDateValidationException(String field, String message, LocalDate today) {
        super(message);
        this.field = field;
        this.today = today;
    }

    public String field() {
        return field;
    }

    public LocalDate today() {
        return today;
    }
}
