package com.xiaoying.ra.auth;

import org.apache.ibatis.annotations.*;

@Mapper
public interface UserMapper {

    @Insert("INSERT INTO t_user(username, password_hash, display_name, is_guest, created_at) " +
            "VALUES(#{username}, #{passwordHash}, #{displayName}, #{isGuest}, #{createdAt})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(User user);

    @Select("SELECT * FROM t_user WHERE username = #{username}")
    User findByUsername(String username);

    @Select("SELECT * FROM t_user WHERE id = #{id}")
    User findById(Long id);
}
