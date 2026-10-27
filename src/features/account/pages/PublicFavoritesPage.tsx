import { useState } from 'react';
import { Alert, Box, Button, Pagination, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useLocation, useOutletContext } from 'react-router';
import { favoritePageSchema } from '@tinyhouse/contracts';
import type { AppIdentity } from '../../auth/identityStore';
import { useSelfAccountPage } from '../api/selfAccount.api';
import { FavoriteButton } from '../components/FavoriteButton';
import { roomSelectionHref } from '../../rooms/roomSelection';
import { FavoriteUnitCard } from '../components/FavoriteUnitCard';
import { accountCardSx } from '../accountSurface';

export function PublicFavoritesPage() {
  const { currentUser } = useOutletContext<{ currentUser: AppIdentity }>();
  const [page, setPage] = useState(1);
  const location = useLocation();
  const query = useSelfAccountPage('favorites', page);
  if (query.isError) return <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}>Không tải được yêu thích.</Alert>;
  if (!query.data) return <Skeleton variant="rounded" height={220} />;
  const data = favoritePageSchema.parse(query.data);
  const params = new URLSearchParams();
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref) params.set('ref', ref);
  return <Stack spacing={2}>
    <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>Căn yêu thích ({data.pagination.total})</Typography>
    {!data.items.length && <Alert severity="info">{page > 1 ? 'Trang này không còn căn yêu thích.' : 'Bạn chưa lưu căn yêu thích nào.'}</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: { xs: 2, md: 3 } }}>
      {data.items.map(item => {
        const room = item.room;
        const unit = room?.roomUnits.find(value => value.id === item.unitId);
        const href = roomSelectionHref(room?.id || '', item.unitId, params.toString());
        if (room && unit) return <FavoriteUnitCard key={item.unitId} room={room} unit={unit} href={href} user={currentUser} />;
        return <Paper key={item.unitId} variant="outlined" sx={{ ...accountCardSx, p: 2.5 }}>
          <Stack spacing={1.5}>
            <Alert severity="info">Căn đã lưu hiện không còn được công khai.</Alert>
            <FavoriteButton unitId={item.unitId} user={currentUser} removeOnly />
          </Stack>
        </Paper>;
      })}
    </Box>
    {Math.max(page, data.pagination.totalPages) > 1 && <Pagination page={page} count={Math.max(page, data.pagination.totalPages)} onChange={(_, next) => setPage(next)} aria-label="Trang yêu thích" />}
  </Stack>;
}
