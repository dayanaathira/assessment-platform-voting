import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * @returns A static greeting string.
   */
  getHello(): string {
    return 'Hello World!';
  }
}
