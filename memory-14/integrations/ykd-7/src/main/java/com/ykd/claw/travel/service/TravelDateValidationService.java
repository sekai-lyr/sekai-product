package com.ykd.claw.travel.service;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

@Service
public class TravelDateValidationService {
    private final TravelDateResolver resolver;

    public TravelDateValidationService(TravelDateResolver resolver) {
        this.resolver = resolver;
    }

    public LocalDate requireCurrentOrFuture(String value, String field) {
        LocalDate today = resolver.today();
        if (value == null || value.isBlank()) {
            throw new TravelDateValidationException(field, field + " is required", today);
        }
        try {
            LocalDate date = LocalDate.parse(value.trim());
            if (date.isBefore(today)) {
                throw new TravelDateValidationException(
                        field, field + " must not be before " + today, today);
            }
            return date;
        } catch (DateTimeParseException e) {
            throw new TravelDateValidationException(
                    field, field + " must use yyyy-MM-dd", today);
        }
    }

    public LocalDate optionalCurrentOrFuture(String value, String field) {
        return value == null || value.isBlank() ? null : requireCurrentOrFuture(value, field);
    }

    public void requireAfter(LocalDate later, String laterField,
                             LocalDate earlier, String earlierField) {
        if (!later.isAfter(earlier)) {
            throw new TravelDateValidationException(laterField,
                    laterField + " must be after " + earlierField, resolver.today());
        }
    }

    public void requireNotBefore(LocalDate later, String laterField,
                                 LocalDate earlier, String earlierField) {
        if (later.isBefore(earlier)) {
            throw new TravelDateValidationException(laterField,
                    laterField + " must not be before " + earlierField, resolver.today());
        }
    }
}
