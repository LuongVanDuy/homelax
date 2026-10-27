import { BadRequestException } from '@nestjs/common';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { uploadsDirectory } from '../../config/uploads-directory.js';

export async function prepareRegistrationAvatar(image: string | undefined) {
  if (!image) return null;
  let buffer: Buffer;
  try {
    const input = Buffer.from(image.split(',')[1] || '', 'base64');
    if (!input.length || input.length > 5 * 1024 * 1024) throw new Error('size');
    buffer = await sharp(input, { limitInputPixels: 25_000_000 })
      .rotate().resize(512, 512, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch {
    throw new BadRequestException({ success: false, error: 'Ảnh đại diện không hợp lệ hoặc vượt quá 5 MB.',
      details: [{ path: 'avatarImage', message: 'Chọn ảnh JPG, PNG, WebP, GIF hoặc AVIF tối đa 5 MB.' }] });
  }
  const name = `avatar-${crypto.randomUUID()}.webp`;
  const directory = uploadsDirectory();
  const file = path.join(directory, name);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(file, buffer, { flag: 'wx' });
  return { url: `/uploads/${name}`, discard: () => fs.unlink(file) };
}
