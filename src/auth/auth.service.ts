import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginUserDto } from './dto/login-user.dto';
import { User } from 'src/users/entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  //회원가입
  async signup(
    createUserDto: CreateUserDto,
  ): Promise<{ id: number; email: string }> {
    const { name, email, password } = createUserDto;

    const existingUser = await this.usersService.findOneByEmail(email);
    if (existingUser) {
      throw new ConflictException('이미 사용중인 이메일입니다.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await this.usersService.create({
      name,
      email,
      password: hashedPassword,
    });

    return { id: newUser.id, email: newUser.email };
  }

  //로그인
  async login(
    loginUserDto: LoginUserDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { email, password } = loginUserDto;

    // 1. 이메일로 사용자 조회 (UsersService 재사용)
    const user = await this.usersService.findOneByEmail(email);

    // 2. 비밀번호 비교
    //    DB에 저장된 해시된 비밀번호와 사용자가 입력한 비밀번호를 비교합니다.
    const isPasswordMatched = user
      ? await bcrypt.compare(password, user.password)
      : false;

    // 3. 사용자가 없거나 비밀번호가 틀렸을 경우 예외 발생
    if (!user || !isPasswordMatched) {
      throw new UnauthorizedException('이메일 또는 비밀번호를 확인해주세요.'); // 401 에러
    }

    // 4. JWT 페이로드 생성 (토큰에 담을 정보)
    const payload = { id: user.id, email: user.email };

    // 5. JWT 발급 (Access Token & Refresh Token)
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_JWT_SECRET'), // TODO: .env 파일로 분리해야 합니다.
      expiresIn: '7d', // 리프레시 토큰 유효 기간 (7일)
    });

    // 5-1. 발급한 리프레시 토큰을 암호화합니다.
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    // 5-2. User 엔티티의 속성 이름인 refreshToken (camelCase)을 사용해서 DB에 저장합니다.
    await this.usersService.updateUser(user.id, {
      refreshToken: hashedRefreshToken,
    });

    // 6. API 명세서에 따라 두 토큰 모두 반환
    return { accessToken, refreshToken };
  }

  refresh(user: Omit<User, 'password' | 'refreshToken'>): {
    accessToken: string;
  } {
    const payload = { id: user.id, email: user.email };
    const newAccessToken = this.jwtService.sign(payload);
    return { accessToken: newAccessToken };
  }

  async logout(userId: number): Promise<{ success: boolean }> {
    // DB에 저장된 사용자의 리프레시 토큰을 null로 업데이트합니다.
    await this.usersService.updateUser(userId, { refreshToken: null });
    return { success: true };
  }
}
