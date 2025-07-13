// src/users/users.controller.ts

import {
  Controller,
  Delete,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
  };
}

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Delete('me')
  @UseGuards(JwtAuthGuard) // 👈 로그인한 사용자만 접근 가능하도록 설정
  @HttpCode(HttpStatus.NO_CONTENT) // 성공 시 204 No Content 응답
  async deleteCurrentUser(@Req() req: RequestWithUser): Promise<void> {
    return this.usersService.deleteUser(req.user.id);
  }
}
