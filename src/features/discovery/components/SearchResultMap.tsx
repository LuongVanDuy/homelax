import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowLeft, ArrowRight, ExternalLink, Maximize, Pencil, Undo2, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import type {
  PublicBuildingMapItem,
  PublicBuildingMapResult,
  PublicMapBounds,
} from "@tinyhouse/contracts";
import "leaflet/dist/leaflet.css";
import { PublicImage } from "../../../components/public/PublicImage";
import { publicHref } from "../../../app/router/publicNavigation";
import { routeHref } from "../../../app/router/routePaths";
import { searchReturnState } from '../../../app/router/searchReturn';
import { publicBrand } from "../../../app/theme/publicBrand";
import { mapRegionFromPoints, normalizeMapBounds, sameMapBounds } from "../mapRegion";
import {
  buildingMapPrice,
  groupBuildingMapPoints,
  regionKey,
  type SearchMapCamera,
} from "../mapModel";

type Layer = { remove: () => void; clearLayers: () => void };
type Bounds = {
  getSouth: () => number;
  getNorth: () => number;
  getWest: () => number;
  getEast: () => number;
};
type MapInstance = {
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  getBounds: () => Bounds;
  setView: (center: [number, number], zoom: number, options?: object) => void;
  fitBounds: (bounds: [number, number][], options?: object) => void;
  invalidateSize: (options?: object) => void;
  on: (type: string, fn: (event: { latlng: { lat: number; lng: number } }) => void) => void;
  off: (type: string, fn: (event: { latlng: { lat: number; lng: number } }) => void) => void;
  fire: (type: string) => void;
  remove: () => void;
};
type Engine = {
  map: MapInstance;
  L: (typeof import("leaflet"))["default"];
  markerLayer: Layer;
  regionLayer: Layer;
};
type Props = {
  data?: PublicBuildingMapResult;
  pending: boolean;
  error: boolean;
  onRetry: () => void;
  filterKey: string;
  region: PublicMapBounds | null;
  onRegionChange: (value: PublicMapBounds | null) => void;
  regionSearchEnabled?: boolean;
  embedded?: boolean;
  fitControlEnabled?: boolean;
  selectionActions?: {
    googleMapsHref: (building: PublicBuildingMapItem) => string;
    onAreaSearch: () => void;
    areaSearchDisabled?: boolean;
    areaSearchLabel?: string;
  };
  autoFitDataChanges?: boolean;
  height?: number;
  getSavedCamera?: () => SearchMapCamera | null;
  onCameraChange?: (value: SearchMapCamera) => void;
  summaryPlacement?: "header" | "overlay-bottom-right";
};
const EMPTY_MARKERS: PublicBuildingMapItem[] = [];
const cameraOf = (map: MapInstance): SearchMapCamera => ({
  ...map.getCenter(),
  zoom: map.getZoom(),
});
const boundsOf = (map: MapInstance): PublicMapBounds => {
  const b = map.getBounds();
  return {
    type: "bounds",
    south: b.getSouth(),
    west: b.getWest(),
    north: b.getNorth(),
    east: b.getEast(),
  };
};

