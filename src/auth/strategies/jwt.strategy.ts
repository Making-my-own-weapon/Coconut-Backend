import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  id: number;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    super({
      // 1. 토큰 추출 방법 설정: Authorization 헤더의 Bearer 스킴에서 토큰을 추출합니다.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 2. 만료된 토큰을 거부할지 여부: false로 설정하면 만료된 토큰도 허용되므로, 반드시 false로 둡니다.
      ignoreExpiration: false,
      // 3. 토큰 검증에 사용할 비밀 키
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  /**
   * 토큰 검증(validate) 메서드
   * @param payload - 토큰이 유효하면, 토큰에 담겼던 payload가 이 메서드의 인자로 전달됩니다.
   */
  async validate(payload: JwtPayload) {
    // payload에서 userId를 사용해 실제 사용자가 DB에 존재하는지 확인합니다.
    const user = await this.usersService.findOneByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    // 이 메서드에서 반환되는 값은 req.user에 저장됩니다.
    return result;
  }
}
