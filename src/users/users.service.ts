import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private userSelect = {
    id: true,
    email: true,
    name: true,
    bio: true,
    createdAt: true,
    updatedAt: true,
  };

  // CREATE NEW USER
  async create(createUserDto: CreateUserDto) {
    try {
      // Using transaction to ensure atomicity
      const user = await this.prisma.$transaction(async (prisma) => {
        // Check if email exists first
        const existingUser = await prisma.user.findUnique({
          where: { email: createUserDto.email },
        });

        if (existingUser)
          throw new ConflictException('User with this email already exists');

        // Hash password
        const hashedPassword = await argon2.hash(createUserDto.password);
        const data = {
          ...createUserDto,
          password: hashedPassword,
        };

        return await prisma.user.create({
          data,
          select: this.userSelect,
        });
      });

      return user;
    } catch (error: any) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw new InternalServerErrorException('Could not create user');
    }
  }

  // GET ALL USERS (supports pagination)
  async findAll(skip?: number, take?: number) {
    const offset = skip ?? 0;
    const limit = Math.min(take ?? 10, 100);

    const users = await this.prisma.user.findMany({
      skip: offset,
      take: limit,
      select: {
        ...this.userSelect,
        posts: {
          select: {
            id: true,
            title: true,
            published: true,
            viewCount: true,
            createdAt: true,
            updatedAt: true,
            categories: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users;
  }

  // GET A SINGLE USER
  async findOne(id: number, currentUserId: number, userRole: UserRole) {
    // Check if its Admin or Owner
    const isAdmin = userRole === UserRole.ADMIN;
    const isOwner = currentUserId === id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('You can only view your own profile');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
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
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  // UPDATE A USER
  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    currentUserId: number,
    userRole: UserRole,
  ) {
    try {
      // Check if its Admin or Owner
      const isAdmin = userRole === UserRole.ADMIN;
      const isOwner = currentUserId === id;

      if (!isAdmin && !isOwner) {
        throw new ForbiddenException('You can only view your own profile');
      }

      // First get the existing user
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
        select: {
          ...this.userSelect,
          password: true,
        },
      });

      if (!existingUser)
        throw new NotFoundException(`User with ID ${id} not found`);

      // Check if there are any actual changes
      const hasChanges = Object.keys(updateUserDto).some((key) => {
        if (key === 'password') return updateUserDto.password !== undefined;
        return updateUserDto[key] !== existingUser[key];
      });

      if (!hasChanges) {
        throw new ConflictException('No changes detected in the update data');
      }

      const data: any = { ...updateUserDto };
      if (updateUserDto.password) {
        data.password = await argon2.hash(updateUserDto.password);
      }

      const user = await this.prisma.user.update({
        where: { id },
        data,
        select: this.userSelect,
      });

      return user;
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record to update not found
          throw new NotFoundException(`User with ID ${id} not found`);
        }
        if (error.code === 'P2002') {
          throw new ConflictException('Email already in use');
        }
      }
      throw new InternalServerErrorException('Could not update user');
    }
  }

  // DELETE A USER
  async remove(id: number, currentUserId: number) {
    try {
      // Prevent self-deletion for admins
      if (currentUserId && id === currentUserId) {
        throw new ConflictException('You cannot delete your own account');
      }
      const user = await this.prisma.user.delete({
        where: { id },
        select: this.userSelect,
      });
      return user;
    } catch (error: any) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw new InternalServerErrorException('Could not delete user');
    }
  }

  // GET USER STATISTICS
  async getUserStats(id: number, currentUserId: number, userRole?: UserRole) {
    // Check if its Admin or Owner
    const isAdmin = userRole === UserRole.ADMIN;
    const isOwner = currentUserId === id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('You can only view your own stats');
    }

    const stats = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posts: true },
        },
        posts: {
          select: {
            viewCount: true,
            published: true,
          },
        },
      },
    });

    if (!stats) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const totalViews = stats.posts.reduce(
      (sum, post) => sum + post.viewCount,
      0,
    );
    const publishedPosts = stats.posts.filter((post) => post.published).length;

    return {
      userId: id,
      totalPosts: stats._count.posts,
      publishedPosts,
      totalViews,
    };
  }
}
