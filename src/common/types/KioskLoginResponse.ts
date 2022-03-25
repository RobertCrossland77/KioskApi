import { KioskAuthStatus } from './KioskAuthStatus';
import { Restaurant } from './Restaurant';

export type KioskLoginResponse = {
  status: KioskAuthStatus;
  locations: Array<Restaurant>;
  message?: string;
};
