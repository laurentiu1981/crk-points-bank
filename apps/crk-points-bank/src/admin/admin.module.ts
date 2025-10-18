import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { OAuthClient } from '../entities/oauth-client.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OAuthClient])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
