import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // --- 추가된 부분: @Public() 메타데이터 확인 ---
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      // 공개(토큰 불필요) 엔드포인트라면 검증을 건너뛴다
      return true;
    }
    // --- 원래 동작: JWT 토큰 검증 수행 ---
    return super.canActivate(context);
  }
}
