package com.sekai.dataobject.service;

import com.sekai.dataobject.model.Series;

import java.util.List;

public interface SeriesService {

    List<Series> listAll();

    List<Series> listPage(String keyword, int page, int pageSize);

    int count(String keyword);

    Series getById(Long id);

    boolean add(Series series);

    boolean update(Series series);

    boolean delete(Long id);
}
