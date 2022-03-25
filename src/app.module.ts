import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LocationModule } from './location/location.module';
import { KioskModule } from './kiosk/kiosk.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [LocationModule, KioskModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
