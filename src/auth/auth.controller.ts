import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request, Response } from 'express';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

// 1. JWT 토큰에서 추출한 사용자 정보의 타입을 정의합니다.
interface UserPayload {
  id: number;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  createdProblems: any[];
  // 토큰에 다른 정보가 있다면 여기에 추가합니다 (e.g., iat, exp).
}

// 2. Express의 Request 타입에 user 정보를 포함하도록 확장합니다.
interface RequestWithUser extends Request {
  user: UserPayload;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 회원가입
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() createUserDto: CreateUserDto) {
    return this.authService.signup(createUserDto);
  }

  // 로그인
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.login(loginUserDto);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
    });

    return { accessToken };
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  // 👇 req 타입을 RequestWithUser로 지정합니다.
  refresh(@Req() req: RequestWithUser) {
    return this.authService.refresh(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  // 👇 req 타입을 RequestWithUser로 지정합니다.
  me(@Req() req: RequestWithUser) {
    return req.user;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  // 👇 req 타입을 RequestWithUser로 지정합니다.
  async logout(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.id);

    res.clearCookie('refreshToken');

    return { success: true };
  }
}
