import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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

    if (!categoryIds || categoryIds.length === 0) {
      throw new BadRequestException('At least one category is required');
    }

    // Using transaction to ensure atomicity
    return await this.prisma.$transaction(async (prisma) => {
      // Verify that all categories exist
      const categories = await prisma.category.findMany({
        where: {
          id: {
            in: categoryIds,
          },
        },
      });

      if (categories.length !== categoryIds.length) {
        throw new NotFoundException('One or more categories not found');
      }

      return await prisma.post.create({
        data: {
          ...postData,
          categories: {
            connect: categoryIds.map((id) => ({ id })),
          },
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
      // First get the existing post
      const existingPost = await this.prisma.post.findUnique({
        where: { id },
        include: {
          categories: { select: { id: true } },
        },
      });

      if (!existingPost) {
        throw new NotFoundException(`Post with ID ${id} not found`);
      }

      // Check if there are any actual changes in the post data
      const hasDataChanges = Object.keys(postData).some(
        (key) => postData[key] !== existingPost[key],
      );

      // Check if there are changes in categories
      const existingCategoryIds = existingPost.categories.map((c) => c.id);
      const hasCategoryChanges =
        (categoryIds &&
          !categoryIds.every((id) => existingCategoryIds.includes(id))) ||
        (categoryIds && categoryIds.length !== existingCategoryIds.length);

      if (!hasDataChanges && !hasCategoryChanges) {
        throw new ConflictException('No changes detected in the update data');
      }

      // If categories are being updated, verify they exist
      if (categoryIds && categoryIds.length > 0) {
        const categories = await this.prisma.category.findMany({
          where: {
            id: {
              in: categoryIds,
            },
          },
        });

        if (categories.length !== categoryIds.length) {
          throw new NotFoundException('One or more categories not found');
        }
      }

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
}
