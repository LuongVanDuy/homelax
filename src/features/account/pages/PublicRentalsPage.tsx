import { useState } from 'react';
import { Alert, Box, Button, Chip, Pagination, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { selfRentalPageSchema } from '@tinyhouse/contracts';
import { useSelfAccountPage } from '../api/selfAccount.api';
import { formatMoney } from '../../rooms/roomPresentation';
import { accountCardSx } from '../accountSurface';

const date = (value: string | null) => value ? value.split('-').reverse().join('/') : 'Chưa cập nhật';
export function PublicRentalsPage() {
  const [page, setPage] = useState(1);
  const query = useSelfAccountPage('rentals', page);
  if (query.isError) return <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}>Không tải được phòng đã thuê.</Alert>;
  if (!query.data) return <Skeleton variant="rounded" height={220} />;
  const data = selfRentalPageSchema.parse(query.data);
  return <Stack spacing={2}>
    <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>Phòng đã thuê ({data.pagination.total})</Typography>
    {!data.items.length && <Alert severity="info">Chưa có thông tin thuê được liên kết với tài khoản của bạn.</Alert>}
    {data.items.map(item => <Paper key={item.id} variant="outlined" sx={{ ...accountCardSx, p: { xs: 2, md: 3 } }}>
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="body2" color="text.secondary">{item.buildingName || `Tòa ${item.buildingCode}`}</Typography>
          <Typography component="h3" variant="h6" sx={{ fontWeight: 700 }}>{item.roomTypeName} · Căn {item.roomUnitCode}</Typography>
        </Box>
        <Chip label={item.lifecycleStatus === 'cancelled' ? 'Giao dịch đã hủy' : 'Giao dịch hiệu lực'} color={item.lifecycleStatus === 'cancelled' ? 'default' : 'success'} />
      </Stack>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', md: 'repeat(3,minmax(0,1fr))' }, gap: 2 }}>
        {[
          ['Giá thuê / tháng', formatMoney(item.finalPrice)],
          ['Thời hạn hợp đồng', item.contractMonths == null ? 'Chưa cập nhật' : `${item.contractMonths} tháng`],
          ['Thời gian thuê', `${date(item.rentalStartDate)} → ${date(item.rentalEndDate)}`],
          ['Hợp đồng', item.contractSignedAt ? `Đã ký · ${new Date(item.contractSignedAt).toLocaleDateString('vi-VN')}` : 'Chưa ghi nhận ký'],
          ['Tiền cọc yêu cầu', item.depositRequiredAmount == null ? 'Chưa cập nhật' : formatMoney(item.depositRequiredAmount)],
          ['Tiền cọc đã nhận', formatMoney(item.depositPaidAmount)],
        ].map(([label, value]) => <Box key={label}><Typography component="dt" variant="body2" color="text.secondary">{label}</Typography><Typography component="dd" sx={{ m: 0, mt: 0.5, fontWeight: 600 }}>{value}</Typography></Box>)}
      </Box>
    </Paper>)}
    {Math.max(page, data.pagination.totalPages) > 1 && <Pagination page={page} count={Math.max(page, data.pagination.totalPages)} onChange={(_, next) => setPage(next)} aria-label="Trang phòng đã thuê" />}
  </Stack>;
}
