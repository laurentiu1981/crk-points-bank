import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Member } from './member.entity';
import { OAuthClient } from './oauth-client.entity';

@Entity('oauth_refresh_tokens')
export class OAuthRefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'refresh_token', unique: true })
  refreshToken: string;

  @Column({ name: 'refresh_token_expires_at', type: 'timestamp' })
  refreshTokenExpiresAt: Date;

  @Column({ type: 'simple-array', nullable: true })
  scope: string[];

  @ManyToOne(() => OAuthClient)
  @JoinColumn({ name: 'client_id' })
  client: OAuthClient;

  @Column({ name: 'client_id' })
  clientId: string;

  @ManyToOne(() => Member)
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'member_id' })
  memberId: string;

  @Column({ default: false })
  revoked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
