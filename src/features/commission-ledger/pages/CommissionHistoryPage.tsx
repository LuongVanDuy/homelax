import { CmsFilterBar, CmsFilterField, CmsRowActions, CmsActionsCell, CmsPageHeader, CmsListCard, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';
import { CircleAlert, Eye, Users, Settings2, Calculator, Wallet, Check, BadgeCheck } from 'lucide-react';

import { useMemo, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, LinearProgress, Paper, Stack, MenuItem, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { CommissionHistoryItem } from '@tinyhouse/contracts';
import type { AppIdentity } from '../../auth/identityStore';
import { useNavigate, useSearchParams } from 'react-router';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useApproveCommissionAccountantMutation, useApproveCommissionAdminMutation, useCommissionHistoryQuery, useCommissionMonthlyStatementQuery, useMarkCommissionPaidMutation, useRequestCommissionWithdrawalMutation } from '../api';
import { useCommissionCollaboratorsQuery } from '../../commission-config/api';
import { toast } from '../../../lib/toast';
import { EmptyState } from '../../../components/ui/feedback/EmptyState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { CommissionCalculationDialog } from '../components/CommissionCalculationDialog';
import { CommissionExceptionResolutionDialog } from '../components/CommissionExceptionResolutionDialog';

type HistoryView = 'actionRequired' | 'unpaid' | 'paid' | 'all' | 'monthly';

function money(value: number | null) {
  if (value === null) return 'Chưa xác định';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function when(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

function currentCommissionMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  return `${year}-${month}`;
}

function commissionState(item: CommissionHistoryItem) {
  if (item.reviewRequired) {
    const reason = item.reviewReason.includes('deal_cancelled')
      ? 'Giao dịch đã hủy'
      : item.reviewReason.includes('contract_deposit_completion_reversed')
        ? 'Điều kiện ký/cọc đã bị đảo'
        : 'Giao dịch đã thay đổi';
    return {
      label: 'Cần xử lý',
      color: 'warning' as const,
      description: `${reason}. Quản trị viên cần rà soát trước khi tiếp tục thanh toán.`,
    };
  }
  if (item.status === 'blocked_no_collaborator') {
    return {
      label: 'Thiếu CTV',
      color: 'warning' as const,
      description: 'Giao dịch chưa có cộng tác viên được ghi nhận.',
    };
  }
  if (item.status === 'blocked_no_collaborator_type') {
    return {
      label: 'Chưa phân loại CTV',
      color: 'warning' as const,
      description: 'Cần chọn loại CTV trước khi đối chiếu mức hoa hồng.',
    };
  }
  if (item.status === 'blocked_no_policy') {
    return {
      label: 'Chưa có mức hoa hồng',
      color: 'warning' as const,
      description: 'Chưa có cấu hình phù hợp cho căn và loại CTV này.',
    };
  }
  if (item.commissionAmount === null) {
    return {
      label: 'Chờ xác định số tiền',
      color: 'info' as const,
      description: 'Giao dịch đã đủ điều kiện nhưng chưa được nhập số tiền hoa hồng.',
    };
  }
  if (item.commissionAmount === 0) {
    return {
      label: 'Không phát sinh chi trả',
      color: 'default' as const,
      description: item.exceptionResolutionCount > 0
        ? 'Trường hợp ngoại lệ đã được xử lý và số hoa hồng phải trả là 0.'
        : 'Số hoa hồng đã được xác định là 0.',
    };
  }
  if (item.paymentStatus === 'paid') {
    return {
      label: 'Đã thanh toán',
      color: 'success' as const,
      description: item.paidAt ? `Xác nhận thanh toán ${when(item.paidAt)}` : 'Đã xác nhận thanh toán.',
    };
  }

  const requestSuffix = item.withdrawalRequestedAt
    ? ` · CTV đã yêu cầu rút ${when(item.withdrawalRequestedAt)}`
    : '';
  if (!item.adminApprovedAt && !item.accountantApprovedAt) {
    return {
      label: 'Chờ 2 bên duyệt',
      color: 'warning' as const,
      description: `Cần Quản trị viên và Kế toán cùng duyệt trước khi xếp đợt thanh toán${requestSuffix}.`,
    };
  }
  if (!item.adminApprovedAt) {
    return {
      label: 'Chờ Quản trị viên duyệt',
      color: 'warning' as const,
      description: `Kế toán đã duyệt; còn thiếu Quản trị viên${requestSuffix}.`,
    };
  }
  if (!item.accountantApprovedAt) {
    return {
      label: 'Chờ Kế toán duyệt',
      color: 'warning' as const,
      description: `Quản trị viên đã duyệt; còn thiếu Kế toán${requestSuffix}.`,
    };
  }
  if (item.payoutDue) {
    return {
      label: 'Đến đợt thanh toán',
      color: 'success' as const,
      description: `Đã đủ hai duyệt · đợt ${item.payoutCycleDate || '-'}${requestSuffix}.`,
    };
  }
  return {
    label: 'Đã duyệt · chờ đợt',
    color: 'info' as const,
    description: `Đã đủ hai duyệt · đợt ${item.payoutCycleDate || '-'}${requestSuffix}.`,
  };
}

function calculationBreakdown(item: CommissionHistoryItem) {
  if (item.grossCommissionX === null) return '';
  const parts = [
    `X ${money(item.grossCommissionX)}`,
    `Thuế ${money(item.taxAmount)}`,
    `Quỹ ${money(item.allocationPool)}`,
    `CTV base ${money(item.ctvBaseAmount)}`,
  ];
  if ((item.ctvBonusAmount || 0) > 0) parts.push(`Thưởng ${money(item.ctvBonusAmount)}`);
  return parts.join(' · ');
}

function CommissionActions({
  item,
  isAdmin,
  isAccountant,
  isCtv,
  requestPending,
  adminApprovalPending,
  accountantApprovalPending,
  paidPending,
  onCalculate,
  onResolveException,
  onApproveAdmin,
  onApproveAccountant,
  onRequest,
  onMarkPaid,
}: {
  item: CommissionHistoryItem;
  isAdmin: boolean;
  isAccountant: boolean;
  isCtv: boolean;
  requestPending: boolean;
  adminApprovalPending: boolean;
  accountantApprovalPending: boolean;
  paidPending: boolean;
  onCalculate: (id: string) => void;
  onResolveException: (id: string) => void;
  onApproveAdmin: (id: string) => void;
  onApproveAccountant: (id: string) => void;
  onRequest: (id: string) => void;
  onMarkPaid: (id: string) => void;
}) {
  const navigate = useNavigate();
  const actionable = item.status === 'eligible_pending_amount'
    && !item.reviewRequired
    && item.commissionAmount !== null
    && item.commissionAmount > 0
    && item.paymentStatus === 'unpaid';

  if (item.reviewRequired) {
    const a04Reason = item.reviewReason.includes('deal_cancelled')
      || item.reviewReason.includes('contract_deposit_completion_reversed');
    const canResolve = isAdmin
      && a04Reason
      && item.paymentStatus === 'unpaid'
      && !item.withdrawalRequestedAt
      && Boolean(item.collaboratorId);

    if (canResolve) {
      return <CmsRowActions actions={[{id:'action-0',label:"Xử lý hủy / cọc",icon:<CircleAlert />,onClick:() => onResolveException(item.id)}]} />;
    }

    return isAdmin
      ? <CmsRowActions actions={[{id:'action-0',label:"Xem giao dịch",icon:<Eye />,onClick:() => navigate(`/cms/deals?deal=${encodeURIComponent(item.dealId)}`)}]} />
      : <Typography variant="caption" color="text.secondary">Chờ Quản trị viên xử lý rà soát</Typography>;
  }

  if (item.status === 'blocked_no_collaborator_type' && item.collaboratorId && isAdmin) {
    return <CmsRowActions actions={[{id:'action-0',label:"Phân loại CTV",icon:<Users />,onClick:() => navigate(`/cms/ctv?ctv=${encodeURIComponent(item.collaboratorId!)}`)}]} />;
  }

  if (item.status === 'blocked_no_policy' && isAdmin) {
    return <CmsRowActions actions={[{id:'action-0',label:"Tạo mức hoa hồng",icon:<Settings2 />,onClick:() => navigate('/cms/commission-config')}]} />;
  }

  if (item.status === 'blocked_no_collaborator' && isAdmin) {
    return <CmsRowActions actions={[{id:'action-0',label:"Xem giao dịch",icon:<Eye />,onClick:() => navigate(`/cms/deals?deal=${encodeURIComponent(item.dealId)}`)}]} />;
  }

  if (item.paymentStatus === 'paid') {
    return <Typography variant="caption" color="text.secondary">
      {when(item.paidAt)}
    </Typography>;
  }

  if (isAdmin
    && item.status === 'eligible_pending_amount'
    && !item.reviewRequired
    && item.paymentStatus === 'unpaid'
    && item.commissionAmount === null
    && item.collaboratorId) {
    return <CmsRowActions actions={[{id:'action-0',label:"Tính hoa hồng",icon:<Calculator />,onClick:() => onCalculate(item.id)}]} />;
  }

  if (isCtv) {
    return <CmsRowActions actions={[{id:'action-0',label:item.withdrawalRequestedAt ? 'Đã yêu cầu rút' : 'Yêu cầu rút',icon:<Wallet />,onClick:() => onRequest(item.id),disabled:!actionable || Boolean(item.withdrawalRequestedAt) || requestPending}]} />;
  }

  if (isAdmin && actionable) {
    if (!item.adminApprovedAt) {
      return <CmsRowActions actions={[{id:'action-0',label:"Quản trị viên duyệt",icon:<Check />,onClick:() => onApproveAdmin(item.id),disabled:adminApprovalPending}]} />;
    }
    if (!item.accountantApprovedAt) {
      return <Typography variant="caption" color="text.secondary">Chờ Kế toán duyệt</Typography>;
    }
    if (!item.payoutDue) {
      return <Typography variant="caption" color="text.secondary">
        Đợt thanh toán: {item.payoutCycleDate || '-'}
      </Typography>;
    }
    return <CmsRowActions actions={[{id:'action-0',label:"Xác nhận đã thanh toán",icon:<BadgeCheck />,onClick:() => onMarkPaid(item.id),disabled:paidPending}]} />;
  }

  if (isAccountant && actionable) {
    if (!item.accountantApprovedAt) {
      return <CmsRowActions actions={[{id:'action-0',label:"Kế toán duyệt",icon:<Check />,onClick:() => onApproveAccountant(item.id),disabled:accountantApprovalPending}]} />;
    }
    if (!item.adminApprovedAt) {
      return <Typography variant="caption" color="text.secondary">Chờ Quản trị viên duyệt</Typography>;
    }
    return <Typography variant="caption" color="text.secondary">
      {item.payoutDue ? 'Đã đủ duyệt · đến đợt' : `Đã đủ duyệt · đợt ${item.payoutCycleDate || '-'}`}
    </Typography>;
  }

  return <Typography variant="caption" color="text.secondary">Chưa có thao tác</Typography>;
}

function CommissionRows({
  items,
  isAdmin,
  isAccountant,
  isCtv,
  requestPendingId,
  adminApprovalPendingId,
  accountantApprovalPendingId,
  paidPendingId,
  onCalculate,
  onResolveException,
  onApproveAdmin,
  onApproveAccountant,
  onRequest,
  onMarkPaid,
}: {
  items: CommissionHistoryItem[];
  isAdmin: boolean;
  isAccountant: boolean;
  isCtv: boolean;
  requestPendingId: string;
  adminApprovalPendingId: string;
  accountantApprovalPendingId: string;
  paidPendingId: string;
  onCalculate: (id: string) => void;
  onResolveException: (id: string) => void;
  onApproveAdmin: (id: string) => void;
  onApproveAccountant: (id: string) => void;
  onRequest: (id: string) => void;
  onMarkPaid: (id: string) => void;
}) {
  return <>
    {items.map((item) => {
      const state = commissionState(item);
      const breakdown = calculationBreakdown(item);
      return <TableRow key={item.id} hover>
        <TableCell sx={{ minWidth: 145 }}>{when(item.eligibleAt)}</TableCell>
        <TableCell sx={{ minWidth: 180 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {item.collaboratorNameSnapshot || 'Chưa có CTV'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {item.collaboratorTypeNameSnapshot || 'Chưa phân loại'}
          </Typography>
        </TableCell>
        <TableCell sx={{ minWidth: 190 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {item.customerName || item.customerId}
          </Typography>
          <Typography variant="caption" color="text.secondary">{item.dealId}</Typography>
        </TableCell>
        <TableCell sx={{ minWidth: 180 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {[item.buildingCode || item.buildingName, item.roomUnitCodeSnapshot].filter(Boolean).join(' · ')}
          </Typography>
          <Typography variant="caption" color="text.secondary">{item.roomTypeName}</Typography>
        </TableCell>
        <TableCell sx={{ minWidth: 175 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{money(item.commissionAmount)}</Typography>
          {breakdown && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {breakdown}
          </Typography>}
          {item.exceptionResolutionCount > 0 && <Typography
            variant="caption"
            color="warning.main"
            sx={{ display: 'block', mt: 0.25 }}
          >
            Đã xử lý ngoại lệ {item.exceptionResolutionCount} lần
            {item.exceptionResolutionReason ? ` · ${item.exceptionResolutionReason}` : ''}
          </Typography>}
        </TableCell>
        <TableCell sx={{ minWidth: 190 }}>
          <Chip size="small" label={state.label} color={state.color} variant="outlined" />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {state.description}
          </Typography>
        </TableCell>
        <CmsActionsCell>
          <CommissionActions
            item={item}
            isAdmin={isAdmin}
            isAccountant={isAccountant}
            isCtv={isCtv}
            requestPending={requestPendingId === item.id}
            adminApprovalPending={adminApprovalPendingId === item.id}
            accountantApprovalPending={accountantApprovalPendingId === item.id}
            paidPending={paidPendingId === item.id}
            onCalculate={onCalculate}
            onResolveException={onResolveException}
            onApproveAdmin={onApproveAdmin}
            onApproveAccountant={onApproveAccountant}
            onRequest={onRequest}
            onMarkPaid={onMarkPaid}
          />
        </CmsActionsCell>
      </TableRow>;
    })}
  </>;
}

function CommissionMobileRows(props: Parameters<typeof CommissionRows>[0]) {
  const {
    items,
    isAdmin,
    isAccountant,
    isCtv,
    requestPendingId,
    adminApprovalPendingId,
    accountantApprovalPendingId,
    paidPendingId,
    onCalculate,
    onResolveException,
    onApproveAdmin,
    onApproveAccountant,
    onRequest,
    onMarkPaid,
  } = props;

  return <Stack divider={<Divider flexItem />} sx={{ display: { xs: 'flex', md: 'none' } }}>
    {items.map((item) => {
      const state = commissionState(item);
      const breakdown = calculationBreakdown(item);
      return <Box key={item.id} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">{when(item.eligibleAt)}</Typography>
            <Typography sx={{ fontWeight: 800 }}>{item.customerName || item.customerId}</Typography>
            <Typography variant="caption" color="text.secondary">{item.dealId}</Typography>
          </Box>
          <Chip size="small" label={state.label} color={state.color} variant="outlined" />
        </Stack>
        <Typography variant="body2" sx={{ mt: 1.25, fontWeight: 700 }}>
          {item.collaboratorNameSnapshot || 'Chưa có CTV'} · {item.collaboratorTypeNameSnapshot || 'Chưa phân loại'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {[item.buildingCode || item.buildingName, item.roomUnitCodeSnapshot, item.roomTypeName].filter(Boolean).join(' · ') || 'Chưa có thông tin căn'}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, fontWeight: 800 }}>{money(item.commissionAmount)}</Typography>
        {breakdown && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{breakdown}</Typography>}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>{state.description}</Typography>
        <Box sx={{ mt: 1.5 }}>
          <CommissionActions item={item} isAdmin={isAdmin} isAccountant={isAccountant} isCtv={isCtv}
            requestPending={requestPendingId === item.id}
            adminApprovalPending={adminApprovalPendingId === item.id}
            accountantApprovalPending={accountantApprovalPendingId === item.id}
            paidPending={paidPendingId === item.id}
            onCalculate={onCalculate} onResolveException={onResolveException}
            onApproveAdmin={onApproveAdmin} onApproveAccountant={onApproveAccountant}
            onRequest={onRequest} onMarkPaid={onMarkPaid} />
        </Box>
      </Box>;
    })}
  </Stack>;
}

export function CommissionHistoryPage({ currentUser }: { currentUser: AppIdentity }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const roleCode = String(currentUser?.roleCode || '').toLowerCase();
  const isCtv = roleCode === 'ctv_sale';
  const isAdmin = roleCode === 'admin' || roleCode === 'superadmin';
  const isAccountant = roleCode === 'commission_accountant';
  const collaboratorFilter = isAdmin ? searchParams.get('collaborator') || '' : '';

  const [view, setView] = useState<HistoryView>('actionRequired');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [statementMonth, setStatementMonth] = useState(currentCommissionMonth);
  const [statementPage, setStatementPage] = useState(0);
  const [statementPageSize, setStatementPageSize] = useState(10);
  const [calculationId, setCalculationId] = useState('');
  const [exceptionResolutionId, setExceptionResolutionId] = useState('');
  const [paidConfirmId, setPaidConfirmId] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const collaboratorsQuery = useCommissionCollaboratorsQuery(isAdmin);
  const filteredCollaborator = (collaboratorsQuery.data || []).find((item) => item.id === collaboratorFilter);

  const workflow = view === 'all' || view === 'monthly' ? '' : view;
  const queryParams = useMemo(() => ({
    page: page + 1,
    pageSize,
    search: debouncedSearch,
    status: '' as const,
    review: '' as const,
    workflow: workflow as '' | 'actionRequired' | 'unpaid' | 'paid',
    collaboratorId: collaboratorFilter,
    sort: 'eligibleAt' as const,
    order: 'desc' as const,
  }), [page, pageSize, debouncedSearch, workflow, collaboratorFilter]);

  const historyQuery = useCommissionHistoryQuery(queryParams, view !== 'monthly');
  const monthlyQuery = useCommissionMonthlyStatementQuery({
    month: statementMonth,
    collaboratorId: collaboratorFilter,
    page: statementPage + 1,
    pageSize: statementPageSize,
  }, view === 'monthly');

  const items = historyQuery.data?.items || [];
  const total = historyQuery.data?.pagination.total || 0;
  const monthlyItems = monthlyQuery.data?.items || [];
  const monthlyTotal = monthlyQuery.data?.pagination.total || 0;
  const monthlySummary = monthlyQuery.data?.summary;

  const requestWithdrawalMutation = useRequestCommissionWithdrawalMutation();
  const approveAdminMutation = useApproveCommissionAdminMutation();
  const approveAccountantMutation = useApproveCommissionAccountantMutation();
  const markPaidMutation = useMarkCommissionPaidMutation();
  const requestPendingId = requestWithdrawalMutation.isPending
    ? String(requestWithdrawalMutation.variables || '')
    : '';
  const adminApprovalPendingId = approveAdminMutation.isPending
    ? String(approveAdminMutation.variables || '')
    : '';
  const accountantApprovalPendingId = approveAccountantMutation.isPending
    ? String(approveAccountantMutation.variables || '')
    : '';
  const paidPendingId = markPaidMutation.isPending
    ? String(markPaidMutation.variables || '')
    : '';

  const approveAdmin = (ledgerId: string) => {
    approveAdminMutation.mutate(ledgerId, {
      onSuccess: () => toast.success('Quản trị viên đã duyệt khoản hoa hồng.'),
      onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể duyệt khoản hoa hồng.'),
    });
  };

  const approveAccountant = (ledgerId: string) => {
    approveAccountantMutation.mutate(ledgerId, {
      onSuccess: () => toast.success('Kế toán đã duyệt khoản hoa hồng.'),
      onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể duyệt khoản hoa hồng.'),
    });
  };

  const requestWithdrawal = (ledgerId: string) => {
    requestWithdrawalMutation.mutate(ledgerId, {
      onSuccess: () => toast.success('Đã gửi yêu cầu rút tiền.'),
      onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể gửi yêu cầu rút tiền.'),
    });
  };

  const markPaid = (ledgerId: string) => setPaidConfirmId(ledgerId);
  const confirmMarkPaid = () => {
    if (!paidConfirmId) return;
    markPaidMutation.mutate(paidConfirmId, {
      onSuccess: () => {
        setPaidConfirmId('');
        toast.success('Đã ghi nhận khoản hoa hồng là đã thanh toán.');
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái thanh toán.'),
    });
  };

  const allVisibleItems = [...items, ...monthlyItems];
  const calculationItem = allVisibleItems.find((item) => item.id === calculationId);
  const exceptionResolutionItem = allVisibleItems.find((item) => item.id === exceptionResolutionId);
  const paidConfirmItem = allVisibleItems.find((item) => item.id === paidConfirmId);

  const clearCollaboratorFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('collaborator');
    setSearchParams(next, { replace: true });
    setPage(0);
    setStatementPage(0);
  };

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Lịch sử hoa hồng </>} description={isCtv
          ? 'Theo dõi các khoản hoa hồng của bạn, yêu cầu rút tiền và trạng thái thanh toán.'
          : isAccountant
            ? 'Đối soát và duyệt các khoản hoa hồng trước khi vào đợt thanh toán ngày 1/15.'
            : 'Theo dõi hoa hồng, xử lý dữ liệu, duyệt và xác nhận thanh toán theo đợt 1/15.'} />

    {collaboratorFilter && isAdmin && <Alert
      severity="info"
      action={<Button color="inherit" size="small" onClick={clearCollaboratorFilter}>Xem tất cả</Button>}
    >
      Đang lọc theo CTV: <strong>{filteredCollaborator?.name || collaboratorFilter}</strong>
    </Alert>}

    <CmsListCard variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ height: 3 }}>
        {(view === 'monthly' ? monthlyQuery.isFetching : historyQuery.isFetching) && <LinearProgress sx={{ height: 3 }} />}
      </Box>
      <CmsFilterBar>
        {view === 'monthly' ? <CmsFilterField
          type="month"
          label="Tháng bảng kê"
          value={statementMonth}
          onChange={(event) => {
            setStatementMonth(event.target.value);
            setStatementPage(0);
          }}
        /> : <CmsFilterField
          label="Tìm hoa hồng"
          placeholder="Tên CTV, khách, mã giao dịch, tòa hoặc phòng…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />}
        <CmsFilterField
          select
          label="Nhóm hiển thị"
          value={view}
          onChange={(event) => {
            setView(event.target.value as HistoryView);
            setPage(0);
            setStatementPage(0);
          }}
        >
          <MenuItem value="actionRequired">Cần xử lý</MenuItem>
          <MenuItem value="unpaid">Chờ thanh toán</MenuItem>
          <MenuItem value="paid">Đã thanh toán</MenuItem>
          <MenuItem value="all">Tất cả</MenuItem>
          <MenuItem value="monthly">Bảng kê tháng</MenuItem>
        </CmsFilterField>
      </CmsFilterBar>
      <Divider />

      {view !== 'monthly' ? <>

        {historyQuery.isError ? <Box sx={{ p: 2 }}>
          <ErrorState title="Không tải được lịch sử hoa hồng" description="Vui lòng thử lại."
            action={<Button onClick={() => void historyQuery.refetch()}>Thử lại</Button>} />
        </Box> : historyQuery.isPending ? <LoadingState label="Đang tải dữ liệu hoa hồng…" minHeight={300} />
          : !items.length ? <EmptyState
            title={view === 'actionRequired' ? 'Không có khoản hoa hồng nào cần xử lý' : view === 'unpaid' ? 'Không có khoản hoa hồng nào đang chờ thanh toán' : view === 'paid' ? 'Chưa có khoản hoa hồng đã thanh toán' : 'Chưa có dữ liệu hoa hồng'}
            description={search ? 'Thử thay đổi từ khóa tìm kiếm.' : undefined}
          /> : <>
            <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Ghi nhận</TableCell><TableCell>Cộng tác viên</TableCell><TableCell>Khách / Giao dịch</TableCell>
                  <TableCell>Căn thuê</TableCell><TableCell>Hoa hồng</TableCell><TableCell>Trạng thái</TableCell><CmsActionsCell>Việc cần làm</CmsActionsCell>
                </TableRow></TableHead>
                <TableBody><CommissionRows
                  items={items} isAdmin={isAdmin} isAccountant={isAccountant} isCtv={isCtv}
                  requestPendingId={requestPendingId} adminApprovalPendingId={adminApprovalPendingId}
                  accountantApprovalPendingId={accountantApprovalPendingId} paidPendingId={paidPendingId}
                  onCalculate={setCalculationId} onResolveException={setExceptionResolutionId}
                  onApproveAdmin={approveAdmin} onApproveAccountant={approveAccountant}
                  onRequest={requestWithdrawal} onMarkPaid={markPaid}
                /></TableBody>
              </Table>
            </TableContainer>
            <CommissionMobileRows
              items={items} isAdmin={isAdmin} isAccountant={isAccountant} isCtv={isCtv}
              requestPendingId={requestPendingId} adminApprovalPendingId={adminApprovalPendingId}
              accountantApprovalPendingId={accountantApprovalPendingId} paidPendingId={paidPendingId}
              onCalculate={setCalculationId} onResolveException={setExceptionResolutionId}
              onApproveAdmin={approveAdmin} onApproveAccountant={approveAccountant}
              onRequest={requestWithdrawal} onMarkPaid={markPaid}
            />
          </>}

        {!historyQuery.isPending && !historyQuery.isError && historyQuery.data && <TablePagination
          component="div" count={total} page={page} onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={pageSize} onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]} labelRowsPerPage="Số dòng:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />}
      </> : <>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Các khoản được xếp theo tháng mà giao dịch lần đầu đủ điều kiện hưởng hoa hồng.
          </Typography>
        </Box>
        <Divider />

        {!monthlyQuery.isPending && !monthlyQuery.isError && monthlySummary && <Box sx={{
          display: 'grid', gap: 1.5, p: { xs: 2, sm: 2.5 },
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' },
        }}>
          {[
            ['Giao dịch đủ điều kiện', monthlySummary.closedRoomCount],
            ['Cần xử lý', monthlySummary.reviewRequiredCount],
            ['Đã có số tiền', monthlySummary.resolvedAmountCount],
            ['Chưa xác định số tiền', monthlySummary.pendingAmountCount],
            ['Chưa thanh toán', monthlySummary.unpaidCount],
            ['Đã yêu cầu rút', monthlySummary.withdrawalRequestedCount],
            ['Đã thanh toán', monthlySummary.paidCount],
            ['Tổng hoa hồng đã xác định', money(monthlySummary.resolvedCommissionTotal)],
          ].map(([label, value]) => <Paper key={String(label)} variant="outlined" sx={{ p: 1.75, borderRadius: 2.5 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>{value}</Typography>
          </Paper>)}
        </Box>}
        {!monthlyQuery.isPending && !monthlyQuery.isError && monthlySummary && <Divider />}

        {monthlyQuery.isError ? <Box sx={{ p: 2 }}>
          <ErrorState title="Không tải được bảng kê hoa hồng" description="Vui lòng thử lại."
            action={<Button onClick={() => void monthlyQuery.refetch()}>Thử lại</Button>} />
        </Box> : monthlyQuery.isPending ? <LoadingState label="Đang tải bảng kê tháng…" minHeight={300} />
          : !monthlyItems.length ? <EmptyState title="Chưa có khoản hoa hồng trong tháng này"
            description="Chọn tháng khác để đối chiếu dữ liệu hoa hồng." /> : <>
            <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Ghi nhận</TableCell><TableCell>Cộng tác viên</TableCell><TableCell>Khách / Giao dịch</TableCell>
                  <TableCell>Căn thuê</TableCell><TableCell>Hoa hồng</TableCell><TableCell>Trạng thái</TableCell><CmsActionsCell>Việc cần làm</CmsActionsCell>
                </TableRow></TableHead>
                <TableBody><CommissionRows
                  items={monthlyItems} isAdmin={isAdmin} isAccountant={isAccountant} isCtv={isCtv}
                  requestPendingId={requestPendingId} adminApprovalPendingId={adminApprovalPendingId}
                  accountantApprovalPendingId={accountantApprovalPendingId} paidPendingId={paidPendingId}
                  onCalculate={setCalculationId} onResolveException={setExceptionResolutionId}
                  onApproveAdmin={approveAdmin} onApproveAccountant={approveAccountant}
                  onRequest={requestWithdrawal} onMarkPaid={markPaid}
                /></TableBody>
              </Table>
            </TableContainer>
            <CommissionMobileRows
              items={monthlyItems} isAdmin={isAdmin} isAccountant={isAccountant} isCtv={isCtv}
              requestPendingId={requestPendingId} adminApprovalPendingId={adminApprovalPendingId}
              accountantApprovalPendingId={accountantApprovalPendingId} paidPendingId={paidPendingId}
              onCalculate={setCalculationId} onResolveException={setExceptionResolutionId}
              onApproveAdmin={approveAdmin} onApproveAccountant={approveAccountant}
              onRequest={requestWithdrawal} onMarkPaid={markPaid}
            />
          </>}

        {!monthlyQuery.isPending && !monthlyQuery.isError && monthlyQuery.data && <TablePagination
          component="div" count={monthlyTotal} page={statementPage}
          onPageChange={(_, nextPage) => setStatementPage(nextPage)}
          rowsPerPage={statementPageSize}
          onRowsPerPageChange={(event) => { setStatementPageSize(Number(event.target.value)); setStatementPage(0); }}
          rowsPerPageOptions={[10, 25, 50]} labelRowsPerPage="Số dòng:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />}
      </>}
    </CmsListCard>

    {view === 'monthly' && <Alert severity="info">
      Tổng tiền chỉ cộng những khoản đã có số tiền hoa hồng. Các khoản chưa xác định vẫn được giữ trong bảng kê để tiếp tục xử lý sau.
    </Alert>}

    {isAdmin && exceptionResolutionItem && <CommissionExceptionResolutionDialog
      item={exceptionResolutionItem}
      onClose={() => setExceptionResolutionId('')}
      onResolved={() => {
        setExceptionResolutionId('');
        void historyQuery.refetch();
        void monthlyQuery.refetch();
      }}
    />}

    {isAdmin && calculationItem && <CommissionCalculationDialog
      item={calculationItem}
      onClose={() => setCalculationId('')}
      onCalculated={() => {
        setCalculationId('');
        void historyQuery.refetch();
        void monthlyQuery.refetch();
      }}
    />}

    <Dialog
      open={Boolean(paidConfirmId)}
      onClose={() => !markPaidMutation.isPending && setPaidConfirmId('')}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>Xác nhận đã thanh toán</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Chỉ xác nhận sau khi khoản hoa hồng đã được cả Quản trị viên + Kế toán duyệt, đến đúng đợt 1/15 và đã thanh toán ngoài hệ thống.
          {paidConfirmItem
            ? ` Khoản: ${money(paidConfirmItem.commissionAmount)} · ${paidConfirmItem.roomUnitCodeSnapshot}.`
            : ''}
          {' '}Sau khi xác nhận, khoản này sẽ được ghi nhận là đã thanh toán.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPaidConfirmId('')} disabled={markPaidMutation.isPending}>
          Hủy
        </Button>
        <Button variant="contained" onClick={confirmMarkPaid} disabled={markPaidMutation.isPending}>
          Xác nhận đã thanh toán
        </Button>
      </DialogActions>
    </Dialog>

    {isAdmin && <Box>
      <Button variant="text" onClick={() => navigate('/cms/commission-config')}>
        Quản lý cơ cấu hoa hồng
      </Button>
    </Box>}
  </Stack>;
}
