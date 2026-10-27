import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  BOOKING_REMINDER_TEXT,
  BOOKING_SUCCESS_TEXT,
  PUBLIC_LISTING_WITHDRAWN_TEXT,
} from "@tinyhouse/contracts";
import { Controller } from "../../../app/forms";
import { DatePickerField } from "../../../components/ui/forms/DatePickerField";
import {
  formatRoomDate,
  type usePublicRoomDetail,
} from "../hooks/usePublicRoomDetail";
import { formatMoney } from "../roomPresentation";

export function PublicRoomBookingForm({
  detail,
}: {
  detail: ReturnType<typeof usePublicRoomDetail>;
}) {
  const {
    acceptsBookings,
    listingWithdrawn,
    bookingReceipt,
    resetReceipt,
    control,
    errors,
    handleSubmit,
    handleBookingSubmit,
    isSubmitting,
    isBookingLoading,
    unitCanSchedule,
    resolvedRoomUnit,
    resolvedRoomNumber,
    resolvedRoomAvailableDate,
    bookingDateMin,
    availableTimeSlots,
    resolvedAppointmentTime,
    building,
    activeRoomType,
  } = detail;
  const busy = isSubmitting || isBookingLoading;
  const buildingName = building?.name?.trim() || "";
  const buildingCode = building?.code?.trim() || "";
  const address = building?.address?.trim() || "";
  const ward = building?.ward?.trim() || "";
  const publicAddress =
    [
      address,
      ward &&
      !address.toLocaleLowerCase("vi").includes(ward.toLocaleLowerCase("vi"))
        ? ward
        : "",
    ]
      .filter(Boolean)
      .join(", ") || "Địa chỉ đang cập nhật";
  const selection = [
    [
      "Tòa nhà",
      buildingName &&
      buildingName.toLocaleLowerCase("vi") !==
        buildingCode.toLocaleLowerCase("vi")
        ? `${buildingName}${buildingCode ? ` (${buildingCode})` : ""}`
        : buildingCode
          ? `Tòa ${buildingCode}`
          : "Đang cập nhật",
    ],
    ["Địa chỉ", publicAddress],
    [
      "Loại phòng",
      activeRoomType?.type ||
        activeRoomType?.roomTypeCatalogName ||
        "Đang cập nhật",
    ],
    [
      "Căn đã chọn",
      resolvedRoomNumber
        ? `Căn ${resolvedRoomNumber}`
        : "Chưa có căn để lựa chọn",
    ],
  ];

  return (
    <>
      <Typography component="h2" sx={{ fontSize: 22, fontWeight: 800, mb: 1 }}>
        Đặt lịch xem phòng
      </Typography>
      {!bookingReceipt && (
        <Box
          sx={{
            mt: 1.5,
            mb: 2.5,
            p: 1.75,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.default",
          }}
        >
          <Box
            component="dl"
            sx={{
              m: 0,
              display: "grid",
              gridTemplateColumns: "82px minmax(0, 1fr)",
              columnGap: 1,
              rowGap: 1,
            }}
          >
            {selection.map(([label, value]) => (
              <Box key={label} sx={{ display: "contents" }}>
                <Typography
                  component="dt"
                  sx={{ fontSize: 13, color: "text.secondary" }}
                >
                  {label}
                </Typography>
                <Typography
                  component="dd"
                  sx={{
                    m: 0,
                    fontSize: 13,
                    fontWeight: label === "Địa chỉ" ? 400 : 700,
                    overflowWrap: "anywhere",
                  }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box
            sx={{
              mt: 1.5,
              pt: 1.5,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              Giá thuê / tháng
            </Typography>
            <Typography
              sx={{
                mt: 0.25,
                fontSize: 22,
                fontWeight: 800,
                color: "primary.main",
                overflowWrap: "anywhere",
              }}
            >
              {activeRoomType && activeRoomType.price > 0
                ? formatMoney(activeRoomType.price)
                : "Giá đang cập nhật"}
            </Typography>
          </Box>
        </Box>
      )}
      {!acceptsBookings ? (
        <Alert severity="warning">
          {listingWithdrawn
            ? PUBLIC_LISTING_WITHDRAWN_TEXT
            : "Hiện chưa thể đặt lịch cho phòng này."}
        </Alert>
      ) : bookingReceipt ? (
        <Stack spacing={2} role="status">
          <Alert severity="success">{BOOKING_SUCCESS_TEXT}</Alert>
          <Box
            sx={{ overflowWrap: "anywhere", "& p": { mb: 0.75, fontSize: 14 } }}
          >
            <Typography>
              <strong>Mã lịch:</strong> {bookingReceipt.id}
            </Typography>
            <Typography>
              <strong>Căn:</strong> {bookingReceipt.roomUnitCode}
            </Typography>
            <Typography>
              <strong>Thời gian:</strong>{" "}
              {formatRoomDate(bookingReceipt.appointmentDate)} ·{" "}
              {bookingReceipt.appointmentTime}
            </Typography>
            <Typography>
              <strong>Trạng thái:</strong> {bookingReceipt.status}
            </Typography>
          </Box>
          <Button variant="outlined" onClick={resetReceipt}>
            Đặt thêm lịch hẹn khác
          </Button>
        </Stack>
      ) : (
        <Box
          component="form"
          onSubmit={handleSubmit(handleBookingSubmit)}
          noValidate
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            "& .MuiInputBase-root": { minHeight: 44, fontSize: 16 },
          }}
        >
          {errors.root?.server?.message && (
            <Alert severity="error">{errors.root.server.message}</Alert>
          )}
          <Controller
            name="customerName"
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <TextField
                {...field}
                inputRef={ref}
                id="booking-customer-name"
                label="Họ và tên"
                required
                fullWidth
                size="small"
                autoComplete="name"
                disabled={busy}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="phone"
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <TextField
                {...field}
                inputRef={ref}
                id="booking-phone"
                label="Số điện thoại"
                type="tel"
                required
                fullWidth
                size="small"
                autoComplete="tel"
                disabled={busy}
                slotProps={{
                  htmlInput: { inputMode: "numeric", maxLength: 11 },
                }}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="appointmentDate"
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <DatePickerField
                {...field}
                inputRef={ref}
                id="booking-date"
                label="Ngày hẹn"
                required
                disabled={busy || !unitCanSchedule}
                minDate={bookingDateMin}
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="appointmentTime"
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <TextField
                {...field}
                value={resolvedAppointmentTime}
                inputRef={ref}
                id="booking-time"
                label="Giờ hẹn"
                select
                required
                fullWidth
                size="small"
                disabled={
                  busy || !unitCanSchedule || availableTimeSlots.length === 0
                }
                error={Boolean(fieldState.error)}
                helperText={
                  fieldState.error?.message ||
                  (!availableTimeSlots.length
                    ? "Không còn khung giờ hợp lệ. Vui lòng chọn ngày khác."
                    : undefined)
                }
              >
                {availableTimeSlots.map((slot) => (
                  <MenuItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Typography
            sx={{
              fontSize: 13,
              color: unitCanSchedule ? "text.secondary" : "warning.main",
            }}
          >
            {resolvedRoomUnit?.status === "occupied"
              ? "Căn đang có người thuê: vui lòng đặt lịch trước ít nhất 24 giờ để Homelax phối hợp với khách đang ở."
              : resolvedRoomUnit?.status === "maintenance"
                ? resolvedRoomAvailableDate
                  ? `Căn đang bảo trì: có thể đặt lịch từ ngày ${resolvedRoomAvailableDate} trở đi.`
                  : "Căn đang bảo trì và chưa có ngày dự kiến hoàn tất, hiện chưa thể đặt lịch xem."
                : BOOKING_REMINDER_TEXT}
          </Typography>
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={busy || !resolvedAppointmentTime || !unitCanSchedule}
          >
            {busy ? "Đang gửi lịch hẹn…" : "Đặt lịch xem phòng"}
          </Button>
        </Box>
      )}
    </>
  );
}
