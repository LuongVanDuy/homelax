import { useId, type ReactNode } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import {
  ArrowRight,
  Building2,
  Headset,
  House,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { PublicLink } from "../../app/router/PublicLink";
import { PublicContainer } from "./PublicLayout";
import { homeDesign as design } from "../../features/home/homeDesign";

const actions = [
  { to: "/tim-phong", label: "Bạn đang tìm phòng?", icon: Search },
  { to: "/chu-nha", label: "Chủ nhà có phòng cho thuê?", icon: Building2 },
  { to: "/cong-tac-vien", label: "CTV sale phòng & nhận hoa hồng", icon: UsersRound },
] as const;
const benefits = [
  { icon: House, label: "Phòng thật" },
  { icon: ShieldCheck, label: "Giá thật" },
  { icon: Headset, label: "Dịch vụ tận tâm 24/7" },
];

export function HomeHero({
  children,
  imageSrc,
}: {
  children: ReactNode;
  imageSrc?: string;
}) {
  const titleId = useId();
  return (
    <Box component="section" aria-labelledby={titleId}>
      <Box
        sx={{
          position: "relative",
          isolation: "isolate",
          display: "flex",
          alignItems: "center",
          bgcolor: design.navy,
          color: "#FFF",
          minHeight: { lg: 440, xl: 520 },
          pt: { xs: 5, lg: 7 },
          pb: { xs: 9, lg: 11 },
        }}
      >
        {imageSrc && (
          <Box
            component="img"
            src={imageSrc}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              zIndex: -2,
            }}
          />
        )}
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: -1,
            background: {
              xs: "linear-gradient(100deg, rgba(10,19,31,.85), rgba(10,19,31,.5))",
              lg: "linear-gradient(90deg, rgba(10,19,31,.82) 0%, rgba(10,19,31,.52) 46%, rgba(10,19,31,.12) 100%)",
            },
          }}
        />
        <PublicContainer>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                lg: "minmax(0, 1fr) 350px",
              },
              gap: { xs: 4, lg: 7 },
              alignItems: "center",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="h1"
                className="home-hero-title"
                id={titleId}
                sx={{
                  fontWeight: 800,
                  lineHeight: 1.25,
                  textTransform: "uppercase",
                  fontSize: {
                    xs: "clamp(1.125rem, 5.7vw, 2rem)",
                    sm: "2rem",
                    xl: "2.25rem",
                  },
                  letterSpacing: "-.035em",
                }}
              >
                <Box component="span" sx={{ display: "block" }}>
                  Quản lý vận hành phòng trọ/ccmn
                </Box>
                <Box
                  component="span"
                  sx={{
                    display: "block",
                    color: design.accent,
                    fontSize: "1.35em",
                    mt: 0.5,
                  }}
                >
                  tại Hà Nội
                </Box>
              </Typography>
              <Typography sx={{ mt: 2, fontSize: { xs: '1.0625rem', sm: '1.25rem' }, fontWeight: 600 }}>
                An tâm sống tốt hơn!
              </Typography>
              <Stack
                component="p"
                direction="row"
                sx={{
                  mt: 2,
                  gap: "8px 12px",
                  flexWrap: "wrap",
                  alignItems: "center",
                  fontSize: { xs: ".875rem", sm: "1rem" },
                  fontWeight: 500,
                  lineHeight: 1.7,
                }}
              >
                {benefits.map(({ icon: Icon, label }, index) => (
                  <Box
                    component="span"
                    key={label}
                    sx={{
                      display: "inline-flex",
                      gap: 1,
                      alignItems: "center",
                    }}
                  >
                    {index > 0 && (
                      <Box component="span" sx={{ mr: 0.5 }}>
                        -
                      </Box>
                    )}
                    <Icon
                      size={22}
                      strokeWidth={1.7}
                      aria-hidden="true"
                      style={{ color: design.accent, flexShrink: 0 }}
                    />
                    {label}
                  </Box>
                ))}
              </Stack>
            </Box>
            <Box
              component="nav"
              aria-label="Bạn đang cần gì?"
              sx={{
                p: 2.5,
                borderRadius: design.radius,
                border: "1px solid rgba(255,255,255,.6)",
                bgcolor: "rgba(16,29,48,.76)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 8px 32px rgba(0,0,0,.12)",
              }}
            >
              <Typography
                sx={{ fontSize: "1.0625rem", fontWeight: 700, mb: 1 }}
              >
                Homelax đồng hành cùng bạn
              </Typography>
              {actions.map(({ to, label, icon: Icon }, index) => (
                <Button
                  key={to}
                  component={PublicLink}
                  to={to}
                  sx={{
                    width: "100%",
                    minHeight: 54,
                    justifyContent: "flex-start",
                    gap: 1.5,
                    px: 0.5,
                    py: 1.5,
                    borderRadius: 0,
                    borderTop: index
                      ? "1px solid rgba(255,255,255,.16)"
                      : "none",
                    color: "#FFF",
                    textAlign: "left",
                    fontSize: ".875rem",
                    fontWeight: 500,
                    lineHeight: 1.5,
                    "&:hover": { bgcolor: "rgba(255,255,255,.1)" },
                    "&:focus-visible": {
                      outline: "2px solid white",
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Icon
                    size={23}
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  />
                  <Box component="span" sx={{ flex: 1 }}>
                    {label}
                  </Box>
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              ))}
            </Box>
          </Box>
        </PublicContainer>
      </Box>
      <PublicContainer>
        <Box
          sx={{
            position: "relative",
            mt: -5,
            p: { xs: 2.5, md: 3.5 },
            bgcolor: "#FFF",
            color: design.navy,
            borderRadius: design.radius,
            boxShadow: "0 8px 28px rgba(16,29,48,.09)",
            border: `1px solid ${design.border}`,
          }}
        >
          {children}
        </Box>
      </PublicContainer>
    </Box>
  );
}
