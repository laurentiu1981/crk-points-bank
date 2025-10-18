import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Member } from '../entities/member.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Member)
    private memberRepository: Repository<Member>,
    private jwtService: JwtService
  ) {}

  async register(registerDto: RegisterDto): Promise<Member> {
    const existingMember = await this.memberRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingMember) {
      throw new ConflictException('Email already registered');
    }

    const member = this.memberRepository.create({
      ...registerDto,
      points: 0,
      active: true,
    });

    return this.memberRepository.save(member);
  }

  async validateMember(email: string, password: string): Promise<Member> {
    const member = await this.memberRepository.findOne({
      where: { email },
    });

    if (!member || !member.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await member.validatePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return member;
  }

  async login(member: Member) {
    const payload = {
      email: member.email,
      sub: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
    };

    return {
      access_token: this.jwtService.sign(payload),
      member: {
        id: member.id,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        points: member.points,
      },
    };
  }

  async findById(id: string): Promise<Member> {
    return this.memberRepository.findOne({ where: { id } });
  }
}
