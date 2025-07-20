-- 1) 데이터베이스 생성 및 선택
CREATE DATABASE IF NOT EXISTS coconut_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE coconut_db;

-- 2) rooms 테이블
CREATE TABLE IF NOT EXISTS rooms (
  room_id         INT AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  max_participants INT NOT NULL,
  invite_code     VARCHAR(255) NOT NULL UNIQUE,
  status          ENUM('WAITING','IN_PROGRESS','FINISHED') NOT NULL DEFAULT 'WAITING',
  creator_id      INT NOT NULL UNIQUE,   -- 인당 방 하나만 생성 가능
  participants    JSON,
  problems        JSON,
  end_time        VARCHAR(8),            -- 수업 종료 시 타이머 시간 (HH:MM:SS 형식)
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3) users 테이블
CREATE TABLE IF NOT EXISTS users (
  user_id        INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password       VARCHAR(255) NOT NULL,
  refresh_token  VARCHAR(255),
  room_id        INT,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    ON DELETE SET NULL
);

-- 4) problems 테이블 (BIGINT 유지)
CREATE TABLE IF NOT EXISTS problems (
  problem_id            BIGINT AUTO_INCREMENT PRIMARY KEY,  -- 문제 고유 ID
  title                 VARCHAR(255) NOT NULL,              -- 문제 제목
  creator_id            INT  NULL,                       -- 등록자(user.user_id) not null로 변경 해야함
  execution_time_limit_ms INT     NOT NULL,                  -- 실행 제한(ms)
  memory_limit_kb        INT     NOT NULL,                  -- 메모리 제한(KB)
  description            TEXT    NOT NULL,                  -- 문제 설명
  solve_time_limit_min   INT,                               -- 풀이 제한(분)
  example_tc             JSON,
  source                 ENUM('My','BOJ','CSES') NOT NULL DEFAULT 'My',  -- 출처(My vs BOJ vs CSES)
  categories             JSON NOT NULL,  -- 카테고리 배열
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_problems_creator
    FOREIGN KEY (creator_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

-- 5) testcases 테이블 (BIGINT로 수정)
CREATE TABLE IF NOT EXISTS testcases (
  testcase_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
  problem_id    BIGINT NOT NULL,
  input_tc      VARCHAR(255) NOT NULL, -- S3에 저장된 Input 파일의 Key
  output_tc     VARCHAR(255) NOT NULL, -- S3에 저장된 Output 파일의 Key
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_testcases_problem
    FOREIGN KEY (problem_id) REFERENCES problems(problem_id)
    ON DELETE CASCADE
);

-- 6) submissions 테이블 (BIGINT로 수정)
CREATE TABLE IF NOT EXISTS submissions (
  submission_id     INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  room_id           INT NOT NULL,
  problem_id        BIGINT NOT NULL,
  code              TEXT NOT NULL,
  language          VARCHAR(50) NOT NULL DEFAULT 'python',
  status            ENUM('PENDING','RUNNING','SUCCESS','FAIL') NOT NULL DEFAULT 'PENDING',
  is_passed         BOOLEAN NOT NULL,
  passed_tc_count   INT,
  total_tc_count    INT,
  execution_time_ms INT NOT NULL,
  memory_usage_kb   INT NOT NULL,
  stdout            TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_submissions_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_problem
    FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE CASCADE
);

-- 7) room_problems 조인 테이블 (BIGINT로 수정)
CREATE TABLE IF NOT EXISTS room_problems (
  room_id      INT NOT NULL,
  problem_id   BIGINT NOT NULL,
  PRIMARY KEY (room_id, problem_id),
  CONSTRAINT fk_rp_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_problem
    FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE CASCADE
);

-- 8) saved_reports 테이블
CREATE TABLE IF NOT EXISTS saved_reports (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  room_title   VARCHAR(255) NOT NULL,
  report_data  JSON NOT NULL,
  saved_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_saved_reports_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);

