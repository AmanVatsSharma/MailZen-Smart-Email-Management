import { BadRequestException, Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { User as PrismaUser } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeUser(prismaUser: PrismaUser): User {
    return {
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name ?? undefined,
      emailsSent: [],
    };
  }

  async createUser(createUserInput: CreateUserInput): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email: createUserInput.email } });
    if (existing) {
      throw new BadRequestException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(createUserInput.password, 10);
    const created = await this.prisma.user.create({
      data: {
        email: createUserInput.email,
        name: createUserInput.name ?? null,
        password: hashedPassword,
      },
    });
    return this.sanitizeUser(created);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }
    return this.sanitizeUser(user);
  }

  async getUser(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new Error(`User with id ${id} not found.`);
    }
    return this.sanitizeUser(user);
  }

  async getAllUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany();
    return users.map((u) => this.sanitizeUser(u));
  }

  async updateUser(updateUserInput: UpdateUserInput): Promise<User> {
    const updated = await this.prisma.user.update({
      where: { id: updateUserInput.id },
      data: {
        email: updateUserInput.email ?? undefined,
        name: updateUserInput.name ?? undefined,
      },
    });
    return this.sanitizeUser(updated);
  }
}