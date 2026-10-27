import { CmsBadge as Chip } from '../../components/cms';
import { useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Pagination, Stack, TextField, Typography } from '@mui/material';
import { Link } from 'react-router';
import { intakeTransitions, intakeUpdateSchema, type IntakeSummary, type IntakeUpdate } from '@tinyhouse/contracts';
import { Controller, useForm, z, zodResolver } from '../../app/forms';
import { LoadingState } from '../../components/ui/feedback/LoadingState';
import { toast } from '../../lib/toast';
import { useIntakeDetail, useIntakeHistory, useIntakeUpdate } from './intake.api';
import { intakeColors, intakeDate, intakeKinds, intakeStatuses } from './intakePresentation';

function ProcessingForm({ data, reload, onBusy }: { data: IntakeSummary; reload: () => void; onBusy: (busy: boolean) => void }) {
  const mutation = useIntakeUpdate(data.id);
  const locked = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof intakeUpdateSchema>, unknown, IntakeUpdate>({
    resolver: zodResolver(intakeUpdateSchema), defaultValues: { status: data.status, note: '', expectedRevision: data.revision },
  });
  const note = register('note');
  return <Box component="form" noValidate onSubmit={event => { void handleSubmit(async values => {
    if (locked.current || uncertain) return;
    locked.current = true; onBusy(true);
    try { await mutation.mutateAsync(values); toast.success('Đã cập nhật yêu cầu.'); }
    catch (error) {
      if ((error as {code?: string}).code !== 'SESSION_CHANGED') {
        toast.error(error instanceof Error ? error.message : 'Không thể xác nhận kết quả lưu.');
        setUncertain(true);
      }
    } finally { locked.current = false; onBusy(false); }
  })(event); }}>
    <Stack spacing={2}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Xử lý yêu cầu</Typography>
      {uncertain && <Alert severity="warning" action={<Button color="inherit" onClick={reload}>Tải lại</Button>}>Tải lại yêu cầu để kiểm tra kết quả trước khi lưu tiếp.</Alert>}
      <Controller name="status" control={control} render={({ field }) => <TextField {...field} select label="Trạng thái" disabled={isSubmitting || uncertain}>
        {[data.status, ...intakeTransitions[data.status]].map(status => <MenuItem key={status} value={status}>{intakeStatuses[status]}</MenuItem>)}
      </TextField>} />
      <TextField {...note} inputRef={note.ref} ref={undefined} label="Ghi chú xử lý" multiline minRows={3} disabled={isSubmitting || uncertain}
        error={Boolean(errors.note)} helperText={errors.note?.message || 'Ghi lại kết quả liên hệ hoặc nội dung cần theo dõi.'} />
      <Button type="submit" variant="contained" disabled={isSubmitting || uncertain} sx={{ alignSelf: 'flex-end' }}>{isSubmitting ? 'Đang lưu…' : 'Lưu xử lý'}</Button>
    </Stack>
  </Box>;
}

function History({ id }: { id: string }) {
  const [page,setPage] = useState(1);
  const query = useIntakeHistory(id,page);
  return <Stack spacing={2}>
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Lịch sử xử lý</Typography>
    {query.isError ? <Alert severity="error" action={<Button onClick={()=>void query.refetch()} color="inherit">Thử lại</Button>}>Không tải được lịch sử.</Alert>
      : !query.data ? <LoadingState minHeight={100} /> : !query.data.items.length ? <Typography color="text.secondary" variant="body2">Chưa có thao tác xử lý.</Typography>
      : query.data.items.map(item=><Box key={item.id} sx={{ borderLeft: '3px solid', borderColor: 'primary.main', pl: 2 }}>
        <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.actorName}</Typography>
          <Typography variant="caption" color="text.secondary">{intakeDate(item.createdAt)}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">{item.fromStatus === item.toStatus ? `${intakeStatuses[item.toStatus]} · Thêm ghi chú` : `${intakeStatuses[item.fromStatus]} → ${intakeStatuses[item.toStatus]}`}</Typography>
        {item.note && <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.note}</Typography>}
      </Box>)}
    {query.data && query.data.pagination.totalPages > 1 && <Pagination page={page} count={query.data.pagination.totalPages} onChange={(_,next)=>setPage(next)} />}
  </Stack>;
}

export function IntakeDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useIntakeDetail(id);
  const [busy,setBusy] = useState(false);
  const [reloadVersion,setReloadVersion] = useState(0);
  const data = query.data;
  return <Dialog open fullWidth maxWidth="md" onClose={busy ? undefined : onClose} aria-labelledby="intake-title"
    slotProps={{ paper: { sx: { height: '80vh' } } }}>
    <DialogTitle id="intake-title">Chi tiết yêu cầu</DialogTitle>
    <DialogContent dividers>
      {query.isError ? <Alert severity="error" action={<Button onClick={()=>void query.refetch()} color="inherit">Thử lại</Button>}>Không tải được yêu cầu.</Alert>
        : !data ? <LoadingState /> : <Stack spacing={3}>
          <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, overflowWrap: 'anywhere' }}>{data.name}</Typography>
            <Chip label={intakeStatuses[data.status]} color={intakeColors[data.status]} size="small" sx={{ color: 'common.white' }} />
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Box><Typography variant="caption" color="text.secondary">Số điện thoại</Typography><Typography component="a" href={`tel:${data.phone}`} sx={{ display: "block" }} color="text.primary">{data.phone}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Loại yêu cầu</Typography><Typography>{intakeKinds[data.kind]}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Tiếp nhận lúc (UTC+7)</Typography><Typography>{intakeDate(data.createdAt)}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Cập nhật gần nhất</Typography><Typography>{intakeDate(data.updatedAt)}</Typography></Box>
          </Box>
          <Box><Typography variant="subtitle2">Nhu cầu</Typography><Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{data.need || 'Chưa cung cấp'}</Typography></Box>
          {data.kind === 'collaborator_registration' && <Alert severity="info" action={<Button component={Link} to="/cms/users" disabled={busy} color="inherit">Người dùng</Button>}>Sau khi xác minh, tạo hoặc gán tài khoản CTV tại mục Người dùng.</Alert>}
          <Divider />
          <ProcessingForm key={`${data.revision}:${reloadVersion}`} data={data} onBusy={setBusy} reload={()=>{
            void query.refetch().then(result=>{ if (!result.isError) setReloadVersion(value=>value+1); });
          }} />
          <Divider />
          <History key={data.revision} id={id} />
        </Stack>}
    </DialogContent>
    <DialogActions sx={{ p: 2 }}><Button onClick={onClose} disabled={busy} color="inherit">Đóng</Button></DialogActions>
  </Dialog>;
}
