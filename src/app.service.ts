import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
  public backendTest() {
    const data = { id: 1, status: 'OK' };
    return data;
  }
}
