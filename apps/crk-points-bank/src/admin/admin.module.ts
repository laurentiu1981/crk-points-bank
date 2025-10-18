import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { OAuthClient } from '../entities/oauth-client.entity';
import { Member } from '../entities/member.entity';
import { RedemptionRequest } from '../entities/redemption-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OAuthClient, Member, RedemptionRequest])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
