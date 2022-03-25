import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma.service';
import {
  KioskAuthStatus,
  BillingTypeInfo,
  KioskDeviceAuthLog,
  KioskDeviceLogin,
  KioskLoginResponse,
  LocationUser,
  Restaurant,
  SpecialAccounts,
} from 'src/common/types';
import { LocationService } from 'src/location/location.service';
import { UsersService } from 'src/users/users.service';
import moment from 'moment';

@Injectable()
export class KioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly location: LocationService,
  ) {}

  async login(
    userId: number,
    deviceId: string,
    support: boolean,
    loginData: KioskDeviceLogin,
  ): Promise<KioskLoginResponse> {
    const user = await this.users.findUserById(userId);
    const locations = await this.location.getLocations(user);

    if (locations.length === 0) {
      return {
        status: KioskAuthStatus.BadRequest,
        message: 'No locations found',
        locations: new Array<Restaurant>(),
      };
    } else if (locations.length === 1) {
      const locationId = locations[0].RestaurantID;
      const duration = support ? 3600 : 0;
      const authExpiration = duration == 0 ? 0 : moment().unix() + duration;

      if (
        user.group_id > 1 &&
        !support &&
        (await this.canAuthorize(deviceId, locationId))
      ) {
        return {
          status: KioskAuthStatus.Unauthorized,
          locations: locations,
          message:
            'Max Device Limit Reached. Please contact your local reseller to change your billing plan',
        };
      } else if (
        await this.authorize(
          deviceId,
          locationId,
          user,
          new Date(),
          authExpiration,
        )
      ) {
        this.logAuthenticate(
          locationId,
          deviceId,
          loginData,
          new Date(),
          authExpiration,
        );

        return {
          status: KioskAuthStatus.Ok,
          locations: locations,
        };
      } else {
        return {
          status: KioskAuthStatus.Unauthorized,
          message: 'Could not authenticate',
          locations: new Array<Restaurant>(),
        };
      }
    } else {
      return {
        status: KioskAuthStatus.Ok,
        locations: locations,
      };
    }
  }

  public async authorize(
    deviceId: string,
    locationId: number,
    user: LocationUser,
    createdWhen: Date,
    authExpiration: number,
  ) {
    try {
      await this.prisma.tblAuthorizedKioskDevices.upsert({
        where: {
          DeviceID: deviceId,
        },
        create: {
          DeviceID: deviceId,
          LocationID: locationId,
          CreatedWhen: createdWhen,
          UserID: user.id,
          GroupID: user.group_id,
          AuthExpiration: authExpiration,
          TimeZone: 'CST',
          SetupVersion: 0,
        },
        update: {
          LocationID: locationId,
          UpdatedWhen: createdWhen,
          UserID: user.id,
          GroupID: user.group_id,
          AuthExpiration: authExpiration,
        },
      });

      return true;
    } catch (e) {
      // Not sure this is the best way to return a false.
      // If the db is down or something we would want
      // that to bubble up. I can't think of an instance
      // where false is what we want but that is what was
      // in the original PHP code this was copied from.
      return false;
    }
  }

  public async canAuthorize(
    deviceId: string,
    locationId: number,
  ): Promise<boolean> {
    const [isAuthorizedAccount, billingTypeInfo] =
      await this.isAuthorizedByAccountType(locationId);

    if (isAuthorizedAccount) {
      return true;
    } else {
      return await this.isAuthorizedByKioskCount(
        deviceId,
        locationId,
        billingTypeInfo?.NumTerminalsKiosk ?? 0,
      );
    }
  }

  async isAuthorizedByKioskCount(
    deviceId: string,
    locationId: number,
    numKioskTerminals: number,
  ): Promise<boolean> {
    return (
      (await this.getDeviceCountInfo(deviceId, locationId)) < numKioskTerminals
    );
  }

  async isAuthorizedByAccountType(
    locationId: number,
  ): Promise<[boolean, BillingTypeInfo | undefined]> {
    const billingTypeInfos = await this.getBillingTypeInfo(locationId);

    if (billingTypeInfos.length !== 1) {
      return [false, undefined];
    } else {
      const {
        AccountID: accountId,
        IsDealer: isDealer,
        IsDemo: isDemo,
      } = billingTypeInfos[0];

      return [
        this.isAuthorizedAccountType(accountId, isDealer, isDemo),
        billingTypeInfos[0],
      ];
    }
  }

  isAuthorizedAccountType(
    accountId: number,
    isDealer: number,
    isDemo: number,
  ): boolean {
    return (
      this.isSpecialAccount(accountId) || this.isDealerOrDemo(isDealer, isDemo)
    );
  }

  isSpecialAccount(accountId: number): boolean {
    return;
    accountId === SpecialAccounts.HeartlandAdmin ||
      accountId === SpecialAccounts.GlobalRestaurantAdmin ||
      accountId === SpecialAccounts.MobileBytesDemo;
  }

  isDealerOrDemo(isDealer: number, isDemo: number): boolean {
    return isDealer === 1 || isDemo === 1;
  }

  async getBillingTypeInfo(
    locationId: number,
  ): Promise<Array<BillingTypeInfo>> {
    return this.serializeGetBillingTypeInfo(
      await this.prisma.tblLocations.findMany({
        select: {
          NumTerminalsKiosk: true,
          AccountID: true,
          tblAccounts: {
            select: {
              IsDealer: true,
              IsDemo: true,
            },
          },
        },
        where: {
          PKID: locationId,
        },
      }),
    );
  }

  async getDeviceCountInfo(
    deviceId: string,
    locationId: number,
  ): Promise<number> {
    return (
      await this.prisma.tblAuthorizedKioskDevices.aggregate({
        _count: {
          DeviceID: true,
        },
        where: {
          AND: {
            LocationID: locationId,
            GroupID: 1,
            AuthExpiration: 0,
            DeviceID: {
              not: deviceId,
            },
            Disabled: 0,
          },
        },
      })
    )._count.DeviceID;
  }

  serializeGetBillingTypeInfo(
    billingInfos: Array<{
      NumTerminalsKiosk: number;
      AccountID: number;
      tblAccounts: {
        IsDealer: number;
        IsDemo: number;
      };
    }>,
  ): Array<BillingTypeInfo> {
    return billingInfos.map((bi) => {
      return {
        NumTerminalsKiosk: bi.NumTerminalsKiosk,
        AccountID: bi.AccountID,
        IsDealer: bi.tblAccounts.IsDealer,
        IsDemo: bi.tblAccounts.IsDemo,
      };
    });
  }

  async logAuthenticate(
    locationId: number,
    deviceId: string,
    loginData: KioskDeviceLogin,
    createdUpdatedWhen: Date,
    authExpiration: number = 0,
  ) {
    const log: KioskDeviceAuthLog = {
      deviceId: deviceId,
      locationId: locationId,
      ipAddress: loginData.ip ? loginData.ip : '',
      hardware: loginData.hw ? loginData.ip : '',
      version: loginData.v && loginData.v.app ? loginData.v.app : '',
      os: loginData.v && loginData.v.os ? loginData.v.os : '',
      createdUpdatedWhen: createdUpdatedWhen,
      deviceName: loginData.name ? loginData.name : '',
      originalDeviceHash:
        loginData.hid && loginData.hid !== '(null)' ? loginData.hid : '',
      authExpiration: authExpiration,
    };

    await this.deviceAuthLogKioskInsert(log);
    await this.authorizedKioskDevicesUpdate(log);
  }

  deviceAuthLogKioskInsert(log: KioskDeviceAuthLog) {
    return this.prisma.tblDeviceAuthLogKiosk.create({
      data: {
        DeviceID: log.deviceId,
        LocationID: log.locationId,
        IPAddress: log.ipAddress,
        Hardware: log.hardware,
        Version: log.version,
        CreatedWhen: log.createdUpdatedWhen,
        DeviceName: log.deviceName,
        OrigDeviceHash: log.originalDeviceHash,
        AuthExpiration: log.authExpiration,
      },
    });
  }

  authorizedKioskDevicesUpdate(kioskDevice: KioskDeviceAuthLog) {
    return this.prisma.tblAuthorizedKioskDevices.update({
      where: {
        DeviceID: kioskDevice.deviceId,
      },
      data: {
        IPAddress: kioskDevice.ipAddress,
        Hardware: kioskDevice.hardware,
        Version: kioskDevice.version,
        DeviceName: kioskDevice.deviceName,
        Software: kioskDevice.os,
        UpdatedWhen: kioskDevice.createdUpdatedWhen,
        OrigDeviceHash: kioskDevice.originalDeviceHash,
        AuthExpiration: kioskDevice.authExpiration,
        Disabled: 0,
      },
    });
  }
}
