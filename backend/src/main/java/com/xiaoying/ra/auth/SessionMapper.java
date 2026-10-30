package com.xiaoying.ra.auth;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SessionMapper {

    @Insert("INSERT INTO t_session(token, user_id, created_at, expires_at) " +
            "VALUES(#{token}, #{userId}, #{createdAt}, #{expiresAt})")
    int insert(Session session);

    @Select("SELECT * FROM t_session WHERE token = #{token}")
    Session findByToken(String token);

    @Delete("DELETE FROM t_session WHERE token = #{token}")
    int deleteByToken(String token);
}
