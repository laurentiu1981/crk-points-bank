import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Member } from '../entities/member.entity';
import { OAuthClient } from '../entities/oauth-client.entity';
import { RedemptionRequest } from '../entities/redemption-request.entity';
import { Transaction } from '../entities/transaction.entity';
import { randomInt } from 'crypto';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @InjectRepository(Member)
    private memberRepository: Repository<Member>,
    @InjectRepository(OAuthClient)
    private clientRepository: Repository<OAuthClient>,
    @InjectRepository(RedemptionRequest)
    private redemptionRepository: Repository<RedemptionRequest>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * Direct redemption using member's OAuth access token
   * Used when member has already granted consent via OAuth
   */
  async redeemWithAccessToken(
    member: Member,
    client: OAuthClient,
    amount: number,
    description?: string,
  ): Promise<{ success: boolean; newBalance: number; transactionId: string }> {
    this.logger.log('=== DIRECT REDEMPTION WITH ACCESS TOKEN ===');
    this.logger.log(`Member: ${member.email} (${member.id})`);
    this.logger.log(`Client: ${client.clientName}`);
    this.logger.log(`Amount: ${amount} points`);
    this.logger.log(`Description: ${description || 'none'}`);

    // Validate amount
    if (amount <= 0) {
      this.logger.warn('Invalid redemption amount (must be positive)');
      throw new BadRequestException('Redemption amount must be positive');
    }

    // Check if member has sufficient points
    const currentPoints = parseFloat(member.points.toString());
    if (currentPoints < amount) {
      this.logger.warn(`Insufficient points. Has: ${currentPoints}, Needs: ${amount}`);
      throw new BadRequestException(`Insufficient points. You have ${currentPoints} points but need ${amount}`);
    }

    // Deduct points
    member.points = currentPoints - amount;
    await this.memberRepository.save(member);

    // Create transaction record
    const transaction = this.transactionRepository.create({
      memberId: member.id,
      member,
      clientId: client.clientId,
      client,
      type: 'debit',
      method: 'oauth_direct',
      amount,
      description,
      status: null, // Direct redemptions are instant (no approval needed)
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    this.logger.log(`Points redeemed successfully. New balance: ${member.points}`);
    this.logger.log(`Transaction ID: ${savedTransaction.id}`);
    this.logger.log('=== END DIRECT REDEMPTION ===\n');

    return {
      success: true,
      newBalance: parseFloat(member.points.toString()),
      transactionId: savedTransaction.id,
    };
  }

  /**
   * Create a redemption request that requires OTP approval
   * Partner initiates, member must approve manually
   */
  async createRedemptionRequest(
    clientId: string,
    clientSecret: string,
    memberId: string,
    amount: number,
    description?: string,
  ): Promise<{ requestId: string; otp: string; expiresAt: Date }> {
    this.logger.log('=== CREATE REDEMPTION REQUEST (OTP) ===');
    this.logger.log(`Client ID: ${clientId}`);
    this.logger.log(`Member ID: ${memberId}`);
    this.logger.log(`Amount: ${amount} points`);
    this.logger.log(`Description: ${description || 'none'}`);

    // Validate client credentials
    const client = await this.clientRepository.findOne({
      where: { clientId, active: true },
    });

    if (!client) {
      this.logger.warn(`Client not found: ${clientId}`);
      throw new NotFoundException('Client not found');
    }

    if (client.clientSecret !== clientSecret) {
      this.logger.warn(`Invalid client secret for client: ${clientId}`);
      throw new BadRequestException('Invalid client credentials');
    }

    this.logger.debug(`Client validated: ${client.clientName}`);

    // Validate member exists
    const member = await this.memberRepository.findOne({
      where: { id: memberId, active: true },
    });

    if (!member) {
      this.logger.warn(`Member not found: ${memberId}`);
      throw new NotFoundException('Member not found');
    }

    this.logger.debug(`Member validated: ${member.email}`);

    // Validate amount
    if (amount <= 0) {
      this.logger.warn('Invalid redemption amount (must be positive)');
      throw new BadRequestException('Redemption amount must be positive');
    }

    // Check if member has sufficient points
    const currentPoints = parseFloat(member.points.toString());
    if (currentPoints < amount) {
      this.logger.warn(`Insufficient points. Has: ${currentPoints}, Needs: ${amount}`);
      throw new BadRequestException(`Member has insufficient points. Available: ${currentPoints}, Required: ${amount}`);
    }

    // Generate 6-digit OTP
    const otp = randomInt(100000, 999999).toString();

    // OTP expires in 10 minutes
    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10);

    // Create redemption request
    const request = this.redemptionRepository.create({
      memberId: member.id,
      member,
      clientId: client.clientId,
      client,
      amount,
      description,
      otp,
      otpExpiresAt,
      status: 'pending',
    });

    const savedRequest = await this.redemptionRepository.save(request);

    this.logger.log(`Redemption request created: ${savedRequest.id}`);
    this.logger.log(`OTP: ${otp} (expires at ${otpExpiresAt.toISOString()})`);
    this.logger.log('=== END CREATE REDEMPTION REQUEST ===\n');

    // In production, send OTP via SMS/Email instead of returning it
    return {
      requestId: savedRequest.id,
      otp, // For demo purposes only - remove in production
      expiresAt: otpExpiresAt,
    };
  }

  /**
   * Member approves redemption request using OTP
   */
  async approveRedemptionRequest(
    memberId: string,
    requestId: string,
    otp: string,
  ): Promise<{ success: boolean; newBalance: number; transactionId: string }> {
    this.logger.log('=== APPROVE REDEMPTION REQUEST ===');
    this.logger.log(`Member ID: ${memberId}`);
    this.logger.log(`Request ID: ${requestId}`);
    this.logger.log(`OTP: ${otp}`);

    // Find redemption request
    const request = await this.redemptionRepository.findOne({
      where: { id: requestId },
      relations: ['member', 'client'],
    });

    if (!request) {
      this.logger.warn(`Redemption request not found: ${requestId}`);
      throw new NotFoundException('Redemption request not found');
    }

    this.logger.debug(`Request found: ${request.id}, Status: ${request.status}`);

    // Validate member owns this request
    if (request.memberId !== memberId) {
      this.logger.warn(`Member ID mismatch. Expected: ${request.memberId}, Got: ${memberId}`);
      throw new BadRequestException('This redemption request does not belong to you');
    }

    // Check if already processed
    if (request.status !== 'pending') {
      this.logger.warn(`Request already processed. Status: ${request.status}`);
      throw new BadRequestException(`Redemption request is already ${request.status}`);
    }

    // Check if OTP expired
    if (request.otpExpiresAt < new Date()) {
      request.status = 'expired';
      await this.redemptionRepository.save(request);
      this.logger.warn('OTP has expired');
      throw new BadRequestException('OTP has expired. Please request a new redemption.');
    }

    // Validate OTP
    if (request.otp !== otp) {
      this.logger.warn('Invalid OTP provided');
      throw new BadRequestException('Invalid OTP');
    }

    this.logger.debug('OTP validated successfully');

    // Check current points balance
    const currentPoints = parseFloat(request.member.points.toString());
    if (currentPoints < parseFloat(request.amount.toString())) {
      request.status = 'rejected';
      await this.redemptionRepository.save(request);
      this.logger.warn(`Insufficient points at approval time. Has: ${currentPoints}, Needs: ${request.amount}`);
      throw new BadRequestException(`Insufficient points. You have ${currentPoints} points but need ${request.amount}`);
    }

    // Deduct points
    request.member.points = currentPoints - parseFloat(request.amount.toString());
    await this.memberRepository.save(request.member);

    // Mark request as approved
    request.status = 'approved';
    request.completedAt = new Date();
    await this.redemptionRepository.save(request);

    // Create unified transaction record
    const transaction = this.transactionRepository.create({
      memberId: request.member.id,
      member: request.member,
      clientId: request.client.clientId,
      client: request.client,
      type: 'debit',
      method: 'otp_approval',
      amount: parseFloat(request.amount.toString()),
      description: request.description,
      status: 'approved',
      completedAt: request.completedAt,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    this.logger.log(`Redemption approved. Points deducted: ${request.amount}`);
    this.logger.log(`New balance: ${request.member.points}`);
    this.logger.log(`Transaction ID: ${savedTransaction.id}`);
    this.logger.log('=== END APPROVE REDEMPTION ===\n');

    return {
      success: true,
      newBalance: parseFloat(request.member.points.toString()),
      transactionId: savedTransaction.id,
    };
  }

  /**
   * Member rejects redemption request
   */
  async rejectRedemptionRequest(memberId: string, requestId: string): Promise<{ success: boolean }> {
    this.logger.log('=== REJECT REDEMPTION REQUEST ===');
    this.logger.log(`Member ID: ${memberId}`);
    this.logger.log(`Request ID: ${requestId}`);

    const request = await this.redemptionRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      this.logger.warn(`Redemption request not found: ${requestId}`);
      throw new NotFoundException('Redemption request not found');
    }

    if (request.memberId !== memberId) {
      this.logger.warn(`Member ID mismatch`);
      throw new BadRequestException('This redemption request does not belong to you');
    }

    if (request.status !== 'pending') {
      this.logger.warn(`Request already processed. Status: ${request.status}`);
      throw new BadRequestException(`Redemption request is already ${request.status}`);
    }

    request.status = 'rejected';
    request.completedAt = new Date();
    await this.redemptionRepository.save(request);

    this.logger.log('Redemption request rejected by member');
    this.logger.log('=== END REJECT REDEMPTION ===\n');

    return { success: true };
  }

  /**
   * Get pending redemption requests for a member
   */
  async getPendingRequests(memberId: string): Promise<RedemptionRequest[]> {
    this.logger.debug(`Getting pending redemption requests for member: ${memberId}`);

    const requests = await this.redemptionRepository.find({
      where: { memberId, status: 'pending' },
      relations: ['client'],
      order: { createdAt: 'DESC' },
    });

    this.logger.debug(`Found ${requests.length} pending requests`);

    return requests;
  }

  /**
   * Credit/Reward points using client credentials (B2B only)
   * Partner rewards member using client_id/secret + member_id
   * This is the ONLY way to credit points - no member token accepted
   */
  async creditPointsWithClientCredentials(
    clientId: string,
    clientSecret: string,
    memberId: string,
    amount: number,
    description?: string,
    reason?: string,
  ): Promise<{ success: boolean; newBalance: number; transactionId: string }> {
    this.logger.log('=== CREDIT POINTS WITH CLIENT CREDENTIALS ===');
    this.logger.log(`Client ID: ${clientId}`);
    this.logger.log(`Member ID: ${memberId}`);
    this.logger.log(`Amount: ${amount} points`);
    this.logger.log(`Description: ${description || 'none'}`);
    this.logger.log(`Reason: ${reason || 'none'}`);

    // Validate client credentials
    const client = await this.clientRepository.findOne({
      where: { clientId, active: true },
    });

    if (!client) {
      this.logger.warn(`Client not found: ${clientId}`);
      throw new NotFoundException('Client not found');
    }

    if (client.clientSecret !== clientSecret) {
      this.logger.warn(`Invalid client secret for client: ${clientId}`);
      throw new BadRequestException('Invalid client credentials');
    }

    this.logger.debug(`Client validated: ${client.clientName}`);

    // Validate member exists
    const member = await this.memberRepository.findOne({
      where: { id: memberId, active: true },
    });

    if (!member) {
      this.logger.warn(`Member not found: ${memberId}`);
      throw new NotFoundException('Member not found');
    }

    this.logger.debug(`Member validated: ${member.email}`);

    // Validate amount
    if (amount <= 0) {
      this.logger.warn('Invalid credit amount (must be positive)');
      throw new BadRequestException('Credit amount must be positive');
    }

    // Add points
    const currentPoints = parseFloat(member.points.toString());
    member.points = currentPoints + amount;
    await this.memberRepository.save(member);

    // Create unified transaction record
    const transaction = this.transactionRepository.create({
      memberId: member.id,
      member,
      clientId: client.clientId,
      client,
      type: 'credit',
      method: reason || 'partner_credit',
      amount,
      description,
      status: null, // Credits are instant
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    this.logger.log(`Points credited successfully. New balance: ${member.points}`);
    this.logger.log(`Transaction ID: ${savedTransaction.id}`);
    this.logger.log('=== END CREDIT POINTS ===\n');

    return {
      success: true,
      newBalance: parseFloat(member.points.toString()),
      transactionId: savedTransaction.id,
    };
  }

  /**
   * Cleanup expired redemption requests
   */
  async cleanupExpiredRequests(): Promise<void> {
    const now = new Date();

    const expiredRequests = await this.redemptionRepository.find({
      where: {
        status: 'pending',
        otpExpiresAt: LessThan(now),
      },
    });

    for (const request of expiredRequests) {
      request.status = 'expired';
      await this.redemptionRepository.save(request);
    }

    this.logger.debug(`Marked ${expiredRequests.length} redemption requests as expired`);
  }
}
