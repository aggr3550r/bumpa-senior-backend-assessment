import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ResponseModel } from './models/response.model';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return ResponseModel.success('Service is healthy', this.appService.getHealth());
  }
}
