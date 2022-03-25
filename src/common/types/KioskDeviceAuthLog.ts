export type KioskDeviceAuthLog = {
  deviceId: string;
  locationId: number;
  ipAddress?: string;
  hardware?: string;
  version?: string;
  os?: string;
  createdUpdatedWhen: string | Date;
  deviceName?: string;
  originalDeviceHash?: string;
  authExpiration: number;
};
