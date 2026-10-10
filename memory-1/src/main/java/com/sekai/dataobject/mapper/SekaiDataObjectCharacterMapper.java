package com.sekai.dataobject.mapper;

import com.sekai.dataobject.dataobject.SekaiDataObjectCharacterDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 人物表 Mapper
 */
@Mapper
public interface SekaiDataObjectCharacterMapper {

    int deleteByPrimaryKey(Long id);

    int insert(SekaiDataObjectCharacterDO record);

    int insertSelective(SekaiDataObjectCharacterDO record);

    SekaiDataObjectCharacterDO selectByPrimaryKey(Long id);

    List<SekaiDataObjectCharacterDO> selectAll();

    List<SekaiDataObjectCharacterDO> selectBySeriesId(@Param("seriesId") Long seriesId);

    List<SekaiDataObjectCharacterDO> selectPage(@Param("keyword") String keyword,
                                                @Param("seriesId") Long seriesId,
                                                @Param("pageSize") int pageSize,
                                                @Param("offset") int offset);

    int count(@Param("keyword") String keyword,
              @Param("seriesId") Long seriesId);

    int updateByPrimaryKeySelective(SekaiDataObjectCharacterDO record);

    int updateByPrimaryKey(SekaiDataObjectCharacterDO record);
}
