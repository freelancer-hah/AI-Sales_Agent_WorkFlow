import { Request, Response } from 'express';
import { unsubscribeService } from '../services/outreach/unsubscribeService.js';
import { contactValidationService } from '../services/outreach/contactValidationService.js';
import { logger } from '../config/logger.js';

export const showUnsubscribePage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const verification = unsubscribeService.verifyToken(token);
    if (!verification.valid || !verification.payload) {
      if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
        res.status(400).json({
          success: false,
          error: { message: verification.error || 'Invalid or expired unsubscribe link.' },
        });
        return;
      }

      res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invalid Unsubscribe Link</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
            .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px; max-width: 440px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            .icon { font-size: 40px; margin-bottom: 16px; }
            h1 { font-size: 20px; margin-bottom: 8px; color: #0f172a; }
            p { font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">⚠️</div>
            <h1>Invalid or Tampered Link</h1>
            <p>This unsubscribe link could not be verified. It may have expired or been altered. Please contact our compliance desk directly if you wish to opt out.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const { email } = verification.payload;
    const suppressionCheck = await contactValidationService.checkSuppression(email);

    if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
      res.json({
        success: true,
        data: {
          email,
          isAlreadySuppressed: suppressionCheck.isSuppressed,
          reason: suppressionCheck.reason,
        },
      });
      return;
    }

    // Render interactive HTML confirmation
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm Email Preferences - Cybells AI</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px; max-width: 480px; text-align: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
          .logo { font-size: 13px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
          h1 { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #0f172a; }
          p { font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 20px; }
          .email-badge { background: #f1f5f9; padding: 8px 14px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #0f172a; display: inline-block; margin-bottom: 24px; border: 1px solid #e2e8f0; word-break: break-all; }
          .btn { background: #dc2626; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; width: 100%; box-sizing: border-box; }
          .btn:hover { background: #b91c1c; }
          .already { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 500; }
          .footer { margin-top: 24px; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">Cybells AI Solutions</div>
          <h1>Confirm Unsubscribe</h1>
          <p>We respect your privacy and inbox preferences. Please confirm that you want to opt out of future AI automation updates from Cybells.</p>
          <div class="email-badge">${email}</div>

          ${
            suppressionCheck.isSuppressed
              ? `<div class="already">✓ This email address is already opted out from our outreach list.</div>`
              : `<form action="/api/unsubscribe/${token}" method="POST">
                   <button type="submit" class="btn">Unsubscribe from All Outreach</button>
                 </form>`
          }

          <div class="footer">Zero-Spam Compliance • CAN-SPAM & GDPR Compliant</div>
        </div>
      </body>
      </html>
    `);
  } catch (error: any) {
    logger.error('Failed to render unsubscribe page', error);
    res.status(500).send('Internal server error loading unsubscribe page.');
  }
};

export const processUnsubscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const verification = unsubscribeService.verifyToken(token);
    if (!verification.valid || !verification.payload) {
      res.status(400).json({
        success: false,
        error: { message: verification.error || 'Invalid or expired unsubscribe link.' },
      });
      return;
    }

    const { email } = verification.payload;

    // Suppress immediately and cancel any pending jobs
    const result = await contactValidationService.suppressEmail(
      email,
      'unsubscribe',
      'one_click_unsubscribe'
    );

    logger.info(`Prospect successfully unsubscribed via signed token: ${email}`, result);

    if (req.headers.accept?.includes('application/json') || req.is('application/json')) {
      res.json({
        success: true,
        message: 'You have been successfully unsubscribed from all future outreach.',
        data: {
          email,
          suppressedAt: new Date(),
        },
      });
      return;
    }

    // Render success confirmation HTML
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Successfully Unsubscribed - Cybells AI</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px; max-width: 440px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .icon { font-size: 40px; margin-bottom: 16px; color: #10b981; }
          h1 { font-size: 20px; margin-bottom: 8px; color: #0f172a; }
          p { font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 20px; }
          .badge { background: #f1f5f9; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #334155; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h1>Successfully Unsubscribed</h1>
          <p>Your email address has been permanently removed from our active outreach campaigns.</p>
          <div class="badge">${email}</div>
        </div>
      </body>
      </html>
    `);
  } catch (error: any) {
    logger.error('Failed to process unsubscribe', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to process unsubscribe request.' },
    });
  }
};

