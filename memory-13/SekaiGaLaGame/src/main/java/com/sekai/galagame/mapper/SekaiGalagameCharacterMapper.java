package com.sekai.galagame.mapper;

import com.sekai.galagame.dataobject.SekaiGalagameCharacterDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface SekaiGalagameCharacterMapper {
    List<SekaiGalagameCharacterDO> selectAll();
}
