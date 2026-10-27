import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { blogCategoriesSchema, blogCategorySchema, blogCategoryWriteSchema, blogListQuerySchema, blogAdminPageSchema, blogPublicPageSchema, blogAdminPostSchema, blogPublicPostSchema, blogPostWriteSchema, blogPostUpdateSchema, blogDeleteSchema, type BlogCategoryWrite, type BlogListQuery, type BlogPostWrite, type BlogPostUpdate } from '@tinyhouse/contracts';
import { Public, Roles } from '../../common/auth/auth.decorators.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AppIdentity } from '../../common/auth/auth.types.js';
import { ApiStandardErrors, ApiZodBody, ApiZodOk } from '../../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BlogService } from './blog.service.js';
const success=z.object({success:z.boolean()});

@ApiTags('blog')
@ApiStandardErrors()
@Public()
@Controller('public/blog')
export class PublicBlogController {
  constructor(private readonly blog:BlogService) {}
  @Get('categories') @Header('Cache-Control','no-store') @ApiZodOk(blogCategoriesSchema)
  categories() {return this.blog.categories(true);}
  @Get('posts') @Header('Cache-Control','no-store') @ApiZodOk(blogPublicPageSchema)
  list(@Query(new ZodValidationPipe(blogListQuerySchema)) query:BlogListQuery) {return this.blog.list(query,true);}
  @Get('posts/:slug') @Header('Cache-Control','no-store') @ApiZodOk(blogPublicPostSchema)
  detail(@Param('slug') slug:string) {return this.blog.detail(slug,true);}
}

@ApiTags('blog')
@ApiBearerAuth()
@ApiStandardErrors()
@Roles('admin','superadmin')
@Controller('blog')
export class BlogController {
  constructor(private readonly blog:BlogService) {}
  @Get('categories') @ApiZodOk(blogCategoriesSchema)
  categories() {return this.blog.categories();}
  @Post('categories') @ApiZodBody(blogCategoryWriteSchema) @ApiZodOk(blogCategorySchema)
  createCategory(@Body(new ZodValidationPipe(blogCategoryWriteSchema)) input:BlogCategoryWrite,@CurrentUser() actor:AppIdentity) {return this.blog.saveCategory(input,actor);}
  @Patch('categories/:id') @ApiZodBody(blogCategoryWriteSchema) @ApiZodOk(blogCategorySchema)
  updateCategory(@Param('id') id:string,@Body(new ZodValidationPipe(blogCategoryWriteSchema)) input:BlogCategoryWrite,@CurrentUser() actor:AppIdentity) {return this.blog.saveCategory(input,actor,id);}
  @Delete('categories/:id') @ApiZodOk(success)
  deleteCategory(@Param('id') id:string,@CurrentUser() actor:AppIdentity) {return this.blog.deleteCategory(id,actor);}
  @Get('posts') @ApiZodOk(blogAdminPageSchema)
  list(@Query(new ZodValidationPipe(blogListQuerySchema)) query:BlogListQuery) {return this.blog.list(query);}
  @Get('posts/:id') @ApiZodOk(blogAdminPostSchema)
  detail(@Param('id') id:string) {return this.blog.detail(id);}
  @Post('posts') @ApiZodBody(blogPostWriteSchema) @ApiZodOk(blogAdminPostSchema)
  create(@Body(new ZodValidationPipe(blogPostWriteSchema)) input:BlogPostWrite,@CurrentUser() actor:AppIdentity) {return this.blog.savePost(input,actor);}
  @Patch('posts/:id') @ApiZodBody(blogPostUpdateSchema) @ApiZodOk(blogAdminPostSchema)
  update(@Param('id') id:string,@Body(new ZodValidationPipe(blogPostUpdateSchema)) input:BlogPostUpdate,@CurrentUser() actor:AppIdentity) {return this.blog.savePost(input,actor,id);}
  @Delete('posts/:id') @ApiZodBody(blogDeleteSchema) @ApiZodOk(success)
  remove(@Param('id') id:string,@Body(new ZodValidationPipe(blogDeleteSchema)) input:{expectedRevision:number},@CurrentUser() actor:AppIdentity) {return this.blog.deletePost(id,input.expectedRevision,actor);}
}
