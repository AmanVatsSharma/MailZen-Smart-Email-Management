/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-tracking-event.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter for TrackingEvent repository (open/click/unsubscribe events).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ITrackingEventRepository } from '../../../application/ports/repositories/tracking-event.repository';
import { TrackingEvent } from '../../../../domain/bounded-contexts/email-analytics/tracking-event.aggregate';
import { Result } from '../../../../domain/shared/result';
import { TrackingEventOrmEntity } from '../entities/tracking-event.orm-entity';
import { TrackingLinkOrmEntity } from '../entities/tracking-link.orm-entity';
import { TrackingPixelOrmEntity } from '../entities/tracking-pixel.orm-entity';

@Injectable()
export class TypeOrmTrackingEventRepository implements ITrackingEventRepository {
  constructor(
    @InjectRepository(TrackingEventOrmEntity)
    private readonly repo: Repository<TrackingEventOrmEntity>,
    @InjectRepository(TrackingLinkOrmEntity)
    private readonly linkRepo: Repository<TrackingLinkOrmEntity>,
    @InjectRepository(TrackingPixelOrmEntity)
    private readonly pixelRepo: Repository<TrackingPixelOrmEntity>,
  ) {}

  async save(event: TrackingEvent): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(event);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async listForEmail(emailId: string): Promise<TrackingEvent[]> {
    const rows = await this.repo.find({ where: { emailId }, order: { occurredAt: 'DESC' } });
    return rows.map(r => this.toDomain(r));
  }

  async countOpens(emailId: string): Promise<number> {
    return this.repo.count({ where: { emailId, kind: 'open' } });
  }

  async countClicks(emailId: string): Promise<number> {
    return this.repo.count({ where: { emailId, kind: 'click' } });
  }

  private toOrm(e: TrackingEvent): TrackingEventOrmEntity {
    const orm = new TrackingEventOrmEntity();
    orm.id = e.id;
    orm.emailId = e.props.emailId;
    orm.recipientEmail = e.props.recipientEmail;
    orm.kind = e.props.kind;
    orm.linkUrl = e.props.linkUrl;
    orm.userAgent = e.props.userAgent;
    orm.ipAddress = e.props.ipAddress;
    orm.occurredAt = e.props.occurredAt;
    return orm;
  }

  private toDomain(row: TrackingEventOrmEntity): TrackingEvent {
    return TrackingEvent.reconstitute({
      id: row.id,
      emailId: row.emailId,
      recipientEmail: row.recipientEmail,
      kind: row.kind as never,
      linkUrl: row.linkUrl,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      occurredAt: row.occurredAt,
    });
  }
}
