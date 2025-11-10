import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { UserRole } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}
  // CREATE POST
  async create(createPostDto: CreatePostDto) {
    const { categoryIds, authorId, ...postData } = createPostDto;

    // Ensure at least one category is provided
    if (!categoryIds || categoryIds.length === 0) {
      throw new BadRequestException('At least one category is required');
    }

    // Validate authorId
    if (!authorId) throw new BadRequestException('Author ID is required');

    // Verify that author exists
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
    });
    if (!author) throw new BadRequestException('Author does not exist');

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
          authorId: authorId,
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
  async update(
    id: number,
    updatePostDto: UpdatePostDto,
    currentUserId: number,
    userRole: UserRole,
  ) {
    const { categoryIds, authorId, ...postData } = updatePostDto;
    try {
      // First get the existing post
      const existingPost = await this.prisma.post.findUnique({
        where: { id },
        include: {
          categories: { select: { id: true } },
        },
      });

      if (!existingPost)
        throw new NotFoundException(`Post with ID ${id} not found`);

      // Authorization check if its admin or post author
      const isAdmin = userRole === UserRole.ADMIN;
      const isAuthor = existingPost.authorId === currentUserId;

      if (!isAdmin && !isAuthor) {
        throw new ForbiddenException(
          'You do not have permission to edit this post',
        );
      }

      // Prepare the actual data to update
      const dataToUpdate: {
        title?: string;
        content?: string;
        published?: boolean;
        authorId?: number;
      } = { ...postData };

      // Handle authorId changes (admin only)
      if (authorId !== undefined && authorId !== existingPost.authorId) {
        if (!isAdmin)
          throw new ForbiddenException(
            'Only administrators can change the author of a post',
          );

        // Verify the new author exists
        const newAuthor = await this.prisma.user.findUnique({
          where: { id: authorId },
        });
        if (!newAuthor)
          throw new NotFoundException(`Author with ID ${authorId} not found`);

        dataToUpdate.authorId = authorId;
      }

      // Check if there are any actual changes in the post data
      const hasDataChanges = Object.keys(postData).some((key) => {
        const newValue = postData[key];
        const oldValue = existingPost[key];
        // Handle the types
        if (typeof newValue === 'string' && typeof oldValue === 'string') {
          return newValue.trim() !== oldValue.trim();
        }
      });

      // Check if there are changes in categories
      let hasCategoryChanges = false;
      if (categoryIds !== undefined) {
        const existingCategoryIds = existingPost.categories
          .map((c) => c.id)
          .sort();
        const newCategoryIds = [...categoryIds].sort();

        hasCategoryChanges =
          newCategoryIds.length !== existingCategoryIds.length ||
          !newCategoryIds.every(
            (id, index) => id === existingCategoryIds[index],
          );
      }

      // Check if ANY field was provided in the DTO
      const hasAnyFieldProvided =
        Object.keys(postData).length > 0 || categoryIds !== undefined;

      if (!hasAnyFieldProvided) {
        throw new BadRequestException('No update data provided');
      }

      if (!hasDataChanges && !hasCategoryChanges) {
        throw new ConflictException('No changes detected in the update data');
      }

      // If categories are being updated, verify they exist
      if (categoryIds !== undefined) {
        if (categoryIds.length === 0) {
          throw new BadRequestException('At least one category is required');
        }

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
          ...dataToUpdate,
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
  async remove(id: number, currentUserId: number, userRole: UserRole) {
    // First get the existing post
    const existingPost = await this.prisma.post.findUnique({
      where: { id },
      include: {
        categories: { select: { id: true } },
      },
    });
    if (!existingPost)
      throw new NotFoundException(`Post with ID ${id} not found`);

    try {
      // Allow if user is admin to delete any post, allow only if user is the post author
      const isAdmin = userRole === UserRole.ADMIN;
      const isAuthor = existingPost.authorId === currentUserId;

      if (!isAdmin && !isAuthor)
        throw new ForbiddenException(
          'You do not have permission to delete this post',
        );
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
