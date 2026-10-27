import { locationSearchResultSchema } from '@tinyhouse/contracts';

export async function searchAddresses(query: string, signal?: AbortSignal) {
  const response = await fetch(`/api/v2/locations/search?${new URLSearchParams({ q: query.trim() })}`, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000), credentials: 'omit',
  });
  if (!response.ok) throw new Error(response.status === 429
    ? 'Dịch vụ đang bận. Vui lòng thử lại sau ít giây.'
    : 'Chưa tìm được địa chỉ. Vui lòng thử lại.');
  return locationSearchResultSchema.parse(await response.json());
}
