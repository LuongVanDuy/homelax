import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { uploadsDirectory } from '../../config/uploads-directory.js';

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_REMOTE_BYTES = 10 * 1024 * 1024;

function safeBaseName(value: string) {
  return path
    .basename(value || '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function decodeImage(image: string) {
  const dataUrl = String(image || '').match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s,
  );

  if (dataUrl) {
    const mime = dataUrl[1].toLowerCase();
    const extension = MIME_EXTENSION[mime];

    if (!extension) {
      throw new HttpException(
        {
          success: false,
          error: 'Định dạng ảnh không được hỗ trợ.',
        },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    return {
      buffer: Buffer.from(dataUrl[2], 'base64'),
      extension,
    };
  }

  const buffer = Buffer.from(
    String(image || ''),
    'base64',
  );

  if (!buffer.length) {
    throw new HttpException(
      {
        success: false,
        error: 'Dữ liệu ảnh không hợp lệ.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  return {
    buffer,
    extension: '.jpg',
  };
}

function allowedRemoteUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password
    ) {
      return false;
    }

    const host = url.hostname.toLowerCase();
    const extras = String(
      process.env.IMAGE_TRANSFORM_ALLOWED_HOSTS || '',
    )
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    return (
      host === 'images.unsplash.com' ||
      host.endsWith('.supabase.co') ||
      extras.includes(host)
    );
  } catch {
    return false;
  }
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(min, Math.round(parsed)),
  );
}

@Injectable()
export class UploadsService {
  async upload(image: string, fileName?: string) {
    const decoded = decodeImage(image);

    if (decoded.buffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new HttpException(
        {
          success: false,
          error: 'Ảnh upload vượt quá giới hạn 12 MB.',
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const uploadDir = uploadsDirectory();

    await fs.mkdir(uploadDir, {
      recursive: true,
    });

    const requested = safeBaseName(fileName || '');
    const requestedExtension = path
      .extname(requested)
      .toLowerCase();

    const extension =
      Object.values(MIME_EXTENSION).includes(
        requestedExtension,
      )
        ? requestedExtension
        : decoded.extension;

    const stem = safeBaseName(
      requested
        ? path.basename(
            requested,
            requestedExtension,
          )
        : 'image',
    );

    const finalName =
      [
        stem || 'image',
        Date.now(),
        crypto.randomBytes(6).toString('hex'),
      ].join('-') + extension;

    await fs.writeFile(
      path.join(uploadDir, finalName),
      decoded.buffer,
      {
        flag: 'wx',
      },
    );

    return {
      success: true,
      url: `/uploads/${finalName}`,
    };
  }

  private async sourceBuffer(rawUrl: string) {
    if (rawUrl.startsWith('/uploads/')) {
      const uploadRoot = uploadsDirectory();
      const relative = rawUrl.slice('/uploads/'.length);
      const localPath = path.resolve(
        uploadRoot,
        relative,
      );

      const rootPrefix = uploadRoot.endsWith(path.sep)
        ? uploadRoot
        : `${uploadRoot}${path.sep}`;

      if (
        localPath !== uploadRoot &&
        !localPath.startsWith(rootPrefix)
      ) {
        throw new HttpException(
          {
            error: 'Đường dẫn ảnh không hợp lệ.',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      try {
        return await fs.readFile(localPath);
      } catch {
        throw new HttpException(
          {
            error: 'Không tìm thấy ảnh.',
          },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    if (!allowedRemoteUrl(rawUrl)) {
      throw new HttpException(
        {
          error: 'Remote image host is not allowed',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const response = await fetch(rawUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new HttpException(
        {
          error: 'Không thể tải ảnh từ nguồn remote.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const contentType = String(
      response.headers.get('content-type') || '',
    ).toLowerCase();
    const contentLength = Number(
      response.headers.get('content-length') || 0,
    );

    if (!contentType.startsWith('image/')) {
      throw new HttpException(
        {
          error: 'Remote resource is not an image.',
        },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    if (
      contentLength &&
      contentLength > MAX_REMOTE_BYTES
    ) {
      throw new HttpException(
        {
          error: 'Remote image is too large.',
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_REMOTE_BYTES) {
      throw new HttpException(
        {
          error: 'Remote image is too large.',
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    return Buffer.from(arrayBuffer);
  }

  async transform(query: Record<string, unknown>) {
    const rawUrl = String(query.url || '').trim();

    if (!rawUrl) {
      throw new HttpException(
        {
          error: 'Thiếu URL ảnh.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const width = clampNumber(
      query.w,
      64,
      2400,
      600,
    );
    const quality = clampNumber(
      query.q,
      40,
      95,
      80,
    );
    const format = String(
      query.fmt || 'webp',
    ).toLowerCase();

    const source = await this.sourceBuffer(rawUrl);
    const pipeline = sharp(source)
      .rotate()
      .resize({
        width,
        withoutEnlargement: true,
        fit:
          String(query.resize || '').toLowerCase() ===
          'cover'
            ? 'cover'
            : 'inside',
      });

    if (format === 'jpg' || format === 'jpeg') {
      return {
        buffer: await pipeline
          .jpeg({ quality })
          .toBuffer(),
        contentType: 'image/jpeg',
      };
    }

    if (format === 'png') {
      return {
        buffer: await pipeline
          .png()
          .toBuffer(),
        contentType: 'image/png',
      };
    }

    if (format === 'avif') {
      return {
        buffer: await pipeline
          .avif({ quality })
          .toBuffer(),
        contentType: 'image/avif',
      };
    }

    return {
      buffer: await pipeline
        .webp({ quality })
        .toBuffer(),
      contentType: 'image/webp',
    };
  }
}
