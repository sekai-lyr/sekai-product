package com.sekai.animevideo.mapper;

import com.sekai.animevideo.dataobject.SekaiAnimeSiteDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface SekaiAnimeSiteMapper {
    int insert(SekaiAnimeSiteDO record);
    SekaiAnimeSiteDO selectByPrimaryKey(Long id);
    List<SekaiAnimeSiteDO> listByUserId(@Param("userId") Long userId, @Param("categoryId") Long categoryId,
                                         @Param("keyword") String keyword, @Param("offset") int offset, @Param("limit") int limit);
    int countByUserId(@Param("userId") Long userId, @Param("categoryId") Long categoryId, @Param("keyword") String keyword);
    int incrementClickCount(@Param("id") Long id);
    List<SekaiAnimeSiteDO> listHotByUserId(@Param("userId") Long userId, @Param("limit") int limit);
    int countTotalClicksByUserId(@Param("userId") Long userId);
    int deleteByPrimaryKey(@Param("id") Long id);
    int updateByPrimaryKeySelective(SekaiAnimeSiteDO record);
}
