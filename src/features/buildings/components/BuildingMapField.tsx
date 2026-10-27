import { HANOI_CITY } from '../../locations/hanoiWards';
import { searchAddresses } from '../../locations/addressSearch';
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { LocateFixed, MapPin, RotateCcw } from 'lucide-react';
import L from 'leaflet';
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const DEFAULT_CENTER: [number, number] = [21.0285, 105.8542];

type Props = {
  address: string;
  ward: string;
  latitude: string;
  longitude: string;
  disabled?: boolean;
  onCoordinateChange: (latitude: string, longitude: string) => void;
};

async function geocode(query: string) {
  try {
    const data = await searchAddresses(query);
    const first = data.items[0];
    return first ? [first.lat, first.lng] as const : null;
  } catch {
    return null;
  }
}

export function BuildingMapField({
  address,
  ward,
  latitude,
  longitude,
  disabled,
  onCoordinateChange,
}: Props) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const map = useRef<ReturnType<typeof L.map> | null>(null);
  const marker = useRef<ReturnType<typeof L.marker> | null>(null);
  const onCoordinateChangeRef = useRef(onCoordinateChange);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");

  const lat = latitude === "" ? null : Number(latitude);
  const lng = longitude === "" ? null : Number(longitude);
  const hasCoordinates =
    lat !== null &&
    lng !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  useEffect(() => {
    onCoordinateChangeRef.current = onCoordinateChange;
  }, [onCoordinateChange]);

  useEffect(() => {
    if (!mapNode.current || map.current) return;
    const instance = L.map(mapNode.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(instance);
    instance.on("click", (event: { latlng: { lat: number; lng: number } }) => {
      const nextLat = Number(event.latlng.lat.toFixed(6));
      const nextLng = Number(event.latlng.lng.toFixed(6));
      onCoordinateChangeRef.current(String(nextLat), String(nextLng));
    });
    map.current = instance;
    window.setTimeout(() => instance.invalidateSize(), 0);
    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    if (!hasCoordinates) {
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([lat!, lng!], { draggable: !disabled }).addTo(
        map.current,
      );
      marker.current.on("dragend", () => {
        const next = marker.current?.getLatLng();
        if (next)
          onCoordinateChangeRef.current(
            String(Number(next.lat.toFixed(6))),
            String(Number(next.lng.toFixed(6))),
          );
      });
    } else {
      marker.current.setLatLng([lat!, lng!]);
    }
    map.current.setView([lat!, lng!], Math.max(map.current.getZoom(), 15));
  }, [hasCoordinates, lat, lng, disabled]);

  const locate = async () => {
    if (!address.trim()) {
      setMessage("Nhập địa chỉ cụ thể trước khi định vị.");
      return;
    }
    setLocating(true);
    setMessage("");
    const query = [address, ward, HANOI_CITY, "Việt Nam"]
      .filter(Boolean)
      .join(", ");
    const result = await geocode(query);
    setLocating(false);
    if (!result) {
      setMessage(
        "Không xác định được vị trí. Hãy click trực tiếp trên bản đồ hoặc nhập tọa độ.",
      );
      return;
    }
    onCoordinateChange(
      String(Number(result[0].toFixed(6))),
      String(Number(result[1].toFixed(6))),
    );
    setMessage("Đã định vị theo địa chỉ.");
  };

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          startIcon={<LocateFixed size={17} />}
          onClick={() => void locate()}
          disabled={disabled || locating}
        >
          {locating ? "Đang định vị…" : "Định vị theo địa chỉ"}
        </Button>
        <Button
          color="inherit"
          startIcon={<RotateCcw size={17} />}
          onClick={() => onCoordinateChange("", "")}
          disabled={disabled || !hasCoordinates}
        >
          Xóa tọa độ
        </Button>
      </Stack>
      {message && (
        <Alert severity={message.startsWith("Đã") ? "success" : "warning"}>
          {message}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 2 }}>
        <Box
          ref={mapNode}
          sx={{ height: { xs: 210, sm: 230, xl: 240 }, width: "100%" }}
        />
      </Paper>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label="Vĩ độ"
          value={latitude}
          disabled={disabled}
          fullWidth
          onChange={(event) =>
            onCoordinateChange(event.target.value, longitude)
          }
          placeholder="21.028500"
          slotProps={{ input: { startAdornment: <MapPin size={16} /> } }}
        />
        <TextField
          size="small"
          label="Kinh độ"
          value={longitude}
          disabled={disabled}
          fullWidth
          onChange={(event) => onCoordinateChange(latitude, event.target.value)}
          placeholder="105.854200"
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {hasCoordinates
          ? `Đang lưu: ${lat!.toFixed(6)}, ${lng!.toFixed(6)}`
          : "Chưa có tọa độ. Click bản đồ hoặc định vị từ địa chỉ."}
      </Typography>
    </Stack>
  );
}
