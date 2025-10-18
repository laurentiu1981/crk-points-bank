import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Member } from './member.entity';
import { OAuthClient } from './oauth-client.entity';

@Entity('redemption_requests')
export class RedemptionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'member_id' })
  memberId: string;

  @ManyToOne(() => Member)
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'client_id' })
  clientId: string;

  @ManyToOne(() => OAuthClient)
  @JoinColumn({ name: 'client_id' })
  client: OAuthClient;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  otp: string;

  @Column({ name: 'otp_expires_at' })
  otpExpiresAt: Date;

  @Column({
    type: 'varchar',
    default: 'pending',
  })
  status: 'pending' | 'approved' | 'rejected' | 'expired';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;
}
