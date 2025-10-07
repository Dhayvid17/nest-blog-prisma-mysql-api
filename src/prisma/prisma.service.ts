import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private static _instance: PrismaService;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectInterval = 5000; // 5 seconds

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    if (!PrismaService._instance) {
      PrismaService._instance = this;
    }

    // Setup event listeners for Prisma
    this.setupEventListeners();

    return PrismaService._instance;
  }

  private setupEventListeners() {
    // Log queries in development
    this.$on('query' as never, (e: any) => {
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      }
    });

    // Log errors
    this.$on('error' as never, (e: any) => {
      this.logger.error(`Prisma Error: ${e.message}`);
    });

    // Log warnings
    this.$on('warn' as never, (e: any) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Successfully connected to the database');
      this.reconnectAttempts = 0; // Reset counter on successful connection
    } catch (error) {
      this.reconnectAttempts++;
      this.logger.error(
        `❌ Failed to connect to database (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );
      this.logger.error(`Error: ${error.message}`);

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.logger.warn(
          `Retrying connection in ${this.reconnectInterval / 1000} seconds...`,
        );
        await this.delay(this.reconnectInterval);
        return this.connectWithRetry();
      } else {
        this.logger.error(
          '❌ Max reconnection attempts reached. Exiting application...',
        );
        throw error; // This will prevent the app from starting
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error.message);
      return false;
    }
  }

  // Handle disconnections at runtime
  async handleDisconnect(): Promise<void> {
    this.logger.warn('Lost database connection. Attempting to reconnect...');
    try {
      await this.$disconnect();
      await this.connectWithRetry();
    } catch (error) {
      this.logger.error('Failed to reconnect to database:', error.message);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
