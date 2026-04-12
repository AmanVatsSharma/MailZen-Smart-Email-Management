/**
 * AutoSendTier — controls how aggressively AI-composed drafts are auto-sent.
 *
 * MANUAL   : default; every draft requires explicit user approval before sending.
 * SEMI_AUTO: auto-send when draft is short (≤120 words) AND thread is classified as
 *            low-stakes (coordination/commercial + LOW/MEDIUM priority).
 * AUTO     : auto-send all AI-composed drafts without approval.
 */
export enum AutoSendTier {
  MANUAL = 'MANUAL',
  SEMI_AUTO = 'SEMI_AUTO',
  AUTO = 'AUTO',
}
