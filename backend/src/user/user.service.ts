import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  private users: User[] = [];
  private idCounter = 1;

  async createUser(createUserInput: CreateUserInput): Promise<User> {
    // Hash the password
    const hashedPassword = await bcrypt.hash(createUserInput.password, 10);
    
    const user: User = {
      id: String(this.idCounter++),
      email: createUserInput.email,
      name: createUserInput.name || '',
      password: hashedPassword, // Store hashed password
      emailsSent: [],
    };
    
    this.users.push(user);
    
    // Return user without password
    const { password, ...result } = user;
    return result as User;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = this.users.find(u => u.email === email);
    if (!user) {
      return null;
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }
    
    // Return user without password
    const { password: _, ...result } = user;
    return result as User;
  }

  getUser(id: string): User {
    const user = this.users.find(u => u.id === id);
    if (!user) {
      throw new Error(`User with id ${id} not found.`);
    }
    
    // Return user without password
    const { password, ...result } = user;
    return result as User;
  }

  getAllUsers(): User[] {
    // Return users without passwords
    return this.users.map(user => {
      const { password, ...result } = user;
      return result as User;
    });
  }

  updateUser(updateUserInput: UpdateUserInput): User {
    const userIndex = this.users.findIndex(u => u.id === updateUserInput.id);
    if (userIndex < 0) {
      throw new Error(`User with id ${updateUserInput.id} not found.`);
    }
    
    const user = this.users[userIndex];
    
    if (updateUserInput.email !== undefined) {
      user.email = updateUserInput.email;
    }
    
    if (updateUserInput.name !== undefined) {
      user.name = updateUserInput.name;
    }
    
    this.users[userIndex] = user;
    
    // Return user without password
    const { password, ...result } = user;
    return result as User;
  }
}