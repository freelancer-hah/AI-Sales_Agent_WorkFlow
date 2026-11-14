import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface UnsubscribePayload {
  contactId: string;
  email: string;
  companyId: string;
  timestamp: number;
}

export class UnsubscribeService {
  private secret: string;

  constructor() {
    this.secret = env.UNSUBSCRIBE_SECRET || 'cybells_default_secret_key_change_in_prod';
  }

  /**
   * Generates a tamper-proof HMAC-SHA256 signed token.
   * Format: base64url(payloadJson).hmacHex
   */
  public generateToken(params: {
    contactId: string;
    email?: string;
    companyId?: string;
  }): string {
    const payload: UnsubscribePayload = {
      contactId: String(params.contactId),
      email: (params.email || '').trim().toLowerCase(),
      companyId: String(params.companyId || ''),
      timestamp: Date.now(),
    };

    const payloadJson = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJson).toString('base64url');

    const hmac = crypto
      .createHmac('sha256', this.secret)
      .update(payloadB64)
      .digest('hex');

    return `${payloadB64}.${hmac}`;
  }

  /**
   * Verifies the cryptographic signature and extracts payload.
   */
  public verifyToken(token: string): {
    valid: boolean;
    payload?: UnsubscribePayload;
    error?: string;
  } {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return { valid: false, error: 'Malformed token structure' };
    }

    const [payloadB64, receivedHmac] = token.split('.');

    if (!payloadB64 || !receivedHmac) {
      return { valid: false, error: 'Incomplete token components' };
    }

    // Compute expected HMAC
    const expectedHmac = crypto
      .createHmac('sha256', this.secret)
      .update(payloadB64)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const receivedBuffer = Buffer.from(receivedHmac, 'hex');
    const expectedBuffer = Buffer.from(expectedHmac, 'hex');

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      logger.warn('Unsubscribe token verification failed: signature mismatch');
      return { valid: false, error: 'Invalid or tampered token signature' };
    }

    try {
      const decodedJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
      const payload: UnsubscribePayload = JSON.parse(decodedJson);

      if (!payload.email || !payload.contactId) {
        return { valid: false, error: 'Token missing required payload properties' };
      }

      return { valid: true, payload };
    } catch (err: any) {
      return { valid: false, error: 'Failed to decode token payload JSON' };
    }
  }

  /**
   * Generates absolute unsubscribe URL for email footers and List-Unsubscribe headers.
   */
  public generateUnsubscribeUrl(
    paramsOrContactId:
      | string
      | {
          contactId: string;
          email?: string;
          companyId?: string;
        }
  ): string {
    let contactId = '';
    let email = '';
    let companyId = '';

    if (typeof paramsOrContactId === 'string') {
      contactId = paramsOrContactId;
    } else {
      contactId = paramsOrContactId.contactId;
      email = paramsOrContactId.email || '';
      companyId = paramsOrContactId.companyId || '';
    }

    const token = this.generateToken({ contactId, email, companyId });
    const baseUrl = env.APP_BASE_URL.replace(/\/+$/, '');
    return `${baseUrl}/api/unsubscribe/${token}`;
  }
}

export const unsubscribeService = new UnsubscribeService();

