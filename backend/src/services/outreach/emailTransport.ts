import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface SendMailOptions {
  from?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
}

export interface SendMailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  sandboxRedirected: boolean;
  originalRecipient: string;
  finalRecipient: string;
  subject: string;
  sentAt: Date;
}

export interface EmailTransport {
  sendMail(options: SendMailOptions): Promise<SendMailResult>;
  verifyConnection(): Promise<{ success: boolean; message: string }>;
}

/**
 * Production & Sandbox SMTP Transport powered by Nodemailer.
 * Automatically enforces the Sandbox Mode Guard (Golden Rule 2.5).
 */
export class SmtpTransport implements EmailTransport {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE, // true for 465, false for 587/25
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        // Helpful defaults for corporate/custom mailservers
        tls: {
          rejectUnauthorized: env.NODE_ENV === 'production',
        },
      });
    } else {
      logger.warn('SMTP credentials missing in environment. SmtpTransport is uninitialized.');
    }
  }

  public async verifyConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.transporter) {
      return {
        success: false,
        message: 'SMTP transporter is not configured. Check SMTP_HOST, SMTP_USER, and SMTP_PASS in .env',
      };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection verified successfully.' };
    } catch (err: any) {
      logger.error('SMTP connection verification failed', err);
      return { success: false, message: `SMTP verification failed: ${err.message}` };
    }
  }

  /**
   * Dispatches mail with strict Sandbox Guard redirection.
   * In sandbox mode (default), recipient is ALWAYS redirected to SANDBOX_INBOX.
   */
  public async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    const isSandbox = env.SEND_MODE === 'sandbox';
    const originalRecipient = options.to.trim();
    const finalRecipient = isSandbox ? env.SANDBOX_INBOX : originalRecipient;

    const finalSubject = isSandbox
      ? `[SANDBOX to: ${originalRecipient}] ${options.subject}`
      : options.subject;

    const fromAddress = options.from || `"${env.SENDER_NAME}" <${env.SENDER_EMAIL}>`;

    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };

    if (isSandbox) {
      headers['X-Sandbox-Redirected'] = 'true';
      headers['X-Original-Recipient'] = originalRecipient;
    }

    if (!this.transporter) {
      // Re-try transporter initialization in case env was updated
      this.initTransporter();
      if (!this.transporter) {
        throw new Error('Cannot send email: SMTP credentials are not configured in backend/.env.');
      }
    }

    logger.info(
      `Dispatching email via SMTP (${isSandbox ? 'SANDBOX GUARD' : 'LIVE'} mode): ${finalSubject} -> ${finalRecipient}`
    );

    const info = await this.transporter.sendMail({
      from: fromAddress,
      to: finalRecipient,
      subject: finalSubject,
      html: options.html,
      text: options.text,
      inReplyTo: options.inReplyTo,
      references: options.references,
      headers,
    });

    const sentAt = new Date();

    return {
      messageId: info.messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [finalRecipient],
      rejected: Array.isArray(info.rejected) ? info.rejected.map(String) : [],
      sandboxRedirected: isSandbox,
      originalRecipient,
      finalRecipient,
      subject: finalSubject,
      sentAt,
    };
  }
}

/**
 * In-Memory Mock Transport for automated testing (Golden Rule 2.6).
 * Never touches real SMTP servers or external networks.
 */
export class MockEmailTransport implements EmailTransport {
  public sentMessages: Array<SendMailOptions & { result: SendMailResult }> = [];
  public failNextSend: boolean = false;
  public failMessage: string = 'Simulated SMTP connection failure';

  public async verifyConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Mock email transport verified.' };
  }

  public async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    if (this.failNextSend) {
      this.failNextSend = false;
      throw new Error(this.failMessage);
    }

    const isSandbox = env.SEND_MODE === 'sandbox';
    const originalRecipient = options.to.trim();
    const finalRecipient = isSandbox ? env.SANDBOX_INBOX : originalRecipient;

    const finalSubject = isSandbox
      ? `[SANDBOX to: ${originalRecipient}] ${options.subject}`
      : options.subject;

    const result: SendMailResult = {
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      accepted: [finalRecipient],
      rejected: [],
      sandboxRedirected: isSandbox,
      originalRecipient,
      finalRecipient,
      subject: finalSubject,
      sentAt: new Date(),
    };

    this.sentMessages.push({
      ...options,
      subject: finalSubject,
      to: finalRecipient,
      result,
    });

    return result;
  }

  public clear(): void {
    this.sentMessages = [];
    this.failNextSend = false;
  }
}

// Global active transport instance (defaults to SmtpTransport)
let activeTransport: EmailTransport = new SmtpTransport();

export const getEmailTransport = (): EmailTransport => activeTransport;

export const setEmailTransport = (transport: EmailTransport): void => {
  activeTransport = transport;
};
