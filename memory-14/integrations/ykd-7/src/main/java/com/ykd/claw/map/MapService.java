package com.ykd.claw.map;


import java.io.IOException;
import java.util.List;

public interface MapService {
    List<PlaceResult> searchPlace(String keyword, String city) throws IOException, InterruptedException;

    /**
     * 按用户位置（经纬度或地名）搜索地点，并按到用户位置的距离由近到远排序。
     * location 为空时行为等同于 searchPlace(keyword, city)。
     */
    List<PlaceResult> searchPlace(String keyword, String city, String location)
            throws IOException, InterruptedException;

    RouteResult getRoute(String origin, String destination) throws IOException, InterruptedException;

    List<GeocodeResult> geocode(String address) throws IOException, InterruptedException;
}
