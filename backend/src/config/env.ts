import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  CLIENT_URL: string;
  MONGODB_URI: string;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  OVERPASS_API_URL: string;
  SEARXNG_URL: string;
  GMAPS_SCRAPER_API_URL: string;
  SCRAPER_SERVICE_URL: string;
  // Phase 2: Outreach & Email Transport
  SEND_MODE: 'sandbox' | 'live';
  SANDBOX_INBOX: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  IMAP_HOST: string;
  IMAP_PORT: number;
  IMAP_USER: string;
  IMAP_PASS: string;
  SENDER_NAME: string;
  SENDER_EMAIL: string;
  SENDER_POSTAL_ADDRESS: string;
  APP_BASE_URL: string;
  UNSUBSCRIBE_SECRET: string;
  DAILY_SEND_CAP: number;
  MIN_DELAY_SECONDS: number;
  MAX_DELAY_SECONDS: number;
  // Cal.diy Self-Hosted Scheduling
  CAL_BASE_URL: string;
  CAL_CLOSER_SLUG: string;
  CAL_EVENT_SLUG: string;
  CAL_WEBHOOK_SECRET: string;
}

export const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/sales_agent',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  OVERPASS_API_URL: process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter',
  SEARXNG_URL: process.env.SEARXNG_URL || 'http://localhost:8080',
  GMAPS_SCRAPER_API_URL: process.env.GMAPS_SCRAPER_API_URL || 'http://localhost:8085',
  SCRAPER_SERVICE_URL: process.env.SCRAPER_SERVICE_URL || 'http://localhost:8000',
  // Phase 2 Defaults
  SEND_MODE: (process.env.SEND_MODE === 'live' ? 'live' : 'sandbox') as 'sandbox' | 'live',
  SANDBOX_INBOX: process.env.SANDBOX_INBOX || 'sandbox@cybells.ai',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  IMAP_HOST: process.env.IMAP_HOST || 'imap.gmail.com',
  IMAP_PORT: parseInt(process.env.IMAP_PORT || '993', 10),
  IMAP_USER: process.env.IMAP_USER || '',
  IMAP_PASS: process.env.IMAP_PASS || '',
  SENDER_NAME: process.env.SENDER_NAME || 'Cybells AI Solutions',
  SENDER_EMAIL: process.env.SENDER_EMAIL || 'outreach@cybells.ai',
  SENDER_POSTAL_ADDRESS: process.env.SENDER_POSTAL_ADDRESS || '123 Innovation Way, Tech Park',
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5000',
  UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET || 'cybells_dev_unsubscribe_secret_key_12345',
  DAILY_SEND_CAP: parseInt(process.env.DAILY_SEND_CAP || '25', 10),
  MIN_DELAY_SECONDS: parseInt(process.env.MIN_DELAY_SECONDS || '60', 10),
  MAX_DELAY_SECONDS: parseInt(process.env.MAX_DELAY_SECONDS || '180', 10),
  // Cal.diy Defaults
  CAL_BASE_URL: process.env.CAL_BASE_URL || 'http://localhost:3000',
  CAL_CLOSER_SLUG: process.env.CAL_CLOSER_SLUG || 'hafiz',
  CAL_EVENT_SLUG: process.env.CAL_EVENT_SLUG || '30min',
  CAL_WEBHOOK_SECRET: process.env.CAL_WEBHOOK_SECRET || 'cal_webhook_secret_cybells_2026',
};
