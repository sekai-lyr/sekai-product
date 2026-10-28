package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsWheelOptionDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiDrawLotsWheelOptionMapper {
    int insert(SekaiDrawLotsWheelOptionDO record);
    SekaiDrawLotsWheelOptionDO selectByIdForUser(@Param("id") Long id, @Param("userId") Long userId);
    List<SekaiDrawLotsWheelOptionDO> selectByUserId(@Param("userId") Long userId, @Param("deckId") Long deckId);
    List<SekaiDrawLotsWheelOptionDO> selectEnabledByUserId(@Param("userId") Long userId, @Param("deckId") Long deckId);
    int deleteForUser(@Param("id") Long id, @Param("userId") Long userId);
    int updateForUser(SekaiDrawLotsWheelOptionDO option);
}
