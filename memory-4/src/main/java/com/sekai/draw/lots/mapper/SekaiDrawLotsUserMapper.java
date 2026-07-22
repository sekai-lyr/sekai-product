package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsUserDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SekaiDrawLotsUserMapper {
    int insert(SekaiDrawLotsUserDO record);
    SekaiDrawLotsUserDO selectByPrimaryKey(Long id);
    SekaiDrawLotsUserDO selectByUserName(@Param("userName") String userName);
    SekaiDrawLotsUserDO selectByLoginName(@Param("loginName") String loginName);
    int updateByPrimaryKeySelective(SekaiDrawLotsUserDO record);
}
