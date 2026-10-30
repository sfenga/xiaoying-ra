package com.xiaoying.ra.asset;

import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface AssetMapper {

    @Insert("INSERT INTO t_asset(user_id, template_id, original_name, mime_type, size_bytes, stored_path, task_id, created_at) " +
            "VALUES(#{userId}, #{templateId}, #{originalName}, #{mimeType}, #{sizeBytes}, #{storedPath}, #{taskId}, #{createdAt})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(Asset asset);

    @Select("SELECT * FROM t_asset WHERE id = #{id}")
    Asset findById(Long id);

    @Select("SELECT COUNT(*) FROM t_asset WHERE user_id = #{userId} AND template_id = #{templateId} AND task_id IS NULL")
    long countUnbound(Long userId, String templateId);

    @Select("<script>SELECT * FROM t_asset WHERE id IN " +
            "<foreach item='id' collection='ids' open='(' separator=',' close=')'>" +
            "#{id}</foreach></script>")
    List<Asset> findByIds(@Param("ids") List<Long> ids);

    @Select("SELECT * FROM t_asset WHERE task_id = #{taskId}")
    List<Asset> findByTaskId(String taskId);

    @Update("UPDATE t_asset SET task_id = #{taskId} WHERE id = #{assetId}")
    int bindTask(@Param("assetId") Long assetId, @Param("taskId") String taskId);

    @Delete("DELETE FROM t_asset WHERE id = #{id}")
    int deleteById(Long id);
}
