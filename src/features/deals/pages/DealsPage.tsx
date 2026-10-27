import { Eye, Plus, ReceiptText, Search } from 'lucide-react';
import { CmsRowActions, CmsActionsCell, CmsFilterField, CmsPageHeader, CmsListCard, CmsFilterBar, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState } from 'react';
import type { AppIdentity } from '../../auth/identityStore';
import { Box, Button, Divider, InputAdornment, LinearProgress, MenuItem, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

import { useSearchParams } from 'react-router';
import { EmptyState } from '../../../components/ui/feedback/EmptyState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useDealsPageQuery } from '../api';
import { formatDealMoney, getDealStage } from '../dealPresentation';
import { DealCreateDialog } from '../components/DealCreateDialog';
import { DealDetailsDialog } from '../components/DealDetailsDialog';
import { RentalScheduleTimeline } from '../components/RentalScheduleTimeline';

export function DealsPage({ currentUser }: { currentUser: AppIdentity }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'schedule'>('list');
  const [sort, setSort] = useState('created-desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('deal'));
  const [createOpen, setCreateOpen] = useState(Boolean(
    searchParams.get('createFromBooking') || searchParams.get('createDirectFor'),
  ));
  const canCreate = Boolean(currentUser?.dealCanCreate);
  const canCreateDirect = Boolean(currentUser?.dealCanCreateDirect);
  const debouncedSearch = useDebouncedValue(search, 350);

  const sortParams = view === 'schedule'
    ? { sort: 'rentalStartDate' as const, order: 'asc' as const }
    : sort === 'customer'
      ? { sort: 'customerName' as const, order: 'asc' as const }
      : sort === 'price-desc'
        ? { sort: 'finalPrice' as const, order: 'desc' as const }
        : { sort: 'createdAt' as const, order: 'desc' as const };

  const query = useDealsPageQuery({
    page: view === 'schedule' ? 1 : page + 1,
    pageSize: view === 'schedule' ? 500 : rowsPerPage,
    search: debouncedSearch,
    bookingId: '',
    customerId: '',
    lifecycleStatus: '',
    rentalSchedule: view === 'schedule' ? 'scheduled' : '',
    rentalDateFrom: '',
    rentalDateTo: '',
    ...sortParams,
  });
  const deals = query.data?.items || [];
  const total = query.data?.pagination.total || 0;

  const openDeal = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.delete('createFromBooking');
    next.delete('createDirectFor');
    next.set('deal', id);
    setSearchParams(next, { replace: true });
  };

  const closeDeal = () => {
    setSelectedId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('deal');
    setSearchParams(next, { replace: true });
  };

  const closeCreate = () => {
    setCreateOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete('createFromBooking');
    next.delete('createDirectFor');
    setSearchParams(next, { replace: true });
  };

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Giao dịch thuê </>} description={<> Theo dõi khách đã quyết định thuê: căn thực tế, hợp đồng, tiền cọc, lịch thuê và người phụ trách. </>} actions={<>{canCreate && <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>
        Tạo giao dịch
      </Button>}</>} />

    <CmsListCard variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ height: 3 }}>{query.isFetching && <LinearProgress sx={{ height: 3 }} />}</Box>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <CmsFilterBar inset>
          <CmsFilterField
            label="Tìm giao dịch"
            placeholder="Mã giao dịch, khách, SĐT, tòa, căn…"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> } }}
          />
          <CmsFilterField select label="Chế độ" value={view}
            onChange={(event) => { setView(event.target.value as 'list' | 'schedule'); setPage(0); }}>
            <MenuItem value="list">Danh sách</MenuItem>
            <MenuItem value="schedule">Lịch thuê</MenuItem>
          </CmsFilterField>
          {view === 'list' && <CmsFilterField select label="Sắp xếp" value={sort}
            onChange={(event) => { setSort(event.target.value); setPage(0); }}>
            <MenuItem value="created-desc">Mới tạo gần nhất</MenuItem>
            <MenuItem value="customer">Tên khách A–Z</MenuItem>
            <MenuItem value="price-desc">Giá chốt cao nhất</MenuItem>
          </CmsFilterField>}
        </CmsFilterBar>
      </Box>
      <Divider />

      {query.isError && <ErrorState
        title="Không tải được giao dịch"
        description="Vui lòng thử lại."
        action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
      />}

      {query.isPending ? <LoadingState
        label={view === 'schedule' ? 'Đang tải lịch thuê…' : 'Đang tải giao dịch…'}
        minHeight={320}
      /> : !deals.length ? <EmptyState
        icon={<ReceiptText size={36} />}
        title={total ? 'Không có giao dịch phù hợp' : 'Chưa có giao dịch thuê'}
        description={canCreate
          ? 'Khi khách quyết định thuê, tạo giao dịch từ lịch xem hoặc tạo trực tiếp.'
          : 'Chưa có giao dịch nào trong phạm vi được phân cho bạn.'}
        action={canCreate ? <Button variant="contained" onClick={() => setCreateOpen(true)}>Tạo giao dịch</Button> : undefined}
      /> : view === 'schedule' ? <>
        <RentalScheduleTimeline deals={deals} onSelect={openDeal} />
        {total > deals.length && <Typography variant="caption" color="warning.main" sx={{ px: 2, pb: 2 }}>
          Đang hiển thị 500 lịch thuê đầu trong phạm vi quyền hiện tại.
        </Typography>}
      </> : <>
        <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
          <Table aria-label="Danh sách giao dịch thuê">
            <TableHead><TableRow>
              <TableCell>Khách hàng</TableCell>
              <TableCell>Căn thuê</TableCell>
              <TableCell>Giai đoạn</TableCell>
              <TableCell>Hợp đồng / cọc</TableCell>
              <TableCell>Lịch thuê</TableCell>
              <TableCell>Phụ trách</TableCell>
              <TableCell>Giá thuê / tháng</TableCell>
            <CmsActionsCell>Thao tác</CmsActionsCell></TableRow></TableHead>
            <TableBody>{deals.map((deal) => {
              const stage = getDealStage(deal);
              const chipColor = stage.tone === 'neutral' ? 'default' : stage.tone;
              return <TableRow
                key={deal.id}
                hover
                role="button"
                tabIndex={0}
                sx={{ cursor: 'pointer' }}
                onClick={() => openDeal(deal.id)}
                onKeyDown={(event) => {
                  if (!['Enter', ' '].includes(event.key)) return;
                  event.preventDefault();
                  openDeal(deal.id);
                }}
              >
                <TableCell>
                  <Typography variant="body2" title={deal.id} sx={{ fontWeight: 800 }}>{deal.customerName}</Typography>
                  <Typography variant="caption" color="text.secondary">{deal.customerPhone || '-'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{deal.buildingCode} · {deal.roomUnitCode}</Typography>
                  <Typography variant="caption" color="text.secondary">{deal.roomTypeName}</Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <Chip size="small" label={stage.label} color={chipColor} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
                    {stage.nextAction}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {deal.contractSigned ? 'Đã ký HĐ' : 'Chưa ký HĐ'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {deal.depositRequiredAmount === null
                      ? `${formatDealMoney(deal.depositPaidAmount)} / chưa xác định`
                      : `${formatDealMoney(deal.depositPaidAmount)} / ${formatDealMoney(deal.depositRequiredAmount)}`}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{deal.rentalStartDate || 'Chưa có lịch'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {deal.rentalEndDate ? `→ ${deal.rentalEndDate}` : deal.rentalStartDate ? 'Chưa có ngày kết thúc' : '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{deal.assignedUserName || 'Chưa phân công'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{formatDealMoney(deal.finalPrice)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {deal.contractMonths === null ? 'Chưa chốt thời hạn' : `${deal.contractMonths} tháng`}
                  </Typography>
                </TableCell>
              <CmsActionsCell><CmsRowActions actions={[{id:'view',label:'Xem chi tiết',icon:<Eye />,onClick:()=>openDeal(deal.id)}]} /></CmsActionsCell></TableRow>;
            })}</TableBody>
          </Table>
        </TableContainer>

        <Stack divider={<Divider />} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {deals.map((deal) => {
            const stage = getDealStage(deal);
            const chipColor = stage.tone === 'neutral' ? 'default' : stage.tone;
            return <Box key={deal.id} role="button" tabIndex={0}
              onClick={() => openDeal(deal.id)}
              onKeyDown={(event) => {
                if (!['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                openDeal(deal.id);
              }}
              sx={{ p: 2, cursor: 'pointer' }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'start' }}>
                <Box>
                  <Typography title={deal.id} sx={{ fontWeight: 800 }}>{deal.customerName}</Typography>
                </Box>
                <Chip size="small" label={stage.label} color={chipColor} />
              </Stack>
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                {deal.buildingCode} · {deal.roomUnitCode} · {formatDealMoney(deal.finalPrice)} / tháng
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Thời hạn HĐ: {deal.contractMonths === null ? 'chưa xác định' : `${deal.contractMonths} tháng`}
              </Typography>
              <Typography variant="caption" color="text.secondary">{stage.nextAction}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Phụ trách: {deal.assignedUserName || 'Chưa phân công'}
              </Typography>
            <CmsRowActions actions={[{id:'view',label:'Xem chi tiết',icon:<Eye />,onClick:()=>openDeal(deal.id)}]} /></Box>;
          })}
        </Stack>
      </>}

      {view === 'list' && query.data && <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
        labelRowsPerPage="Số dòng:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        onPageChange={(_, value) => setPage(value)}
        onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
        sx={{ borderTop: 1, borderColor: 'divider' }}
      />}
    </CmsListCard>

    {createOpen && canCreate && <DealCreateDialog
      canCreateDirect={canCreateDirect}
      initialBookingId={searchParams.get('createFromBooking') || undefined}
      initialCustomerId={searchParams.get('createDirectFor') || undefined}
      onClose={closeCreate}
      onCreated={(id) => {
        closeCreate();
        openDeal(id);
        void query.refetch();
      }}
    />}

    {selectedId && <DealDetailsDialog
      dealId={selectedId}
      currentUser={currentUser}
      onClose={closeDeal}
    />}
  </Stack>;
}
