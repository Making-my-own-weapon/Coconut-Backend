import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from 'src/users/users.service';

interface JwtPayload {
  id: number;
  email: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    super({
      // 1. 요청의 쿠키에서 'refreshToken'을 추출합니다.
      jwtFromRequest: (req: Request) => {
        // 1. req.cookies의 타입을 { refreshToken?: string }으로 지정합니다.
        const cookies = req.cookies as { refreshToken?: string };

        // 2. 타입이 지정된 객체에서 토큰을 추출합니다.
        const token = cookies?.refreshToken;

        // 3. 토큰이 없으면(undefined) null을 반환합니다.
        return token ?? null;
      },
      // 2. 만료 여부를 확인합니다. (false로 설정)
      ignoreExpiration: false,
      // 3. 비밀 키를 설정합니다.
      secretOrKey: configService.getOrThrow<string>('REFRESH_JWT_SECRET'),
    });
  }

  /**
   * 4. 위 설정으로 토큰의 서명과 만료일자 검증이 끝나면,
   * 성공 시에만 이 validate 함수가 호출됩니다.
   * 여기서는 토큰의 payload를 받습니다.
   */
  async validate(payload: JwtPayload) {
    // payload의 id로 사용자가 DB에 실제로 존재하는지 확인합니다.
    const user = await this.usersService.findOneById(payload.id);

    // 사용자가 없거나, DB에 refreshToken이 없다면(로그아웃 처리된 경우) 에러를 발생시킵니다.
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('유효하지 않은 사용자 또는 토큰입니다.');
    }

    // 모든 검증 통과 시, 비밀번호와 리프레시 토큰을 제외한 사용자 정보를 반환합니다.
    // 이 반환 값은 Guard를 통과한 요청의 req.user에 담기게 됩니다.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, ...result } = user;
    return result;
  }
}
