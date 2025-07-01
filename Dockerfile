# FROM node:20-alpine
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .

# RUN npm run build

# CMD ["npm", "run", "start:dev"]

FROM node:20-alpine

WORKDIR /app

# 1. NestJS CLI 글로벌 설치 (중요!)
RUN npm install -g @nestjs/cli

# 2. package.json, package-lock.json 복사
COPY package*.json ./

# 3. devDependencies까지 모두 설치 (start:dev에 필요)
RUN npm install

# 4. 소스 코드 복사
COPY . .

# 5. 빌드
RUN npm run build

# 6. 개발 서버 실행
CMD ["npm", "run", "start:dev"]
