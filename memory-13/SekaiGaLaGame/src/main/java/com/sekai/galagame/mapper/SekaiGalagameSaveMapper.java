package com.sekai.galagame.mapper;

import com.sekai.galagame.dataobject.SekaiGalagameSaveDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiGalagameSaveMapper {
    int insert(SekaiGalagameSaveDO record);

    int updateBySlot(SekaiGalagameSaveDO record);

    List<SekaiGalagameSaveDO> selectByUserId(@Param("userId") Long userId);

    SekaiGalagameSaveDO selectByUserAndSlot(@Param("userId") Long userId, @Param("slotNo") Integer slotNo);

    int deleteByUserAndSlot(@Param("userId") Long userId, @Param("slotNo") Integer slotNo);
}
