package com.ykd.claw.travel.model;

import java.util.List;

public record TravelContext(
        List<String> weather,
        List<TravelPlace> places,
        List<String> routes,
        List<DiningRecommendation> foods,
        List<String> hotels,
        List<String> knowledge,
        List<String> pois,
        List<String> flights,
        List<String> trains) {
    public TravelContext {
        weather = List.copyOf(weather);
        places = List.copyOf(places);
        routes = List.copyOf(routes);
        foods = List.copyOf(foods);
        hotels = List.copyOf(hotels);
        knowledge = List.copyOf(knowledge);
        pois = List.copyOf(pois);
        flights = List.copyOf(flights);
        trains = List.copyOf(trains);
    }
}
