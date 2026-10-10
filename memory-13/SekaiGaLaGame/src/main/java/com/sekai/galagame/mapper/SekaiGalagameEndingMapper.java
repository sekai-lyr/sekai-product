package com.sekai.galagame.mapper;

import com.sekai.galagame.dataobject.SekaiGalagameEndingDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiGalagameEndingMapper {
    List<SekaiGalagameEndingDO> selectAll();

    SekaiGalagameEndingDO selectByKey(@Param("endingKey") String endingKey);
}
