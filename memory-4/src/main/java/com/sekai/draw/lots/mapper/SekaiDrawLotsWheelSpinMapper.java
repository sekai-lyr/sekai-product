package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsWheelSpinDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiDrawLotsWheelSpinMapper {
    int insert(SekaiDrawLotsWheelSpinDO record);
    SekaiDrawLotsWheelSpinDO selectByPrimaryKey(Long id);
    List<SekaiDrawLotsWheelSpinDO> selectRecentByUserId(@Param("userId") Long userId, @Param("deckId") Long deckId, @Param("limit") int limit);
}
