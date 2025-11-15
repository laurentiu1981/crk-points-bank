import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { OAuthClient } from '../entities/oauth-client.entity';
import { Member } from '../entities/member.entity';
import { RedemptionRequest } from '../entities/redemption-request.entity';
import { CreateOAuthClientDto } from './dto/create-oauth-client.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(OAuthClient)
    private clientRepository: Repository<OAuthClient>,
    @InjectRepository(Member)
    private memberRepository: Repository<Member>,
    @InjectRepository(RedemptionRequest)
    private redemptionRepository: Repository<RedemptionRequest>
  ) {}

  async createOAuthClient(
    createDto: CreateOAuthClientDto
  ): Promise<OAuthClient> {
    const clientId = randomBytes(16).toString('hex');
    const clientSecret = randomBytes(32).toString('hex');

    const client = this.clientRepository.create({
      clientId,
      clientSecret,
      clientName: createDto.clientName,
      redirectUris: createDto.redirectUris,
      allowedGrants: createDto.allowedGrants || [
        'authorization_code',
        'refresh_token',
      ],
      allowedScopes: createDto.allowedScopes || ['profile', 'points'],
      description: createDto.description,
      logoUrl: createDto.logoUrl,
      active: true,
    });

    return this.clientRepository.save(client);
  }

  async getAllClients(): Promise<OAuthClient[]> {
    return this.clientRepository.find();
  }

  async getClientById(id: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({ where: { clientId: id } });
    if (!client) {
      throw new NotFoundException('OAuth client not found');
    }
    return client;
  }

  async deactivateClient(id: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({ where: { clientId: id } });
    if (!client) {
      throw new NotFoundException('OAuth client not found');
    }
    client.active = false;
    return this.clientRepository.save(client);
  }

  async activateClient(id: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({ where: { clientId: id } });
    if (!client) {
      throw new NotFoundException('OAuth client not found');
    }
    client.active = true;
    return this.clientRepository.save(client);
  }

  async getAllMembers(): Promise<Member[]> {
    return this.memberRepository.find({
      where: { active: true },
      select: ['id', 'email', 'firstName', 'lastName', 'points'],
      order: { email: 'ASC' },
    });
  }

  /**
   * Get all pending redemption requests (for simulation dashboard)
   */
  async getPendingRedemptionRequests(): Promise<any[]> {
    const requests = await this.redemptionRepository.find({
      where: { status: 'pending' },
      relations: ['member', 'client'],
      order: { createdAt: 'DESC' },
    });

    return requests.map((request) => ({
      requestId: request.id,
      memberId: request.member.id,
      memberEmail: request.member.email,
      memberName: `${request.member.firstName} ${request.member.lastName}`,
      amount: request.amount,
      description: request.description,
      partnerName: request.client.clientName,
      otp: request.otp,
      createdAt: request.createdAt,
      expiresAt: request.otpExpiresAt,
    }));
  }

  /**
   * Approve redemption request (simulating member approval from simulation dashboard)
   */
  async approveRedemptionRequest(
    requestId: string,
    memberId: string,
    otp: string
  ): Promise<any> {
    const request = await this.redemptionRepository.findOne({
      where: { id: requestId },
      relations: ['member', 'client'],
    });

    if (!request) {
      throw new NotFoundException('Redemption request not found');
    }

    if (request.member.id !== memberId) {
      throw new BadRequestException('Request does not belong to this member');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    // Check if OTP expired
    if (new Date() > request.otpExpiresAt) {
      request.status = 'expired';
      await this.redemptionRepository.save(request);
      throw new BadRequestException('OTP has expired');
    }

    // Validate OTP
    if (request.otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    // Check if member has enough points
    const member = request.member;
    const currentPoints = parseFloat(member.points.toString());
    if (currentPoints < request.amount) {
      throw new BadRequestException('Insufficient points');
    }

    // Deduct points
    member.points = currentPoints - request.amount;
    await this.memberRepository.save(member);

    // Mark request as approved
    request.status = 'approved';
    await this.redemptionRepository.save(request);

    return {
      success: true,
      newBalance: parseFloat(member.points.toString()),
      redeemedAmount: request.amount,
    };
  }

  /**
   * Reject redemption request (simulating member rejection from simulation dashboard)
   */
  async rejectRedemptionRequest(
    requestId: string,
    memberId: string
  ): Promise<any> {
    const request = await this.redemptionRepository.findOne({
      where: { id: requestId },
      relations: ['member'],
    });

    if (!request) {
      throw new NotFoundException('Redemption request not found');
    }

    if (request.member.id !== memberId) {
      throw new BadRequestException('Request does not belong to this member');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    // Mark request as rejected
    request.status = 'rejected';
    await this.redemptionRepository.save(request);

    return {
      success: true,
      message: 'Redemption request rejected',
    };
  }
}
