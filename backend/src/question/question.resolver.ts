import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Question } from './entities/question.entity';
import { CreateQuestionInput } from './dto/create-question.input';
import { QuestionService } from './question.service';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { CreatorGuard } from '../common/guards/creator.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Resolver(() => Question)
@UseGuards(JwtAuthGuard, ActiveUserGuard) // All endpoints require JWT authentication and active user.
export class QuestionResolver {
  constructor(private readonly questionService: QuestionService) {}

  @Mutation(() => Question)
  @SetMetadata('roles', ['CREATOR'])
  @UseGuards(CreatorGuard)
  createQuestion(
    @Args('createQuestionInput') createQuestionInput: CreateQuestionInput,
    @Context() context: any,
  ): Question {
    const user = context.req.user;
    return this.questionService.createQuestion(createQuestionInput, user.id);
  }

  @Query(() => [Question])
  getMyQuestions(@Context() context: any): Question[] {
    const user = context.req.user;
    return this.questionService.getQuestionsByAuthor(user.id);
  }

  @Mutation(() => Question)
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(AdminGuard)
  deleteQuestion(@Args('id') id: string): Question {
    return this.questionService.deleteQuestion(id);
  }
} 