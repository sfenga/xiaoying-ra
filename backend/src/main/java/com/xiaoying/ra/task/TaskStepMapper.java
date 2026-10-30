package com.xiaoying.ra.task;

import org.apache.ibatis.annotations.*;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface TaskStepMapper {

    @Insert("INSERT INTO t_task_step(task_id, step, status, message, started_at, finished_at) " +
            "VALUES(#{taskId}, #{step}, #{status}, #{message}, #{startedAt}, #{finishedAt})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(TaskStep step);

    @Select("SELECT * FROM t_task_step WHERE task_id = #{taskId} ORDER BY id ASC")
    List<TaskStep> findByTaskId(String taskId);

    @Select("SELECT * FROM t_task_step WHERE task_id = #{taskId} AND step = #{step}")
    TaskStep findByTaskIdAndStep(@Param("taskId") String taskId, @Param("step") TaskStage step);

    @Update("UPDATE t_task_step SET status = 'RUNNING', started_at = #{startedAt} WHERE id = #{id}")
    int markRunning(@Param("id") Long id, @Param("startedAt") LocalDateTime startedAt);

    @Update("UPDATE t_task_step SET status = 'SUCCESS', message = #{message}, finished_at = #{finishedAt} " +
            "WHERE id = #{id}")
    int markSuccess(@Param("id") Long id, @Param("message") String message, @Param("finishedAt") LocalDateTime finishedAt);

    @Update("UPDATE t_task_step SET status = 'FAILED', message = #{message}, finished_at = #{finishedAt} " +
            "WHERE id = #{id}")
    int markFailed(@Param("id") Long id, @Param("message") String message, @Param("finishedAt") LocalDateTime finishedAt);
}
