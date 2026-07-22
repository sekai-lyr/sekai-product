package com.sekai.animevideo.mapper;

import com.sekai.animevideo.dataobject.SekaiAnimeCategoryDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface SekaiAnimeCategoryMapper {
    int insert(SekaiAnimeCategoryDO record);
    SekaiAnimeCategoryDO selectByPrimaryKey(Long id);
    List<SekaiAnimeCategoryDO> listByUserId(@Param("userId") Long userId);
    int countByUserId(@Param("userId") Long userId);
}
