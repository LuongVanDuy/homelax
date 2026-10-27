import { SalesImageLink } from '../../affiliate/components/SalesImageLink';
import { PublicDetailHeader } from '../../../components/public/PublicDetailHeader';
import { PublicDetailGallery } from '../../../components/public/PublicDetailGallery';
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import {
  BedDouble,
  Building2,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import { Link as RouterLink, useLocation } from "react-router";
import {
  PUBLIC_BUILDING_MAP_LIMIT,
  PUBLIC_LISTING_WITHDRAWN_TEXT,
  TINY_HOUSES_PUBLIC_CONTACT,
  publicBuildingMapQuerySchema,
  publicBuildingPriceFallback,
  type PublicBuildingMapResult,
} from "@tinyhouse/contracts";
import { publicHref } from "../../../app/router/publicNavigation";
import { routeHref, routePaths } from "../../../app/router/routePaths";
import { searchReturnHref } from '../../../app/router/searchReturn';
import {
  PublicBuildingCard,
  PublicContainer,
  PublicRoomCard,
  PublicSurface,
} from "../../../components/public";

import type { AppIdentity } from "../../auth/identityStore";
import { AffiliateShareButton } from "../../affiliate/components/AffiliateShareButton";
import { useBuildingMapQuery } from "../../discovery/api";
import { SearchResultMap } from "../../discovery/components/SearchResultMap";
import { useRoomsByBuildingQuery } from "../../rooms/api";
import { useBuildingQuery, useBuildingsPageQuery } from "../api";

type Props = {
  buildingId: string;
  currentUser: AppIdentity;
};

const money = (value: number) => value.toLocaleString("vi-VN");

function errorStatus(error: unknown) {
  return Number((error as { status?: number } | null)?.status || 0);
}

function DetailSkeleton() {
  return (
    <PublicSurface>
      <PublicContainer>
        <Stack sx={{ py: { xs: 3, md: 5 }, gap: 2 }}>
          <Skeleton width={260} height={28} />
          <Skeleton width="55%" height={52} />
          <Skeleton width="75%" height={28} />
          <Skeleton variant="rounded" height={440} sx={{ borderRadius: 3 }} />
        </Stack>
      </PublicContainer>
    </PublicSurface>
  );
}

function NotFound({
  buildingId,
  search,
}: {
  buildingId: string;
  search: string;
}) {
  return (
    <PublicSurface>
      <PublicContainer>
        <Paper
          variant="outlined"
          sx={{
            maxWidth: 560,
            mx: "auto",
            my: { xs: 5, md: 8 },
            p: { xs: 3, md: 4 },
            textAlign: "center",
            borderRadius: 3,
          }}
        >
          <Building2 size={48} aria-hidden="true" />
          <Typography
            component="h1"
            sx={{ mt: 2, fontSize: { xs: 22, md: 26 }, fontWeight: 800 }}
          >
            Không tìm thấy tòa nhà
          </Typography>
          <Typography sx={{ mt: 1, color: "text.secondary" }}>
            Không có tòa nhà công khai với mã <strong>{buildingId}</strong>.
          </Typography>
          <Button
            component={RouterLink}
            to={publicHref(routePaths.search, search)}
            variant="contained"
            sx={{ mt: 3 }}
          >
            Tìm tòa nhà khác
          </Button>
        </Paper>
      </PublicContainer>
    </PublicSurface>
  );
}

export default function PublicBuildingDetailPage({
  buildingId,
  currentUser,
}: Props) {
  const location = useLocation();
  const { search } = location;
  const query = useBuildingQuery(buildingId);
  const building = query.data;
  const roomsQuery = useRoomsByBuildingQuery(
    building?.listingState === "withdrawn"
      ? undefined
      : building?.id || building?.code || buildingId,
  );
  const buildingWard = String(building?.ward || "").trim();
  const otherBuildingsQuery = useBuildingsPageQuery(
    {
      scope: "public",
      status: "active",
      ward: buildingWard,
      availability: "available",
      page: 1,
      pageSize: 6,
      sort: "updatedAt",
      order: "desc",
    },
    Boolean(building && buildingWard),
  );
  const [showAreaMap, setShowAreaMap] = useState(false);
  const areaMapParams = useMemo(
    () =>
      publicBuildingMapQuerySchema.parse({
        ward: buildingWard,
        availability: "available",
      }),
    [buildingWard],
  );
  const areaMapQuery = useBuildingMapQuery(
    areaMapParams,
    showAreaMap && Boolean(buildingWard) && Boolean(building),
  );

  const gallery = useMemo(() => {
    if (!building) return [];
    return Array.from(
      new Set(
        [
          building.coverImage,
          ...(Array.isArray(building.images) ? building.images : []),
        ]
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    );
  }, [building]);

  const mapData = useMemo<PublicBuildingMapResult | undefined>(() => {
    if (!building) return undefined;
    const point = building.mapPoint;
    const minPrice = building.minPrice > 0 ? building.minPrice : null;
    const priceState: PublicBuildingMapResult["markers"][number]["priceState"] =
      building.vacantRoomsCount <= 0
        ? "no_available_units"
        : minPrice
          ? "priced"
          : "missing_price";
    return {
      total: 1,
      mappableTotal: point ? 1 : 0,
      missingLocationTotal: point ? 0 : 1,
      limit: PUBLIC_BUILDING_MAP_LIMIT,
      truncated: false,
      markers: point
        ? [
            {
              id: building.id,
              code: building.code,
              name: building.name,
              ownerType: building.ownerType === "partner" ? "partner" : "tiny",
              address: building.address,
              district: building.district,
              ward: building.ward,
              city: building.city,
              coverImage: building.coverImage,
              minPrice,
              priceState,
              vacantRoomsCount: building.vacantRoomsCount,
              mapPoint: point,
            },
          ]
        : [],
    };
  }, [building]);

  const activeMapData = useMemo<PublicBuildingMapResult | undefined>(() => {
    if (!showAreaMap || !areaMapQuery.data) return mapData;
    const current = mapData?.markers[0];
    const markers =
      current &&
      !areaMapQuery.data.markers.some((item) => item.id === current.id)
        ? [current, ...areaMapQuery.data.markers]
        : areaMapQuery.data.markers;
    return {
      ...areaMapQuery.data,
      total: Math.max(areaMapQuery.data.total, markers.length),
      mappableTotal: Math.max(areaMapQuery.data.mappableTotal, markers.length),
      markers,
    };
  }, [areaMapQuery.data, mapData, showAreaMap]);

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError && errorStatus(query.error) !== 404) {
    return (
      <PublicSurface>
        <PublicContainer>
          <Paper
            role="alert"
            variant="outlined"
            sx={{
              maxWidth: 620,
              mx: "auto",
              my: { xs: 5, md: 8 },
              p: 3,
              borderRadius: 3,
            }}
          >
            <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800 }}>
              Chưa tải được thông tin tòa nhà
            </Typography>
            <Typography sx={{ mt: 1, color: "text.secondary" }}>
              Vui lòng kiểm tra kết nối và thử lại.
            </Typography>
            <Button
              variant="contained"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              sx={{ mt: 2 }}
            >
              Thử lại
            </Button>
          </Paper>
        </PublicContainer>
      </PublicSurface>
    );
  }
  if (!building || errorStatus(query.error) === 404)
    return <NotFound buildingId={buildingId} search={search} />;

  const withdrawn = building.listingState === "withdrawn";
  const ownerLabel =
    building.ownerType === "tiny" ? "Tòa Homelax" : "Tòa đối tác";
  const title = String(building.name || building.code || "Tòa nhà").trim();
  const code = String(building.code || "").trim();
  const codeIsDistinct =
    Boolean(code) &&
    code.toLocaleLowerCase("vi") !== title.toLocaleLowerCase("vi");
  const ward = buildingWard;
  const rawAddress = String(building.address || "").trim();
  const publicAddress =
    [
      rawAddress,
      ward &&
      !rawAddress.toLocaleLowerCase("vi").includes(ward.toLocaleLowerCase("vi"))
        ? ward
        : "",
    ]
      .filter(Boolean)
      .join(", ") || "Địa chỉ đang được cập nhật";
  const otherBuildings = (otherBuildingsQuery.data?.items || [])
    .filter((item) => item.id !== building.id)
    .slice(0, 3);
  const googleMapsHref = (item: PublicBuildingMapResult["markers"][number]) =>
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(item.mapPoint.lat + "," + item.mapPoint.lng);
  const price =
    building.minPrice > 0 ? (
      <>
        Từ {money(building.minPrice)} đ{" "}
        <Typography
          component="span"
          sx={{ fontSize: 13, color: "text.secondary", fontWeight: 500 }}
        >
          /tháng
        </Typography>
      </>
    ) : (
      publicBuildingPriceFallback(building)
    );


  return (
    <PublicSurface>
      <PublicContainer>
        <Box sx={{ py: { xs: 2.5, md: 4.5 }, minWidth: 0 }}>
          <PublicDetailHeader title={title} address={publicAddress} price={price}
            breadcrumbs={[
              { label: 'Trang chủ', href: publicHref(routePaths.home, search) },
              { label: 'Tìm phòng', href: searchReturnHref(location.state, search) },
              { label: 'Chi tiết tòa nhà' },
            ]}
            notice={withdrawn ? <Alert severity="warning" sx={{ mb: 2.5 }}>{PUBLIC_LISTING_WITHDRAWN_TEXT}</Alert> : null}
            badges={<>
              <Chip size="small" label={ownerLabel} color={building.ownerType === 'tiny' ? 'primary' : 'default'} sx={{ fontWeight: 700 }} />
              {codeIsDistinct && <Chip size="small" variant="outlined" label={code} />}
              <Chip size="small" variant="outlined" color={building.vacantRoomsCount > 0 ? 'success' : 'default'}
                label={building.vacantRoomsCount > 0 ? `${building.vacantRoomsCount} phòng trống` : 'Hết phòng trống'} />
            </>}
            actions={<><AffiliateShareButton currentUser={currentUser} />{!withdrawn && <SalesImageLink currentUser={currentUser} buildingId={building.id} />}</>} />

          <PublicDetailGallery images={gallery} title={title} label="Hình ảnh tòa nhà"
            emptyLabel="Tòa nhà chưa có ảnh công khai" media={building.media360 || []} />

          <Box
            sx={{
              mt: { xs: 4, md: 5 },
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                lg: "repeat(12, minmax(0, 1fr))",
              },
              gap: { xs: 3, lg: 2.5 },
              alignItems: "start",
            }}
          >
            <Box
              component="section"
              aria-labelledby="building-room-types-title"
              sx={{ gridColumn: { lg: "span 7" }, minWidth: 0 }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  gap: 1,
                  justifyContent: "space-between",
                  alignItems: { sm: "flex-end" },
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    id="building-room-types-title"
                    component="h2"
                    sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800 }}
                  >
                    Loại phòng còn trống
                  </Typography>
                </Box>
                {!roomsQuery.isPending && !roomsQuery.isError && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${(roomsQuery.data || []).filter((room) => room.vacantCount > 0).length} loại phòng`}
                  />
                )}
              </Stack>

              {withdrawn ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 3, md: 4 },
                    borderRadius: 3,
                    textAlign: "center",
                    bgcolor: "background.default",
                  }}
                >
                  <BedDouble size={34} aria-hidden="true" />
                  <Typography sx={{ mt: 1.25, fontSize: 18, fontWeight: 800 }}>
                    Tòa nhà đã ngừng nhận khách
                  </Typography>
                  <Typography
                    sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}
                  >
                    Thông tin tòa nhà vẫn được giữ để tham khảo, nhưng hiện
                    không nhận lịch xem phòng mới.
                  </Typography>
                </Paper>
              ) : roomsQuery.isPending ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr)",
                    gap: 2,
                  }}
                >
                  {[0, 1].map((item) => (
                    <Skeleton
                      key={item}
                      variant="rounded"
                      height={220}
                      sx={{ borderRadius: 3 }}
                    />
                  ))}
                </Box>
              ) : roomsQuery.isError ? (
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                  <Typography sx={{ fontWeight: 800 }}>
                    Chưa tải được danh sách loại phòng
                  </Typography>
                  <Typography
                    sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}
                  >
                    Vui lòng thử lại.
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => void roomsQuery.refetch()}
                    disabled={roomsQuery.isFetching}
                    sx={{ mt: 2 }}
                  >
                    Thử lại
                  </Button>
                </Paper>
              ) : (
                (() => {
                  const availableRooms = (roomsQuery.data || []).filter(
                    (room) =>
                      room.vacantCount > 0 &&
                      room.roomUnits?.some(
                        (unit) => unit.status === "available",
                      ),
                  );
                  if (!availableRooms.length)
                    return (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: { xs: 3, md: 4 },
                          borderRadius: 3,
                          textAlign: "center",
                          bgcolor: "background.default",
                        }}
                      >
                        <BedDouble size={34} aria-hidden="true" />
                        <Typography
                          sx={{ mt: 1.25, fontSize: 18, fontWeight: 800 }}
                        >
                          Tòa nhà hiện chưa có phòng trống
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.5,
                            fontSize: 14,
                            color: "text.secondary",
                          }}
                        >
                          Các loại phòng sẽ xuất hiện lại khi có căn sẵn sàng
                          cho thuê.
                        </Typography>
                      </Paper>
                    );

                  return (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr)",
                        gap: 2,
                      }}
                    >
                      {availableRooms.map((room) => (
                        <PublicRoomCard
                          key={room.id}
                          room={{ ...room, ownerType: building.ownerType }}
                          href={publicHref(routeHref.room(room.id), search)}
                        />
                      ))}
                    </Box>
                  );
                })()
              )}
            </Box>

            <Box
              component="section"
              aria-labelledby="building-location-title"
              sx={{ gridColumn: { lg: "span 5" }, minWidth: 0 }}
            >
              <Paper
                variant="outlined"
                sx={{ borderRadius: 3, overflow: "hidden" }}
              >
                {mapData?.mappableTotal ? (
                  <SearchResultMap
                    data={activeMapData}
                    pending={false}
                    error={false}
                    onRetry={() => void areaMapQuery.refetch()}
                    filterKey={
                      "building-detail:" +
                      building.id +
                      (showAreaMap ? ":area" : ":single")
                    }
                    region={null}
                    onRegionChange={() => undefined}
                    regionSearchEnabled={false}
                    embedded
                    fitControlEnabled={false}
                    autoFitDataChanges
                    selectionActions={{
                      googleMapsHref,
                      onAreaSearch: () => setShowAreaMap(true),
                      areaSearchDisabled: showAreaMap || !ward,
                      areaSearchLabel: showAreaMap
                        ? "Đang hiển thị các tòa cùng khu vực"
                        : "Xem các phòng cùng khu vực",
                    }}
                    height={300}
                    summaryPlacement="overlay-bottom-right"
                  />
                ) : (
                  <Box
                    sx={{
                      minHeight: 240,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "background.default",
                      p: 3,
                    }}
                  >
                    <Stack
                      sx={{
                        alignItems: "center",
                        textAlign: "center",
                        gap: 1,
                        maxWidth: 360,
                      }}
                    >
                      <MapPin size={34} aria-hidden="true" />
                      <Typography sx={{ fontWeight: 800 }}>
                        Chưa có vị trí bản đồ công khai
                      </Typography>
                      <Typography
                        sx={{ fontSize: 14, color: "text.secondary" }}
                      >
                        Bạn vẫn có thể liên hệ Homelax để được hướng dẫn khi
                        đặt lịch xem phòng.
                      </Typography>
                    </Stack>
                  </Box>
                )}

                <Box
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "text.secondary",
                      letterSpacing: ".04em",
                    }}
                  >
                    LIÊN HỆ XEM PHÒNG
                  </Typography>
                  <Typography
                    component="h3"
                    sx={{ mt: 1, fontSize: 20, fontWeight: 850 }}
                  >
                    {TINY_HOUSES_PUBLIC_CONTACT.name}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 1,
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: "text.secondary",
                    }}
                  >
                    Liên hệ đội ngũ Homelax để kiểm tra tình trạng căn và
                    sắp xếp lịch xem phù hợp.
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    sx={{ mt: 2.5, gap: 1.25 }}
                  >
                    <Button
                      component="a"
                      href={"tel:" + TINY_HOUSES_PUBLIC_CONTACT.phone}
                      variant="contained"
                      startIcon={<Phone size={18} aria-hidden="true" />}
                      sx={{ minHeight: 44, flex: 1 }}
                    >
                      Gọi {TINY_HOUSES_PUBLIC_CONTACT.phone}
                    </Button>
                    <Button
                      component="a"
                      href={TINY_HOUSES_PUBLIC_CONTACT.zaloUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      startIcon={<MessageCircle size={18} aria-hidden="true" />}
                      sx={{ minHeight: 44, flex: 1 }}
                    >
                      Nhắn Zalo
                    </Button>
                  </Stack>
                </Box>
              </Paper>
            </Box>
          </Box>

          <Box
            component="section"
            aria-labelledby="other-buildings-title"
            sx={{ mt: { xs: 4, md: 5 } }}
          >
            <Box sx={{ mb: 2 }}>
              <Typography
                id="other-buildings-title"
                component="h2"
                sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800 }}
              >
                Các tòa nhà cùng khu vực
              </Typography>
            </Box>

            {!buildingWard ? (
              <Typography color="text.secondary">Chưa có xã/phường để tìm tòa cùng khu vực.</Typography>
            ) : otherBuildingsQuery.isPending ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {[0, 1, 2].map((item) => (
                  <Skeleton
                    key={item}
                    variant="rounded"
                    height={320}
                    sx={{ borderRadius: 3 }}
                  />
                ))}
              </Box>
            ) : otherBuildingsQuery.isError ? (
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                <Typography sx={{ fontWeight: 800 }}>
                  Chưa tải được các tòa nhà khác
                </Typography>
                <Typography
                  sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}
                >
                  Vui lòng thử lại.
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => void otherBuildingsQuery.refetch()}
                  disabled={otherBuildingsQuery.isFetching}
                  sx={{ mt: 2 }}
                >
                  Thử lại
                </Button>
              </Paper>
            ) : otherBuildings.length ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {otherBuildings.map((item) => (
                  <PublicBuildingCard
                    key={item.id}
                    building={item}
                    href={publicHref(
                      routeHref.building(item.code || item.id),
                      search,
                    )}
                  />
                ))}
              </Box>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  borderRadius: 3,
                  textAlign: "center",
                  bgcolor: "background.default",
                }}
              >
                <Typography sx={{ fontWeight: 800 }}>
                  Chưa có tòa khác cùng khu vực đang còn phòng
                </Typography>
                <Typography
                  sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}
                >
                  Bạn có thể mở trang tìm phòng để xem thêm các lựa chọn khác.
                </Typography>
                <Button
                  component={RouterLink}
                  to={publicHref(routePaths.search, search)}
                  variant="outlined"
                  sx={{ mt: 2 }}
                >
                  Xem tất cả tòa nhà
                </Button>
              </Paper>
            )}
          </Box>
        </Box>
      </PublicContainer>

    </PublicSurface>
  );
}
