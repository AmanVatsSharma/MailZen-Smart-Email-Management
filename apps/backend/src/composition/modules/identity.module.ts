// apps/backend/src/composition/modules/identity.module.ts
// Composition for the identity bounded context.
// Wires the identity ports to their TypeORM / crypto / OAuth adapters.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UserOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/user.orm-entity';
import { SessionOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/session.orm-entity';
import { TypeOrmUserRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-user.repository';
import { USER_REPOSITORY } from '../../core/application/ports/repositories/user.repository';
import { EVENT_BUS } from '../../core/application/ports/event-bus/event-bus';
import { UNIT_OF_WORK } from '../../core/application/ports/persistence/unit-of-work';
import { JWT_GATEWAY } from '../../core/application/ports/gateways/jwt.gateway';
import { PASSWORD_HASHER } from '../../core/application/ports/gateways/password-hasher.gateway';
import { OAUTH_GATEWAY } from '../../core/application/ports/gateways/oauth.gateway';
import { TypeOrmUnitOfWork } from '../../core/infrastructure/persistence/typeorm/typeorm-unit-of-work';
import { JwtTokenService } from '../../core/infrastructure/crypto/jwt-token.service';
import { Argon2Hasher } from '../../core/infrastructure/crypto/argon2-hasher';
import { GoogleOAuthGateway } from '../../core/infrastructure/external-services/oauth/google-oauth.gateway';
import { MicrosoftOAuthGateway } from '../../core/infrastructure/external-services/oauth/microsoft-oauth.gateway';
import { InProcessEventBus } from '../../interfaces/event-bus/in-process-event-bus';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity, SessionOrmEntity]),
    JwtModule.register({}), // options bound per-token via JwtTokenService
  ],
  providers: [
    // Port -> Adapter bindings
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: EVENT_BUS, useClass: InProcessEventBus },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: JWT_GATEWAY, useClass: JwtTokenService },
    { provide: PASSWORD_HASHER, useClass: Argon2Hasher },
    { provide: OAUTH_GATEWAY, useClass: GoogleOAuthGateway }, // Microsoft gateway reuses same interface
    MicrosoftOAuthGateway,
    // Global JWT guard
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [USER_REPOSITORY, EVENT_BUS, UNIT_OF_WORK, JWT_GATEWAY, PASSWORD_HASHER, OAUTH_GATEWAY],
})
export class IdentityModule {}
