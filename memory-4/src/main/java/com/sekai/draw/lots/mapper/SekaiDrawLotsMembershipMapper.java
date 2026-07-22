package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsMembershipDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SekaiDrawLotsMembershipMapper {
    SekaiDrawLotsMembershipDO selectByUserId(@Param("userId") Long userId);
    SekaiDrawLotsMembershipDO selectActiveByUserId(@Param("userId") Long userId);
    int upsert(SekaiDrawLotsMembershipDO record);
}
