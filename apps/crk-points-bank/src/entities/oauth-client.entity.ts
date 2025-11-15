import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { randomBytes } from 'crypto';

@Entity('oauth_clients')
export class OAuthClient {
  @PrimaryColumn({ name: 'client_id' })
  clientId: string;

  @BeforeInsert()
  generateClientId() {
    if (!this.clientId) {
      this.clientId = randomBytes(16).toString('hex');
    }
  }

  @Column({ name: 'client_secret' })
  clientSecret: string;

  @Column({ name: 'client_name' })
  clientName: string;

  @Column({ type: 'text', array: true, name: 'redirect_uris' })
  redirectUris: string[];

  @Column({
    type: 'simple-array',
    name: 'allowed_grants',
    default: 'authorization_code,refresh_token',
  })
  allowedGrants: string[];

  @Column({
    type: 'simple-array',
    name: 'allowed_scopes',
    default: 'profile,points',
  })
  allowedScopes: string[];

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true, name: 'logo_url' })
  logoUrl: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
