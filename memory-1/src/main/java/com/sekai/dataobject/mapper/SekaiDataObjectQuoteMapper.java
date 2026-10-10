package com.sekai.dataobject.mapper;

import com.sekai.dataobject.dataobject.SekaiDataObjectQuoteDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 台词表 Mapper
 */
@Mapper
public interface SekaiDataObjectQuoteMapper {

    int deleteByPrimaryKey(Long id);

    int insert(SekaiDataObjectQuoteDO record);

    int insertSelective(SekaiDataObjectQuoteDO record);

    SekaiDataObjectQuoteDO selectByPrimaryKey(Long id);

    List<SekaiDataObjectQuoteDO> selectAll();

    List<SekaiDataObjectQuoteDO> selectBySeriesId(@Param("seriesId") Long seriesId);

    List<SekaiDataObjectQuoteDO> selectByCharacterId(@Param("characterId") Long characterId);

    List<SekaiDataObjectQuoteDO> selectPage(@Param("keyword") String keyword,
                                            @Param("seriesId") Long seriesId,
                                            @Param("characterId") Long characterId,
                                            @Param("pageSize") int pageSize,
                                            @Param("offset") int offset);

    int count(@Param("keyword") String keyword,
              @Param("seriesId") Long seriesId,
              @Param("characterId") Long characterId);

    int countWithAudio();

    int updateByPrimaryKeySelective(SekaiDataObjectQuoteDO record);

    int updateByPrimaryKey(SekaiDataObjectQuoteDO record);
}
