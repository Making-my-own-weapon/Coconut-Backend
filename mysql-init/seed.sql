-- seed.sql (snake_case 스키마에 맞춰 수정)

USE coconut_db;   -- 사용할 데이터베이스

-- 1) Users 기본 계정
INSERT INTO users (name, email, password, refresh_token, room_id)
VALUES
  ('Alice', 'alice@example.com', 'hashed_password_1', NULL, NULL),
  ('Bob',   'bob@example.com',   'hashed_password_2', NULL, NULL);

-- 2) Rooms 예시 세팅 (문제 배정용)
INSERT INTO rooms (host_id, title, invite_code, status)
VALUES
  (1, 'Intro to Algorithms', 'ALG1234567', 'WAITING'),
  (2, 'Data Structures 101', 'DSC7654321', 'WAITING');

-- 3) Problems 기본 문제 3개
INSERT INTO problems (title, creator_id, execution_time_limit_ms, memory_limit_kb, description, solve_time_limit_min)
VALUES
  (
    '두 수 더하기',
    1,
    1000,
    65536,
    '두 개의 정수가 주어졌을 때, 두 수의 합을 출력하는 문제입니다.',
    10
  ),
  (
    '팩토리얼 계산',
    1,
    2000,
    65536,
    'n! (1 ≤ n ≤ 20)을 계산하는 문제입니다.',
    15
  ),
  (
    '피보나치 수열',
    2,
    2000,
    65536,
    'n번째 피보나치 수(1 ≤ n ≤ 50)를 계산하는 문제입니다.',
    15
  );

-- 4) Room ↔ Problem 매핑 예시
INSERT INTO room_problems (room_id, problem_id)
VALUES
  (1, 1),
  (1, 2),
  (2, 2),
  (2, 3);

-- 5) Testcases 예시 (채점용)
INSERT INTO testcases (problem_id, input_tc, output_tc)
VALUES
  -- 두 수 더하기
  (1, '1 2',   '3'),
  (1, '10 20', '30'),
  (1, '-5 5',  '0'),
  -- 팩토리얼 계산
  (2, '1',   '1'),
  (2, '5',   '120'),
  (2, '10',  '3628800'),
  -- 피보나치 수열
  (3, '1',  '1'),
  (3, '10', '55'),
  (3, '20', '6765');
