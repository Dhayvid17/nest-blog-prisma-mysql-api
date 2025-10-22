import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // CREATE CATEGORY
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  // GET ALL CATEGORIES (supports pagination)
  findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip?: number,
    @Query('take', new DefaultValuePipe(10), ParseIntPipe) take?: number,
  ) {
    return this.categoriesService.findAll();
  }

  // GET A SINGLE CATEGORY
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  // UPDATE A CATEGORY
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  // DELETE A CATEGORY
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.removeAndDisconnect(id);
  }
}
