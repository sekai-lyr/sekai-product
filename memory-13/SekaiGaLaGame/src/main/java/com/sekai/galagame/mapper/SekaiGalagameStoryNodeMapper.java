package com.sekai.galagame.mapper;

import com.sekai.galagame.dataobject.SekaiGalagameStoryNodeDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SekaiGalagameStoryNodeMapper {
    SekaiGalagameStoryNodeDO selectByNodeKey(@Param("nodeKey") String nodeKey);

    SekaiGalagameStoryNodeDO selectFirstOfLabel(@Param("labelName") String labelName);

    int countByLabel(@Param("labelName") String labelName);
}
