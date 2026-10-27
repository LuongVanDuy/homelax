import { SalesImageLink } from '../../affiliate/components/SalesImageLink';
import { FavoriteButton } from '../../account/components/FavoriteButton';
import { useId, type ReactNode } from 'react';
import { Alert, Box, Button, ButtonBase, Chip, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { CalendarDays, Check, Circle, DoorOpen, Ruler, Users } from 'lucide-react';
import { PUBLIC_LISTING_WITHDRAWN_TEXT } from '@tinyhouse/contracts';
import { publicHref } from '../../../app/router/publicNavigation';
import { routeHref, routePaths } from '../../../app/router/routePaths';
import { designTokens as tokens } from '../../../app/theme/tokens';
import { PublicContainer, PublicSurface } from '../../../components/public';
import { PublicDetailGallery } from '../../../components/public/PublicDetailGallery';
import { PublicDetailHeader } from '../../../components/public/PublicDetailHeader';
import { PublicShareButton } from '../../../components/public/PublicShareButton';
import { getAmenityIcon } from '../../../data/amenitiesData';
import type { AppIdentity } from '../../auth/identityStore';
import { AffiliateShareButton } from '../../affiliate/components/AffiliateShareButton';
import { PublicRoomBookingForm } from '../components/PublicRoomBookingForm';
import { RoomAreaBuildings } from '../components/RoomAreaBuildings';
import { usePublicRoomDetail } from '../hooks/usePublicRoomDetail';
import { roomDescriptionDisplayHtml } from '../roomDescription';
import { formatMoney, unitStatusColor, unitStatusLabel } from '../roomPresentation';
import { roomSelectionHref } from '../roomSelection';

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return <Paper component="section" aria-labelledby={id} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, minWidth: 0 }}>
    <Typography id={id} component="h2" sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 800, mb: 2 }}>{title}</Typography>
    {children}
  </Paper>;
}

function Amenities({ items }: { items: string[] }) {
  return items.length ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
    {items.map(name => <Stack key={name} direction="row" sx={{ gap: 1, alignItems: 'center', minWidth: 0 }}>
      <Box aria-hidden="true" sx={{ color: 'text.secondary', display: 'flex', flexShrink: 0 }}>{getAmenityIcon(name, 18, 'currentColor')}</Box>
      <Typography sx={{ fontSize: 14, overflowWrap: 'anywhere' }}>{name}</Typography>
    </Stack>)}
  </Box> : <Typography color="text.secondary">Tiện ích đang cập nhật.</Typography>;
}

function UnitStatusTag({ status }: { status: Parameters<typeof unitStatusColor>[0] }) {
  const color = unitStatusColor(status);
  return <Chip size="small" color={color} label={unitStatusLabel(status)} sx={{
    color: 'common.white', bgcolor: color === 'default' ? 'text.secondary' : `${color}.dark`,
    height: 22, fontSize: 12, fontWeight: 600,
  }} />;
}

