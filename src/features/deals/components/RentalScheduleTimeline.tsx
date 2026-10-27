import { CmsBadge as Chip } from '../../../components/cms';
import { Box, Paper, Stack, Typography } from '@mui/material';
import type { DealSummary } from '@tinyhouse/contracts';

function dayNumber(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function dateLabel(value: string | null) {
  if (!value) return 'Chưa xác định';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('vi-VN').format(new Date(year, month - 1, day));
}

export function RentalScheduleTimeline({
  deals,
  onSelect,
}: {
  deals: DealSummary[];
  onSelect: (id: string) => void;
}) {
  const scheduled = deals.filter((deal) => deal.rentalStartDate);
  if (!scheduled.length) {
    return <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography sx={{ fontWeight: 800 }}>Chưa có lịch thuê trong phạm vi này</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Mở Deal để ghi ngày bắt đầu/kết thúc thuê.
      </Typography>
    </Box>;
  }

  const minDay = Math.min(...scheduled.map((deal) => dayNumber(deal.rentalStartDate!)));
  const maxDay = Math.max(...scheduled.map((deal) =>
    dayNumber(deal.rentalEndDate || deal.rentalStartDate!)));
  const totalDays = Math.max(1, maxDay - minDay + 1);
  const minDate = scheduled.reduce(
    (min, deal) => deal.rentalStartDate! < min ? deal.rentalStartDate! : min,
    scheduled[0].rentalStartDate!,
  );
  const maxDate = scheduled.reduce(
    (max, deal) => {
      const candidate = deal.rentalEndDate || deal.rentalStartDate!;
      return candidate > max ? candidate : max;
    },
    scheduled[0].rentalEndDate || scheduled[0].rentalStartDate!,
  );

  return <Stack spacing={1.25} sx={{ p: { xs: 1.5, sm: 2 } }}>
    <Stack direction="row" sx={{ justifyContent: 'space-between', pl: { sm: '266px' } }}>
      <Typography variant="caption" color="text.secondary">{dateLabel(minDate)}</Typography>
      <Typography variant="caption" color="text.secondary">{dateLabel(maxDate)}</Typography>
    </Stack>

    {scheduled.map((deal) => {
      const start = dayNumber(deal.rentalStartDate!);
      const end = dayNumber(deal.rentalEndDate || deal.rentalStartDate!);
      const left = ((start - minDay) / totalDays) * 100;
      const width = deal.rentalEndDate
        ? Math.max(2, ((end - start + 1) / totalDays) * 100)
        : 2;

      return <Paper
        key={deal.id}
        variant="outlined"
        role="button"
        tabIndex={0}
        onClick={() => onSelect(deal.id)}
        onKeyDown={(event) => {
          if (!['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          onSelect(deal.id);
        }}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '250px minmax(0, 1fr)' },
          gap: 1.5,
          p: 1.5,
          borderRadius: 2,
          cursor: 'pointer',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{deal.customerName}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {deal.buildingCode} · {deal.roomUnitCode} · {deal.roomTypeName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {dateLabel(deal.rentalStartDate)} → {deal.rentalEndDate ? dateLabel(deal.rentalEndDate) : 'chưa có ngày kết thúc'}
          </Typography>
        </Box>
        <Box sx={{ position: 'relative', minHeight: 42, bgcolor: 'action.hover', borderRadius: 1.5, overflow: 'hidden' }}>
          <Box sx={{
            position: 'absolute',
            left: String(left) + '%',
            width: String(width) + '%',
            minWidth: 8,
            top: 8,
            bottom: 8,
            bgcolor: 'primary.main',
            borderRadius: 999,
          }} />
          {!deal.rentalEndDate && <Chip
            size="small"
            label="Chưa có ngày kết thúc"
            variant="outlined"
            sx={{ position: 'absolute', right: 6, top: 7, bgcolor: 'background.paper' }}
          />}
        </Box>
      </Paper>;
    })}
  </Stack>;
}