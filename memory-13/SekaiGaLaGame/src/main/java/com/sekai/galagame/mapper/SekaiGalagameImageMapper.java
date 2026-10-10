package com.sekai.galagame.mapper;

import com.sekai.galagame.dataobject.SekaiGalagameImageDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiGalagameImageMapper {
    List<SekaiGalagameImageDO> selectAll();

    SekaiGalagameImageDO selectByKey(@Param("imageKey") String imageKey);

    List<SekaiGalagameImageDO> selectByType(@Param("imageType") String imageType);
}
