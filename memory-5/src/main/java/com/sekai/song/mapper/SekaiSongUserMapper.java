package com.sekai.song.mapper;

import com.sekai.song.model.User;
import org.apache.ibatis.annotations.Param;

public interface SekaiSongUserMapper {
    int insert(User user);

    User findByUserName(@Param("userName") String userName);

    User findById(@Param("id") Long id);

    int updatePassword(@Param("id") Long id, @Param("password") String password);

}
