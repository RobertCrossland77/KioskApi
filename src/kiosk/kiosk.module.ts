import { Module } from '@nestjs/common';
import { KioskService } from './kiosk.service';
import { KioskController } from './kiosk.controller';
import { PrismaService } from 'prisma.service';
import { UsersModule } from 'src/users/users.module';
import { LocationModule } from 'src/location/location.module';
import { LocationService } from 'src/location/location.service';
import { UsersService } from 'src/users/users.service';

@Module({
  imports: [UsersModule, LocationModule],
  controllers: [KioskController],
  providers: [KioskService, LocationService, UsersService, PrismaService],
})
export class KioskModule {}
