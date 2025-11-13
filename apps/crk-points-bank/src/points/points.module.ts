import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { Member } from '../entities/member.entity';
import { OAuthClient } from '../entities/oauth-client.entity';
import { RedemptionRequest } from '../entities/redemption-request.entity';
import { Transaction } from '../entities/transaction.entity';
import { OAuthModule } from '../oauth/oauth.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Member, OAuthClient, RedemptionRequest, Transaction]),
    OAuthModule,
    AuthModule,
  ],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
