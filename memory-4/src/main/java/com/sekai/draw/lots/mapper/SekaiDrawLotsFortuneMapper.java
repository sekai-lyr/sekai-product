package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsFortuneDO;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SekaiDrawLotsFortuneMapper {
    SekaiDrawLotsFortuneDO selectRandom();
}
