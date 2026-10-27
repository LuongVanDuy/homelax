import {
  databaseRestorePreviewSchema,
  databaseRestoreResultSchema,
  databaseStatsSchema,
  type DatabaseSnapshot,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { validateSnapshot } from '../databaseAdminPresentation';

export const databaseAdminApi = {
  async stats() {
    const parsed = databaseStatsSchema.safeParse(
      await ApiClient.get('/v2/database/stats', { bypassCache: true }),
    );
    if (!parsed.success) throw new Error('Không đọc được trạng thái PostgreSQL. Vui lòng thử lại.');
    return parsed.data;
  },
  async backup() {
    // Snapshot.data is application data, NOT an API response envelope.
    return validateSnapshot(await ApiClient.post('/v2/database/backup', {}, { unwrapData: false }));
  },
  async preview(snapshot: DatabaseSnapshot) {
    const parsed = databaseRestorePreviewSchema.safeParse(await ApiClient.post('/v2/database/restore', {
      snapshot, confirm: 'RESTORE_POSTGRESQL', dryRun: true,
    }));
    if (!parsed.success) throw new Error('Máy chủ chưa trả về kết quả kiểm tra hợp lệ.');
    return parsed.data;
  },
  async restore(snapshot: DatabaseSnapshot) {
    const parsed = databaseRestoreResultSchema.safeParse(await ApiClient.post('/v2/database/restore', {
      snapshot, confirm: 'RESTORE_POSTGRESQL', dryRun: false,
    }));
    // Do not report a malformed/lost response as a failed transaction or retry it.
    if (!parsed.success) throw new Error('Không xác nhận được kết quả khôi phục từ máy chủ.');
    return parsed.data;
  },
};

export function downloadSnapshot(snapshot: DatabaseSnapshot) {
  const valid = validateSnapshot(snapshot);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `tinyhouse_postgres_backup_${timestamp}.json`;
  const blob = new Blob([JSON.stringify(valid, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Allow the browser to start reading the object URL before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { filename, exportedAt: valid.exportedAt };
}
