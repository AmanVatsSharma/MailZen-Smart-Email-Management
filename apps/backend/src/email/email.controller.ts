import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('track/:emailId/open')
  async trackOpen(@Param('emailId') emailId: string, @Res() res: Response) {
    await this.emailService.trackOpen(emailId);

    // Return a 1x1 transparent GIF
    const transparentPixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64',
    );
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': transparentPixel.length,
    });
    res.end(transparentPixel);
  }

  @Get('track/:emailId/click')
  async trackClick(
    @Param('emailId') emailId: string,
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    await this.emailService.trackClick(emailId);
    res.redirect(url);
  }
}
