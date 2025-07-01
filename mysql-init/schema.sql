-- 1) 데이터베이스 생성 및 선택
CREATE DATABASE IF NOT EXISTS coconut_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE coconut_db;

-- 2) rooms 테이블
-- CREATE TABLE IF NOT EXISTS rooms (
--   room_id      BIGINT AUTO_INCREMENT PRIMARY KEY,      -- 방 고유 ID
--   host_id      BIGINT NOT NULL,                        -- 세션 생성자(user.user_id)
--   title        VARCHAR(255) NOT NULL,                  -- 세션 제목
--   invite_code  CHAR(10)     NOT NULL UNIQUE,           -- 초대 코드
--   status       ENUM('WAITING','IN_PROGRESS','FINISHED')
--                  NOT NULL DEFAULT 'WAITING',           -- 세션 상태
--   created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
--                  ON UPDATE CURRENT_TIMESTAMP
-- );

CREATE TABLE IF NOT EXISTS rooms (
  room_id        INT AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  max_participants INT NOT NULL,
  invite_code     VARCHAR(255) NOT NULL UNIQUE,
  status          ENUM('WAITING','IN_PROGRESS','FINISHED') NOT NULL DEFAULT 'WAITING',
  creator_id      INT NOT NULL UNIQUE,   -- 인당 방 하나만 생성 가능
  participants    JSON,
  problems        JSON,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3) users 테이블
CREATE TABLE IF NOT EXISTS users (
  user_id        INT AUTO_INCREMENT PRIMARY KEY,    -- 사용자 고유 ID
  name           VARCHAR(255) NOT NULL,                -- 사용자 이름
  email          VARCHAR(255) NOT NULL UNIQUE,         -- 로그인용 이메일
  password       VARCHAR(255) NOT NULL,                -- 해시된 비밀번호
  refresh_token  VARCHAR(255),                         -- 리프레시 토큰
  room_id        INT,                                  -- 현재 세션(room) ID
  created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    ON DELETE SET NULL
);

-- 4) problems 테이블
CREATE TABLE IF NOT EXISTS problems (
  problem_id            BIGINT AUTO_INCREMENT PRIMARY KEY,  -- 문제 고유 ID
  title                 VARCHAR(255) NOT NULL,              -- 문제 제목
  creator_id            BIGINT  NULL,                       -- 등록자(user.user_id) not null로 변경 해야함
  execution_time_limit_ms INT     NOT NULL,                  -- 실행 제한(ms)
  memory_limit_kb        INT     NOT NULL,                  -- 메모리 제한(KB)
  description            TEXT    NOT NULL,                  -- 문제 설명
  solve_time_limit_min   INT,                               -- 풀이 제한(분)
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_problems_creator
    FOREIGN KEY (creator_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

-- 5) testcases 테이블
CREATE TABLE IF NOT EXISTS testcases (
  testcase_id  BIGINT AUTO_INCREMENT PRIMARY KEY,       -- 테스트케이스 고유 ID
  problem_id   BIGINT NOT NULL,                         -- 소속 문제(problems.problem_id)
  input_tc     VARCHAR(255) NOT NULL,                   -- 입력 파일 키
  output_tc    VARCHAR(255) NOT NULL,                   -- 출력 파일 키
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_testcases_problem
    FOREIGN KEY (problem_id) REFERENCES problems(problem_id)
    ON DELETE CASCADE
);

-- 6) submissions 테이블
CREATE TABLE IF NOT EXISTS submissions (
  submission_id    INT AUTO_INCREMENT PRIMARY KEY,      -- 제출 고유 ID
  user_id          INT NOT NULL,                        -- 제출자(user.user_id)
  room_id          INT NOT NULL,                        -- 소속 세션(rooms.room_id)
  problem_id       INT NOT NULL,                        -- 대상 문제(problems.problem_id)
  code             TEXT    NOT NULL,                    -- 제출된 코드
  language         VARCHAR(50) NOT NULL DEFAULT 'python',  -- 사용 언어
  status           ENUM('PENDING','RUNNING','SUCCESS','FAIL')
                     NOT NULL DEFAULT 'PENDING',          -- 채점 상태
  is_passed        BOOLEAN NOT NULL,                       -- 전체 TC 통과 여부
  passed_tc_count  INT,                                    -- 통과한 TC 수
  total_tc_count   INT,                                    -- 전체 TC 수
  execution_time_ms INT     NOT NULL,                      -- 실행 시간(ms)
  memory_usage_kb   INT     NOT NULL,                      -- 메모리 사용(KB)
  stdout           TEXT,                                   -- 표준 출력
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                     ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_submissions_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_submissions_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_submissions_problem
    FOREIGN KEY (problem_id) REFERENCES problems(problem_id)
    ON DELETE CASCADE
);

-- 7) room_problems 조인 테이블
CREATE TABLE IF NOT EXISTS room_problems (
  room_id      INT NOT NULL,                           -- FK: rooms.room_id
  problem_id   INT NOT NULL,                           -- FK: problems.problem_id
  PRIMARY KEY (room_id, problem_id),
  CONSTRAINT fk_rp_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_rp_problem
    FOREIGN KEY (problem_id) REFERENCES problems(problem_id)
    ON DELETE CASCADE
);
