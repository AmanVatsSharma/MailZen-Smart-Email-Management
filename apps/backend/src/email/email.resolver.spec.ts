/**
 * File:        apps/backend/src/email/email.resolver.spec.ts
 * Module:      Email · GraphQL Resolver · Tests
 * Purpose:     Unit tests for EmailResolver verifying that mutations and queries
 *              correctly forward the authenticated user ID and delegate to services.
 *
 * Exports:
 *   - none (Jest test suite)
 *
 * Depends on:
 *   - ./email.resolver    — unit under test
 *   - ./email.service     — mocked
 *   - ./mail.service      — mocked
 *
 * Side-effects:
 *   - none (all services are mocked)
 *
 * Key invariants:
 *   - Resolver is instantiated directly (no NestJS DI) — mocks are passed via constructor
 *   - userRepo mock has a findOne that returns null by default (safe for unsubscribe test)
 *
 * Read order:
 *   1. mock setup  — service stubs
 *   2. test cases  — markEmailRead → sendRealEmail → unsubscribeFromSender
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { MailService } from './mail.service';
import { EmailService } from './email.service';
import { EmailResolver } from './email.resolver';

describe('EmailResolver', () => {
  const emailService = {
    getEmailsByUser: jest.fn(),
    getEmailById: jest.fn(),
    sendEmail: jest.fn(),
    markEmailRead: jest.fn(),
    unsubscribeFromSender: jest.fn(),
  };
  const mailService = {
    sendRealEmail: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
  } as unknown as Repository<User>;

  const resolver = new EmailResolver(
    emailService as unknown as EmailService,
    mailService as unknown as MailService,
    userRepo,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards authenticated user id when marking email read', async () => {
    emailService.markEmailRead.mockResolvedValue({
      id: 'email-1',
      status: 'READ',
    });

    const result = await resolver.markEmailRead(
      { emailId: 'email-1' } as never,
      {
        req: {
          user: {
            id: 'user-1',
          },
        },
      } as never,
    );

    expect(emailService.markEmailRead).toHaveBeenCalledWith('email-1', 'user-1');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'email-1',
      }),
    );
  });

  it('forwards authenticated user id when sending real email', async () => {
    mailService.sendRealEmail.mockResolvedValue({
      messageId: 'msg-1',
      accepted: ['one@mailzen.com'],
      rejected: [],
    });

    const result = await resolver.sendRealEmail(
      {
        senderId: 'sender-1',
        subject: 'Hello',
        body: 'Body',
        recipientIds: ['one@mailzen.com'],
      } as never,
      {
        req: {
          user: {
            id: 'user-2',
          },
        },
      } as never,
    );

    expect(mailService.sendRealEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: 'sender-1',
      }),
      'user-2',
    );
    expect(result).toEqual(
      expect.objectContaining({
        messageId: 'msg-1',
      }),
    );
  });

  it('forwards authenticated user id to unsubscribeFromSender', async () => {
    emailService.unsubscribeFromSender.mockResolvedValue({
      success: true,
      senderEmail: 'newsletter@example.com',
    });

    const result = await resolver.unsubscribeFromSender('email-9', {
      req: { user: { id: 'user-3' } },
    } as never);

    expect(emailService.unsubscribeFromSender).toHaveBeenCalledWith(
      'email-9',
      'user-3',
    );
    expect(result).toEqual({
      success: true,
      senderEmail: 'newsletter@example.com',
    });
  });
});
