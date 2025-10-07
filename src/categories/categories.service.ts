import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}
  // CREATE CATEGORY
  async create(createCategoryDto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: createCategoryDto,
        select: { id: true, name: true, description: true },
      });
    } catch (error: any) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Category with that name already exists');
      }
      throw new InternalServerErrorException('Could not create category');
    }
  }

  // GET ALL CATEGORIES
  async findAll() {
    return this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { posts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  // GET A SINGLE CATEGORY
  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        posts: {
          select: {
            id: true,
            title: true,
            author: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  // UPDATE A CATEGORY
  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    try {
      return await this.prisma.category.update({
        where: { id },
        data: updateCategoryDto,
        select: { id: true, name: true, description: true },
      });
    } catch (error: any) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Category name already in use');
      }
      throw new InternalServerErrorException('Could not update category');
    }
  }

  // DELETE A CATEGORY
  async remove(id: number) {
    try {
      return await this.prisma.category.delete({
        where: { id },
        select: { id: true, name: true },
      });
    } catch (error: any) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      throw new InternalServerErrorException('Could not delete category');
    }
  }
}
