import { randomBytes } from 'node:crypto';

// The token of a shared plan's link (UC-09 §7, ADR 0010): 32 bytes from the operating system's
// random source, as strong as a session token (ADR 0002), written in base64url so it fits a URL.
const TOKEN_BYTES = 32;
const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const newShareToken = (): string => randomBytes(TOKEN_BYTES).toString('base64url');

/** Whether the text has the shape of a token. Anything else is not looked up at all. */
export const isShareToken = (value: unknown): value is string => typeof value === 'string' && SHARE_TOKEN.test(value);
