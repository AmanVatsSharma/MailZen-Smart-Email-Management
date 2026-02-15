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
    @Headers('authorization') authorizationHeader: string | undefined,
    @Ip() ipAddress: string,
  ) {
    return this.mailboxInboundService.ingestInboundEvent(input, {
      inboundTokenHeader,
      authorizationHeader,
      sourceIp: ipAddress,
    });
  }
}
