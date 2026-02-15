import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import { MailboxInboundWebhookInput } from './dto/mailbox-inbound-webhook.input';
import { MailboxInboundService } from './mailbox-inbound.service';

@Controller('mailbox/inbound')
export class MailboxInboundController {
  constructor(private readonly mailboxInboundService: MailboxInboundService) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async receiveInboundEvent(
    @Body() input: MailboxInboundWebhookInput,
    @Headers('x-mailzen-inbound-token') inboundTokenHeader: string | undefined,
    @Headers('x-mailzen-inbound-signature')
    signatureHeader: string | undefined,
    @Headers('x-mailzen-inbound-timestamp')
    timestampHeader: string | undefined,
    @Headers('authorization') authorizationHeader: string | undefined,
    @Headers('x-request-id') requestIdHeader: string | undefined,
    @Ip() ipAddress: string,
  ) {
    return this.mailboxInboundService.ingestInboundEvent(input, {
      requestIdHeader,
      inboundTokenHeader,
      signatureHeader,
      timestampHeader,
      authorizationHeader,
      sourceIp: ipAddress,
    });
  }
}
