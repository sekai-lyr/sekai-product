package com.sekai.galagame.mapper;

import com.sekai.galagame.dataobject.SekaiGalagameUserDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SekaiGalagameUserMapper {
    int insert(SekaiGalagameUserDO record);

    SekaiGalagameUserDO selectByPrimaryKey(Long id);

    SekaiGalagameUserDO selectByUsername(@Param("username") String username);

    int updateByPrimaryKeySelective(SekaiGalagameUserDO record);
}
