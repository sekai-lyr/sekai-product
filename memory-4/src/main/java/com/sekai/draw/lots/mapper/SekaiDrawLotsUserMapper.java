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
    SekaiDrawLotsUserDO lockById(@Param("id") Long id);
    int setRecovery(@Param("id") Long id, @Param("hash") String hash);
    int exchangeRecovery(@Param("name") String name, @Param("recovery") String recovery, @Param("token") String token);
    SekaiDrawLotsUserDO lockByResetToken(@Param("token") String token);
    int resetPassword(@Param("id") Long id, @Param("password") String password);
}
