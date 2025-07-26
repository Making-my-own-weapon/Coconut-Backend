import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check(@Res() res: Response) {
    res.status(200).send('healthy\n');
  }
}
