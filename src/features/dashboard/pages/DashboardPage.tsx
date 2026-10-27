import { CmsPageHeader, CmsBadge as Chip } from '../../../components/cms';
import { type ReactNode } from 'react';
import { Alert, Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { Building2, CalendarClock, DoorOpen, House, UserRoundCheck, type LucideIcon } from 'lucide-react';
import { Link as RouterLink } from 'react-router';
import type { AppIdentity } from '../../auth/identityStore';
import { getCmsNavigation, isCmsAdministrator } from '../../cms/navigation';
import { useBuildingStatsQuery } from '../../buildings/api';
import { useRoomStatsQuery } from '../../rooms/api';
import { useBookingStatsQuery } from '../../bookings/api';
import { useUserStatsQuery } from '../../users/api';

type MetricCardProps = {
  title: string;
  value: number | undefined;
  helper: ReactNode;
  icon: LucideIcon;
  loading: boolean;
  to?: string;
  actionLabel?: string;
};

function formatCount(value: number | undefined) {
  return value === undefined ? '-' : new Intl.NumberFormat('vi-VN').format(value);
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  loading,
  to,
  actionLabel,
}: MetricCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        minWidth: 0,
        minHeight: 176,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'action.hover',
            color: 'primary.main',
            flex: '0 0 auto',
          }}
        >
          <Icon size={20} aria-hidden="true" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Stack>

      {loading ? (
        <Skeleton width={72} height={44} />
      ) : (
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
          {formatCount(value)}
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
        {helper}
      </Typography>

      {to && actionLabel && (
        <Button
          component={RouterLink}
          to={to}
          size="small"
          sx={{ mt: 'auto', pt: 2, alignSelf: 'flex-start' }}
        >
          {actionLabel}
        </Button>
      )}
    </Paper>
  );
}

export function DashboardPage({ currentUser }: { currentUser: AppIdentity }) {
  const authenticated = Boolean(currentUser?.id);
  const admin = isCmsAdministrator(currentUser);
  const navigation = getCmsNavigation(currentUser);
  const canOpen = (code: string) => navigation.some((item) => item.code === code);

  const buildings = useBuildingStatsQuery(authenticated);
  const rooms = useRoomStatsQuery(authenticated);
  const bookings = useBookingStatsQuery(authenticated);
  const users = useUserStatsQuery(authenticated && admin);

  const hasError = buildings.isError || rooms.isError || bookings.isError || (admin && users.isError);

  if (!authenticated) {
    return <Alert severity="error">Không có phiên đăng nhập hợp lệ để tải tổng quan.</Alert>;
  }

  const cards: MetricCardProps[] = [
    {
      title: 'Tòa nhà đang hoạt động',
      value: buildings.data?.active,
      helper: buildings.data ? `${formatCount(buildings.data.archived)} tòa đang lưu trữ` : 'Dữ liệu theo phạm vi tài khoản hiện tại',
      icon: Building2,
      loading: buildings.isLoading,
      to: canOpen('buildings') ? '/cms/buildings' : undefined,
      actionLabel: canOpen('buildings') ? 'Mở danh sách tòa nhà' : undefined,
    },
    {
      title: 'Loại phòng đang hoạt động',
      value: rooms.data?.activeTypes,
      helper: rooms.data ? `${formatCount(rooms.data.archivedTypes)} loại phòng đang lưu trữ` : 'Dữ liệu theo phạm vi tài khoản hiện tại',
      icon: House,
      loading: rooms.isLoading,
      to: canOpen('rooms') ? '/cms/rooms' : undefined,
      actionLabel: canOpen('rooms') ? 'Mở danh sách phòng' : undefined,
    },
    {
      title: 'Căn đang trống',
      value: rooms.data?.vacantUnits,
      helper: rooms.data ? `Trên ${formatCount(rooms.data.totalUnits)} căn thuộc loại phòng hoạt động` : 'Theo số căn thực tế đang quản lý',
      icon: DoorOpen,
      loading: rooms.isLoading,
      to: canOpen('rooms') ? '/cms/rooms' : undefined,
      actionLabel: canOpen('rooms') ? 'Kiểm tra tồn phòng' : undefined,
    },
    {
      title: 'Lịch xem chờ xác nhận',
      value: bookings.data?.pending,
      helper: bookings.data ? `Tổng ${formatCount(bookings.data.total)} lịch trong phạm vi tài khoản hiện tại` : 'Dữ liệu theo phạm vi tài khoản hiện tại',
      icon: CalendarClock,
      loading: bookings.isLoading,
      to: canOpen('bookings') ? '/cms/bookings' : undefined,
      actionLabel: canOpen('bookings') ? 'Mở lịch xem phòng' : undefined,
    },
  ];

  if (admin) {
    cards.push({
      title: 'Tài khoản chờ duyệt',
      value: users.data?.pending,
      helper: users.data ? `Tổng ${formatCount(users.data.total)} tài khoản hệ thống` : 'Chỉ hiển thị với quản trị viên/quản trị viên cấp cao',
      icon: UserRoundCheck,
      loading: users.isLoading,
      to: '/cms/users?review=pending',
      actionLabel: 'Mở danh sách người dùng',
    });
  }

  return (
    <Stack spacing={3}>
      <CmsPageHeader title={<> Tổng quan vận hành </>} description={<> Tổng hợp nhanh các dữ liệu vận hành trong phạm vi tài khoản của bạn. </>} actions={<><Chip label={String(currentUser?.roleName || 'Tài khoản hệ thống')} variant="outlined" /></>} />

      {hasError && (
        <Alert severity="warning">
          Một số số liệu chưa tải được. Các mục còn lại vẫn hiển thị bình thường.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        {cards.map((card) => <MetricCard key={card.title} {...card} />)}
      </Box>

    </Stack>
  );
}
