import { z } from 'zod';

export const ROOM_AUDIENCES = [
  { value: 'student', label: 'Sinh viên' },
  { value: 'young-worker', label: 'Người trẻ đi làm' },
  { value: 'couple', label: 'Cặp đôi' },
  { value: 'family', label: 'Hộ gia đình' },
] as const;
export const roomAudienceSchema = z.enum(['student', 'young-worker', 'couple', 'family']);
export const roomAudienceGroupsSchema = z.array(roomAudienceSchema).max(4).refine(values => new Set(values).size === values.length, 'Nhóm khách không được trùng.');
export const roomAudienceFilterSchema = z.enum(['', 'student', 'young-worker', 'couple', 'family']).default('');
