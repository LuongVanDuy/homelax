import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { locationSearchResultSchema, type LocationSearchResult } from '@tinyhouse/contracts';
import { PostgresService } from '../../database/postgres.service.js';

const busyError = () => new HttpException({ error: 'Dịch vụ đang bận. Vui lòng thử lại sau ít giây.', retryAfterSeconds: 2 }, 429);

@Injectable()
export class LocationsService {
  private readonly cache = new Map<string, { until: number; data: LocationSearchResult }>();
  private busy = false;
  private cooldownUntil = 0;
  constructor(private readonly db: PostgresService) {}

  async search(query: string): Promise<LocationSearchResult> {
    const key = query.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi');
    const cached = this.cache.get(key);
    if (cached && cached.until > Date.now()) return cached.data;
    if (this.busy || this.cooldownUntil > Date.now()) throw busyError();
    const endpoint = process.env.GEOCODING_SEARCH_URL || 'https://nominatim.openstreetmap.org/search';
    if (endpoint === 'disabled') throw new ServiceUnavailableException('Dịch vụ tìm địa chỉ đang tạm dừng.');
    this.busy = true;
    try {
      const data = await this.db.transaction(async client => {
        // Same database lock across API workers and both CMS/public consumers.
        // Never queue a public request while holding another pool connection.
        const lock = await client.query('SELECT pg_try_advisory_xact_lock(1846142535, 1) AS acquired');
        if (!lock.rows[0]?.acquired) throw busyError();
        try {
          const url = new URL(endpoint);
          url.search = new URLSearchParams({
            format: 'jsonv2', q: query, limit: '5', countrycodes: 'vn',
            viewbox: '105.28,21.40,106.06,20.55', bounded: '1', 'accept-language': 'vi,en',
          }).toString();
          const response = await fetch(url, {
            headers: { 'User-Agent': process.env.GEOCODING_USER_AGENT || 'Homelax/1.0 (+https://truyencuaho.com/lien-he)', Accept: 'application/json' },
            signal: AbortSignal.timeout(8000), redirect: 'error',
          });
          if (!response.ok) {
            if (response.status === 429) this.cooldownUntil = Date.now() + 60000;
            throw new ServiceUnavailableException('Chưa tìm được địa chỉ. Vui lòng thử lại sau.');
          }
          const raw: unknown = await response.json();
          if (!Array.isArray(raw)) throw new Error('Invalid provider response');
          return locationSearchResultSchema.parse({
            items: raw.slice(0, 5).map(item => ({
              id: `${item.osm_type}:${item.osm_id}`, label: String(item.display_name || '').slice(0, 320),
              lat: Number(item.lat), lng: Number(item.lon),
            })), attribution: '© OpenStreetMap contributors',
          });
        } finally {
          // Keep the cross-worker lock for a full second AFTER network completion,
          // also on timeout/error, so the next call can never start too early.
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      });
      for (const [cacheKey, entry] of this.cache) if (entry.until <= Date.now()) this.cache.delete(cacheKey);
      if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { data, until: Date.now() + 86400000 });
      return data;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Chưa tìm được địa chỉ. Vui lòng thử lại sau.');
    } finally { this.busy = false; }
  }
}
