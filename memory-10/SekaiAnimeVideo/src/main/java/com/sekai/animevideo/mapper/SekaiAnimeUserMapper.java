package com.sekai.animevideo.mapper;

import com.sekai.animevideo.dataobject.SekaiAnimeUserDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SekaiAnimeUserMapper {
    int insert(SekaiAnimeUserDO record);
    SekaiAnimeUserDO selectByPrimaryKey(Long id);
    SekaiAnimeUserDO selectByUserName(@Param("userName") String userName);
    SekaiAnimeUserDO selectByLoginName(@Param("loginName") String loginName);
    int updateByPrimaryKeySelective(SekaiAnimeUserDO record);
}
