package com.sekai.dataobject.service.impl;

import com.sekai.dataobject.dataobject.SekaiDataObjectSeriesDO;
import com.sekai.dataobject.mapper.SekaiDataObjectSeriesMapper;
import com.sekai.dataobject.model.Series;
import com.sekai.dataobject.service.SeriesService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class SeriesServiceImpl implements SeriesService {

    @Resource
    private SekaiDataObjectSeriesMapper seriesMapper;

    @Override
    public List<Series> listAll() {
        return seriesMapper.selectAll().stream().map(SekaiDataObjectSeriesDO::convertToSeries).toList();
    }

    @Override
    public List<Series> listPage(String keyword, int page, int pageSize) {
        int offset = Math.max((page - 1) * pageSize, 0);
        return seriesMapper.selectPage(keyword, pageSize, offset).stream()
                .map(SekaiDataObjectSeriesDO::convertToSeries)
                .toList();
    }

    @Override
    public int count(String keyword) {
        return seriesMapper.count(keyword);
    }

    @Override
    public Series getById(Long id) {
        if (id == null) {
            return null;
        }
        SekaiDataObjectSeriesDO seriesDO = seriesMapper.selectByPrimaryKey(id);
        return seriesDO == null ? null : seriesDO.convertToSeries();
    }

    @Override
    @Transactional
    public boolean add(Series series) {
        if (series == null || series.getTitle() == null || series.getTitle().trim().isEmpty()) {
            return false;
        }
        series.setTitle(series.getTitle().trim());
        SekaiDataObjectSeriesDO seriesDO = new SekaiDataObjectSeriesDO(series);
        seriesDO.setCreateTime(LocalDateTime.now());
        seriesDO.setUpdateTime(LocalDateTime.now());
        return seriesMapper.insert(seriesDO) > 0;
    }

    @Override
    @Transactional
    public boolean update(Series series) {
        if (series == null || series.getId() == null) {
            return false;
        }
        if (series.getTitle() == null || series.getTitle().trim().isEmpty()) {
            return false;
        }
        SekaiDataObjectSeriesDO seriesDO = new SekaiDataObjectSeriesDO(series);
        seriesDO.setUpdateTime(LocalDateTime.now());
        return seriesMapper.updateByPrimaryKeySelective(seriesDO) > 0;
    }

    @Override
    @Transactional
    public boolean delete(Long id) {
        if (id == null) {
            return false;
        }
        return seriesMapper.deleteByPrimaryKey(id) > 0;
    }
}
