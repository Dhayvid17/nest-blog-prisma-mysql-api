import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}
  // CREATE POST
  async create(createPostDto: CreatePostDto) {
    const { categoryIds, ...postData } = createPostDto;

    return this.prisma.post.create({
      data: {
        ...postData,
        categories: categoryIds
          ? {
              connect: categoryIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        categories: { select: { id: true, name: true } },
      },
    });
  }

  // GET ALL POSTS (supports optional published filter and pagination)
  async findAll(published?: boolean, skip?: number, take?: number) {
    const offset = skip ?? 0;
    const limit = Math.min(take ?? 10, 100); // cap page size to 100

    return this.prisma.post.findMany({
      where: published !== undefined ? { published } : undefined,
      skip: offset,
      take: limit,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        categories: { select: { id: true, name: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // GET A SINGLE POST (increments viewCount atomically and returns the updated post)
  async findOne(id: number) {
    try {
      const post = await this.prisma.post.update({
        where: { id },
        data: {
          viewCount: { increment: 1 },
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
          categories: { select: { id: true, name: true } },
        },
      });

      return post;
    } catch (error: any) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Post with ID ${id} not found`);
      }
      throw error;
    }
  }

  // UPDATE A POST
  async update(id: number, updatePostDto: UpdatePostDto) {
    const { categoryIds, ...postData } = updatePostDto;

    try {
      return await this.prisma.post.update({
        where: { id },
        data: {
          ...postData,
          categories: categoryIds
            ? {
                set: categoryIds.map((id) => ({ id })),
              }
            : undefined,
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
          categories: { select: { id: true, name: true } },
        },
      });
    } catch (error: any) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Post with ID ${id} not found`);
      }
      throw error;
    }
  }

  // DELETE A POST
  async remove(id: number) {
    try {
      return await this.prisma.post.delete({
        where: { id },
        include: {
          author: { select: { id: true, name: true, email: true } },
          categories: { select: { id: true, name: true } },
        },
      });
    } catch (error: any) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Post with ID ${id} not found`);
      }
      throw error;
    }
  }

  // SEARCH POSTS BY TITLE OR CONTENT
  async searchPosts(query: string) {
    return this.prisma.post.findMany({
      where: {
        OR: [{ title: { contains: query } }, { content: { contains: query } }],
      },
      include: {
        author: { select: { id: true, name: true } },
        categories: { select: { id: true, name: true } },
      },
    });
  }
}
