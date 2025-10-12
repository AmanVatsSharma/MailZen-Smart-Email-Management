import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { User } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(createUserInput: CreateUserInput): Promise<User> {
    const normalizedEmail = createUserInput.email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(createUserInput.password, 12);
    const created = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        email: normalizedEmail,
        name: createUserInput.name || null,
        password: hashedPassword,
      },
    });

    return { id: created.id, email: created.email, name: created.name ?? undefined } as User;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const dbUser = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!dbUser || !dbUser.password) return null;

    const isPasswordValid = await bcrypt.compare(password, dbUser.password);
    if (!isPasswordValid) return null;

    await this.prisma.user.update({
      where: { id: dbUser.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0 },
    });

    return { id: dbUser.id, email: dbUser.email, name: dbUser.name ?? undefined } as User;
  }

  getUser = async (id: string): Promise<User> => {
    const dbUser = await this.prisma.user.findUnique({ where: { id } });
    if (!dbUser) throw new NotFoundException(`User with id ${id} not found.`);
    return { id: dbUser.id, email: dbUser.email, name: dbUser.name ?? undefined } as User;
  };

  async getAllUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany();
    return users.map(u => ({ id: u.id, email: u.email, name: u.name ?? undefined } as User));
  }

  async updateUser(updateUserInput: UpdateUserInput): Promise<User> {
    const dbUser = await this.prisma.user.update({
      where: { id: updateUserInput.id },
      data: {
        email: updateUserInput.email?.trim().toLowerCase(),
        name: updateUserInput.name,
      },
    });
    return { id: dbUser.id, email: dbUser.email, name: dbUser.name ?? undefined } as User;
  }
}