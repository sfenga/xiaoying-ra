-- 素材制作网站数据库结构（MySQL 8 / 测试环境 H2 MySQL 模式均兼容）
-- 全部使用 IF NOT EXISTS，可重复执行。

CREATE TABLE IF NOT EXISTS t_user (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    display_name  VARCHAR(64)  NOT NULL,
    is_guest      TINYINT      NOT NULL DEFAULT 0,
    created_at    DATETIME     NOT NULL
);

CREATE TABLE IF NOT EXISTS t_session (
    token      VARCHAR(64) PRIMARY KEY,
    user_id    BIGINT      NOT NULL,
    created_at DATETIME    NOT NULL,
    expires_at DATETIME    NOT NULL
);

CREATE TABLE IF NOT EXISTS t_template (
    id                   VARCHAR(64)   PRIMARY KEY,
    title                VARCHAR(128)  NOT NULL,
    category             VARCHAR(64)   NOT NULL,
    description          VARCHAR(512)  NOT NULL,
    cover_url            VARCHAR(256)  NOT NULL,
    required_image_count INT           NOT NULL,
    accepted_mime_types  VARCHAR(256)  NOT NULL,
    max_file_size_bytes  BIGINT        NOT NULL,
    result_urls          VARCHAR(1024) NOT NULL,
    sort_order           INT           NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS t_asset (
    id            BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT       NOT NULL,
    template_id   VARCHAR(64)  NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    stored_path   VARCHAR(255) NOT NULL,
    task_id       VARCHAR(64)  NULL,
    created_at    DATETIME     NOT NULL
);

CREATE TABLE IF NOT EXISTS t_task (
    id             VARCHAR(64)  PRIMARY KEY,
    user_id        BIGINT       NOT NULL,
    template_id    VARCHAR(64)  NOT NULL,
    status         VARCHAR(16)  NOT NULL,
    stage          VARCHAR(16)  NULL,
    fail_stage     VARCHAR(16)  NULL,
    failure_reason VARCHAR(512) NULL,
    result_url     VARCHAR(256) NULL,
    created_at     DATETIME     NOT NULL,
    started_at     DATETIME     NULL,
    finished_at    DATETIME     NULL
);

CREATE TABLE IF NOT EXISTS t_task_step (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
    task_id     VARCHAR(64)  NOT NULL,
    step        VARCHAR(16)  NOT NULL,
    status      VARCHAR(16)  NOT NULL,
    message     VARCHAR(512) NULL,
    started_at  DATETIME     NULL,
    finished_at DATETIME     NULL
);