export default function PublicRoomDetailPage({ roomId, currentUser }: { roomId: string; currentUser: AppIdentity }) {
  const detail = usePublicRoomDetail(roomId, currentUser);
  const { room, building, loading, roomError, buildingError, location, navigate, listingWithdrawn,
    acceptsBookings, availableRoomTypes, specificRoomUnits, resolvedRoomUnit, selectedRoomHref,
    resolvedRoomNumber, resolvedRoomAvailableDate, handleSelectRoomType, galleryImages,
    roomAmenities, buildingAmenities, bookingFormRef, isSubmitting, isBookingLoading,
    unitCanSchedule, scrollToBooking } = detail;
  const busy = isSubmitting || isBookingLoading;

  if (loading) return <PublicSurface><PublicContainer><Stack sx={{ py: { xs: 3, md: 5 }, gap: 2 }}>
    <Skeleton width={260} height={28} /><Skeleton width="55%" height={52} /><Skeleton width="75%" height={28} />
    <Skeleton variant="rounded" height={440} sx={{ borderRadius: 3 }} />
  </Stack></PublicContainer></PublicSurface>;

  if (roomError || buildingError || !room || !building) {
    const error = roomError || buildingError;
    const notFound = !error || Number((error as { status?: number }).status) === 404;
    return <PublicSurface><PublicContainer><Paper variant="outlined" sx={{ maxWidth: 560, mx: 'auto', my: { xs: 5, md: 8 }, p: 3, borderRadius: 3, textAlign: 'center' }}>
      <Typography component="h1" sx={{ fontSize: 26, fontWeight: 800 }}>{notFound ? 'Không tìm thấy phòng' : 'Không thể tải thông tin phòng'}</Typography>
      <Typography sx={{ my: 2, color: 'text.secondary' }}>{notFound ? 'Phòng không tồn tại hoặc không còn được công khai.' : 'Vui lòng tải lại trang để thử lại.'}</Typography>
      <Stack direction="row" sx={{ justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
        {!notFound && <Button variant="outlined" onClick={() => window.location.reload()}>Tải lại</Button>}
        <Button component={RouterLink} to={publicHref(routePaths.search, location.search)} variant="contained">Tìm phòng khác</Button>
      </Stack>
    </Paper></PublicContainer></PublicSurface>;
  }

  const roomTitle = room.type || room.roomTypeCatalogName || 'Loại phòng';
  const title = `Tòa ${building.code} - ${roomTitle}${resolvedRoomNumber ? ` (Căn ${resolvedRoomNumber})` : ''}`;
  const price = room.price > 0 ? `${formatMoney(room.price)}/tháng` : 'Giá đang cập nhật';
  const buildingName = building.name.trim() || `Tòa ${building.code}`;
  const address = building.address.trim();
  const ward = building.ward.trim();
  const publicAddress = [buildingName, address,
    ward && !address.toLocaleLowerCase('vi').includes(ward.toLocaleLowerCase('vi')) ? ward : '',
  ].filter((part, index, parts) => part && parts.findIndex(value => value.toLocaleLowerCase('vi') === part.toLocaleLowerCase('vi')) === index).join(' · ');
  const facts = [
    { label: 'Diện tích', value: room.area > 0 ? `${room.area} m²` : 'Đang cập nhật', Icon: Ruler },
    { label: 'Số người tối đa', value: room.maxOccupants > 0 ? `${room.maxOccupants} người` : 'Đang cập nhật', Icon: Users },
    { label: 'Số căn trống', value: String(room.vacantCount), Icon: DoorOpen },
  ];

  return <PublicSurface><PublicContainer>
    <Box sx={{ pt: { xs: 3, md: 5 }, pb: { xs: 'calc(120px + env(safe-area-inset-bottom))', lg: 6 } }}>
      <PublicDetailHeader title={title} address={publicAddress} price={price}
        breadcrumbs={[
          { label: 'Trang chủ', href: publicHref(routePaths.home, location.search) },
          { label: 'Tìm phòng', href: publicHref(routePaths.search, location.search) },
          { label: `Tòa ${building.code}`, href: publicHref(routeHref.building(building.code || building.id), location.search) },
          { label: roomTitle },
        ]}
        badges={<>
          <Chip size="small" label={`Tòa ${building.code}`} variant="outlined" />
          {resolvedRoomUnit && <UnitStatusTag status={resolvedRoomUnit.status} />}
        </>}
        notice={listingWithdrawn && <Alert severity="warning" sx={{ mb: 2 }}>{PUBLIC_LISTING_WITHDRAWN_TEXT}</Alert>} />
      <PublicDetailGallery images={galleryImages} title={roomTitle} label="Hình ảnh phòng" emptyLabel="Chưa có hình ảnh phòng" media={room.media360 || []}
        actions={<>{resolvedRoomUnit && !listingWithdrawn && <FavoriteButton key={`${currentUser?.id}:${resolvedRoomUnit.id}`} user={currentUser} unitId={resolvedRoomUnit.id} href={selectedRoomHref} />}<PublicShareButton href={selectedRoomHref} title={title} /><AffiliateShareButton currentUser={currentUser} href={selectedRoomHref} />{!listingWithdrawn && (!resolvedRoomUnit || resolvedRoomUnit.status === 'available') && <SalesImageLink currentUser={currentUser} buildingId={building.id} roomId={room.id} unitId={resolvedRoomUnit?.id} />}</>} />

      <Box sx={{ mt: { xs: 3, md: 4 }, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px' }, gap: 3, alignItems: 'start' }}>
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <DetailSection title="Chọn loại phòng và căn">
            <Typography sx={{ mb: 1, fontSize: 14, fontWeight: 700 }}>Loại phòng</Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {availableRoomTypes.map(type => <Button key={type.id} variant={type.id === room.id ? 'contained' : 'outlined'}
                aria-pressed={type.id === room.id} disabled={busy} onClick={() => handleSelectRoomType(type)}>
                {type.type || type.roomTypeCatalogName}
              </Button>)}
            </Stack>
            <Typography sx={{ mb: 1, fontSize: 14, fontWeight: 700 }}>Căn cụ thể</Typography>
            {specificRoomUnits.length ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {specificRoomUnits.map(unit => <ButtonBase key={unit.id} disabled={busy} aria-pressed={unit.id === resolvedRoomUnit?.id}
                onClick={() => navigate(roomSelectionHref(room.id, unit.id, location.search, location.hash), { preventScrollReset: true })}
                sx={{ p: 1.5, width: { xs: 'calc(50% - 4px)', sm: 152 }, minHeight: 76, border: '1px solid',
                  borderColor: unit.id === resolvedRoomUnit?.id ? 'primary.main' : 'divider', borderRadius: 1.5,
                  bgcolor: unit.id === resolvedRoomUnit?.id ? 'primary.main' : 'background.paper',
                  color: unit.id === resolvedRoomUnit?.id ? 'primary.contrastText' : 'text.primary',
                  boxShadow: unit.id === resolvedRoomUnit?.id ? `inset 0 0 0 1px ${tokens.colors.brand[500]}` : 'none',
                  '&:hover': { borderColor: 'primary.main', bgcolor: unit.id === resolvedRoomUnit?.id ? 'primary.dark' : 'primary.light' } }}>
                <Stack sx={{ alignItems: 'flex-start', gap: 1, minWidth: 0, width: '100%' }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 0.5, width: '100%' }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, overflowWrap: 'anywhere' }}>Căn {unit.code}</Typography>
                    <Box aria-hidden="true" sx={{ display: 'flex', flexShrink: 0, color: unit.id === resolvedRoomUnit?.id ? 'primary.contrastText' : 'divider' }}>
                      {unit.id === resolvedRoomUnit?.id ? <Check size={17} strokeWidth={3} /> : <Circle size={16} />}
                    </Box>
                  </Stack>
                  <UnitStatusTag status={unit.status} />
                </Stack>
              </ButtonBase>)}
            </Box> : <Alert severity="info">Chưa có căn để lựa chọn.</Alert>}
          </DetailSection>
          <DetailSection title="Thông tin phòng">
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
              {facts.map(({ label, value, Icon }) => <Box key={label} sx={{
                p: 2, minWidth: 0, borderRadius: 2, border: '1px solid', borderColor: 'divider',
                bgcolor: 'background.paper', boxShadow: tokens.shadows.md,
              }}>
                <Box aria-hidden="true" sx={{ display: 'grid', placeItems: 'center', width: 36, height: 36, mb: 1.5,
                  borderRadius: 1.5, bgcolor: 'primary.light', color: 'primary.main' }}><Icon size={20} /></Box>
                <Typography component="dt" sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
                <Typography component="dd" sx={{ m: 0, mt: 0.5, fontSize: 20, fontWeight: 800, overflowWrap: 'anywhere' }}>{value}</Typography>
              </Box>)}
            </Box>
            {resolvedRoomAvailableDate && <Stack direction="row" sx={{ mt: 2, gap: 1, alignItems: 'center', color: 'text.secondary' }}>
              <CalendarDays size={18} aria-hidden="true" />
              <Typography sx={{ fontSize: 14 }}>Ngày có thể vào ở: <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{resolvedRoomAvailableDate}</Box></Typography>
            </Stack>}
            {room.description && <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', overflowWrap: 'anywhere',
              '& p': { my: 1 }, '& ul, & ol': { pl: 3 }, '& a': { color: 'primary.main' }, '& img': { maxWidth: '100%', height: 'auto' } }}
              dangerouslySetInnerHTML={{ __html: roomDescriptionDisplayHtml(room.description) }} />}
          </DetailSection>
          <DetailSection title="Tiện ích trong phòng"><Amenities items={roomAmenities} /></DetailSection>
          <DetailSection title="Tiện ích tòa nhà"><Amenities items={buildingAmenities} /></DetailSection>
        </Stack>
        <Paper ref={bookingFormRef} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, minWidth: 0,
          position: { lg: 'sticky' }, top: tokens.layout.headerHeight + 24, scrollMarginTop: tokens.layout.headerHeight + 24 }}>
          <PublicRoomBookingForm detail={detail} />
        </Paper>
      </Box>
      <RoomAreaBuildings key={`${building.id}:${building.ward}`} buildingId={building.id} ward={building.ward} search={location.search} />
    </Box>
    <Paper square sx={{ display: { xs: 'flex', lg: 'none' }, position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: tokens.zIndex.header - 1, borderTop: '1px solid', borderColor: 'divider', px: 2, pt: 1.5,
      pb: 'calc(12px + env(safe-area-inset-bottom))', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 15, color: 'primary.main' }}>{price}</Typography>
        <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{resolvedRoomNumber ? `Căn ${resolvedRoomNumber} · ` : ''}{roomTitle}</Typography>
      </Box>
      <Button variant="contained" sx={{ flexShrink: 0 }} disabled={busy || !acceptsBookings || !unitCanSchedule} onClick={scrollToBooking}>Đặt lịch xem</Button>
    </Paper>
  </PublicContainer></PublicSurface>;
}
