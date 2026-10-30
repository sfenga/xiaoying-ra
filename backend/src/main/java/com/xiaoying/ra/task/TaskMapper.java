package com.xiaoying.ra.task;

import org.apache.ibatis.annotations.*;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface TaskMapper {

    @Insert("INSERT INTO t_task(id, user_id, template_id, status, stage, fail_stage, failure_reason, result_url, " +
            "created_at, started_at, finished_at) " +
            "VALUES(#{id}, #{userId}, #{templateId}, #{status}, #{stage}, #{failStage}, #{failureReason}, " +
            "#{resultUrl}, #{createdAt}, #{startedAt}, #{finishedAt})")
    int insert(Task task);

    @Select("SELECT t.*, p.title AS template_title FROM t_task t " +
            "LEFT JOIN t_template p ON p.id = t.template_id WHERE t.id = #{id}")
    Task findById(String id);

    @Select("<script>SELECT t.*, p.title AS template_title FROM t_task t " +
            "LEFT JOIN t_template p ON p.id = t.template_id " +
            "WHERE t.user_id = #{userId} " +
            "<if test='templateId != null'>AND t.template_id = #{templateId}</if> " +
            "<if test='ids != null'>AND t.id IN " +
            "<foreach item='tid' collection='ids' open='(' separator=',' close=')'>#{tid}</foreach>" +
            "</if> " +
            "ORDER BY t.created_at DESC, t.id DESC</script>")
    List<Task> findByUser(@Param("userId") Long userId,
                          @Param("templateId") String templateId,
                          @Param("ids") List<String> ids);

    @Select("SELECT * FROM t_task WHERE status IN ('PENDING', 'PROCESSING')")
    List<Task> findActiveTasks();

    @Update("UPDATE t_task SET status = 'PROCESSING', stage = #{stage}, started_at = #{startedAt} " +
            "WHERE id = #{id} AND status = 'PENDING'")
    int markProcessing(@Param("id") String id, @Param("stage") TaskStage stage, @Param("startedAt") LocalDateTime startedAt);

    @Update("UPDATE t_task SET stage = #{stage} WHERE id = #{id}")
    int updateStage(@Param("id") String id, @Param("stage") TaskStage stage);

    @Update("UPDATE t_task SET status = 'SUCCESS', result_url = #{resultUrl}, finished_at = #{finishedAt} " +
            "WHERE id = #{id}")
    int markSuccess(@Param("id") String id, @Param("resultUrl") String resultUrl, @Param("finishedAt") LocalDateTime finishedAt);

    @Update("UPDATE t_task SET status = 'FAILED', stage = #{stage}, failure_reason = #{failureReason}, " +
            "finished_at = #{finishedAt} WHERE id = #{id}")
    int markFailed(@Param("id") String id, @Param("stage") TaskStage stage,
                   @Param("failureReason") String failureReason, @Param("finishedAt") LocalDateTime finishedAt);
}
