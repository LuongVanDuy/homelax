import { Box, Button, Card, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { ArrowUpRight, Building2, MapPin, Ruler, Users } from 'lucide-react';
import { Link } from 'react-router';
import type { PublicRoomType } from '@tinyhouse/contracts';
import { accountCardSx } from '../accountSurface';
import { PublicImage } from '../../../components/public/PublicImage';
import type { AppIdentity } from '../../auth/identityStore';
import { useBuildingQuery } from '../../buildings/api/building.queries';
import { formatMoney, unitStatusColor, unitStatusLabel } from '../../rooms/roomPresentation';
import { FavoriteButton } from './FavoriteButton';

export function FavoriteUnitCard({ room, unit, href, user }: {
  room: PublicRoomType; unit: PublicRoomType['roomUnits'][number]; href: string; user: AppIdentity;
}) {
  // Reuse the public building detail cache, as on the room detail page.
  const buildingQuery = useBuildingQuery(room.buildingId);
  const building = buildingQuery.data;
  const name = building?.name?.trim() || room.buildingName?.trim() || `Tòa ${room.buildingCode}`;
  const street = building?.address?.trim() || room.address.trim();
  const ward = building?.ward?.trim() || '';
  const address = [street, ward && !street.toLocaleLowerCase('vi').includes(ward.toLocaleLowerCase('vi')) ? ward : ''].filter(Boolean).join(', ');
  const title = `${room.type} · Căn ${unit.code}`;
  const tone = unitStatusColor(unit.status);
  return <Card variant="outlined" sx={{ ...accountCardSx, minWidth: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
    <Box sx={{ position: 'relative' }}>
      <Box component={Link} to={href} aria-label={`Xem ${title}`} sx={{ display: 'block' }}>
        <PublicImage src={room.coverImage || room.images[0]} alt={`${name} · ${title}`} aspectRatio="3 / 2" />
      </Box>
      <Chip size="small" label={unitStatusLabel(unit.status)} color={tone}
        sx={{ position: 'absolute', left: 12, top: 12, borderRadius: '6px', color: 'common.white' }} />
      <Box sx={{ position: 'absolute', right: 12, top: 12 }}><FavoriteButton unitId={unit.id} user={user} removeOnly compact /></Box>
    </Box>
    <Stack sx={{ p: 2, gap: 1, flex: 1, minWidth: 0 }}>
      <Typography component="h3" variant="h6" sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.45,
        color: 'text.primary', overflowWrap: 'anywhere' }}><Link to={href}>{title}</Link></Typography>
      <Stack spacing={.5} sx={{ color: 'text.secondary' }}>
        <Stack direction="row" sx={{ gap: .75, alignItems: 'flex-start' }}>
          <Building2 size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
          <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{name}</Typography>
        </Stack>
        <Stack direction="row" sx={{ gap: .75, alignItems: 'flex-start' }}>
          <MapPin size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
          <Typography variant="body2" sx={{ lineHeight: 1.6, overflowWrap: 'anywhere' }}>{address || 'Địa chỉ đang cập nhật'}</Typography>
        </Stack>
        {buildingQuery.isError && <Button size="small" onClick={() => void buildingQuery.refetch()} sx={{ alignSelf: 'flex-start' }}>Thử tải đầy đủ địa chỉ</Button>}
      </Stack>
      <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', color: 'text.secondary', fontSize: 14 }}>
        {room.area > 0 && <Stack direction="row" sx={{ gap: .75, alignItems: 'center' }}><Ruler size={16} aria-hidden="true" />{room.area} m²</Stack>}
        {room.maxOccupants > 0 && <Stack direction="row" sx={{ gap: .75, alignItems: 'center' }}><Users size={16} aria-hidden="true" />Tối đa {room.maxOccupants} người</Stack>}
      </Stack>
      <Stack direction="row" sx={{ pt: .75, mt: 'auto', gap: .5, borderTop: 1, borderColor: 'divider', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 800, color: 'primary.main', fontSize: 18, whiteSpace: 'nowrap' }}>
          {room.price > 0 ? formatMoney(room.price) : 'Liên hệ'}
          {room.price > 0 && <Typography component="span" sx={{ ml: .5, fontSize: 14, fontWeight: 400, color: 'text.secondary' }}>/ tháng</Typography>}
        </Typography>
        <Tooltip title="Xem căn"><IconButton component={Link} to={href} aria-label={`Xem ${title}`}
          color="primary" sx={{ width: 44, height: 44, flexShrink: 0 }}><ArrowUpRight size={20} /></IconButton></Tooltip>
      </Stack>
    </Stack>
  </Card>;
}
