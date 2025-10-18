import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { OAuthClient } from '../entities/oauth-client.entity';
import { CreateOAuthClientDto } from './dto/create-oauth-client.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(OAuthClient)
    private clientRepository: Repository<OAuthClient>
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
    return this.clientRepository.findOne({ where: { id } });
  }

  async deactivateClient(id: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({ where: { id } });
    client.active = false;
    return this.clientRepository.save(client);
  }

  async activateClient(id: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({ where: { id } });
    client.active = true;
    return this.clientRepository.save(client);
  }
}
