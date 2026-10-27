import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '../../../services/apiClient';
import { toast } from '../../../lib/toast';
import type { DatabaseRestoreWorkflow, SnapshotFile } from '../databaseRestoreWorkflow';
import { databaseAdminApi, downloadSnapshot } from './database-admin.api';

export async function endRestoredSession(cache: { clear: () => void }) {
  // logoutSession ends local identity/token synchronously; a failed logout HTTP
  // call must not make a committed database restore look like a failed restore.
  const logout = ApiClient.logoutSession();
  cache.clear();
  await logout.catch(() => undefined);
}

export function useExportDatabaseMutation() {
  return useMutation({
    mutationKey: ['database-admin', 'export'],
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      const version = ApiClient.getSessionVersion();
      const snapshot = await databaseAdminApi.backup();
      if (version !== ApiClient.getSessionVersion()) throw new Error('Phiên đăng nhập đã thay đổi.');
      return downloadSnapshot(snapshot);
    },
  });
}

export function usePreviewDatabaseRestoreMutation(
  workflow: DatabaseRestoreWorkflow,
  file: { current: SnapshotFile | null },
) {
  return useMutation({
    mutationKey: ['database-admin', 'preview'],
    retry: false,
    gcTime: 0,
    mutationFn: () => {
      if (!file.current) throw new Error('Vui lòng chọn một bản sao lưu.');
      return workflow.preview(file.current);
    },
  });
}

export function useApplyDatabaseRestoreMutation(workflow: DatabaseRestoreWorkflow) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['database-admin', 'restore'],
    retry: false,
    gcTime: 0,
    mutationFn: () => workflow.apply(),
    onSuccess: async () => {
      if (!workflow.isCurrentSession()) return;
      toast.success('Khôi phục dữ liệu thành công. Vui lòng đăng nhập lại.', { duration: 8000 });
      await endRestoredSession(queryClient);
    },
  });
}
