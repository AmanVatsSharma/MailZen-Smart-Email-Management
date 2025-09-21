import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>
  ) {}

  private stripPassword(user: User): User {
    const { password, ...rest } = user;
    return rest as User;
  }

  async createUser(createUserInput: CreateUserInput): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: createUserInput.email } });
    if (existing) {
      throw new BadRequestException('Email is already registered');
    }
    const hashedPassword = await bcrypt.hash(createUserInput.password, 10);
    const toCreate = this.userRepo.create({
      email: createUserInput.email,
      name: createUserInput.name ?? null,
      password: hashedPassword,
      role: 'USER',
    });
    const created = await this.userRepo.save(toCreate);
    return this.stripPassword(created);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) return null;
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;
    return this.stripPassword(user);
  }

  async getUser(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new Error(`User with id ${id} not found.`);
    return this.stripPassword(user);
  }

  async getAllUsers(): Promise<User[]> {
    const users = await this.userRepo.find();
    return users.map((u) => this.stripPassword(u));
  }

  async updateUser(updateUserInput: UpdateUserInput): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: updateUserInput.id } });
    if (!user) throw new Error(`User with id ${updateUserInput.id} not found.`);
    if (updateUserInput.email !== undefined) user.email = updateUserInput.email;
    if (updateUserInput.name !== undefined) user.name = updateUserInput.name;
    const saved = await this.userRepo.save(user);
    return this.stripPassword(saved);
  }
}