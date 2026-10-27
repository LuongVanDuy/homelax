import { CmsPageHeader, CmsBadge as Chip, CmsTable as Table } from '../../../components/cms';
import { useEffect, useRef, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Divider, FormControlLabel, LinearProgress, Paper, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { ChevronDown, Database, Download, FileCheck2, RefreshCw, Upload } from 'lucide-react';
import type { AppIdentity } from '../../auth/identityStore';
import { getIdentityScope, IdentityStore } from '../../auth/identityStore';
import { isCmsAdministrator } from '../../cms/navigation';
import { ApiClient } from '../../../services/apiClient';
import { toast } from '../../../lib/toast';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { databaseAdminApi } from '../api/database-admin.api';
import { useDatabaseStatsQuery } from '../api/database-admin.queries';
import { useApplyDatabaseRestoreMutation, useExportDatabaseMutation, usePreviewDatabaseRestoreMutation } from '../api/database-admin.mutations';
import { DatabaseRestoreWorkflow, RestoreOutcomeUnknownError, type SnapshotFile } from '../databaseRestoreWorkflow';
import { databaseAdminError, databaseFileSize, databaseNumber, databaseTableLabel, databaseTime } from '../databaseAdminPresentation';
import { RestorePreview } from '../components/RestorePreview';

export function DatabaseAdminPage({ currentUser }: { currentUser: AppIdentity }) {
  const allowed = isCmsAdministrator(currentUser);
  const statsQuery = useDatabaseStatsQuery(allowed);
  const fileRef = useRef<SnapshotFile | null>(null);
  const operationLock = useRef(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [workflow] = useState(() => {
    const version = ApiClient.getSessionVersion();
    const scope = getIdentityScope(currentUser);
    return new DatabaseRestoreWorkflow(databaseAdminApi, () =>
      version === ApiClient.getSessionVersion()
      && scope === getIdentityScope(IdentityStore.get())
      && isCmsAdministrator(IdentityStore.get()));
  });
  useEffect(() => () => { workflow.clear(); fileRef.current = null; }, [workflow]);

  const backup = useExportDatabaseMutation();
  const preview = usePreviewDatabaseRestoreMutation(workflow, fileRef);
  const restore = useApplyDatabaseRestoreMutation(workflow);
  const busy = backup.isPending || preview.isPending || restore.isPending;
  const unknownOutcome = restore.error instanceof RestoreOutcomeUnknownError;
  const stats = statsQuery.data;
  const connected = Boolean(stats?.connected) && !statsQuery.isError;
  const canConfirm = Boolean(preview.data) && acknowledged && !busy && !unknownOutcome && connected;

  const runExclusive = async (action: () => Promise<unknown>) => {
    if (operationLock.current) return;
    operationLock.current = true;
    try { await action(); }
    catch (error) { toast.error(databaseAdminError(error, 'Không thể hoàn tất thao tác.')); }
    finally { operationLock.current = false; }
  };

  const selectFile = (file: File | undefined) => {
    if (!file || operationLock.current || unknownOutcome) return;
    workflow.clear();
    preview.reset();
    restore.reset();
    fileRef.current = file;
    setSelectedFile({ name: file.name, size: file.size });
    setAcknowledged(false);
    setConfirmOpen(false);
  };

  const checkFile = () => runExclusive(async () => {
    setAcknowledged(false);
    setConfirmOpen(false);
    restore.reset();
    preview.reset();
    await preview.mutateAsync();
  });

  const applyRestore = () => runExclusive(async () => {
    if (!canConfirm) return;
    try { await restore.mutateAsync(); }
    finally {
      // Each explicit apply consumes its preview, even on a server rejection.
      preview.reset();
      setAcknowledged(false);
      setConfirmOpen(false);
      fileRef.current = null;
      setSelectedFile(null);
    }
  });

  if (!allowed) return <ErrorState title="Bạn không có quyền sao lưu dữ liệu"
    description="Chức năng này chỉ dành cho quản trị viên hệ thống." />;

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Sao lưu dữ liệu </>} description={<> Xuất bản sao lưu dữ liệu và kiểm tra tệp trước khi khôi phục. </>} actions={<><Button variant="outlined" color="inherit" startIcon={<RefreshCw size={18} />}
        disabled={busy || statsQuery.isFetching} onClick={() => void statsQuery.refetch()}>
        {statsQuery.isFetching ? 'Đang cập nhật…' : 'Làm mới trạng thái'}
      </Button></>} />

    {statsQuery.isPending ? <LoadingState label="Đang đọc trạng thái cơ sở dữ liệu…" minHeight={120} />
      : statsQuery.isError ? <ErrorState title="Không tải được trạng thái cơ sở dữ liệu"
        description={databaseAdminError(statsQuery.error, 'Vui lòng kiểm tra kết nối và thử lại.')}
        action={<Button disabled={busy} color="inherit" onClick={() => void statsQuery.refetch()}>Thử lại</Button>} />
        : stats && <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5}
            sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Database size={24} aria-hidden="true" />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }}>Cơ sở dữ liệu hệ thống</Typography>
                <Typography variant="body2" color="text.secondary">Trạng thái kết nối hiện tại</Typography>
              </Box>
              <Chip size="small" variant="outlined" color={connected ? 'success' : 'warning'}
                label={connected ? 'Đã kết nối' : 'Chưa kết nối'} />
            </Stack>
            <Box>
              <Typography variant="body2">Định dạng sao lưu v{stats.snapshotVersion}</Typography>
              <Typography variant="caption" color="text.secondary">
                Cập nhật {databaseTime(stats.timestamp)} · {databaseNumber(stats.latencyMs)} ms
              </Typography>
            </Box>
          </Stack>
        </Paper>}

    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'stretch' }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Download size={22} aria-hidden="true" />
            <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>Xuất bản sao lưu</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Tải tệp JSON đầy đủ dữ liệu và thông tin phiên bản để khôi phục. Không xuất refresh mã.
          </Typography>
          <Alert severity="warning">Tệp sao lưu chứa dữ liệu tài khoản. Chỉ lưu ở nơi an toàn và không chia sẻ công khai.</Alert>
          <Typography variant="body2" color="text.secondary">
            Ảnh và các tệp đã tải lên cần được sao lưu riêng.
          </Typography>
          <Button variant="contained" startIcon={<Download size={18} />}
            disabled={!connected || busy || unknownOutcome}
            onClick={() => void runExclusive(async () => {
              await backup.mutateAsync();
              toast.success('Đã tạo bản sao lưu và gửi tệp tới trình duyệt.');
            })} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>
            {backup.isPending ? 'Đang tạo bản sao lưu…' : 'Tải bản sao lưu JSON'}
          </Button>
          {backup.isPending && <LinearProgress aria-label="Đang tạo bản sao lưu" />}
          {backup.isError && <ErrorState title="Chưa xuất được bản sao lưu"
            description={databaseAdminError(backup.error, 'Hãy thử xuất lại bản sao lưu.')} />}
          {backup.data && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            Đã tạo tệp: {backup.data.filename}
          </Typography>}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Upload size={22} aria-hidden="true" />
            <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>Khôi phục dữ liệu</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Chọn tệp → kiểm tra trên máy chủ → xem đối chiếu và xác nhận. Chọn tệp không tự khôi phục dữ liệu.
          </Typography>
          <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {selectedFile ? `${selectedFile.name} · ${databaseFileSize(selectedFile.size)}` : 'Chưa chọn bản sao lưu'}
              </Typography>
              <Button component="label" variant="outlined" startIcon={<Upload size={18} />}
                disabled={busy || unknownOutcome} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>
                {selectedFile ? 'Chọn tệp khác' : 'Chọn tệp JSON'}
                <input hidden type="file" accept=".json,application/json" aria-label="Chọn bản sao lưu JSON"
                  disabled={busy || unknownOutcome} onChange={(event) => {
                    selectFile(event.target.files?.[0]);
                    event.target.value = '';
                  }} />
              </Button>
            </Stack>
          </Box>
          <Button variant="contained" color="secondary" startIcon={<FileCheck2 size={18} />}
            disabled={!selectedFile || busy || !connected || unknownOutcome} onClick={() => void checkFile()}
            sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>
            {preview.isPending ? 'Đang kiểm tra…' : 'Kiểm tra bản sao lưu'}
          </Button>
          {preview.isPending && <LinearProgress aria-label="Đang kiểm tra bản sao lưu" />}
          {preview.isError && <ErrorState title="Bản sao lưu chưa được xác nhận"
            description={databaseAdminError(preview.error, 'Vui lòng kiểm tra và chọn lại tệp.')} />}
        </Stack>
      </Paper>
    </Box>

    {restore.isError && <ErrorState
      title={unknownOutcome ? 'Cần kiểm tra kết quả trước khi tiếp tục' : 'Máy chủ chưa chấp nhận khôi phục'}
      description={databaseAdminError(restore.error, 'Vui lòng kiểm tra dữ liệu trước khi tiếp tục.')}
      action={unknownOutcome ? <Button color="inherit" onClick={() => void ApiClient.logoutSession().catch(() => undefined)}>
        Đăng xuất
      </Button> : undefined} />}

    {preview.data && <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack spacing={2}>
        <RestorePreview preview={preview.data} />
        {stats && stats.database !== preview.data.file.database && <Alert severity="warning">
          Bản sao lưu được tạo từ “{preview.data.file.database}”, trong khi dữ liệu hiện tại là “{stats.database}”. Hãy kiểm tra đúng nguồn trước khi tiếp tục.
        </Alert>}
        <Divider />
        <FormControlLabel control={<Checkbox checked={acknowledged} disabled={busy}
          onChange={(event) => setAcknowledged(event.target.checked)} />}
          label={<Typography variant="body2">Tôi đã lưu bản sao lưu hiện tại và hiểu rằng dữ liệu sẽ bị thay thế.</Typography>} />
        <Button color="error" variant="contained" disabled={!canConfirm}
          onClick={() => setConfirmOpen(true)} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-end' } }}>
          Khôi phục từ tệp này
        </Button>
      </Stack>
    </Paper>}

    {connected && stats && <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <AccordionSummary expandIcon={<ChevronDown size={18} />}>
        <Typography sx={{ fontWeight: 700 }}>Bảng dữ liệu hiện tại · {Object.keys(stats.counts).length} bảng</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table size="small" stickyHeader aria-label="Số bản ghi dữ liệu hiện tại">
            <TableHead><TableRow><TableCell>Bảng dữ liệu</TableCell><TableCell align="right">Số bản ghi</TableCell></TableRow></TableHead>
            <TableBody>{Object.entries(stats.counts).map(([table, count]) => <TableRow key={table}>
              <TableCell>{databaseTableLabel(table)}</TableCell>
              <TableCell align="right">{databaseNumber(count)}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>}

    <ConfirmDialog open={confirmOpen} title="Khôi phục dữ liệu?" danger loading={restore.isPending}
      description={`Khôi phục từ tệp ${preview.data?.file.name || ''}. Dữ liệu các bảng được nạp sẽ bị thay thế và các phiên đăng nhập bị thu hồi. Sau khi hoàn tất, bạn cần đăng nhập lại.`}
      confirmLabel="Xác nhận khôi phục" cancelLabel="Quay lại kiểm tra"
      onConfirm={applyRestore} onClose={() => setConfirmOpen(false)} />
  </Stack>;
}
