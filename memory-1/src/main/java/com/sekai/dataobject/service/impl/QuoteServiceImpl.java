package com.sekai.dataobject.service.impl;

import com.sekai.dataobject.dataobject.SekaiDataObjectQuoteDO;
import com.sekai.dataobject.mapper.SekaiDataObjectQuoteMapper;
import com.sekai.dataobject.model.Quote;
import com.sekai.dataobject.service.QuoteService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class QuoteServiceImpl implements QuoteService {

    @Resource
    private SekaiDataObjectQuoteMapper quoteMapper;

    @Override
    public List<Quote> listAll() {
        return quoteMapper.selectAll().stream().map(SekaiDataObjectQuoteDO::convertToQuote).toList();
    }

    @Override
    public List<Quote> listBySeriesId(Long seriesId) {
        if (seriesId == null) {
            return List.of();
        }
        return quoteMapper.selectBySeriesId(seriesId).stream()
                .map(SekaiDataObjectQuoteDO::convertToQuote)
                .toList();
    }

    @Override
    public List<Quote> listByCharacterId(Long characterId) {
        if (characterId == null) {
            return List.of();
        }
        return quoteMapper.selectByCharacterId(characterId).stream()
                .map(SekaiDataObjectQuoteDO::convertToQuote)
                .toList();
    }

    @Override
    public List<Quote> listPage(String keyword, Long seriesId, Long characterId, int page, int pageSize) {
        int offset = Math.max((page - 1) * pageSize, 0);
        return quoteMapper.selectPage(keyword, seriesId, characterId, pageSize, offset).stream()
                .map(SekaiDataObjectQuoteDO::convertToQuote)
                .toList();
    }

    @Override
    public int count(String keyword, Long seriesId, Long characterId) {
        return quoteMapper.count(keyword, seriesId, characterId);
    }

    @Override
    public int countWithAudio() {
        return quoteMapper.countWithAudio();
    }

    @Override
    public Quote getById(Long id) {
        if (id == null) {
            return null;
        }
        SekaiDataObjectQuoteDO quoteDO = quoteMapper.selectByPrimaryKey(id);
        return quoteDO == null ? null : quoteDO.convertToQuote();
    }

    @Override
    @Transactional
    public boolean add(Quote quote) {
        if (quote == null || quote.getContent() == null || quote.getContent().trim().isEmpty()) {
            return false;
        }
        quote.setContent(quote.getContent().trim());
        SekaiDataObjectQuoteDO quoteDO = new SekaiDataObjectQuoteDO(quote);
        quoteDO.setCreateTime(LocalDateTime.now());
        return quoteMapper.insert(quoteDO) > 0;
    }

    @Override
    @Transactional
    public boolean update(Quote quote) {
        if (quote == null || quote.getId() == null) {
            return false;
        }
        if (quote.getContent() == null || quote.getContent().trim().isEmpty()) {
            return false;
        }
        SekaiDataObjectQuoteDO quoteDO = new SekaiDataObjectQuoteDO(quote);
        return quoteMapper.updateByPrimaryKeySelective(quoteDO) > 0;
    }

    @Override
    @Transactional
    public boolean delete(Long id) {
        if (id == null) {
            return false;
        }
        return quoteMapper.deleteByPrimaryKey(id) > 0;
    }
}
