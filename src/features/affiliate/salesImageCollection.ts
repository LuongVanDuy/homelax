import type { PublicRoomType } from '@tinyhouse/contracts';
import { publicBrand } from '../../app/theme/publicBrand';
import { getValidImageUrl } from '../../utils/roomHierarchy';

export type SalesImageRoom = Pick<PublicRoomType, 'id' | 'buildingCode' | 'buildingName' | 'type' | 'address' | 'coverImage' | 'images' | 'vacantCount' | 'listingState'> & { price: number | null };

export function collectionPages<T>(items: T[], pageSize: number): T[][] {
  if (![1, 6, 8, 12].includes(pageSize)) throw new Error('Số phòng mỗi ảnh không hợp lệ.');
  return Array.from({ length: Math.ceil(items.length / pageSize) }, (_, index) => items.slice(index * pageSize, (index + 1) * pageSize));
}

export const canIncludeSalesRoom = (room: SalesImageRoom) => room.listingState === 'listed' && room.vacantCount > 0;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(() => { img.src = ''; reject(new Error('Ảnh tải quá lâu. Hãy thử lại.')); }, 15000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('Không tải được ảnh phòng. Hãy thử lại hoặc bỏ chọn phòng này.')); };
    img.src = url;
  });
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / ratio, sh = h / ratio;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number) {
  let result = value;
  while (result.length && ctx.measureText(result).width > width) result = result.slice(0, -1);
  if (result !== value) result = result.slice(0, -1) + '…';
  ctx.fillText(result, x, y, width);
}

/** Browser Canvas only; source data stays within Homelax and no images are sent to third parties. */
export async function renderSalesCollection(rooms: SalesImageRoom[], columns: number, contact: string, offset = 0) {
  if (![1, 2, 3, 4].includes(columns) || !rooms.length || rooms.length > 12 || rooms.some(room => !canIncludeSalesRoom(room))) throw new Error('Danh sách phòng không còn phù hợp.');
  const photos = await Promise.all(rooms.map(async room => {
    const urls = [...new Set([room.coverImage, ...room.images].map(url => getValidImageUrl(url)).filter(Boolean))].slice(0, 4);
    return Promise.all(urls.map(url => loadImage(`/api/v2/images/transform?url=${encodeURIComponent(url)}&w=800&q=88&fmt=jpeg`)));
  }));
  const logo = await loadImage('/homelax-logo.png');
  const canvas = document.createElement('canvas');
  const pad = 28, gap = 20, width = 1200, cardWidth = (width - pad * 2 - gap * (columns - 1)) / columns;
  const photoHeight = Math.round(cardWidth * .72), cardHeight = photoHeight + 154;
  canvas.width = width;
  canvas.height = 138 + Math.ceil(rooms.length / columns) * (cardHeight + gap) + 90;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ tạo ảnh.');
  ctx.fillStyle = '#F1F5F9'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#101D30'; ctx.fillRect(0, 0, width, 112);
  ctx.textBaseline = 'top'; ctx.fillStyle = '#FFF'; ctx.font = '700 38px Arial';
  ctx.drawImage(logo, 165, 405, 1590, 270, pad, 30, 212, 36);
  ctx.font = '400 23px Arial'; ctx.fillText('PHÒNG TRỐNG DÀNH CHO BẠN', 275, 36);
  rooms.forEach((room, index) => {
    const x = pad + (index % columns) * (cardWidth + gap), y = 138 + Math.floor(index / columns) * (cardHeight + gap);
    ctx.fillStyle = '#FFF'; ctx.fillRect(x, y, cardWidth, cardHeight);
    const images = photos[index];
    if (images.length === 0) {
      ctx.fillStyle = '#E2E8F0'; ctx.fillRect(x, y, cardWidth, photoHeight);
      ctx.fillStyle = '#475569'; ctx.font = '400 22px Arial'; ctx.fillText('Chưa có ảnh', x + 20, y + photoHeight / 2);
    } else {
      const photoCols = images.length === 1 ? 1 : 2, photoRows = images.length <= 2 ? 1 : 2;
      images.forEach((img, i) => cover(ctx, img, x + i % photoCols * cardWidth / photoCols, y + Math.floor(i / photoCols) * photoHeight / photoRows, (images.length === 3 && i === 2 ? cardWidth : cardWidth / photoCols) - 2, photoHeight / photoRows - 2));
    }
    ctx.fillStyle = publicBrand.orange; ctx.fillRect(x + 10, y + 10, 44, 44);
    ctx.fillStyle = '#FFF'; ctx.font = '700 26px Arial'; ctx.fillText(String(offset + index + 1), x + 20, y + 18);
    ctx.fillStyle = '#101D30'; ctx.font = '700 25px Arial';
    text(ctx, `${room.buildingCode || room.buildingName} · ${room.type}`, x + 16, y + photoHeight + 14, cardWidth - 32);
    ctx.fillStyle = '#475569'; ctx.font = '400 21px Arial'; text(ctx, room.address, x + 16, y + photoHeight + 49, cardWidth - 32);
    ctx.fillStyle = '#9B5400'; ctx.font = '700 27px Arial';
    text(ctx, room.price && room.price > 0 ? `${room.price.toLocaleString('vi-VN')} đ/tháng` : 'Liên hệ giá thuê', x + 16, y + photoHeight + 81, cardWidth - 32);
    ctx.fillStyle = '#287D40'; ctx.font = '400 21px Arial'; ctx.fillText(`${room.vacantCount} căn trống`, x + 16, y + photoHeight + 119);
  });
  ctx.fillStyle = '#101D30'; ctx.font = '700 28px Arial'; text(ctx, contact, pad, canvas.height - 70, width - pad * 2);
  ctx.font = '400 19px Arial'; ctx.fillStyle = '#475569'; ctx.fillText('Liên hệ CTV để kiểm tra phòng và hẹn lịch xem.', pad, canvas.height - 32);
  return canvas;
}
