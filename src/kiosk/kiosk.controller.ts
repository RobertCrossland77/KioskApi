import { Controller, Post, Body } from '@nestjs/common';
import { KioskDeviceLogin } from 'src/common/types';
import { KioskService } from './kiosk.service';

@Controller('kiosk')
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Post('login')
  create(
    @Body()
    authorizeKioskDto: {
      userId: number;
      deviceId: string;
      support: boolean;
      device: KioskDeviceLogin;
    },
  ) {
    return this.kioskService.login(
      authorizeKioskDto.userId,
      authorizeKioskDto.deviceId,
      authorizeKioskDto.support,
      authorizeKioskDto.device,
    );
  }
}
