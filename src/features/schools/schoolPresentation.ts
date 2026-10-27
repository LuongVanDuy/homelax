import type { PublicSchool } from '@tinyhouse/contracts';

export const publicSchoolLabel = (school: Pick<PublicSchool, 'name' | 'campus'>) =>
  school.campus ? `${school.name} - ${school.campus}` : school.name;

export function schoolErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'Không thể thực hiện thao tác với trường học.';
}

export function schoolCoordinateLabel(
  latitude: number | null,
  longitude: number | null,
) {
  if (latitude === null || longitude === null) return 'Chưa có tọa độ';
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
