import { useId, useState, type ReactNode } from 'react';
import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material';
import { Eye, ImageOff } from 'lucide-react';
import type { Media360Item } from '@tinyhouse/contracts';
import { PublicImage } from './PublicImage';
import { PublicMedia360 } from './PublicMedia360';
import ImageLightboxModal from '../ui/media/ImageLightboxModal';

export function PublicDetailGallery({ images: gallery, title, label, emptyLabel, media = [], actions }: {
  images: string[]; title: string; label: string; emptyLabel: string; media?: Media360Item[]; actions?: ReactNode;
}) {
  const headingId = useId();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const visibleGallery = gallery.slice(0, 4);
  const galleryLayoutCount = visibleGallery.length;
  const openImage = (index: number) => { setLightboxIndex(index); setLightboxOpen(true); };
  return <>
          <Box
            component="section"
            aria-labelledby={headingId}
            sx={{ mt: 2 }}
          >
            <Stack
              direction="row"
              sx={{
                mb: 1.5,
                justifyContent: "space-between",
                alignItems: "center",
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Typography
                id={headingId}
                component="h2"
                sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 800 }}
              >
                {label}
              </Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center', ml: 'auto' }}>
              {actions}
              <PublicMedia360
                media={media}
                subject={title}
                inline
              />
              </Stack>
            </Stack>

            {gallery.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{
                  minHeight: { xs: 220, md: 340 },
                  borderRadius: 3,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "background.default",
                }}
              >
                <Stack
                  sx={{ alignItems: "center", textAlign: "center", gap: 1 }}
                >
                  <ImageOff size={34} aria-hidden="true" />
                  <Typography sx={{ fontWeight: 700 }}>
                    {emptyLabel}
                  </Typography>
                  <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
                    Ảnh sẽ hiển thị khi được cập nhật.
                  </Typography>
                </Stack>
              </Paper>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 1.25,
                  minWidth: 0,
                  overflow: "hidden",
                  borderRadius: 3,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    md:
                      galleryLayoutCount === 1
                        ? "minmax(0, 1fr)"
                        : galleryLayoutCount === 2
                          ? "repeat(2, minmax(0, 1fr))"
                          : "repeat(4, minmax(0, 1fr))",
                  },
                  gridTemplateRows: {
                    xs: "auto",
                    md: galleryLayoutCount <= 2 ? "440px" : "repeat(2, 215px)",
                  },
                }}
              >
                {visibleGallery.map((image, index) => {
                  const isMain = index === 0;
                  const remaining = gallery.length - visibleGallery.length;
                  const desktopPlacement =
                    galleryLayoutCount >= 3
                      ? index === 0
                        ? { gridColumn: "1 / 3", gridRow: "1 / 3" }
                        : index === 1
                          ? { gridColumn: "3 / 5", gridRow: "1" }
                          : { gridColumn: galleryLayoutCount === 3 ? "3 / 5" : String(index + 1), gridRow: "2" }
                      : {};

                  return (
                    <ButtonBase
                      key={image}
                      aria-label={
                        index === 0
                          ? `Xem ảnh chính - ${title}`
                          : `Xem ảnh ${index + 1} - ${title}`
                      }
                      onClick={() => openImage(index)}
                      sx={{
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: 2.5,
                        display: "block",
                        minWidth: 0,
                        height: { xs: isMain ? 270 : index === 1 ? 180 : 130, md: "100%" },
                        gridColumn: {
                          xs: isMain || index === 1 || galleryLayoutCount === 3 ? "1 / -1" : "auto",
                          md: desktopPlacement.gridColumn || "auto",
                        },
                        gridRow: { md: desktopPlacement.gridRow || "auto" },
                      }}
                    >
                      <PublicImage
                        src={image}
                        alt={`${title} - ảnh ${index + 1}`}
                        priority={isMain}
                        fill
                      />

                      {isMain && (
                        <Stack
                          direction="row"
                          sx={{
                            position: "absolute",
                            left: 12,
                            bottom: 12,
                            gap: 0.75,
                            alignItems: "center",
                            bgcolor: "rgba(15,23,42,.82)",
                            color: "common.white",
                            borderRadius: 99,
                            px: 1.5,
                            py: 0.75,
                          }}
                        >
                          <Eye size={15} aria-hidden="true" />
                          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>
                            Xem tất cả ảnh
                          </Typography>
                        </Stack>
                      )}

                      {index === visibleGallery.length - 1 && remaining > 0 && (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: "rgba(15,23,42,.68)",
                            color: "common.white",
                          }}
                        >
                          <Typography sx={{ fontSize: 18, fontWeight: 800 }}>
                            +{remaining} ảnh
                          </Typography>
                        </Box>
                      )}
                    </ButtonBase>
                  );
                })}
              </Box>
            )}
          </Box>

    <ImageLightboxModal isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)}
      images={gallery} currentIndex={lightboxIndex} onIndexChange={setLightboxIndex} title={title} />
  </>;
}
