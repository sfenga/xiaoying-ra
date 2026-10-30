package com.xiaoying.ra.template;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TemplateMapper {

    @Select("SELECT * FROM t_template ORDER BY sort_order ASC, id ASC")
    List<Template> findAll();

    @Select("SELECT * FROM t_template WHERE id = #{id}")
    Template findById(String id);

    @Select("SELECT COUNT(*) FROM t_template")
    long count();

    @Insert("INSERT INTO t_template(id, title, category, description, cover_url, required_image_count, " +
            "accepted_mime_types, max_file_size_bytes, result_urls, sort_order) " +
            "VALUES(#{id}, #{title}, #{category}, #{description}, #{coverUrl}, #{requiredImageCount}, " +
            "#{acceptedMimeTypes}, #{maxFileSizeBytes}, #{resultUrls}, #{sortOrder})")
    int insert(Template template);
}
