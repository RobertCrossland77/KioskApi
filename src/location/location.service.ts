import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma.service';
import {
  Group,
  LocationUser,
  Restaurant,
  SpecialAccounts,
} from 'src/common/types';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  getLocations(user: LocationUser, locationID?: number) {
    return this.getLocationsByRole(user, Number(locationID));
  }

  async getLocationsByRole(
    user: LocationUser,
    locationID: number,
  ): Promise<Array<Restaurant>> {
    switch (user.group_id) {
      case Group.admin:
        return await this.getAdminLocations(user, locationID);
      case Group.dealer:
        return await this.getDealerLocations(user, locationID);
      case Group.members:
        return await this.getMemberLocations(user, locationID);
      default:
        return Promise.resolve([] as Array<Restaurant>);
    }
  }

  getAdminLocations(user: LocationUser, location: number) {
    this.groupGuard(user.group_id, Group.admin);

    if (user.account_id === SpecialAccounts.GlobalRestaurantAdmin) {
      return this.getLocationsForGlobalRestaurantAdmin(location);
    } else if (user.account_id === SpecialAccounts.HeartlandAdmin) {
      return this.getLocationsForHeartlandAdmin(location);
    } else {
      throw new Error(
        'An admin must be a Global Resteraunt Admin or a Heartland Admin',
      );
    }
  }

  getDealerLocations(user: LocationUser, location: number) {
    this.groupGuard(user.group_id, Group.dealer);

    if (user.account_id === SpecialAccounts.GlobalRestaurantAdmin) {
      return this.getLocationsForGlobalRestaurantAdmin(location);
    } else if (user.account_id === SpecialAccounts.HeartlandAdmin) {
      return this.getLocationsForHeartlandAdmin(location);
    } else if (Number(user.account_admin) === 1) {
      return this.getLocationsForAccountAdminDealer(user, location);
    } else {
      return this.getLocationsForDealer(user, location);
    }
  }

  getMemberLocations(user: LocationUser, location: number) {
    this.groupGuard(user.group_id, Group.members);

    if (Number(user.account_admin) === 1) {
      return this.getLocationsForAccountAdminMember(user, location);
    } else {
      return this.getLocationsForMember(user, location);
    }
  }

  groupGuard(userGroup: Group, intendedGroup: Group) {
    if (userGroup !== intendedGroup) {
      throw new Error(
        `Unauthorized: Passed in user must have ${Group[intendedGroup]} role`,
      );
    }
  }

  getLocationsForGlobalRestaurantAdmin(
    locationID: number,
  ): Promise<Array<Restaurant>> {
    return this.prisma.$queryRaw`
      SELECT
        loc.PKID AS RestaurantID,
        loc.Name as RestaurantName,
        CONCAT(
          loc.Address,
          ' ',
          loc.City,
          ', ',
          loc.State,
          ' ',
          loc.PostalCode
        ) AS RestaurantAddress
      FROM tblLocations loc
        INNER JOIN tblAccounts acc
          ON loc.AccountID = acc.PKID
        INNER JOIN tblAccounts dealer
          ON acc.DealerID = dealer.PKID
      WHERE
        loc.IsActive = 1
        AND loc.PosActive = 1
        AND (
          acc.DealerID = -8888 OR dealer.DealerID = -8888
        )
        AND (
          loc.PKID = ${locationID} 
          OR ${locationID} IS NULL
        )
      ORDER BY loc.Name
    `;
  }

  getLocationsForHeartlandAdmin(
    locationID: number,
  ): Promise<Array<Restaurant>> {
    return this.prisma.$queryRaw`
      SELECT
        loc.PKID AS RestaurantID,
        loc.Name as RestaurantName,
        CONCAT(
          loc.Address,
          ' ',
          loc.City,
          ', ',
          loc.State,
          ' ',
          loc.PostalCode
        ) AS RestaurantAddress
      FROM tblLocations loc
        INNER JOIN tblAccounts acc
          ON loc.AccountID = acc.PKID
      WHERE
        loc.IsActive = 1
        AND loc.PosActive = 1
        AND (
          loc.PKID = ${locationID} 
          OR ${locationID} IS NULL
        )
      ORDER BY loc.Name
    `;
  }

  getLocationsForAccountAdminDealer(
    user: LocationUser,
    locationID: number,
  ): Promise<Array<Restaurant>> {
    return this.prisma.$queryRaw`
      SELECT
        loc.PKID AS RestaurantID,
        loc.Name as RestaurantName,
        CONCAT(
          loc.Address,
          ' ',
          loc.City,
          ', ',
          loc.State,
          ' ',
          loc.PostalCode
        ) AS RestaurantAddress
      FROM
        tblLocations loc
        INNER JOIN tblAccounts acc
          ON loc.AccountID = acc.PKID
      WHERE
        loc.IsActive = 1
        AND loc.PosActive = 1
        AND (
          acc.PKID = ${user.account_id} 
          OR acc.DealerID = ${user.account_id}
        )
        AND (
          loc.PKID = ${locationID} 
          OR ${locationID} IS NULL
        )
      UNION ALL
      SELECT
        loc.PKID AS RestaurantID,
        loc.Name as RestaurantName,
        CONCAT(
          loc.Address,
          ' ',
          loc.City,
          ', ',
          loc.State,
          ' ',
          loc.PostalCode
        ) AS RestaurantAddress 
      FROM tblLocations loc
        INNER JOIN tblAccounts acc
          ON loc.AccountID = acc.PKID
        INNER JOIN tblDealerSupportAccess dsa
          ON acc.DealerID = dsa.SupportDealerID
      WHERE
        loc.IsActive = 1
        AND loc.PosActive = 1
        AND dsa.DealerID = ${user.account_id}
        AND acc.IsDemo = 0
        AND (
          loc.PKID = ${locationID} 
          OR ${locationID} IS NULL
        )
      ORDER BY RestaurantName
    `;
  }

  getLocationsForDealer(
    user: LocationUser,
    locationID: number,
  ): Promise<Array<Restaurant>> {
    return this.prisma.$queryRaw`
      SELECT
        loc.PKID AS RestaurantID,
        loc.Name as RestaurantName,
        CONCAT(
          loc.Address,
          ' ',
          loc.City,
          ', ',
          loc.State,
          ' ',
          loc.PostalCode
        ) AS RestaurantAddress
      FROM tblLocations loc
        INNER JOIN tblAccounts acc
          ON loc.AccountID = acc.PKID
        INNER JOIN tblResellerPermissions rp 
          ON acc.PKID = rp.AccountID
            AND rp.UserID = ${user.id}
      WHERE
        loc.IsActive = 1
        AND loc.PosActive = 1 
        AND (
          acc.PKID = ${user.account_id} 
          OR acc.DealerID = ${user.account_id}
        )
        AND (
          loc.PKID = ${locationID} 
          OR ${locationID} IS NULL
        )
      UNION ALL
      SELECT
        loc.PKID AS RestaurantID,
        loc.Name as RestaurantName,
        CONCAT(
          loc.Address,
          ' ',
          loc.City,
          ', ',
          loc.State,
          ' ',
          loc.PostalCode
        ) AS RestaurantAddress
      FROM tblLocations loc
        INNER JOIN tblAccounts acc
          ON loc.AccountID = acc.PKID
        INNER JOIN tblDealerSupportAccess dsa
          ON acc.DealerID = dsa.SupportDealerID
        INNER JOIN tblResellerPermissions rp
          ON acc.PKID = rp.AccountID
            AND rp.UserID = ${user.id}
      WHERE
        loc.IsActive = 1
        AND loc.PosActive = 1
        AND dsa.DealerID = ${user.account_id}
        AND acc.IsDemo = 0
        AND (
          loc.PKID = ${locationID} 
          OR ${locationID} IS NULL
        )
      ORDER BY RestaurantName
    `;
  }

  getLocationsForAccountAdminMember(
    user: LocationUser,
    locationID: number,
  ): Promise<Array<Restaurant>> {
    return this.prisma.$queryRaw`
      SELECT
        loc.PKID AS RestaurantID,
        loc.Name as RestaurantName,
        CONCAT(
          loc.Address,
          ' ',
          loc.City,
          ', ',
          loc.State,
          ' ',
          loc.PostalCode
        ) AS RestaurantAddress
      FROM tblLocations loc
        INNER JOIN tblAccounts acc
          ON loc.AccountID = acc.PKID
      WHERE
        loc.IsActive = 1
        AND loc.PosActive = 1
        AND loc.AccountID = ${user.account_id}
        AND (
          loc.PKID = ${locationID}
          OR ${locationID} IS NULL
        )
      ORDER BY loc.Name
    `;
  }

  getLocationsForMember(
    user: LocationUser,
    locationID: number,
  ): Promise<Array<Restaurant>> {
    return this.prisma.$queryRaw`
      SELECT
        loc.PKID AS RestaurantID,
        loc.Name as RestaurantName,
        CONCAT(
          loc.Address,
          ' ',
          loc.City,
          ', ',
          loc.State,
          ' ',
          loc.PostalCode
        ) AS RestaurantAddress
      FROM tblLocations loc
        INNER JOIN tblAccounts acc
          ON loc.AccountID = acc.PKID
        INNER JOIN tblUserPermissions_V2 up
          ON loc.PKID = up.LocationID
      WHERE
        loc.IsActive = 1
        AND loc.PosActive = 1 
        AND loc.AccountID = ${user.account_id}
        AND up.UserID = ${user.id}
        AND (
          loc.PKID = ${locationID} 
          OR ${locationID} IS NULL
        )
      ORDER BY loc.Name
    `;
  }
}
