import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('oauth_clients')
export class OAuthClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', unique: true })
  clientId: string;

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
