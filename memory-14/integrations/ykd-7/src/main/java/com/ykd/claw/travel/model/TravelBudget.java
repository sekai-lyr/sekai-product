package com.ykd.claw.travel.model;

public record TravelBudget(
        Double total,
        Integer days,
        Integer people,
        Double perDay,
        Double perPersonPerDay) {
}
