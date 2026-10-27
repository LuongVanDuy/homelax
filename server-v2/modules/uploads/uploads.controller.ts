import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import {
  Public,
} from '../../common/auth/auth.decorators.js';
import {
  ZodValidationPipe,
} from '../../common/pipes/zod-validation.pipe.js';
import { UploadsService } from './uploads.service.js';

const uploadSchema = z
  .object({
    image: z
      .string()
      .min(
        1,
        'Không tìm thấy dữ liệu ảnh để upload.',
      ),
    fileName: z.string().optional(),
  })
  .passthrough();

@ApiTags('uploads')
@Controller()
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
  ) {}

  @Post('upload')
  @ApiBearerAuth()
  @HttpCode(200)
  upload(
    @Body(new ZodValidationPipe(uploadSchema))
    body: z.infer<typeof uploadSchema>,
  ) {
    return this.uploadsService.upload(
      body.image,
      body.fileName,
    );
  }

  @Get('images/transform')
  @Public()
  @ApiOperation({
    summary:
      'Public image transform for local/allowlisted remote images',
  })
  async transform(
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
    const transformed =
      await this.uploadsService.transform(query);

    response.setHeader(
      'Content-Type',
      transformed.contentType,
    );
    response.setHeader(
      'Cache-Control',
      'public, max-age=86400',
    );

    response.send(transformed.buffer);
  }
}
