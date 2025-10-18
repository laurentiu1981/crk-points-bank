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

@Entity('oauth_authorization_codes')
export class OAuthAuthorizationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'authorization_code', unique: true })
  authorizationCode: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'redirect_uri' })
  redirectUri: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
