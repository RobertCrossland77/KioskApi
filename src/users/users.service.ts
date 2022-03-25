import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma.service';
import { LocationUser } from 'src/common/types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findUserById(userId: number): Promise<LocationUser> {
    return this.prisma.$queryRaw`
      SELECT 
        users.id,
        users.group_id,
        meta.account_id,
        meta.account_admin
      FROM users 
        INNER JOIN meta
          ON users.id = meta.user_id
      WHERE users.id = ${userId};
    `;
  }
}
