package com.sekai.dataobject.service.impl;

import com.sekai.dataobject.dataobject.SekaiDataObjectCharacterDO;
import com.sekai.dataobject.mapper.SekaiDataObjectCharacterMapper;
import com.sekai.dataobject.model.CharacterInfo;
import com.sekai.dataobject.service.CharacterService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class CharacterServiceImpl implements CharacterService {

    @Resource
    private SekaiDataObjectCharacterMapper characterMapper;

    @Override
    public List<CharacterInfo> listAll() {
        return characterMapper.selectAll().stream().map(SekaiDataObjectCharacterDO::convertToCharacterInfo).toList();
    }

    @Override
    public List<CharacterInfo> listBySeriesId(Long seriesId) {
        if (seriesId == null) {
            return List.of();
        }
        return characterMapper.selectBySeriesId(seriesId).stream()
                .map(SekaiDataObjectCharacterDO::convertToCharacterInfo)
                .toList();
    }

    @Override
    public List<CharacterInfo> listPage(String keyword, Long seriesId, int page, int pageSize) {
        int offset = Math.max((page - 1) * pageSize, 0);
        return characterMapper.selectPage(keyword, seriesId, pageSize, offset).stream()
                .map(SekaiDataObjectCharacterDO::convertToCharacterInfo)
                .toList();
    }

    @Override
    public int count(String keyword, Long seriesId) {
        return characterMapper.count(keyword, seriesId);
    }

    @Override
    public CharacterInfo getById(Long id) {
        if (id == null) {
            return null;
        }
        SekaiDataObjectCharacterDO characterDO = characterMapper.selectByPrimaryKey(id);
        return characterDO == null ? null : characterDO.convertToCharacterInfo();
    }

    @Override
    @Transactional
    public boolean add(CharacterInfo characterInfo) {
        if (characterInfo == null || characterInfo.getName() == null || characterInfo.getName().trim().isEmpty()) {
            return false;
        }
        characterInfo.setName(characterInfo.getName().trim());
        SekaiDataObjectCharacterDO characterDO = new SekaiDataObjectCharacterDO(characterInfo);
        characterDO.setCreateTime(LocalDateTime.now());
        return characterMapper.insert(characterDO) > 0;
    }

    @Override
    @Transactional
    public boolean update(CharacterInfo characterInfo) {
        if (characterInfo == null || characterInfo.getId() == null) {
            return false;
        }
        if (characterInfo.getName() == null || characterInfo.getName().trim().isEmpty()) {
            return false;
        }
        SekaiDataObjectCharacterDO characterDO = new SekaiDataObjectCharacterDO(characterInfo);
        return characterMapper.updateByPrimaryKeySelective(characterDO) > 0;
    }

    @Override
    @Transactional
    public boolean delete(Long id) {
        if (id == null) {
            return false;
        }
        return characterMapper.deleteByPrimaryKey(id) > 0;
    }
}
