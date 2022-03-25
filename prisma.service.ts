import { INestApplication, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export class PrismaService extends PrismaClient implements OnModuleInit {
  onModuleInit() {
    this.$connect();
  }

  enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', () => {
      app.close();
    });
  }
}
