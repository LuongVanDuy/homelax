import { CmsBadge as Chip } from '../../../components/cms';
import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Ban, DoorOpen, ReceiptText } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { AppIdentity } from '../../auth/identityStore';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { useAddDealNoteMutation, useAssignDealMutation, useDealAssigneesQuery, useDealQuery, useDealRoomUnitHistoryQuery } from '../api';
import { useCommissionLedgerDealQuery } from '../../commission-ledger/api';
import { toast } from '../../../lib/toast';
import { formatDealMoney, getDealStage } from '../dealPresentation';
import { DealCancelDialog } from './DealCancelDialog';
import { DealCommercialTermsDialog } from './DealCommercialTermsDialog';
import { DealContractDepositDialog } from './DealContractDepositDialog';
import { DealRoomUnitDialog } from './DealRoomUnitDialog';
import { DealRentalScheduleDialog } from './DealRentalScheduleDialog';

function Info({ label, value, secondary }: {
  label: string;
  value: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return <Box sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 700, overflowWrap: 'anywhere' }}>
      {value || '-'}
    </Typography>
    {secondary && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
      {secondary}
    </Typography>}
  </Box>;
}

function when(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

export function DealDetailsDialog({
  dealId,
  currentUser,
  onClose,
}: {
  dealId: string;
  currentUser: AppIdentity;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const query = useDealQuery(dealId);
  const roomHistoryQuery = useDealRoomUnitHistoryQuery(dealId, Boolean(query.data));
  const canViewCommission = ['admin', 'superadmin'].includes(String(currentUser?.roleCode || '').toLowerCase());
  const commissionQuery = useCommissionLedgerDealQuery(dealId, canViewCommission && Boolean(query.data));
  const assigneesQuery = useDealAssigneesQuery(Boolean(query.data && currentUser?.dealScope === 'all'));
  const assignMutation = useAssignDealMutation();
  const noteMutation = useAddDealNoteMutation();

  const [commercialTermsOpen, setCommercialTermsOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [rentalScheduleOpen, setRentalScheduleOpen] = useState(false);
  const [roomUnitOpen, setRoomUnitOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);

  const deal = query.data;
  const noteValue = noteDraft ?? deal?.notes ?? '';
  const active = deal?.lifecycleStatus !== 'cancelled';
  const canManageContract = Boolean(currentUser?.dealCanManageContractDeposit) && active;
  const canManageSchedule = Boolean(currentUser?.dealCanManageRentalSchedule) && active;
  const canManageLifecycle = Boolean(currentUser?.dealCanManageLifecycle) && active;
  const canManageAssignment = currentUser?.dealScope === 'all' && canManageLifecycle;
  const stage = deal ? getDealStage(deal) : null;
  const stageColor = stage?.tone === 'neutral' ? 'default' : stage?.tone;

  const saveAssignment = async (assignedUserId: string) => {
    if (!deal || assignMutation.isPending) return;
    try {
      await assignMutation.mutateAsync({
        id: deal.id,
        assignment: { assignedUserId: assignedUserId || null },
      });
      toast.success('Đã cập nhật người phụ trách giao dịch.');
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật người phụ trách.');
    }
  };

  const saveNote = async () => {
    if (!deal || !noteValue.trim() || noteMutation.isPending) return;
    try {
      await noteMutation.mutateAsync({ id: deal.id, note: { note: noteValue.trim() } });
      toast.success('Đã lưu ghi chú giao dịch.');
      setNoteDraft(null);
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu ghi chú.');
    }
  };

  return <Dialog open fullWidth maxWidth="md" onClose={onClose}>
    <DialogTitle>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <ReceiptText size={22} />
        <Box>
          <Typography sx={{ fontWeight: 800 }}>Chi tiết giao dịch thuê</Typography>
          <Typography variant="caption" color="text.secondary">{dealId}</Typography>
        </Box>
      </Stack>
    </DialogTitle>

    <DialogContent dividers>
      {query.isPending ? <LoadingState label="Đang tải giao dịch…" minHeight={280} /> :
        query.isError ? <ErrorState
          title="Không tải được giao dịch"
          description="Vui lòng thử lại."
          action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
        /> : deal && stage ? <Stack spacing={3}>
          <Box sx={{
            p: 2,
            border: 1,
            borderColor: stage.tone === 'error' ? 'error.main' : 'divider',
            borderRadius: 2.5,
            bgcolor: stage.tone === 'error' ? 'error.50' : 'action.hover',
          }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
              sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
              <Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                  <Chip size="small" label={stage.label} color={stageColor} />
                  <Typography variant="caption" color="text.secondary">{deal.id}</Typography>
                </Stack>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>Việc tiếp theo</Typography>
                <Typography variant="body2" color="text.secondary">{stage.nextAction}</Typography>
              </Box>
              {canManageLifecycle && <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<DoorOpen size={17} />} onClick={() => setRoomUnitOpen(true)}>
                  Đổi căn
                </Button>
                <Button color="error" variant="outlined" startIcon={<Ban size={17} />} onClick={() => setCancelOpen(true)}>
                  Hủy giao dịch
                </Button>
              </Stack>}
            </Stack>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.25 }}>Khách hàng</Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
              <Info label="Khách" value={deal.customerName} secondary={deal.customerPhone || undefined} />
              <Info
                label="Nguồn"
                value={[deal.sourceType, deal.sourceChannel].filter(Boolean).join(' · ') || 'Chưa ghi nhận'}
                secondary={deal.collaboratorName ? `CTV: ${deal.collaboratorName}` : undefined}
              />
            </Box>
            <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap' }}>
              <Button size="small" onClick={() => navigate(`/cms/customers?customer=${encodeURIComponent(deal.customerId)}`)}>
                Xem hồ sơ khách
              </Button>
              {deal.bookingId && <Button size="small" onClick={() => navigate(`/cms/bookings?booking=${encodeURIComponent(deal.bookingId!)}`)}>
                Xem lịch xem nguồn
              </Button>}
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
              sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1.25 }}>
              <Typography sx={{ fontWeight: 800 }}>Căn thuê & điều khoản</Typography>
              <Stack direction="row" spacing={1}>
                {canManageContract && <Button variant="outlined" size="small" onClick={() => setCommercialTermsOpen(true)}>
                  Cập nhật điều khoản
                </Button>}
                {canManageLifecycle && <Button variant="outlined" size="small" onClick={() => setRoomUnitOpen(true)}>Đổi căn</Button>}
              </Stack>
            </Stack>
            <Box sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
            }}>
              <Info label="Tòa nhà" value={deal.buildingName || deal.buildingCode} secondary={deal.buildingCode} />
              <Info label="Căn thuê" value={deal.roomUnitCode} secondary={deal.roomTypeName} />
              <Info label="Giá thuê / tháng" value={formatDealMoney(deal.finalPrice)} />
              <Info
                label="Thời hạn hợp đồng"
                value={deal.contractMonths === null ? 'Chưa xác định' : `${deal.contractMonths} tháng`}
              />
            </Box>
            {roomHistoryQuery.data?.length ? <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Lịch sử đổi căn</Typography>
              <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                {roomHistoryQuery.data.map((item) => <Typography key={item.id} variant="body2">
                  {item.fromRoomUnitCode} → {item.toRoomUnitCode} · {when(item.changedAt)}
                </Typography>)}
              </Stack>
            </Box> : null}
          </Box>

          <Divider />

          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
                <Typography sx={{ fontWeight: 800 }}>Hợp đồng</Typography>
                {canManageContract && <Button size="small" onClick={() => setContractOpen(true)}>Cập nhật</Button>}
              </Stack>
              <Info
                label="Trạng thái"
                value={deal.contractSigned ? 'Đã ký' : 'Chưa ký'}
                secondary={deal.contractSignedAt ? `Xác nhận lúc ${when(deal.contractSignedAt)}` : undefined}
              />
            </Box>

            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
                <Typography sx={{ fontWeight: 800 }}>Tiền cọc</Typography>
                {canManageContract && <Button size="small" onClick={() => setContractOpen(true)}>Cập nhật</Button>}
              </Stack>
              <Info
                label="Đã ghi nhận / cần đóng"
                value={deal.depositRequiredAmount === null
                  ? `${formatDealMoney(deal.depositPaidAmount)} / chưa xác định`
                  : `${formatDealMoney(deal.depositPaidAmount)} / ${formatDealMoney(deal.depositRequiredAmount)}`}
                secondary={deal.depositFullyPaid ? 'Đã đủ cọc' : 'Chưa đủ cọc'}
              />
            </Box>
          </Box>

          <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
              sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1.25 }}>
              <Typography sx={{ fontWeight: 800 }}>Lịch thuê</Typography>
              {canManageSchedule && <Button variant="outlined" size="small" onClick={() => setRentalScheduleOpen(true)}>
                Cập nhật lịch thuê
              </Button>}
            </Stack>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
              <Info label="Bắt đầu" value={deal.rentalStartDate || 'Chưa xác định'} />
              <Info label="Kết thúc" value={deal.rentalEndDate || 'Chưa xác định'} />
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.25 }}>Người phụ trách</Typography>
            {canManageAssignment ? <TextField
              select
              fullWidth
              label="Người phụ trách giao dịch"
              value={deal.assignedUserId || ''}
              disabled={assignMutation.isPending}
              onChange={(event) => void saveAssignment(event.target.value)}
            >
              <MenuItem value="">Chưa phân công</MenuItem>
              {(assigneesQuery.data || []).map((user) => <MenuItem key={user.id} value={user.id}>
                {user.name || user.email} · {user.roleName}
              </MenuItem>)}
            </TextField> : <Info
              label="Phụ trách"
              value={deal.assignedUserName || 'Chưa phân công'}
              secondary={deal.assignedUserEmail || undefined}
            />}
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.25 }}>Ghi chú nội bộ</Typography>
            <Stack spacing={1}>
              <TextField
                multiline
                minRows={3}
                value={noteValue}
                disabled={!canManageLifecycle || noteMutation.isPending}
                placeholder="Ghi chú tình hình xử lý giao dịch…"
                onChange={(event) => setNoteDraft(event.target.value)}
              />
              {canManageLifecycle && <Button
                variant="outlined"
                sx={{ alignSelf: 'flex-start' }}
                disabled={!noteValue.trim() || noteValue.trim() === deal.notes.trim() || noteMutation.isPending}
                onClick={() => void saveNote()}
              >
                Lưu ghi chú
              </Button>}
            </Stack>
          </Box>

          {canViewCommission && <Box sx={{ p: 1.75, border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}
              sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>Hoa hồng</Typography>
                <Typography variant="body2" color="text.secondary">
                  {commissionQuery.isPending
                    ? 'Đang kiểm tra…'
                    : commissionQuery.data
                      ? commissionQuery.data.reviewRequired
                        ? 'Có bản ghi · cần rà soát'
                        : 'Đã có bản ghi hoa hồng'
                      : 'Chưa có bản ghi hoa hồng'}
                </Typography>
              </Box>
              <Button size="small" onClick={() => navigate('/cms/commission-history')}>Xem hoa hồng</Button>
            </Stack>
          </Box>}

          <Divider />

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.25 }}>Lịch sử giao dịch</Typography>
            {deal.activity.length ? <Stack spacing={1}>
              {[...deal.activity].reverse().map((item) => <Box key={item.id} sx={{
                display: 'grid',
                gap: 0.35,
                gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' },
                p: 1.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
              }}>
                <Typography variant="caption" color="text.secondary">{when(item.createdAt)}</Typography>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.title}</Typography>
                  {item.detail && <Typography variant="caption" color="text.secondary">{item.detail}</Typography>}
                  {item.actorName && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {item.actorName}
                  </Typography>}
                </Box>
              </Box>)}
            </Stack> : <Typography variant="body2" color="text.secondary">Chưa có lịch sử thao tác.</Typography>}
          </Box>

          {deal.lifecycleStatus === 'cancelled' && <Box sx={{ p: 1.75, bgcolor: 'error.50', borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 800 }}>Giao dịch đã hủy</Typography>
            <Typography variant="body2" color="text.secondary">
              {when(deal.cancelledAt)}{deal.cancellationReason ? ` · ${deal.cancellationReason}` : ''}
            </Typography>
          </Box>}
        </Stack> : null}
    </DialogContent>

    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose}>Đóng</Button>
    </DialogActions>

    {deal && roomUnitOpen && <DealRoomUnitDialog
      deal={deal}
      onClose={() => setRoomUnitOpen(false)}
      onUpdated={() => void query.refetch()}
    />}
    {deal && cancelOpen && <DealCancelDialog
      deal={deal}
      onClose={() => setCancelOpen(false)}
      onUpdated={() => void query.refetch()}
    />}
    {deal && rentalScheduleOpen && <DealRentalScheduleDialog
      deal={deal}
      onClose={() => setRentalScheduleOpen(false)}
      onUpdated={() => void query.refetch()}
    />}
    {deal && commercialTermsOpen && <DealCommercialTermsDialog
      deal={deal}
      onClose={() => setCommercialTermsOpen(false)}
      onUpdated={() => void query.refetch()}
    />}
    {deal && contractOpen && <DealContractDepositDialog
      deal={deal}
      onClose={() => setContractOpen(false)}
      onUpdated={() => void query.refetch()}
    />}
  </Dialog>;
}

