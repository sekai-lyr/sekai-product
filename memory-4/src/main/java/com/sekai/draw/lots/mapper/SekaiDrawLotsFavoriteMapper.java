package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsCharacterDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiDrawLotsFavoriteMapper {
    int insert(@Param("userId") Long userId, @Param("characterId") Long characterId, @Param("note") String note);
    int delete(@Param("userId") Long userId, @Param("characterId") Long characterId);
    int exists(@Param("userId") Long userId, @Param("characterId") Long characterId);
    int countByUserId(@Param("userId") Long userId);
    List<SekaiDrawLotsCharacterDO> listByUserId(@Param("userId") Long userId);
}
