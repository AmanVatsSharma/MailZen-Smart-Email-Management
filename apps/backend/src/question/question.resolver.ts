import { Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Resolver()
@UseGuards(JwtAuthGuard)
export class QuestionResolver {
  @Query(() => String, {
    description:
      'Temporary status endpoint while Question module domain entities are being designed.',
  })
  questionModuleStatus(): string {
    return 'Question module is parked for a future domain implementation.';
  }
}
