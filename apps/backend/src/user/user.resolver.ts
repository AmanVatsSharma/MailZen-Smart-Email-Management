import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { User } from './entities/user.entity';
import { AccountDataExportResponse } from './dto/account-data-export.response';
import { CreateUserInput } from './dto/create-user.input';
import { UserService } from './user.service';
import { UpdateUserInput } from './dto/update-user.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Resolver(() => User)
@UseGuards(JwtAuthGuard)
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query(() => AccountDataExportResponse)
  async myAccountDataExport(
    @Context() context: { req: { user: { id: string } } },
  ): Promise<AccountDataExportResponse> {
    return this.userService.exportUserDataSnapshot(context.req.user.id);
  }

  @Query(() => AccountDataExportResponse)
  @UseGuards(AdminGuard)
  async userAccountDataExport(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: { req: { user: { id: string } } },
  ): Promise<AccountDataExportResponse> {
    return this.userService.exportUserDataSnapshotForAdmin({
      targetUserId: id,
      actorUserId: context.req.user.id,
    });
  }

  @Query(() => [User])
  @UseGuards(AdminGuard)
  async users(): Promise<User[]> {
    return this.userService.getAllUsers();
  }

  @Query(() => User, { nullable: true })
  @UseGuards(AdminGuard)
  async user(@Args('id', { type: () => ID }) id: string): Promise<User> {
    return this.userService.getUser(id);
  }

  @Mutation(() => User)
  @UseGuards(AdminGuard)
  async createUser(
    @Args('createUserInput') createUserInput: CreateUserInput,
  ): Promise<User> {
    return this.userService.createUser(createUserInput);
  }

  @Mutation(() => User)
  @UseGuards(AdminGuard)
  async updateUser(
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
  ): Promise<User> {
    return this.userService.updateUser(updateUserInput);
  }
}
