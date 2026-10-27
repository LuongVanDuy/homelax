import { CmsFilterField, CmsFilterBar, CmsPageHeader, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useMemo, useState } from 'react';
import { Alert, Box, Button, MenuItem, Paper, Skeleton, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useMediaQuery, useTheme } from '@mui/material';
import type { CtvMyCustomerItem, CtvMyCustomersWorkspace } from '@tinyhouse/contracts';
import { BadgeDollarSign, CalendarDays, CheckCircle2, Copy, History, UserCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { AppIdentity } from '../../auth/identityStore';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { toast } from '../../../lib/toast';
import { useMyAffiliateCustomersQuery } from '../api';

const stageLabels = {
  introduced: 'Mới giới thiệu',
  booking: 'Đã có lịch xem',
  deal: 'Đã có giao dịch',
  deposited: 'Đã cọc',
  closed: 'Đã chốt',
  cancelled: 'Đã hủy',
} as const;

const stageColors = {
  introduced: 'default',
  booking: 'info',
  deal: 'info',
  deposited: 'warning',
  closed: 'success',
  cancelled: 'default',
} as const;

function money(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function when(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function StatCard({
  icon,
  label,
  value,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, minWidth: 0 }}>
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
      <Box sx={{
        width: 36,
        height: 36,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 2,
        bgcolor: 'action.hover',
        flex: '0 0 auto',
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
        {secondary && <Typography variant="caption" color="text.secondary">{secondary}</Typography>}
      </Box>
    </Stack>
  </Paper>;
}

function CommissionSummary({ item }: { item: CtvMyCustomerItem }) {
  const commission = item.commission;
  if (commission.reviewAmount > 0) {
    return <Stack spacing={0.25}>
      <Chip size="small" color="warning" variant="outlined" label="Cần xử lý" sx={{ alignSelf: 'flex-start' }} />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{money(commission.reviewAmount)}</Typography>
    </Stack>;
  }
  if (commission.unresolvedCount > 0) {
    return <Stack spacing={0.25}>
      <Chip size="small" color="info" variant="outlined" label="Chờ xác định" sx={{ alignSelf: 'flex-start' }} />
      <Typography variant="caption" color="text.secondary">{commission.unresolvedCount} khoản chưa có tiền</Typography>
    </Stack>;
  }
  if (commission.approvedUnpaidAmount > 0) {
    return <Stack spacing={0.25}>
      <Chip size="small" color="success" variant="outlined" label="Đã duyệt · chờ đợt" sx={{ alignSelf: 'flex-start' }} />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{money(commission.approvedUnpaidAmount)}</Typography>
      {commission.latestPayoutCycleDate && <Typography variant="caption" color="text.secondary">
        Đợt {commission.latestPayoutCycleDate}
      </Typography>}
    </Stack>;
  }
  if (commission.pendingApprovalAmount > 0) {
    return <Stack spacing={0.25}>
      <Chip size="small" color="warning" variant="outlined" label="Chờ duyệt" sx={{ alignSelf: 'flex-start' }} />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{money(commission.pendingApprovalAmount)}</Typography>
    </Stack>;
  }
  if (commission.paidAmount > 0) {
    return <Stack spacing={0.25}>
      <Chip size="small" color="success" variant="outlined" label="Đã thanh toán" sx={{ alignSelf: 'flex-start' }} />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{money(commission.paidAmount)}</Typography>
    </Stack>;
  }
  return <Typography variant="body2" color="text.secondary">Chưa phát sinh</Typography>;
}

function CustomerMobileCard({ item }: { item: CtvMyCustomerItem }) {
  return <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }}>{item.customerName || 'Khách chưa có tên'}</Typography>
          <Typography variant="body2" color="text.secondary">{item.phone || '-'}</Typography>
        </Box>
        <Chip size="small" label={stageLabels[item.stage]} color={stageColors[item.stage]} variant="outlined" />
      </Stack>

      <Box>
        <Typography variant="caption" color="text.secondary">Lịch xem gần nhất</Typography>
        <Typography variant="body2" sx={{ fontWeight: 650 }}>
          {item.latestBooking
            ? `${item.latestBooking.buildingCode || item.latestBooking.buildingName} · ${item.latestBooking.roomUnitCode || '-'}`
            : 'Chưa có lịch'}
        </Typography>
        {item.latestBooking && <Typography variant="caption" color="text.secondary">
          {item.latestBooking.status} · {when(item.latestBooking.appointmentAt)}
        </Typography>}
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">Giao dịch</Typography>
        {item.latestDeal ? <>
          <Typography variant="body2" sx={{ fontWeight: 650 }}>
            {item.latestDeal.buildingCode} · {item.latestDeal.roomUnitCode} · {money(item.latestDeal.finalPrice)}/tháng
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Cọc {money(item.latestDeal.depositPaidAmount)}
            {item.latestDeal.depositRequiredAmount !== null ? ` / ${money(item.latestDeal.depositRequiredAmount)}` : ''}
            {item.latestDeal.contractMonths ? ` · ${item.latestDeal.contractMonths} tháng` : ''}
          </Typography>
        </> : <Typography variant="body2" color="text.secondary">Chưa có giao dịch</Typography>}
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">Hoa hồng</Typography>
        <CommissionSummary item={item} />
      </Box>
    </Stack>
  </Paper>;
}

export function MyCustomersPage({ currentUser }: { currentUser: AppIdentity }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search, 300);

  const query = useMyAffiliateCustomersQuery({
    page: page + 1,
    pageSize,
    search: debouncedSearch,
    stage: stage as '' | 'introduced' | 'booking' | 'deal' | 'deposited' | 'closed' | 'cancelled',
    sort: 'sourceRecordedAt',
    order: 'desc',
  }, String(currentUser?.roleCode || '').toLowerCase() === 'ctv_sale');

  const data: CtvMyCustomersWorkspace | undefined = query.data;
  const stats = data?.stats;
  const items = data?.items || [];

  const totalCommission = useMemo(() =>
    (stats?.commissionPendingApprovalAmount || 0)
    + (stats?.commissionApprovedUnpaidAmount || 0)
    + (stats?.commissionPaidAmount || 0)
    + (stats?.commissionReviewAmount || 0),
  [stats]);

  const copyReferral = async () => {
    const token = data?.referral.affiliateToken;
    if (!token) {
      toast.error('Chưa tải được liên kết giới thiệu.');
      return;
    }
    const url = new URL('/', window.location.origin);
    url.searchParams.set('ref', token);
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success('Đã sao chép liên kết giới thiệu.');
    } catch {
      toast.error('Không thể sao chép liên kết giới thiệu.');
    }
  };

  if (query.isError) {
    return <Alert severity="error">
      {query.error instanceof Error ? query.error.message : 'Không thể tải danh sách khách của bạn.'}
    </Alert>;
  }

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Khách của tôi </>} description={<> Theo dõi khách bạn giới thiệu từ lúc có thông tin, đặt lịch xem, giao dịch thuê đến hoa hồng. </>} actions={<><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button variant="outlined" startIcon={<Copy size={17} />} onClick={() => void copyReferral()}
          disabled={!data?.referral.affiliateToken}>
          Sao chép liên kết giới thiệu
        </Button>
        <Button variant="outlined" startIcon={<History size={17} />}
          onClick={() => navigate('/cms/commission-history')}>
          Lịch sử hoa hồng
        </Button>
      </Stack></>} />

    {query.isPending ? <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
      {[0, 1, 2, 3].map((key) => <Skeleton key={key} variant="rounded" height={94} />)}
    </Box> : <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
      <StatCard icon={<Users size={20} />} label="Khách giới thiệu" value={stats?.customerCount || 0} />
      <StatCard icon={<CalendarDays size={20} />} label="Lịch xem" value={stats?.bookingCount || 0} />
      <StatCard icon={<UserCheck size={20} />} label="Đã cọc / Đã chốt"
        value={`${stats?.depositedCustomerCount || 0} / ${stats?.closedCustomerCount || 0}`}
        secondary="Theo giao dịch thuê" />
      <StatCard icon={<BadgeDollarSign size={20} />} label="Tổng hoa hồng đang theo dõi"
        value={money(totalCommission)}
        secondary={`Đã trả ${money(stats?.commissionPaidAmount || 0)}`} />
    </Box>}

    {(stats?.commissionReviewAmount || 0) > 0 && <Alert severity="warning">
      Có {money(stats?.commissionReviewAmount || 0)} hoa hồng đang cần quản trị viên xử lý trước khi tiếp tục duyệt hoặc thanh toán.
    </Alert>}

    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
      <CmsFilterBar>
        <CmsFilterField
          size="small"
          fullWidth
          placeholder="Tìm tên, SĐT, tòa hoặc mã căn…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        <CmsFilterField
          select
          size="small"
          label="Hành trình"
          value={stage}
          onChange={(event) => {
            setStage(event.target.value);
            setPage(0);
          }}
          sx={{ minWidth: { sm: 190 } }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          {Object.entries(stageLabels).map(([value, label]) =>
            <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </CmsFilterField>
      </CmsFilterBar>
    </Paper>

    {query.isFetching && !query.isPending && <Alert severity="info">Đang cập nhật dữ liệu…</Alert>}

    {!query.isPending && items.length === 0 ? <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
      <CheckCircle2 size={28} />
      <Typography sx={{ mt: 1, fontWeight: 700 }}>Chưa có khách phù hợp</Typography>
      <Typography variant="body2" color="text.secondary">
        Khách sẽ xuất hiện tại đây khi được ghi nhận từ liên kết giới thiệu của bạn.
      </Typography>
    </Paper> : mobile ? <Stack spacing={1.25}>
      {items.map((item) => <CustomerMobileCard key={item.customerId} item={item} />)}
    </Stack> : <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Khách</TableCell>
            <TableCell>Hành trình</TableCell>
            <TableCell>Lịch xem gần nhất</TableCell>
            <TableCell>Giao dịch</TableCell>
            <TableCell>Hoa hồng</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => <TableRow key={item.customerId} hover>
            <TableCell sx={{ minWidth: 160 }}>
              <Typography sx={{ fontWeight: 750 }}>{item.customerName || 'Khách chưa có tên'}</Typography>
              <Typography variant="caption" color="text.secondary">{item.phone || '-'}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Nguồn: {when(item.sourceRecordedAt || item.createdAt)}
              </Typography>
            </TableCell>
            <TableCell>
              <Chip size="small" label={stageLabels[item.stage]} color={stageColors[item.stage]} variant="outlined" />
            </TableCell>
            <TableCell sx={{ minWidth: 190 }}>
              {item.latestBooking ? <>
                <Typography variant="body2" sx={{ fontWeight: 650 }}>
                  {item.latestBooking.buildingCode || item.latestBooking.buildingName} · {item.latestBooking.roomUnitCode || '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.latestBooking.status} · {when(item.latestBooking.appointmentAt)}
                </Typography>
              </> : <Typography variant="body2" color="text.secondary">Chưa có lịch</Typography>}
            </TableCell>
            <TableCell sx={{ minWidth: 210 }}>
              {item.latestDeal ? <>
                <Typography variant="body2" sx={{ fontWeight: 650 }}>
                  {item.latestDeal.buildingCode} · {item.latestDeal.roomUnitCode}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {money(item.latestDeal.finalPrice)}/tháng
                  {item.latestDeal.contractMonths ? ` · ${item.latestDeal.contractMonths} tháng` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cọc {money(item.latestDeal.depositPaidAmount)}
                  {item.latestDeal.depositRequiredAmount !== null
                    ? ` / ${money(item.latestDeal.depositRequiredAmount)}`
                    : ''}
                </Typography>
              </> : <Typography variant="body2" color="text.secondary">Chưa có giao dịch</Typography>}
            </TableCell>
            <TableCell sx={{ minWidth: 175 }}>
              <CommissionSummary item={item} />
            </TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </TableContainer>}

    <TablePagination
      component="div"
      count={data?.pagination.total || 0}
      page={page}
      onPageChange={(_event, next) => setPage(next)}
      rowsPerPage={pageSize}
      onRowsPerPageChange={(event) => {
        setPageSize(Number(event.target.value));
        setPage(0);
      }}
      rowsPerPageOptions={[10, 20, 50]}
      labelRowsPerPage="Số dòng"
    />
  </Stack>;
}
