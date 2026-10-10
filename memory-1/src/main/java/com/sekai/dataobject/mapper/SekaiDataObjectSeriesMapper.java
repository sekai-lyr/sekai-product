package com.sekai.dataobject.mapper;

import com.sekai.dataobject.dataobject.SekaiDataObjectSeriesDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 番剧表 Mapper
 */
@Mapper
public interface SekaiDataObjectSeriesMapper {

    int deleteByPrimaryKey(Long id);

    int insert(SekaiDataObjectSeriesDO record);

    int insertSelective(SekaiDataObjectSeriesDO record);

    SekaiDataObjectSeriesDO selectByPrimaryKey(Long id);

    List<SekaiDataObjectSeriesDO> selectAll();

    List<SekaiDataObjectSeriesDO> selectPage(@Param("keyword") String keyword,
                                             @Param("pageSize") int pageSize,
                                             @Param("offset") int offset);

    int count(@Param("keyword") String keyword);

    int updateByPrimaryKeySelective(SekaiDataObjectSeriesDO record);

    int updateByPrimaryKey(SekaiDataObjectSeriesDO record);
}
