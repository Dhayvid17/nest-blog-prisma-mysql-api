import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CurrentUser } from 'src/auth/decorators/current-use.decorator';
import { Public } from 'src/auth/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // CREATE POST
  create(
    @Body() createPostDto: CreatePostDto,
    @CurrentUser() user: { id: number },
  ) {
    // Override authorId with current user's Id to prevent users from creating post as others
    createPostDto.authorId = user.id;
    return this.postsService.create(createPostDto);
  }

  // GET ALL POSTS (optional filters & pagination)
  @Public()
  @Get()
  findAll(
    @Query('published') published?: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip?: number,
    @Query('take', new DefaultValuePipe(10), ParseIntPipe) take?: number,
  ) {
    // Convert string to boolean, but only if the parameter is provided
    const publishedBool =
      published === undefined ? undefined : published === 'true';
    return this.postsService.findAll(publishedBool, skip, take);
  }

  // SEARCH POSTS BY TITLE OR CONTENT
  @Public()
  @Get('search')
  searchPosts(@Query('q') query: string) {
    return this.postsService.searchPosts(query);
  }

  // GET A SINGLE POST
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  // UPDATE A POST
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.postsService.update(id, updatePostDto, user.id, user.role);
  }

  // DELETE A POST
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: UserRole },
  ) {
    return this.postsService.remove(id, user.id, user.role);
  }
}
