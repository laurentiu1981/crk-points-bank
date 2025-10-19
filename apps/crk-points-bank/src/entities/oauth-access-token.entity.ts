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

@Entity('oauth_access_tokens')
export class OAuthAccessToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'access_token', unique: true })
  accessToken: string;

  @Column({ name: 'access_token_expires_at', type: 'timestamp', nullable: true })
  accessTokenExpiresAt: Date;

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
