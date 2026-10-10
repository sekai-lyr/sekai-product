package com.sekai.galagame.mapper;

import com.sekai.galagame.dataobject.SekaiGalagameChoiceDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiGalagameChoiceMapper {
    List<SekaiGalagameChoiceDO> selectByNodeKey(@Param("nodeKey") String nodeKey);
}
