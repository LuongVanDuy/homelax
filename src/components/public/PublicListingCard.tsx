import type { MouseEvent, ReactNode } from "react";
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  MapPin,
  Ruler,
  Users,
} from "lucide-react";
import {
  PUBLIC_PRICE_TEXT,
  PUBLIC_LISTING_WITHDRAWN_TEXT,
  type PublicBuilding,
  type PublicRoomType,
} from "@tinyhouse/contracts";
import { designTokens as tokens } from "../../app/theme/tokens";
import { PublicImage } from "./PublicImage";

type LinkProps = { href: string; onNavigate?: () => void; priority?: boolean };
const money = new Intl.NumberFormat("vi-VN");
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function ListingCard({
  title,
  address,
  image,
  price,
  vacantCount,
  withdrawn,
  ownerType,
  details,
  horizontal = false,
  compact = false,
  imageAspectRatio,
  href,
  onNavigate,
  priority,
}: LinkProps & {
  title: string;
  address?: string;
  image?: string;
  price: ReactNode;
  vacantCount: number;
  withdrawn?: boolean;
  ownerType: string;
  details?: ReactNode;
  horizontal?: boolean;
  compact?: boolean;
  imageAspectRatio?: string;
}) {
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !onNavigate ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    onNavigate();
  };
  // Extra distance/school details must not push the price outside a fixed card.
  const fixedCompactHorizontal = compact && horizontal && !details;
  return (
    <Card
      variant="outlined"
      sx={{
        height: {
          xs: "auto",
          sm: fixedCompactHorizontal ? 166 : horizontal ? "auto" : "100%",
        },
        minHeight: { sm: fixedCompactHorizontal ? 166 : undefined },
        maxHeight: { sm: fixedCompactHorizontal ? 166 : undefined },
        minWidth: 0,
        overflow: "hidden",
        borderColor: tokens.colors.neutral[200],
        borderRadius: compact ? "12px" : `${tokens.radius.lg}px`,
        boxShadow: compact
          ? "0 4px 20px rgba(16,29,48,.045)"
          : tokens.shadows.xs,
      }}
    >
      <CardActionArea
        component="a"
        href={href}
        onClick={navigate}
        aria-label={`Xem chi tiết ${title}`}
        sx={{
          height: horizontal && !fixedCompactHorizontal ? "auto" : "100%",
          display: "flex",
          flexDirection: { xs: "column", sm: horizontal ? "row" : "column" },
          alignItems: "stretch",
          color: "inherit",
          textDecoration: "none",
          "&.Mui-focusVisible": {
            outline: "3px solid",
            outlineColor: "primary.main",
            outlineOffset: -3,
          },
          "@media (hover: hover)": {
            "&:hover": { bgcolor: tokens.colors.neutral[50] },
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: { xs: "100%", sm: horizontal ? (compact ? 216 : "38%") : "100%" },
            maxWidth: { sm: horizontal && !compact ? 272 : undefined },
            height: "auto",
            aspectRatio: horizontal
              ? { xs: imageAspectRatio || "4 / 3", sm: "auto" }
              : undefined,
            alignSelf: "stretch",
            flexShrink: 0,
          }}
        >
          <Box sx={horizontal ? { position: "absolute", inset: 0 } : undefined}>
            <PublicImage
              src={image}
              alt={title}
              priority={priority}
              aspectRatio={imageAspectRatio}
              fill={horizontal}
            />
          </Box>
          {compact && (
            <Chip
              size="small"
              label={
                withdrawn
                  ? "Ngừng nhận khách"
                  : vacantCount > 0
                    ? "Còn phòng"
                    : PUBLIC_PRICE_TEXT.no_available_units
              }
              sx={{
                position: "absolute",
                top: 10,
                left: 10,
                height: 28,
                borderRadius: "6px",
                fontSize: ".75rem",
                fontWeight: 700,
                bgcolor: withdrawn ? "#475569" : vacantCount > 0 ? "#287D40" : "error.dark",
                color: "#FFF",
              }}
            />
          )}
          {compact && (
            <Chip
              size="small"
              label={ownerType === "tiny" ? "Tòa Homelax" : "Tòa đối tác"}
              sx={{
                position: "absolute",
                bottom: 10,
                left: 10,
                height: 28,
                borderRadius: "6px",
                fontSize: ".75rem",
                fontWeight: 700,
                bgcolor:
                  ownerType === "tiny"
                    ? "primary.main"
                    : tokens.colors.navy[900],
                color: ownerType === "tiny" ? "primary.contrastText" : "#FFF",
                boxShadow: "0 2px 8px rgba(0,0,0,.16)",
              }}
            />
          )}
        </Box>
        <Stack sx={{ p: horizontal && !compact ? 2 : 2.5, gap: compact || horizontal ? 1 : 1.5, flex: 1, minWidth: 0 }}>
          {!compact && (
            <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
              <Chip
                size="small"
                label={ownerType === "tiny" ? "Homelax" : "Đối tác"}
                color={ownerType === "tiny" ? "primary" : "secondary"}
              />
              <Chip
                size="small"
                variant="outlined"
                label={
                  withdrawn
                    ? "Ngừng nhận khách"
                    : vacantCount > 0
                      ? `${vacantCount} phòng trống`
                      : PUBLIC_PRICE_TEXT.no_available_units
                }
                sx={{ color: "text.primary" }}
              />
            </Stack>
          )}
          <Typography
            component="h3"
            sx={{
              fontSize: "1.125rem",
              lineHeight: 1.4,
              fontWeight: 700,
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </Typography>
          {address && (
            <Stack
              direction="row"
              sx={{
                gap: 0.75,
                color: "text.secondary",
                alignItems: "flex-start",
              }}
            >
              <MapPin
                size={compact ? 14 : 18}
                aria-hidden="true"
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <Typography
                variant="body2"
                sx={{
                  fontSize: ".875rem",
                  lineHeight: 1.6,
                  overflowWrap: "anywhere",
                }}
              >
                {address}
              </Typography>
            </Stack>
          )}
          {compact && (
            <Stack
              direction="row"
              sx={{ alignItems: "center", gap: 0.75, color: "text.secondary" }}
            >
              <Building2 size={14} aria-hidden="true" />
              <Typography sx={{ fontSize: ".875rem", lineHeight: 1.6 }}>
                {withdrawn ? "Ngừng nhận khách" : vacantCount > 0 ? `${vacantCount} phòng trống` : PUBLIC_PRICE_TEXT.no_available_units}
              </Typography>
            </Stack>
          )}
          {details}
          <Stack
            direction="row"
            sx={{
              gap: 1,
              justifyContent: "space-between",
              alignItems: "center",
              mt: "auto",
              pt: compact ? 0.5 : horizontal ? 1 : 1.5,
              borderTop: compact
                ? "none"
                : `1px solid ${tokens.colors.neutral[200]}`,
            }}
          >
            <Typography
              component="div"
              sx={{
                color: "primary.main",
                fontWeight: 700,
                fontSize: "1.125rem",
                fontVariantNumeric: "tabular-nums",
                "& > span": { fontSize: ".875rem" },
              }}
            >
              {price}
            </Typography>
            {compact ? (
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: `1px solid ${tokens.colors.neutral[200]}`,
                  flexShrink: 0,
                }}
              >
                <ArrowRight size={14} aria-hidden="true" />
              </Box>
            ) : (
              <ArrowUpRight
                size={20}
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              />
            )}
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function Rent({ value, from = false }: { value: number; from?: boolean }) {
  return (
    <>
      {from && "Từ "}
      {money.format(value)} đ
      <Typography
        component="span"
        sx={{
          ml: 0.5,
          fontSize: "0.875rem",
          fontWeight: 400,
          color: "text.secondary",
        }}
      >
        /tháng
      </Typography>
    </>
  );
}

type BuildingCardData = Pick<
  PublicBuilding,
  | "name"
  | "address"
  | "ward"
  | "coverImage"
  | "images"
  | "minPrice"
  | "vacantRoomsCount"
  | "ownerType"
> &
  Partial<Pick<PublicBuilding, "listingState" | "code">>;
export function PublicBuildingCard({
  building,
  details,
  horizontal = false,
  ...link
}: LinkProps & {
  building: BuildingCardData;
  details?: ReactNode;
  horizontal?: boolean;
}) {
  const address = [
    building.address,
    building.ward && !building.address.includes(building.ward)
      ? building.ward
      : "",
  ]
    .filter(Boolean)
    .join(", ");
  const price =
    building.vacantRoomsCount <= 0 ? (
      PUBLIC_PRICE_TEXT.no_available_units
    ) : positive(building.minPrice) ? (
      <Rent value={building.minPrice} from />
    ) : (
      PUBLIC_PRICE_TEXT.missing_price
    );
  return (
    <ListingCard
      {...link}
      compact
      horizontal={horizontal}
      title={building.code || building.name}
      address={address}
      image={building.coverImage || building.images[0]}
      imageAspectRatio="3 / 2"
      details={details}
      ownerType={building.ownerType}
      vacantCount={building.vacantRoomsCount}
      withdrawn={building.listingState === "withdrawn"}
      price={price}
    />
  );
}

type RoomCardData = Pick<
  PublicRoomType,
  | "type"
  | "area"
  | "maxOccupants"
  | "coverImage"
  | "images"
  | "vacantCount"
  | "ownerType"
> & { price: number | null; listingState?: PublicRoomType["listingState"] };
export function PublicRoomCard({
  room,
  ...link
}: LinkProps & { room: RoomCardData }) {
  return (
    <ListingCard
      {...link}
      title={room.type}
      image={room.coverImage || room.images[0]}
      ownerType={room.ownerType}
      vacantCount={room.vacantCount}
      withdrawn={room.listingState === "withdrawn"}
      horizontal
      price={
        positive(room.price) ? (
          <Rent value={room.price} />
        ) : (
          PUBLIC_PRICE_TEXT.missing_price
        )
      }
      details={
        <>
          <Stack
            direction="row"
            sx={{
              gap: 2,
              flexWrap: "wrap",
              color: "text.secondary",
              fontSize: "0.875rem",
            }}
          >
            {positive(room.area) && (
              <Stack direction="row" sx={{ gap: 0.5, alignItems: "center" }}>
                <Ruler size={16} aria-hidden="true" />
                {room.area} m²
              </Stack>
            )}
            {positive(room.maxOccupants) && (
              <Stack direction="row" sx={{ gap: 0.5, alignItems: "center" }}>
                <Users size={16} aria-hidden="true" />
                Tối đa {room.maxOccupants} người
              </Stack>
            )}
          </Stack>
          {room.listingState === "withdrawn" && (
            <Typography variant="body2" color="text.secondary">
              {PUBLIC_LISTING_WITHDRAWN_TEXT}
            </Typography>
          )}
        </>
      }
    />
  );
}