export function SearchMapPreview({
  building,
  onClose,
  onBack,
}: {
  building: PublicBuildingMapItem;
  onClose: () => void;
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { search } = location;
  const href = publicHref(
    routeHref.building(building.code || building.id),
    search,
  );
  const area =
    building.address ||
    [building.ward, building.district, building.city]
      .filter(Boolean)
      .join(", ");
  const openDetail = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href, { state: searchReturnState(location) });
  };
  return (
    <Paper
      variant="outlined"
      role="region"
      aria-label="Thông tin tòa nhà trên bản đồ"
      sx={{ overflow: "hidden", borderRadius: 2 }}
    >
      <Box sx={{ position: "relative", height: 112, overflow: "hidden" }}>
        <Box component="a" href={href} onClick={openDetail} aria-label={`Xem ảnh và chi tiết ${building.code || building.name}`}
          sx={{ display: 'block', height: '100%', '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: -3 } }}>
          <PublicImage src={building.coverImage} alt={building.code || building.name} fill />
        </Box>
        <IconButton
          aria-label="Đóng thông tin tòa nhà"
          onClick={onClose}
          size="small"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: "background.paper",
            width: 44,
            height: 44,
          }}
        >
          <X size={16} />
        </IconButton>
      </Box>
      <Stack sx={{ p: 1.75, gap: 0.75 }}>
        {onBack && (
          <Button
            size="small"
            startIcon={<ArrowLeft size={14} />}
            onClick={onBack}
            sx={{ alignSelf: "flex-start" }}
          >
            Các tòa cùng vị trí
          </Button>
        )}
        <Typography component="h3" sx={{ fontSize: 16, fontWeight: 700 }}>
          <Box component="a" href={href} onClick={openDetail} sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            {building.code || building.name}
          </Box>
        </Typography>
        <Typography
          sx={{
            fontSize: 13,
            color: "text.secondary",
            overflowWrap: "anywhere",
          }}
        >
          {area}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          Vị trí gần đúng ·{" "}
          {building.ownerType === "tiny" ? "Tòa Homelax" : "Tòa đối tác"}
        </Typography>
        <Typography
          sx={{ fontSize: 15, color: "primary.main", fontWeight: 700 }}
        >
          {buildingMapPrice(building)}
        </Typography>
        <Chip size="small" label={building.vacantRoomsCount > 0 ? `${building.vacantRoomsCount.toLocaleString("vi-VN")} căn trống` : 'Hết phòng'}
          sx={{ alignSelf: 'flex-start', color: '#FFF', bgcolor: building.vacantRoomsCount > 0 ? 'success.dark' : 'error.dark' }} />
        <Button
          component="a"
          href={href}
          variant="contained"
          size="small"
          endIcon={<ArrowRight size={16} />}
          onClick={openDetail}
        >
          Xem tòa nhà
        </Button>
      </Stack>
    </Paper>
  );
}

