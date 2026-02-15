#!/usr/bin/env node

const { createHmac } = require('crypto');

function normalizeEmailAddress(input) {
  return String(input || '')
    .trim()
    .toLowerCase();
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }
    parsed[key] = value;
    i += 1;
  }
  return parsed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const signingKey =
    args.key || process.env.MAILZEN_INBOUND_WEBHOOK_SIGNING_KEY || '';
  if (!signingKey) {
    console.error(
      'Missing signing key. Set MAILZEN_INBOUND_WEBHOOK_SIGNING_KEY or pass --key "<value>".',
    );
    process.exit(1);
  }

  const mailboxEmail = normalizeEmailAddress(args.mailboxEmail);
  const from = normalizeEmailAddress(args.from);
  const messageId = String(args.messageId || '').trim();
  const subject = String(args.subject || '').trim();
  const timestamp = String(args.timestamp || Date.now());

  if (!mailboxEmail || !from) {
    console.error(
      'Missing required fields. Usage: --mailboxEmail "<alias@mailzen.com>" --from "<sender@example.com>" [--messageId "..."] [--subject "..."] [--timestamp "..."]',
    );
    process.exit(1);
  }

  const payloadDigest = [mailboxEmail, from, messageId, subject].join('.');
  const signature = createHmac('sha256', signingKey)
    .update(`${timestamp}.${payloadDigest}`)
    .digest('hex');

  const output = {
    timestamp,
    payloadDigest,
    signature,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
