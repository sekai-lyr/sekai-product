package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsCharacterDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiDrawLotsCharacterMapper {
    int countAll();
    SekaiDrawLotsCharacterDO selectByPrimaryKey(@Param("id") Long id);
    SekaiDrawLotsCharacterDO selectRandom();
    SekaiDrawLotsCharacterDO selectRandomByFocus(@Param("focus") String focus);
    List<SekaiDrawLotsCharacterDO> selectTop(@Param("limit") int limit);
    List<SekaiDrawLotsCharacterDO> search(@Param("keyword") String keyword, @Param("limit") int limit);
    List<SekaiDrawLotsCharacterDO> selectRelated(@Param("baseId") Long baseId,
                                                 @Param("userId") Long userId,
                                                 @Param("limit") int limit);
}
