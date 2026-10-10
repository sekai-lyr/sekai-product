package com.sekai.dataobject.service;

import com.sekai.dataobject.model.CharacterInfo;

import java.util.List;

public interface CharacterService {

    List<CharacterInfo> listAll();

    List<CharacterInfo> listBySeriesId(Long seriesId);

    List<CharacterInfo> listPage(String keyword, Long seriesId, int page, int pageSize);

    int count(String keyword, Long seriesId);

    CharacterInfo getById(Long id);

    boolean add(CharacterInfo characterInfo);

    boolean update(CharacterInfo characterInfo);

    boolean delete(Long id);
}
