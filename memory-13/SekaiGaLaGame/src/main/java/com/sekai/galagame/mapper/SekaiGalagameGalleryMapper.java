package com.sekai.galagame.mapper;

import com.sekai.galagame.dataobject.SekaiGalagameGalleryDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiGalagameGalleryMapper {
    int insertIgnore(SekaiGalagameGalleryDO record);

    List<SekaiGalagameGalleryDO> selectByUserId(@Param("userId") Long userId);
}
