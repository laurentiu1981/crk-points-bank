import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Member } from '../entities/member.entity';
import { OAuthAccessToken } from '../entities/oauth-access-token.entity';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class MemberService {
  constructor(
    @InjectRepository(Member)
    private memberRepository: Repository<Member>,
    @InjectRepository(OAuthAccessToken)
    private accessTokenRepository: Repository<OAuthAccessToken>,
    @InjectRepository(OAuthRefreshToken)
    private refreshTokenRepository: Repository<OAuthRefreshToken>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * Get member's active OAuth sessions
   */
  async getActiveSessions(memberId: string) {
    // Get active access tokens (not expired and not revoked)
    // Include non-expiring tokens (card linking) where expiresAt is null
    const now = new Date();
    const activeSessions = await this.accessTokenRepository
      .createQueryBuilder('token')
      .leftJoinAndSelect('token.client', 'client')
      .leftJoinAndSelect('token.member', 'member')
      .where('token.member_id = :memberId', { memberId })
      .andWhere('(token.access_token_expires_at > :now OR token.access_token_expires_at IS NULL)', { now })
      .andWhere('token.revoked = :revoked', { revoked: false })
      .orderBy('token.created_at', 'DESC')
      .getMany();

    return activeSessions.map((session) => ({
      id: session.id,
      clientName: session.client.clientName,
      clientLogo: session.client.logoUrl,
      scope: session.scope,
      createdAt: session.createdAt,
      expiresAt: session.accessTokenExpiresAt,
      lastUsed: session.createdAt, // No updatedAt field, use createdAt
      isNonExpiring: session.accessTokenExpiresAt === null,
    }));
  }

  /**
   * Get member's transaction history from unified Transaction table
   */
  async getTransactionHistory(memberId: string, limit = 50) {
    // Query unified transactions table - much simpler!
    const transactions = await this.transactionRepository.find({
      where: { memberId },
      relations: ['client'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    // Format for frontend
    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.type, // 'credit' or 'debit'
      amount: tx.type === 'credit' ? tx.amount : -tx.amount, // Positive for credits, negative for debits
      description: tx.description,
      method: tx.method,
      partnerName: tx.client.clientName,
      status: tx.status,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
    }));
  }

  /**
   * Revoke OAuth session
   */
  async revokeSession(memberId: string, sessionId: string): Promise<boolean> {
    const session = await this.accessTokenRepository.findOne({
      where: { id: sessionId, memberId: memberId },
    });

    if (!session) {
      return false;
    }

    // Mark access token as revoked
    session.revoked = true;
    await this.accessTokenRepository.save(session);

    // Also revoke associated refresh tokens (by member and client)
    await this.refreshTokenRepository
      .createQueryBuilder()
      .update()
      .set({ revoked: true })
      .where('member_id = :memberId', { memberId: session.memberId })
      .andWhere('client_id = :clientId', { clientId: session.clientId })
      .execute();

    return true;
  }
}
