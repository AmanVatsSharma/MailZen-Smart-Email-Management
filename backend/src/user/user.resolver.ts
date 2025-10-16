import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { User } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UserService } from './user.service';
import { UpdateUserInput } from './dto/update-user.input';

@Resolver(() => User)
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query(() => [User])
  async users(): Promise<User[]> {
    return this.userService.getAllUsers();
  }

  @Query(() => User, { nullable: true })
  async user(@Args('id', { type: () => ID }) id: string): Promise<User> {
    return this.userService.getUser(id);
  }

  @Mutation(() => User)
  async createUser(@Args('createUserInput') createUserInput: CreateUserInput): Promise<User> {
    return this.userService.createUser(createUserInput);
  }

  @Mutation(() => User)
  async updateUser(@Args('updateUserInput') updateUserInput: UpdateUserInput): Promise<User> {
    return this.userService.updateUser(updateUserInput);
  }
}