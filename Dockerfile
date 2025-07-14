# FROM node:20-alpine
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .

# RUN npm run build

# CMD ["npm", "run", "start:dev"]

FROM node:20-alpine

WORKDIR /app

# Python과 빌드 도구 설치 (Tree-sitter 네이티브 모듈 컴파일용)
RUN apk add --no-cache python3 make g++

# 1. NestJS CLI 글로벌 설치 (중요!)
RUN npm install -g @nestjs/cli

# 2. package.json, package-lock.json 복사
COPY package*.json ./

# 3. devDependencies까지 모두 설치 (start:dev에 필요)
# Tree-sitter 미리 컴파일된 바이너리 사용
ENV npm_config_target_platform=linux
ENV npm_config_target_arch=arm64
RUN npm install --legacy-peer-deps

# 4. 소스 코드 복사
COPY . .

# 5. 빌드
RUN npm run build

# 6. 개발 서버 실행
CMD ["npm", "run", "start:dev"]