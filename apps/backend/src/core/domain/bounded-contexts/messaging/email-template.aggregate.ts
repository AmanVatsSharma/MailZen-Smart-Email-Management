/**
 * File:        apps/backend/src/core/domain/bounded-contexts/messaging/email-template.aggregate.ts
 * Module:      Core · Domain · Messaging
 * Purpose:     EmailTemplate aggregate. Stores a reusable subject + body
 *              template; supports {{variable}} interpolation via render().
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { AggregateRoot } from '../../shared/aggregate-root';
import { Result, makeResult } from '../../shared/result';
import { UserId } from '../../shared/value-objects/ids';

export interface EmailTemplateProps {
  id: string;
  ownerUserId: UserId;
  name: string;
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailTemplate extends AggregateRoot<EmailTemplateProps> {
  private constructor(props: EmailTemplateProps) {
    super(props);
  }

  static create(input: {
    id: string;
    ownerUserId: UserId;
    name: string;
    subject: string;
    body: string;
  }): Result<EmailTemplate, Error> {
    if (input.name.trim().length === 0) {
      return makeResult(Result.err(new Error('template name is required')));
    }
    return makeResult(Result.ok(new EmailTemplate({
      id: input.id,
      ownerUserId: input.ownerUserId,
      name: input.name,
      subject: input.subject,
      body: input.body,
      createdAt: new Date(),
      updatedAt: new Date(),
    })));
  }

static reconstitute(props: EmailTemplateProps): EmailTemplate { return EmailTemplate.rehydrate(props); }
  static rehydrate(emailtemplateprops: EmailTemplateProps): EmailTemplate {
    return new EmailTemplate(props);
  }

  rename(name: string): void {
    this.props.name = name;
    this.props.updatedAt = new Date();
  }

  updateContent(subject: string, body: string): void {
    this.props.subject = subject;
    this.props.body = body;
    this.props.updatedAt = new Date();
  }

  render(variables: Readonly<Record<string, unknown>>): { subject: string; body: string } {
    const subject = interpolate(this.props.subject, variables);
    const body = interpolate(this.props.body, variables);
    return { subject, body };
  }

  get name(): string { return this.props.name; }
}

function interpolate(template: string, variables: Readonly<Record<string, unknown>>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = lookup(variables, key);
    return value === undefined ? '' : String(value);
  });
}

function lookup(vars: Readonly<Record<string, unknown>>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, vars);
}
