import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export type DBConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

class Database {
  private status: DBConnectionStatus = 'disconnected';
  private lastError: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    mongoose.connection.on('connected', () => {
      this.status = 'connected';
      this.lastError = null;
      logger.info('MongoDB connected successfully');
    });

    mongoose.connection.on('disconnected', () => {
      this.status = 'disconnected';
      logger.warn('MongoDB disconnected');
      this.scheduleReconnect();
    });

    mongoose.connection.on('error', (err) => {
      this.status = 'error';
      this.lastError = err.message;
      logger.error('MongoDB connection error', err);
    });
  }

  public async connect(customUri?: string): Promise<boolean> {
    const uri = customUri || env.MONGODB_URI;
    this.status = 'connecting';
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      this.status = 'connected';
      this.lastError = null;
      return true;
    } catch (err: any) {
      this.status = 'error';
      this.lastError = err.message;
      logger.error(`Initial MongoDB connection failed: ${err.message}`);
      this.scheduleReconnect();
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await mongoose.disconnect();
    this.status = 'disconnected';
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || process.env.NODE_ENV === 'test') return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      logger.info('Attempting MongoDB reconnect...');
      try {
        await this.connect();
      } catch {
        // Will retry on next event or timer
      }
    }, 10000);
  }

  public getStatus(): { status: DBConnectionStatus; error: string | null; host?: string; dbName?: string } {
    const isConnected = mongoose.connection.readyState === 1;
    return {
      status: isConnected ? 'connected' : this.status,
      error: this.lastError,
      host: mongoose.connection.host || undefined,
      dbName: mongoose.connection.name || undefined,
    };
  }
}

export const db = new Database();
