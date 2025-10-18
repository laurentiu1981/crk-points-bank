import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Member } from '../entities/member.entity';
import { OAuthAccessToken } from '../entities/oauth-access-token.entity';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity';
import { RedemptionRequest } from '../entities/redemption-request.entity';
import { CreditTransaction } from '../entities/credit-transaction.entity';

@Injectable()
export class MemberService {
  constructor(
    @InjectRepository(Member)
    private memberRepository: Repository<Member>,
    @InjectRepository(OAuthAccessToken)
    private accessTokenRepository: Repository<OAuthAccessToken>,
    @InjectRepository(OAuthRefreshToken)
    private refreshTokenRepository: Repository<OAuthRefreshToken>,
    @InjectRepository(RedemptionRequest)
    private redemptionRepository: Repository<RedemptionRequest>,
    @InjectRepository(CreditTransaction)
    private creditRepository: Repository<CreditTransaction>,
  ) {}

  /**
   * Get member's active OAuth sessions
   */
  async getActiveSessions(memberId: string) {
    // Get active access tokens (not expired and not revoked)
    const now = new Date();
    const activeSessions = await this.accessTokenRepository
      .createQueryBuilder('token')
      .leftJoinAndSelect('token.client', 'client')
      .leftJoinAndSelect('token.member', 'member')
      .where('token.member_id = :memberId', { memberId })
      .andWhere('token.access_token_expires_at > :now', { now })
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
    }));
  }

  /**
   * Get member's transaction history (redemptions + credits)
   */
  async getTransactionHistory(memberId: string, limit = 50) {
    // Get redemptions
    const redemptions = await this.redemptionRepository.find({
      where: {
        member: { id: memberId },
        status: 'approved'
      },
      relations: ['client'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    // Get credits
    const credits = await this.creditRepository.find({
      where: { member: { id: memberId } },
      relations: ['client'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    // Combine and sort by date
    const transactions = [
      ...redemptions.map((r) => ({
        id: r.id,
        type: 'redemption' as const,
        amount: -r.amount, // Negative for deduction
        description: r.description,
        partnerName: r.client.clientName,
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...credits.map((c) => ({
        id: c.id,
        type: 'credit' as const,
        amount: c.amount, // Positive for addition
        description: c.description,
        reason: c.reason,
        partnerName: c.client.clientName,
        createdAt: c.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
     .slice(0, limit);

    return transactions;
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
