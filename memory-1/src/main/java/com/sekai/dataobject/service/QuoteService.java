package com.sekai.dataobject.service;

import com.sekai.dataobject.model.Quote;

import java.util.List;

public interface QuoteService {

    List<Quote> listAll();

    List<Quote> listBySeriesId(Long seriesId);

    List<Quote> listByCharacterId(Long characterId);

    List<Quote> listPage(String keyword, Long seriesId, Long characterId, int page, int pageSize);

    int count(String keyword, Long seriesId, Long characterId);

    int countWithAudio();

    Quote getById(Long id);

    boolean add(Quote quote);

    boolean update(Quote quote);

    boolean delete(Long id);
}