/** One Leaflet instance per mounted map. Query updates replace layers, never the canvas/camera. */
export function SearchResultMap({
  data,
  pending,
  error,
  onRetry,
  filterKey,
  region,
  onRegionChange,
  regionSearchEnabled = true,
  embedded = false,
  fitControlEnabled = true,
  selectionActions,
  autoFitDataChanges = false,
  height = 620,
  getSavedCamera,
  onCameraChange,
  summaryPlacement = "header",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [engineError, setEngineError] = useState(false);
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [tileError, setTileError] = useState(false);
  const [tileSlow, setTileSlow] = useState(false);
  const tileRef = useRef<{ redraw: () => void } | null>(null);
  const latest = useRef({ region, getSavedCamera, onCameraChange });
  useEffect(() => {
    latest.current = { region, getSavedCamera, onCameraChange };
  }, [region, getSavedCamera, onCameraChange]);
  const framing = useRef(false);
  const [viewport, setViewport] = useState<{
    bounds: PublicMapBounds;
    camera: SearchMapCamera;
  } | null>(null);
  const [baseline, setBaseline] = useState<PublicMapBounds | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const drawnRegion = useMemo(() => mapRegionFromPoints(drawPoints), [drawPoints]);
  const initialized = useRef(false);
  const lastAutoFitKey = useRef(filterKey);
  const appliedKey = regionKey(region);
  const previousRegionKey = useRef(appliedKey);
  const localRegionChange = useRef<string | null>(null);
  const [selection, setSelection] = useState<{
    key: string;
    ids: string[];
    chosen?: string;
  } | null>(null);
  const markers =
    !pending && !error ? data?.markers || EMPTY_MARKERS : EMPTY_MARKERS;
  const groupingZoom = Math.floor(viewport?.camera.zoom ?? 12);
  const groups = useMemo(
    () => groupBuildingMapPoints(markers, groupingZoom),
    [markers, groupingZoom],
  );
  const selectedMembers =
    selection?.key === filterKey
      ? markers.filter((b) => selection.ids.includes(b.id))
      : [];
  const selected =
    selectedMembers.length === 1
      ? selectedMembers[0]
      : selectedMembers.find((b) => b.id === selection?.chosen);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let cancelled = false;
    let owned: Engine | null = null;
    let observer: ResizeObserver | undefined;
    let resizeFrame: number | undefined;
    let tileTimer: ReturnType<typeof setTimeout> | undefined;
    setEngineError(false);
    void import("leaflet")
      .then(({ default: L }) => {
        if (cancelled) return;
        const map: MapInstance = L.map(node, {
          zoomControl: false,
          minZoom: 3,
          maxZoom: 18,
          zoomSnap: 0.25,
          scrollWheelZoom: true,
          trackResize: false,
        });
        L.control.zoom({ position: "bottomright" }).addTo(map);
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
            updateWhenIdle: true,
            updateWhenZooming: false,
          },
        ).addTo(map);
        // A successful tile must not hide failures in other visible tiles.
        const failedTiles = new Set<HTMLElement>();
        tiles.on("tileerror", ({ tile }: { tile: HTMLElement }) => {
          failedTiles.add(tile);
          if (!cancelled) setTileError(true);
        });
        const clearTileError = ({ tile }: { tile: HTMLElement }) => {
          failedTiles.delete(tile);
          if (!cancelled) setTileError(failedTiles.size > 0);
        };
        tiles.on("tileload", clearTileError);
        tiles.on("tileunload", clearTileError);
        tiles.on("loading", () => {
          clearTimeout(tileTimer);
          if (!cancelled) setTileSlow(false);
          tileTimer = setTimeout(() => { if (!cancelled) setTileSlow(true); }, 10_000);
        });
        tiles.on("load", () => {
          clearTimeout(tileTimer);
          if (!cancelled) setTileSlow(false);
        });
        tileRef.current = tiles;
        owned = {
          map,
          L,
          markerLayer: L.layerGroup().addTo(map),
          regionLayer: L.layerGroup().addTo(map),
        };
        const initial = latest.current.getSavedCamera?.();
        map.setView(
          initial ? [initial.lat, initial.lng] : [21.0285, 105.8542],
          initial?.zoom ?? 12,
          { animate: false },
        );
        initialized.current = Boolean(initial);
        const sync = () => {
          if (cancelled) return;
          const camera = cameraOf(map);
          setViewport({ bounds: boundsOf(map), camera });
          if (framing.current) setBaseline(boundsOf(map));
          latest.current.onCameraChange?.(camera);
        };
        map.on("moveend", sync);
        sync();
        setBaseline(boundsOf(map));
        let width = node.clientWidth;
        let height = node.clientHeight;
        observer = new ResizeObserver(() => {
          if (resizeFrame) cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            if (cancelled || !node.clientWidth || !node.clientHeight) return;
            if (node.clientWidth === width && node.clientHeight === height) return;
            width = node.clientWidth;
            height = node.clientHeight;
            // Leaflet compensates for the changed viewport center itself. A
            // forced setView/reset discards tile work and emits another move.
            map.invalidateSize({ pan: true, animate: false });
            sync();
            // A layout resize is not a user request to search another area.
            setBaseline(boundsOf(map));
          });
        });
        observer.observe(node);
        setEngine(owned);
      })
      .catch(() => {
        if (!cancelled) setEngineError(true);
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      clearTimeout(tileTimer);
      owned?.map.remove();
      tileRef.current = null;
    };
  }, [engineAttempt]);

  const fit = useCallback(
    (points: [number, number][], padding = 36) => {
      if (!engine || points.length === 0) return;
      framing.current = true;
      engine.map.fitBounds(points, {
        padding: [padding, padding],
        maxZoom: 15,
        animate: false,
      });
      engine.map.fire("moveend");
      framing.current = false;
    },
    [engine],
  );

  // Initial framing only. Sort/page/filter responses MUST NOT run fitBounds.
  useEffect(() => {
    if (!engine || initialized.current || pending || error) return;
    initialized.current = true;
    if (region)
      fit(
        [
          [region.south, region.west],
          [region.north, region.east],
        ],
        0,
      );
    else fit(markers.map((b) => [b.mapPoint.lat, b.mapPoint.lng]));
  }, [engine, pending, error, region, markers, fit]);

  useEffect(() => {
    if (!autoFitDataChanges || !engine || pending || error || !markers.length) return;
    if (lastAutoFitKey.current === filterKey) return;
    lastAutoFitKey.current = filterKey;
    setSelection(null);
    fit(markers.map((b) => [b.mapPoint.lat, b.mapPoint.lng]));
  }, [autoFitDataChanges, engine, error, filterKey, fit, markers, pending]);

  // URL back/forward restores an externally selected region. Local Apply/Clear never reframes it.
  useEffect(() => {
    if (previousRegionKey.current === appliedKey) return;
    previousRegionKey.current = appliedKey;
    if (localRegionChange.current === appliedKey) {
      localRegionChange.current = null;
      return;
    }
    if (region)
      fit(
        [
          [region.south, region.west],
          [region.north, region.east],
        ],
        0,
      );
  }, [appliedKey, region, fit]);

  useEffect(() => {
    if (!engine) return;
    engine.regionLayer.clearLayers();
    if (region) {
      const shape = region.polygon ? engine.L.polygon : engine.L.rectangle;
      shape(
        region.polygon || [
          [region.south, region.west],
          [region.north, region.east],
        ],
        {
          color: publicBrand.orange,
          weight: 2,
          fillOpacity: 0.035,
          dashArray: "6 6",
          interactive: false,
        },
      ).addTo(engine.regionLayer);
    }
  }, [engine, appliedKey, region]);

  useEffect(() => {
    if (!engine || !drawing) return;
    const addPoint = ({ latlng }: { latlng: { lat: number; lng: number } }) => {
      const point: [number, number] = [Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))];
      setDrawPoints(points => points.length >= 32 || points.some(p => p[0] === point[0] && p[1] === point[1]) ? points : [...points, point]);
    };
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDrawing(false); setDrawPoints([]); } };
    engine.map.on('click', addPoint);
    window.addEventListener('keydown', cancel);
    return () => { engine.map.off('click', addPoint); window.removeEventListener('keydown', cancel); };
  }, [engine, drawing]);

  useEffect(() => {
    if (!engine || !drawing) return;
    const layer = engine.L.layerGroup().addTo(engine.map);
    const options = { color: publicBrand.orange, weight: 3, fillOpacity: .12, interactive: false };
    if (drawPoints.length >= 3) engine.L.polygon(drawPoints, options).addTo(layer);
    else if (drawPoints.length === 2) engine.L.polyline(drawPoints, options).addTo(layer);
    drawPoints.forEach(point => engine.L.circleMarker(point, { ...options, radius: 5, fillOpacity: 1 }).addTo(layer));
    return () => layer.remove();
  }, [engine, drawing, drawPoints]);

  useEffect(() => {
    if (!engine) return;
    engine.markerLayer.clearLayers();
    for (const group of groups) {
      const clustered = group.members.length > 1;
      const b = group.members[0];
      const element = document.createElement("span");
      element.className = clustered
        ? "th-map-cluster"
        : `th-map-price th-map-price--${b.ownerType}`;
      element.textContent = clustered
        ? `${group.members.length} tòa`
        : buildingMapPrice(b, true);
      element.dataset.buildingIds = group.members
        .map((item) => item.id)
        .join(",");
      const label = clustered
        ? `${group.members.length} tòa nhà trong cụm`
        : `${b.name || b.code}, ${buildingMapPrice(b, true)}`;
      const marker = engine.L.marker([group.lat, group.lng], {
        icon: engine.L.divIcon({
          html: element,
          className: "th-map-icon",
          iconSize: clustered ? [64, 38] : [106, 34],
          iconAnchor: clustered ? [32, 19] : [53, 17],
        }),
        keyboard: !drawing,
        interactive: !drawing,
        title: label,
        alt: label,
        riseOnHover: true,
      }).addTo(engine.markerLayer);
      marker.on("click", () => {
        const samePoint = group.members.every(
          (item) =>
            item.mapPoint.lat === b.mapPoint.lat &&
            item.mapPoint.lng === b.mapPoint.lng,
        );
        if (clustered && !samePoint && engine.map.getZoom() < 18) {
          engine.map.fitBounds(
            group.members.map((item) => [item.mapPoint.lat, item.mapPoint.lng]),
            {
              padding: [50, 50],
              maxZoom: Math.min(18, engine.map.getZoom() + 2),
              animate: false,
            },
          );
        } else {
          setSelection({
            key: filterKey,
            ids: group.members.map((item) => item.id),
          });
        }
      });
    }
    return () => engine.markerLayer.clearLayers();
  }, [engine, groups, filterKey, drawing]);

  const viewportValid = viewport ? normalizeMapBounds(viewport.bounds) : null;
  const dirty = Boolean(
    viewport && baseline && !sameMapBounds(viewport.bounds, baseline),
  );
  const regionChanged = Boolean(
    viewportValid && !sameMapBounds(viewportValid, region),
  );
  const canOfferSearch = regionSearchEnabled && !drawing && (!region || dirty) && regionChanged;
  const changeRegion = (value: PublicMapBounds | null) => {
    localRegionChange.current = regionKey(value);
    if (viewport) setBaseline(viewport.bounds);
    setSelection(null);
    setDrawing(false);
    setDrawPoints([]);
    onRegionChange(value);
  };
  const known = !pending && !error && data;
  const noResults = known && data.total === 0;
  const noLocation = known && data.total > 0 && data.mappableTotal === 0;

  const summary = pending ? (
    "Đang cập nhật kết quả bản đồ…"
  ) : error ? (
    "Chưa tải được dữ liệu bản đồ"
  ) : data ? (
    <>
      <strong>{data.total.toLocaleString("vi-VN")}</strong> tòa phù hợp ·{" "}
      {data.mappableTotal.toLocaleString("vi-VN")} tòa có vị trí gần đúng
    </>
  ) : (
    "Bản đồ tòa nhà"
  );

  return (
    <Box
      data-testid="search-result-map"
      data-map-count={known ? data.mappableTotal : undefined}
      sx={{ minWidth: 0, height, display: "flex", flexDirection: "column" }}
    >
      {summaryPlacement === "header" && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            gap: 0.75,
            justifyContent: "space-between",
            mb: 1.25,
            flexShrink: 0,
          }}
        >
          <Typography
            role="status"
            sx={{ fontSize: 13, color: "text.secondary" }}
          >
            {summary}
          </Typography>
        </Stack>
      )}
      <Box
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          border: embedded ? 0 : "1px solid",
          borderColor: "divider",
          borderRadius: embedded ? 0 : 3,
          overflow: "hidden",
          isolation: "isolate",
          "& .th-map-icon": { background: "none", border: "none" },
          "& .th-map-price, & .th-map-cluster": {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
            borderRadius: "20px",
            boxShadow: "0 2px 8px #0f172a30",
            fontWeight: 700,
            fontSize: "12px",
            whiteSpace: "nowrap",
            boxSizing: "border-box",
          },
          "& .th-map-price": {
            bgcolor: "background.paper",
            border: "2px solid",
            borderColor: "primary.main",
            color: "primary.main",
          },
          "& .th-map-price--partner": {
            borderColor: "secondary.main",
            color: "secondary.main",
          },
          "& .th-map-cluster": {
            bgcolor: "secondary.main",
            color: "common.white",
            border: "2px solid white",
          },
          "& .leaflet-marker-icon:focus-visible": {
            outline: "3px solid",
            outlineColor: "primary.main",
            outlineOffset: "3px",
          },
          "& .leaflet-control-attribution": { fontSize: 10 },
        }}
      >
        <Box
          ref={containerRef}
          data-testid="search-map-canvas"
          aria-label="Bản đồ vị trí gần đúng của các tòa phù hợp"
          aria-busy={pending}
          sx={{ width: "100%", height: "100%", bgcolor: "#F5F7FA" }}
        />
        {(pending || !engine) && !engineError && (
          <LinearProgress
            aria-label="Đang tải bản đồ"
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 700,
            }}
          />
        )}
        <Stack
          sx={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            zIndex: 600,
            gap: 1,
            alignItems: "flex-start",
            pointerEvents: "none",
          }}
        >
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 0.75, pointerEvents: "auto" }}
          >
            {fitControlEnabled && !drawing && <Button
              size="small"
              variant="contained"
              color="inherit"
              startIcon={<Maximize size={15} />}
              disabled={!engine || !markers.length}
              onClick={() =>
                fit(markers.map((b) => [b.mapPoint.lat, b.mapPoint.lng]))
              }
              sx={{
                minHeight: 36,
                bgcolor: "background.paper",
                color: "text.primary",
              }}
            >
              Xem toàn bộ kết quả
            </Button>}
            {regionSearchEnabled && !drawing && <Button variant="contained" startIcon={<Pencil size={16} />} disabled={!engine || pending || error}
              onClick={() => { setDrawing(true); setDrawPoints([]); setSelection(null); }} sx={{ minHeight: 44 }}>Vẽ vùng tìm</Button>}
            {region && (
              <Chip
                label="Đang lọc theo vùng"
                onDelete={() => changeRegion(null)}
                deleteIcon={<X size={15} />}
                aria-label="Xóa vùng bản đồ"
                sx={{ bgcolor: "background.paper", height: 36, fontSize: 12 }}
              />
            )}
          </Stack>
          {drawing && <Paper role="region" aria-label="Vẽ vùng tìm kiếm" sx={{ p: 1.25, pointerEvents: 'auto', maxWidth: '100%' }}>
            <Typography role="status" sx={{ fontSize: 14, mb: 1 }}>Chạm quanh khu muốn tìm: {drawPoints.length}/32 điểm (tối thiểu 3).</Typography>
            {drawPoints.length >= 3 && !drawnRegion && <Typography role="alert" color="error" sx={{ fontSize: 13, mb: 1 }}>Vùng không hợp lệ. Hãy tránh cạnh cắt nhau và thu nhỏ vùng vẽ.</Typography>}
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" disabled={!drawnRegion || pending || error} onClick={() => drawnRegion && changeRegion(drawnRegion)} sx={{ minHeight: 44 }}>Lọc trong vùng</Button>
              <IconButton aria-label="Hoàn tác điểm vẽ" disabled={!drawPoints.length} onClick={() => setDrawPoints(points => points.slice(0, -1))} sx={{ width: 44, height: 44 }}><Undo2 size={18} /></IconButton>
              <IconButton aria-label="Hủy vẽ vùng" onClick={() => { setDrawing(false); setDrawPoints([]); }} sx={{ width: 44, height: 44 }}><X size={18} /></IconButton>
            </Stack>
          </Paper>}
          {canOfferSearch && (
            <Button
              variant="contained"
              size="small"
              disabled={pending || error || !viewportValid}
              onClick={() => viewportValid && changeRegion(viewportValid)}
              sx={{ pointerEvents: "auto", minHeight: 40 }}
            >
              {region ? "Cập nhật khu vực tìm kiếm" : "Tìm trong khu vực này"}
            </Button>
          )}
          {regionSearchEnabled && viewport && !viewportValid && (
            <Paper sx={{ px: 1.25, py: 0.75 }}>
              <Typography sx={{ fontSize: 12 }}>
                Phóng to bản đồ để tìm trong khu vực này.
              </Typography>
            </Paper>
          )}
          {(error || engineError) && (
            <Paper role="alert" sx={{ p: 1.5, pointerEvents: "auto" }}>
              <Typography sx={{ fontSize: 14 }}>
                {engineError
                  ? "Chưa mở được bản đồ."
                  : "Chưa tải được dữ liệu bản đồ."}
              </Typography>
              <Button
                size="small"
                onClick={() => {
                  if (engineError) {
                    setEngine(null);
                    setEngineAttempt((n) => n + 1);
                  } else onRetry();
                }}
              >
                Thử lại
              </Button>
            </Paper>
          )}
          {(tileError || tileSlow) && !engineError && (
            <Paper role="status" sx={{ p: 1, pointerEvents: "auto" }}>
              <Typography sx={{ fontSize: 12 }}>
                {tileError ? 'Một phần nền bản đồ chưa tải được.' : 'Nền bản đồ đang tải chậm. Bạn vẫn có thể xem danh sách tòa nhà.'}
              </Typography>
              <Button
                size="small"
                onClick={() => {
                  setTileError(false);
                  setTileSlow(false);
                  tileRef.current?.redraw();
                }}
              >
                Tải lại nền bản đồ
              </Button>
            </Paper>
          )}
          {(noResults || noLocation) && (
            <Paper role="status" sx={{ p: 1.5, maxWidth: "100%" }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                {noResults
                  ? region
                    ? "Không có tòa trong vùng hiện tại"
                    : "Không có tòa nhà phù hợp"
                  : "Các tòa phù hợp chưa có vị trí bản đồ"}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {noLocation
                  ? "Bạn vẫn có thể xem các tòa trong danh sách."
                  : "Thử thay đổi khu vực hoặc bỏ bớt bộ lọc."}
              </Typography>
            </Paper>
          )}
          {known && data.truncated && (
            <Paper role="status" sx={{ p: 1 }}>
              <Typography sx={{ fontSize: 12 }}>
                Bản đồ hiện {data.markers.length.toLocaleString("vi-VN")}/
                {data.mappableTotal.toLocaleString("vi-VN")} tòa có vị trí. Hãy
                thu hẹp khu vực hoặc bộ lọc.
              </Typography>
            </Paper>
          )}
          {known && data.missingLocationTotal > 0 && !noLocation && (
            <Paper sx={{ p: 1 }}>
              <Typography sx={{ fontSize: 12 }}>
                {data.missingLocationTotal} tòa chưa có vị trí, vẫn có trong
                danh sách.
              </Typography>
            </Paper>
          )}
        </Stack>
        {selectedMembers.length > 0 && !pending && !error && (
          <Box
            sx={{
              position: "absolute",
              left: 12,
              bottom: 40,
              zIndex: 650,
              width: selectionActions ? 260 : 292,
              maxWidth: "calc(100% - 60px)",
              maxHeight: "75%",
              overflowY: "auto",
              boxShadow: 3,
              borderRadius: 2,
            }}
          >
            {selected ? (
              selectionActions ? <Paper sx={{ p: 1.25, pt: 1.5, position: "relative" }} role="region" aria-label="Thao tác với vị trí gần đúng">
                <IconButton
                  aria-label="Đóng thao tác bản đồ"
                  size="small"
                  onClick={() => setSelection(null)}
                  sx={{ position: "absolute", top: 6, right: 6, width: 30, height: 30 }}
                >
                  <X size={16} />
                </IconButton>
                <Typography sx={{ pr: 4, fontSize: 14, fontWeight: 800 }}>Vị trí gần đúng</Typography>
                <Stack sx={{ gap: .75, mt: 1 }}>
                  <Button component="a" href={selectionActions.googleMapsHref(selected)} target="_blank" rel="noopener noreferrer"
                    variant="contained" size="small" endIcon={<ExternalLink size={15} />}>
                    Mở Google Maps
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={selectionActions.areaSearchDisabled}
                    onClick={() => {
                      selectionActions.onAreaSearch();
                      setSelection(null);
                    }}
                  >
                    {selectionActions.areaSearchLabel || "Xem các phòng cùng khu vực"}
                  </Button>
                </Stack>
              </Paper> : <SearchMapPreview
                building={selected}
                onClose={() => setSelection(null)}
                onBack={
                  selectedMembers.length > 1
                    ? () =>
                        setSelection((current) =>
                          current ? { ...current, chosen: undefined } : null,
                        )
                    : undefined
                }
              />
            ) : (
              <Paper
                sx={{ p: 1.5 }}
                role="region"
                aria-label="Các tòa cùng vị trí gần đúng"
              >
                <Stack
                  direction="row"
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                    {selectedMembers.length} tòa trong khu vực
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label="Đóng nhóm tòa"
                    onClick={() => setSelection(null)}
                  >
                    <X size={16} />
                  </IconButton>
                </Stack>
                {selectedMembers.map((b) => (
                  <Button
                    key={b.id}
                    fullWidth
                    variant="text"
                    onClick={() =>
                      setSelection((current) =>
                        current ? { ...current, chosen: b.id } : null,
                      )
                    }
                    sx={{
                      justifyContent: "space-between",
                      gap: 1,
                      textAlign: "left",
                      borderTop: "1px solid",
                      borderColor: "divider",
                      py: 1,
                    }}
                  >
                    <span>{b.name || b.code}</span>
                    <Typography component="span" sx={{ fontSize: 12 }}>
                      {buildingMapPrice(b, true)}
                    </Typography>
                  </Button>
                ))}
              </Paper>
            )}
          </Box>
        )}
        <Typography
          sx={{
            position: "absolute",
            left: 10,
            bottom: 8,
            zIndex: 500,
            fontSize: 11,
            bgcolor: "background.paper",
            borderRadius: 1,
            px: 1,
            py: 0.5,
            pointerEvents: "none",
          }}
        >
          Vị trí gần đúng · không phải điểm chỉ đường
        </Typography>
        {summaryPlacement === "overlay-bottom-right" && (
          <Typography
            role="status"
            sx={{
              position: "absolute",
              right: 0,
              bottom: 0,
              zIndex: 500,
              px: 1.25,
              py: 0.65,
              borderRadius: 1.5,
              bgcolor: "rgba(255,255,255,.94)",
              boxShadow: "0 2px 10px rgba(15,23,42,.12)",
              fontSize: 12.5,
              color: "text.secondary",
              lineHeight: 1.3,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {summary}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
