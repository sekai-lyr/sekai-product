package com.sekai.animevideo.mapper;

import com.sekai.animevideo.dataobject.SekaiAnimeFavoriteDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface SekaiAnimeFavoriteMapper {
    int insert(SekaiAnimeFavoriteDO record);
    int deleteByUserAndSite(@Param("userId") Long userId, @Param("siteId") Long siteId);
    int countByUserId(@Param("userId") Long userId);
    boolean existsByUserAndSite(@Param("userId") Long userId, @Param("siteId") Long siteId);
    List<SekaiAnimeFavoriteDO> listByUserId(@Param("userId") Long userId);
}
