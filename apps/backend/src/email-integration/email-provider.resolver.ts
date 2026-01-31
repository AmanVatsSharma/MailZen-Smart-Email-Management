import { Resolver, Mutation, Args, Query, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailProviderService } from './email-provider.service';
import { EmailProviderInput } from './dto/email-provider.input';
import { DeleteProviderInput } from './dto/delete-provider.input';
import { EmailProvider } from './entities/email-provider.entity';
import { Email } from '../email/entities/email.entity';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => EmailProvider)
@UseGuards(JwtAuthGuard)
export class EmailProviderResolver {
  constructor(private readonly emailProviderService: EmailProviderService) {}

  @Mutation(() => EmailProvider)
  async configureEmailProvider(
    @Args('providerInput') providerInput: EmailProviderInput,
    @Context() context: RequestContext
  ) {
    return this.emailProviderService.configureProvider(
      providerInput, 
      context.req.user.id
    );
  }

  @Query(() => [Email])
  async getProviderEmails(
    @Args('providerId') providerId: string,
    @Context() context: RequestContext
  ) {
    return this.emailProviderService.getProviderEmails(
      providerId, 
      context.req.user.id
    );
  }

  @Query(() => [EmailProvider])
  async getAllProviders(
    @Context() context: RequestContext
  ) {
    return this.emailProviderService.getAllProviders(
      context.req.user.id
    );
  }

  @Query(() => EmailProvider)
  async getProviderById(
    @Args('id') id: string,
    @Context() context: RequestContext
  ) {
    return this.emailProviderService.getProviderById(
      id, 
      context.req.user.id
    );
  }

  @Mutation(() => Boolean)
  async deleteProvider(
    @Args('input') input: DeleteProviderInput,
    @Context() context: RequestContext
  ) {
    return this.emailProviderService.deleteProvider(
      input.id, 
      context.req.user.id
    );
  }

  @Mutation(() => EmailProvider)
  async updateProviderCredentials(
    @Args('id') id: string,
    @Args('input') input: EmailProviderInput,
    @Context() context: RequestContext
  ) {
    return this.emailProviderService.updateProviderCredentials(
      id, 
      input, 
      context.req.user.id
    );
  }

  @Query(() => Boolean)
  async validateProvider(
    @Args('id') id: string,
    @Context() context: RequestContext
  ) {
    const result = await this.emailProviderService.validateProvider(
      id, 
      context.req.user.id
    );
    return result.valid;
  }
} 