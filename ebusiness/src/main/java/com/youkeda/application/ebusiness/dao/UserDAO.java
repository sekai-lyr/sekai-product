package com.youkeda.application.ebusiness.dao;

import com.youkeda.application.ebusiness.dataobject.UserDO;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper // 必须加！告诉Spring这是MyBatis Mapper接口
public interface UserDAO {
    // 你的所有方法
    int add(UserDO userDO);
    int batchAdd(List<UserDO> userDOList);
    int update(UserDO userDO);
    int delete(Long id);
    UserDO findByUserName(String userName);
    List<UserDO> findByIds(List<Long> ids);
}

