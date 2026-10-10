package com.sekai.galagame.mapper;

import com.sekai.galagame.dataobject.SekaiGalagameEndingRecordDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiGalagameEndingRecordMapper {
    int insertIgnore(SekaiGalagameEndingRecordDO record);

    List<SekaiGalagameEndingRecordDO> selectByUserId(@Param("userId") Long userId);
}
