package com.ykd.claw.map;

public record GeocodeResult(
        String formattedAddress,
        String location,
        String province,
        String city,
        String district,
        String adcode,
        String level) {
}
