import { CmsBadge as Chip } from '../../../components/cms';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router';
import type { CommissionHistoryItem } from '@tinyhouse/contracts';
import { toast } from '../../../lib/toast';
import type { ContactSummary } from '../contact.types';
import { displayRecordedDate } from '../contactPresentation';
import { useBookingsPageQuery } from '../../bookings/api';
import { useDealsPageQuery } from '../../deals/api';
import { getDealStage } from '../../deals/dealPresentation';
import { useAssignCollaboratorTypeMutation, useCollaboratorTypesQuery, useCommissionCollaboratorsQuery } from '../../commission-config/api';
import { useCommissionHistoryQuery } from '../../commission-ledger/api';

const SOURCE_LABELS: Record<string, string> = {
  website: 'Trang web',
  ctv: 'CTV',
  ads: 'Quảng cáo',
  social: 'Mạng xã hội',
  other: 'Khác',
};

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <Box sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography
      variant="body2"
      sx={{ mt: 0.25, fontWeight: 700, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
    >
      {value || '-'}
    </Typography>
  </Box>;
}

function when(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

function money(value: number | null) {
  if (value === null) return 'Chưa xác định số tiền';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function commissionState(item: CommissionHistoryItem) {
  if (item.reviewRequired) return { label: 'Cần kiểm tra', color: 'warning' as const };
  if (item.status === 'blocked_no_collaborator_type') {
    return { label: 'Chưa phân loại CTV', color: 'warning' as const };
  }
  if (item.status === 'blocked_no_policy') {
    return { label: 'Chưa có mức hoa hồng', color: 'warning' as const };
  }
  if (item.status === 'blocked_no_collaborator') {
    return { label: 'Thiếu CTV', color: 'warning' as const };
  }
  if (item.commissionAmount === null) {
    return { label: 'Chờ xác định số tiền', color: 'info' as const };
  }
  if (item.commissionAmount === 0) {
    return { label: 'Không phát sinh chi trả', color: 'default' as const };
  }
  if (item.paymentStatus === 'paid') return { label: 'Đã thanh toán', color: 'success' as const };
  if (item.withdrawalRequestedAt) return { label: 'Đã yêu cầu rút', color: 'warning' as const };
  return { label: 'Chờ thanh toán', color: 'info' as const };
}

export function ContactDetailsDialog({
  contact,
  canCreateBooking = false,
  canCreateDirectDeal = false,
  onClose,
}: {
  contact: ContactSummary;
  canCreateBooking?: boolean;
  canCreateDirectDeal?: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const isCustomer = 'sourceType' in contact;
  const isCollaborator = !isCustomer;

  const bookingsQuery = useBookingsPageQuery({
    page: 1,
    pageSize: 100,
    search: '',
    customerId: isCustomer ? contact.id : '',
    status: '',
    building: '',
    dateFrom: '',
    dateTo: '',
    assignee: '',
    sort: 'createdAt',
    order: 'desc',
  }, isCustomer);

  const dealsQuery = useDealsPageQuery({
    page: 1,
    pageSize: 100,
    search: '',
    customerId: isCustomer ? contact.id : '',
    bookingId: '',
    lifecycleStatus: '',
    rentalSchedule: '',
    rentalDateFrom: '',
    rentalDateTo: '',
    sort: 'createdAt',
    order: 'desc',
  }, isCustomer);

  const commissionCollaboratorsQuery = useCommissionCollaboratorsQuery(isCollaborator);
  const collaboratorTypesQuery = useCollaboratorTypesQuery(isCollaborator);
  const assignTypeMutation = useAssignCollaboratorTypeMutation();
  const commissionHistoryQuery = useCommissionHistoryQuery({
    page: 1,
    pageSize: 5,
    search: '',
    status: '',
    review: '',
    workflow: '',
    collaboratorId: isCollaborator ? contact.id : '',
    sort: 'eligibleAt',
    order: 'desc',
  }, isCollaborator);

  const recorded = 'ageRecordedAt' in contact ? displayRecordedDate(contact.ageRecordedAt) : '';
  const sourceRecorded = 'sourceRecordedAt' in contact && contact.sourceRecordedAt
    ? when(contact.sourceRecordedAt)
    : '';

  const bookings = bookingsQuery.data?.items || [];
  const deals = dealsQuery.data?.items || [];
  const timeline = isCustomer ? [
    ...bookings.map((booking) => ({
      key: `booking-${booking.id}`,
      at: booking.updatedAt || booking.createdAt || booking.appointmentAt || '',
      title: `Lịch xem · ${booking.status}`,
      subtitle: `${booking.id} · ${[booking.buildingCode, booking.roomTypeName, booking.roomNumber].filter(Boolean).join(' · ') || 'Chưa xác định phòng'}`,
      target: 'booking' as const,
      id: booking.id,
    })),
    ...deals.map((deal) => {
      const stage = getDealStage(deal);
      return {
        key: `deal-${deal.id}`,
        at: deal.updatedAt || deal.createdAt || '',
        title: `Giao dịch · ${stage.label}`,
        subtitle: `${deal.id} · ${deal.buildingCode} · ${deal.roomUnitCode}`,
        target: 'deal' as const,
        id: deal.id,
      };
    }),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at))) : [];

  const collaborator = isCollaborator
    ? (commissionCollaboratorsQuery.data || []).find((item) => item.id === contact.id)
    : undefined;
  const activeTypes = (collaboratorTypesQuery.data || []).filter((item) => !item.archivedAt);
  const recentCommissions = commissionHistoryQuery.data?.items || [];
  const commissionCount = commissionHistoryQuery.data?.pagination.total || 0;

  const updateCollaboratorType = async (collaboratorTypeId: string) => {
    if (!isCollaborator || assignTypeMutation.isPending) return;
    try {
      await assignTypeMutation.mutateAsync({
        id: contact.id,
        value: { collaboratorTypeId: collaboratorTypeId || null },
      });
      toast.success('Đã cập nhật loại cộng tác viên.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật loại cộng tác viên.');
    }
  };

  const copyAffiliateToken = async () => {
    if (!collaborator?.affiliateToken) return;
    try {
      await navigator.clipboard.writeText(collaborator.affiliateToken);
      toast.success('Đã sao chép mã affiliate.');
    } catch {
      toast.error('Không thể sao chép mã affiliate.');
    }
  };

  return <Dialog open fullWidth maxWidth="md" onClose={onClose} aria-labelledby="contact-details-title">
    <DialogTitle id="contact-details-title">
      <Typography sx={{ fontWeight: 800 }}>{contact.name}</Typography>
      <Typography variant="caption" color="text.secondary">{contact.id}</Typography>
    </DialogTitle>

    <DialogContent dividers>
      <Stack spacing={3}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {contact.archivedAt && <Chip label="Đã lưu trữ" variant="outlined" size="small" />}
          {isCustomer ? <>
            <Chip label={`${bookingsQuery.data?.pagination.total ?? contact.bookingIds.length} lịch xem`} size="small" variant="outlined" />
            <Chip label={`${dealsQuery.data?.pagination.total ?? contact.dealIds.length} giao dịch`} size="small" variant="outlined" />
            <Chip label={contact.userId ? 'Đã có tài khoản' : 'Chưa đăng ký tài khoản'} size="small" variant="outlined" />
          </> : <>
            <Chip
              label={collaborator?.collaboratorTypeName || 'Chưa phân loại CTV'}
              color={collaborator?.collaboratorTypeId ? 'success' : 'warning'}
              size="small"
              variant="outlined"
            />
            <Chip label={contact.userId ? 'Tài khoản đã liên kết' : 'Chưa liên kết tài khoản'} size="small" variant="outlined" />
            <Chip label={`${commissionCount} khoản hoa hồng`} size="small" variant="outlined" />
          </>}
        </Stack>

        <Box>
          <Typography sx={{ fontWeight: 800, mb: 1.25 }}>
            {isCustomer ? 'Thông tin khách hàng' : 'Thông tin cộng tác viên'}
          </Typography>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 2.5,
          }}>
            <Detail label="Số điện thoại" value={contact.phone} />
            <Detail label="Email" value={contact.email} />
            <Detail label="Tài khoản" value={contact.userId || (isCustomer ? 'Chưa đăng ký' : 'Chưa liên kết')} />
            {'age' in contact && <Detail
              label="Tuổi ghi nhận"
              value={contact.age !== null ? `${contact.age} tuổi${recorded ? ` · ${recorded}` : ''}` : undefined}
            />}
            {'sourceType' in contact && <Detail
              label="Nguồn ban đầu"
              value={contact.sourceType ? SOURCE_LABELS[contact.sourceType] || contact.sourceType : undefined}
            />}
            {'sourceChannel' in contact && <Detail label="Kênh nguồn" value={contact.sourceChannel} />}
            {'referredByCollaboratorId' in contact && <Detail label="CTV giới thiệu" value={contact.referredByCollaboratorId} />}
            {'sourceRecordedAt' in contact && <Detail label="Ghi nhận nguồn" value={sourceRecorded} />}
            <Box sx={{ gridColumn: '1 / -1' }}><Detail label="Địa chỉ" value={contact.address} /></Box>
            <Box sx={{ gridColumn: '1 / -1' }}><Detail label="Ghi chú" value={contact.notes} /></Box>
          </Box>
        </Box>

        {isCollaborator && <Box>
          <Typography sx={{ fontWeight: 800, mb: 1.25 }}>Giới thiệu & phân loại</Typography>
          <Box sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}>
            <TextField
              select
              fullWidth
              label="Loại cộng tác viên"
              value={collaborator?.collaboratorTypeId || ''}
              disabled={commissionCollaboratorsQuery.isPending || assignTypeMutation.isPending}
              onChange={(event) => void updateCollaboratorType(event.target.value)}
            >
              <MenuItem value="">Chưa phân loại</MenuItem>
              {activeTypes.map((type) => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}
            </TextField>

            <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">Mã affiliate</Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.35, fontWeight: 700, overflowWrap: 'anywhere' }}
              >
                {collaborator?.affiliateToken || 'Chưa có mã affiliate'}
              </Typography>
              {collaborator?.affiliateToken && <Button size="small" sx={{ mt: 0.75 }} onClick={() => void copyAffiliateToken()}>
                Sao chép mã
              </Button>}
            </Box>
          </Box>
        </Box>}

        {isCustomer && <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1.25 }}>
            <Box>
              <Typography sx={{ fontWeight: 800 }}>Hành trình khách hàng</Typography>
              <Typography variant="body2" color="text.secondary">
                Lịch xem và giao dịch của cùng một hồ sơ khách.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {canCreateBooking && <Button
                variant="outlined"
                onClick={() => navigate(`/cms/bookings?createForCustomer=${encodeURIComponent(contact.id)}`)}
              >
                Tạo lịch xem mới
              </Button>}
              {canCreateDirectDeal && <Button
                variant="outlined"
                onClick={() => navigate(`/cms/deals?createDirectFor=${encodeURIComponent(contact.id)}`)}
              >
                Tạo giao dịch trực tiếp
              </Button>}
            </Stack>
          </Stack>

          {(bookingsQuery.isPending || dealsQuery.isPending) ? <Typography variant="body2" color="text.secondary">
            Đang tải hành trình…
          </Typography> : timeline.length ? <Stack spacing={0.75}>
            {timeline.map((item) => <Box
              key={item.key}
              role="button"
              tabIndex={0}
              onClick={() => navigate(item.target === 'booking'
                ? `/cms/bookings?booking=${encodeURIComponent(item.id)}`
                : `/cms/deals?deal=${encodeURIComponent(item.id)}`)}
              onKeyDown={(event) => {
                if (!['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                navigate(item.target === 'booking'
                  ? `/cms/bookings?booking=${encodeURIComponent(item.id)}`
                  : `/cms/deals?deal=${encodeURIComponent(item.id)}`);
              }}
              sx={{
                display: 'grid',
                gap: 0.5,
                gridTemplateColumns: { xs: '1fr', sm: '170px 1fr auto' },
                p: 1.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Typography variant="caption" color="text.secondary">{when(item.at)}</Typography>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.title}</Typography>
                <Typography variant="caption" color="text.secondary">{item.subtitle}</Typography>
              </Box>
              <Typography variant="caption" color="primary.main">
                {item.target === 'booking' ? 'Xem lịch' : 'Xem giao dịch'}
              </Typography>
            </Box>)}
          </Stack> : <Typography variant="body2" color="text.secondary">
            Khách chưa có lịch xem hoặc giao dịch thuê.
          </Typography>}
        </Box>}

        {isCollaborator && <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1.25 }}>
            <Box>
              <Typography sx={{ fontWeight: 800 }}>Hoa hồng gần đây</Typography>
              <Typography variant="body2" color="text.secondary">
                Các khoản phát sinh từ những giao dịch được ghi nhận cho CTV này.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={() => navigate(`/cms/commission-history?collaborator=${encodeURIComponent(contact.id)}`)}
            >
              Xem toàn bộ hoa hồng
            </Button>
          </Stack>

          {commissionHistoryQuery.isPending ? <Typography variant="body2" color="text.secondary">
            Đang tải dữ liệu hoa hồng…
          </Typography> : recentCommissions.length ? <Stack spacing={0.75}>
            {recentCommissions.map((item) => {
              const state = commissionState(item);
              return <Box
                key={item.id}
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: { xs: '1fr', sm: '150px minmax(0, 1fr) auto' },
                  p: 1.25,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1.5,
                }}
              >
                <Typography variant="caption" color="text.secondary">{when(item.eligibleAt)}</Typography>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {item.buildingCode || item.buildingName} · {item.roomUnitCodeSnapshot}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.customerName || item.customerId} · {item.dealId}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.35, fontWeight: 700 }}>
                    {money(item.commissionAmount)}
                  </Typography>
                </Box>
                <Chip size="small" label={state.label} color={state.color} variant="outlined" />
              </Box>;
            })}
          </Stack> : <Typography variant="body2" color="text.secondary">
            CTV chưa có khoản hoa hồng nào được ghi nhận.
          </Typography>}
        </Box>}
      </Stack>
    </DialogContent>

    <DialogActions sx={{ p: 2.5 }}>
      <Button onClick={onClose}>Đóng</Button>
    </DialogActions>
  </Dialog>;
}
