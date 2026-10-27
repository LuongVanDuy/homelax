import { Module } from '@nestjs/common';
import { BlogService } from './blog.service.js';
import { BlogController, PublicBlogController } from './blog.controller.js';
@Module({ controllers:[BlogController,PublicBlogController], providers:[BlogService] })
export class BlogModule {}
