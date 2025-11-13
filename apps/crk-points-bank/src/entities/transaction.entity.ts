import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Member } from './member.entity';
import { OAuthClient } from './oauth-client.entity';

@Entity('transactions')
@Index(['memberId', 'createdAt'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'member_id' })
  @Index()
  memberId: string;

  @ManyToOne(() => Member)
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'client_id' })
  clientId: string;

  @ManyToOne(() => OAuthClient)
  @JoinColumn({ name: 'client_id' })
  client: OAuthClient;

  // Transaction type: 'credit' (adding points) or 'debit' (spending points)
  @Column({ type: 'varchar', length: 10 })
  @Index()
  type: 'credit' | 'debit';

  // Method/reason for transaction
  // Credits: 'signup_bonus', 'purchase_reward', 'referral', 'promotion', 'card_linked'
  // Debits: 'oauth_direct', 'otp_approval', 'card_linked'
  @Column({ type: 'varchar', length: 50, nullable: true })
  method: string;

  // Amount (always positive - type indicates if adding or removing)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  // Human-readable description
  @Column({ type: 'text', nullable: true })
  description: string;

  // Status for debit transactions that require approval
  // null for instant transactions (oauth_direct, credits)
  // 'pending', 'approved', 'rejected', 'expired' for OTP-based debits
  @Column({ type: 'varchar', length: 20, nullable: true })
  status: string;

  // OTP fields (only for OTP-based debits)
  @Column({ type: 'varchar', length: 6, nullable: true })
  otp: string;

  @Column({ type: 'timestamp', nullable: true, name: 'otp_expires_at' })
  otpExpiresAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
