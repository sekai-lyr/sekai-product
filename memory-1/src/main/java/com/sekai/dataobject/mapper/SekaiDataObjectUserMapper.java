package com.sekai.dataobject.mapper;

import com.sekai.dataobject.dataobject.SekaiDataObjectUserDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 用户表 Mapper
 */
@Mapper
public interface SekaiDataObjectUserMapper {

    int deleteByPrimaryKey(Long id);

    int insert(SekaiDataObjectUserDO record);

    int insertSelective(SekaiDataObjectUserDO record);

    SekaiDataObjectUserDO selectByPrimaryKey(Long id);

    SekaiDataObjectUserDO selectByUserName(@Param("userName") String userName);

    SekaiDataObjectUserDO selectByLoginName(@Param("loginName") String loginName);

    int updateByPrimaryKeySelective(SekaiDataObjectUserDO record);

    int updateByPrimaryKey(SekaiDataObjectUserDO record);
}
