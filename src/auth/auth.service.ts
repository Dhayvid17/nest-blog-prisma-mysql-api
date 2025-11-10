import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon2 from 'argon2';
import { AuthCleanupService } from './auth-cleanup.services';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private authCleanUpService: AuthCleanupService,
  ) {}

  private userSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    bio: true,
    createdAt: true,
    updatedAt: true,
  };

  // REGISTER NEW USER
  async register(registerDto: RegisterDto) {
    // Check if user already exists
    try {
      // Using transaction to ensure atomicity
      const user = await this.prismaService.$transaction(
        async (prismaService) => {
          const existingUser = await prismaService.user.findUnique({
            where: { email: registerDto.email },
          });
          if (existingUser)
            throw new ConflictException('User with email already exists');

          // Hash Password before saving
          const hashedPassword = await argon2.hash(registerDto.password);
          const data = { ...registerDto, password: hashedPassword };

          return await prismaService.user.create({
            data,
            select: this.userSelect,
          });
        },
      );
      return {
        message: 'User Registered Successfully',
        user,
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Failed to register user');
    }
  }

  // VALIDATE USER (Used by LocalStrategy)
  // Checks if email and password are correct
  async validateUser(email: string, password: string): Promise<any> {
    // Find user by email
    const user = await this.prismaService.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        bio: true,
        password: true,
      },
    });
    if (!user) return null; // User not found

    // Compare provided password with hashed in DB
    const isPasswordValid = await argon2.verify(user.password, password);
    if (!isPasswordValid) return null; // wrong password

    // Return user without password and refresh tokens
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Calculate Expiration Date
  // Converts '7d', '15m' to actual date object
  private calculateExpirationDate(expiresIn: string): Date {
    const now = new Date();
    const unit = expiresIn.slice(-1); // 'd', 'h', 'm'
    const value = parseInt(expiresIn.slice(0, -1), 10);

    switch (unit) {
      case 'd': // days
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      case 'h': // hours
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'm': // minutes
        return new Date(now.getTime() + value * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
    }
  }

  // Function to push refresh token to database and update last login of User
  async storeRefreshToken(
    userId: number,
    refreshToken: string,
    expirationDate: Date,
    deviceInfo?: string,
  ) {
    // Create a new refresh token linked to the user
    const token = await this.prismaService.refreshTokens.create({
      data: {
        token: refreshToken,
        expiresAt: expirationDate,
        deviceInfo: deviceInfo || 'Unknown Device',
        user: {
          connect: { id: userId },
        },
      },
    });

    // Update user's lastLogin timestamp
    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        lastLogin: new Date(),
      },
    });
    return token;
  }

  // LOGIN (Generate Tokens)
  // Create Access tokens and refresh tokens
  async login(user: any, deviceInfo?: string) {
    // Create JWT payload
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate access token(short-lived: 15 minutes)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION'),
    });

    // Generate refresh token (long-lived: 7 days), Used to get new access tokens when expires
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION'),
    });

    // calculate expiration date for refresh token
    // parse '7d' to actual date

    const expiresIn = this.configService.get('JWT_REFRESH_EXPIRATION');
    const expirationDate = this.calculateExpirationDate(expiresIn);

    // Store refresh token in database
    await this.storeRefreshToken(
      user.id,
      refreshToken,
      expirationDate,
      deviceInfo || 'Unknown Device',
    );

    // Return tokens and user Info
    return {
      message: 'Login Successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        bio: user.bio,
      },
    };
  }

  // Generate new access token using refresh token
  async refreshTokens(oldRefreshToken: string) {
    // Find and validate the old refresh token
    const tokenRecord = await this.prismaService.refreshTokens.findFirst({
      where: { token: oldRefreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenRecord.expiresAt < new Date()) {
      await this.prismaService.refreshTokens.delete({
        where: { id: tokenRecord.id },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = tokenRecord.user;
    // Create payload
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate new tokens
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION'),
    });

    const newRefreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION'),
    });

    const expiresIn = this.configService.get('JWT_REFRESH_EXPIRATION');
    const expirationDate = this.calculateExpirationDate(expiresIn);

    // Rotate tokens in a transaction
    await this.prismaService.$transaction([
      this.prismaService.refreshTokens.delete({
        where: { id: tokenRecord.id },
      }),
      this.prismaService.refreshTokens.create({
        data: {
          token: newRefreshToken,
          expiresAt: expirationDate,
          deviceInfo: tokenRecord.deviceInfo,
          user: { connect: { id: user.id } },
        },
      }),
    ]);

    return {
      message: 'Token Rotated Successfully',
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  // LOGOUT (SINGLE DEVICE)
  async logout(userId: number, refreshToken: string) {
    // Remove the refresh token from the user's refreshTokens array
    await this.prismaService.refreshTokens.deleteMany({
      where: {
        userId,
        token: refreshToken,
      },
    });
    return { message: 'Logged out successfully' };
  }

  // LOGOUT ALL DEVICES
  // Remove all refresh tokens for user
  async logoutAllDevices(userId: number) {
    // Invalidate all sessions on all devices
    await this.prismaService.refreshTokens.deleteMany({
      where: { userId },
    });
    return { message: 'Logged out from all devices successfully' };
  }

  // GET USER PROFILE
  async getProfile(userId: number) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        ...this.userSelect,
        posts: {
          select: {
            id: true,
            title: true,
            content: true,
            published: true,
            viewCount: true,
            createdAt: true,
            updatedAt: true,
            categories: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Clean Expired token
  async cleanExpiredTokens() {
    return this.authCleanUpService.cleanupExpiredTokens();
  }
}
