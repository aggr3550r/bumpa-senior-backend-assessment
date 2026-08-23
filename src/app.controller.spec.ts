import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('returns the baseline health response envelope', () => {
      expect(appController.getHealth()).toEqual({
        status: true,
        statusCode: 200,
        message: 'Service is healthy',
        data: {
          status: 'ok',
          service: 'bumpa-ecommerce-store',
        },
        meta: undefined,
      });
    });
  });
});
