import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const isDbHealthy = await this.prisma.isHealthy();

    return {
      status: isDbHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      database: {
        status: isDbHealthy ? 'connected' : 'disconnected',
      },
    };
  }

  @Get('db')
  async checkDatabase() {
    try {
      const isHealthy = await this.prisma.isHealthy();

      if (!isHealthy) {
        return {
          status: 'error',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
        };
      }

      // Get some basic stats
      const userCount = await this.prisma.user.count();
      const postCount = await this.prisma.post.count();
      const categoryCount = await this.prisma.category.count();

      return {
        status: 'ok',
        message: 'Database is healthy',
        timestamp: new Date().toISOString(),
        stats: {
          users: userCount,
          posts: postCount,
          categories: categoryCount,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
