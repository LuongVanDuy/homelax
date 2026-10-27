import type { DatabaseRestorePreview, DatabaseRestoreResult, DatabaseSnapshot } from '@tinyhouse/contracts';
import { parseSnapshotText } from './databaseAdminPresentation';

export type SnapshotFile = { name: string; size: number; text: () => Promise<string> };
export type PreparedRestore = {
  file: { name: string; size: number; database: string; version: string; schemaVersion: number; exportedAt: string };
  report: DatabaseRestorePreview;
};
type RestoreApi = {
  preview: (snapshot: DatabaseSnapshot) => Promise<DatabaseRestorePreview>;
  restore: (snapshot: DatabaseSnapshot) => Promise<DatabaseRestoreResult>;
};

export class RestoreOutcomeUnknownError extends Error {
  constructor() {
    super('Chưa xác nhận được kết quả khôi phục. Không gửi lại thao tác; hãy kiểm tra dữ liệu và đăng nhập lại trước khi tiếp tục.');
    this.name = 'RestoreOutcomeUnknownError';
  }
}

/** Raw rows/password hashes stay private, never in Query/Mutation data or browser storage. */
export class DatabaseRestoreWorkflow {
  private snapshot: DatabaseSnapshot | null = null;
  private epoch = 0;
  private busy = false;
  private terminal = false;

  constructor(private readonly api: RestoreApi, private readonly isCurrent: () => boolean) {}

  clear() {
    this.epoch += 1;
    this.snapshot = null;
  }

  isCurrentSession() { return this.isCurrent(); }

  private assertCurrent() {
    if (!this.isCurrent()) throw new Error('Phiên đăng nhập đã thay đổi. Hãy chọn và kiểm tra lại tệp.');
  }

  async preview(file: SnapshotFile): Promise<PreparedRestore> {
    this.assertCurrent();
    if (this.busy || this.terminal) throw new Error('Chưa thể kiểm tra tệp trong trạng thái hiện tại.');
    this.clear();
    const epoch = this.epoch;
    this.busy = true;
    try {
      if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Vui lòng chọn tệp sao lưu .json.');
      if (file.size === 0) throw new Error('Tệp sao lưu đang rỗng.');
      let text: string;
      try { text = await file.text(); }
      catch { throw new Error('Không đọc được tệp đã chọn. Hãy chọn lại tệp.'); }
      this.assertCurrent();
      if (epoch !== this.epoch) throw new Error('Tệp đã thay đổi; cần kiểm tra lại.');
      const snapshot = parseSnapshotText(text);
      const report = await this.api.preview(snapshot);
      this.assertCurrent();
      if (epoch !== this.epoch) throw new Error('Tệp đã thay đổi; bỏ qua kết quả kiểm tra cũ.');
      this.snapshot = snapshot;
      return {
        file: { name: file.name, size: file.size, database: snapshot.database,
          version: snapshot.version, schemaVersion: snapshot.schemaVersion, exportedAt: snapshot.exportedAt },
        report,
      };
    } finally { this.busy = false; }
  }

  async apply(): Promise<DatabaseRestoreResult> {
    this.assertCurrent();
    if (this.busy || this.terminal || !this.snapshot) {
      throw new Error('Cần kiểm tra tệp thành công trước khi xác nhận khôi phục.');
    }
    const snapshot = this.snapshot;
    // Consume the approval before sending. Never replay an apply after a lost response.
    this.snapshot = null;
    this.busy = true;
    try {
      const result = await this.api.restore(snapshot);
      this.terminal = true;
      // Navigation does not cancel a committed restore. Only a different session
      // prevents this old task from logging out a newly authenticated user.
      this.assertCurrent();
      return result;
    } catch (error) {
      const status = Number((error as { status?: number } | null)?.status || 0);
      if (!status || status >= 500) {
        this.terminal = true;
        throw new RestoreOutcomeUnknownError();
      }
      throw error;
    } finally { this.busy = false; }
  }
}
