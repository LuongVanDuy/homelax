import { useLocation, useNavigate } from 'react-router';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useForm, z, zodResolver } from '../../../app/forms';
import { BOOKING_MIN_LEAD_MINUTES, PUBLIC_LISTING_WITHDRAWN_TEXT, bookingRoomUnitEligibility,
  createBookingRequestSchema, normalizeBookingTime24h, type BookingPublicReceipt, type RoomType } from '@tinyhouse/contracts';
import type { AppIdentity } from '../../auth/identityStore';
import { useBuildingQuery } from '../../buildings/api';
import { useRoomQuery, useRoomsByBuildingQuery } from '../api';
import { useCreateBookingMutation } from '../../bookings/api';
import { getValidImageUrl } from '../../../utils/roomHierarchy';
import { resolveRoomUnit, roomSelectionHref } from '../roomSelection';

export function formatRoomDate(value?: string | null) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}
const ALL_TIME_SLOTS = [
  { value: '08:00 AM', label: '08:00 AM' },
  { value: '08:30 AM', label: '08:30 AM' },
  { value: '09:00 AM', label: '09:00 AM' },
  { value: '09:30 AM', label: '09:30 AM' },
  { value: '10:00 AM', label: '10:00 AM' },
  { value: '10:30 AM', label: '10:30 AM' },
  { value: '11:00 AM', label: '11:00 AM' },
  { value: '11:30 AM', label: '11:30 AM' },
  { value: '12:00 PM', label: '12:00 PM' },
  { value: '12:30 PM', label: '12:30 PM' },
  { value: '01:00 PM', label: '01:00 PM' },
  { value: '01:30 PM', label: '01:30 PM' },
  { value: '02:00 PM', label: '02:00 PM' },
  { value: '02:30 PM', label: '02:30 PM' },
  { value: '03:00 PM', label: '03:00 PM' },
  { value: '03:30 PM', label: '03:30 PM' },
  { value: '04:00 PM', label: '04:00 PM' },
  { value: '04:30 PM', label: '04:30 PM' },
  { value: '05:00 PM', label: '05:00 PM' },
  { value: '05:30 PM', label: '05:30 PM' },
  { value: '06:00 PM', label: '06:00 PM' },
  { value: '06:30 PM', label: '06:30 PM' },
  { value: '07:00 PM', label: '07:00 PM' },
  { value: '07:30 PM', label: '07:30 PM' },
  { value: '08:00 PM', label: '08:00 PM' },
  { value: '08:30 PM', label: '08:30 PM' },
  { value: '09:00 PM', label: '09:00 PM' },
  { value: '09:30 PM', label: '09:30 PM' },
  { value: '10:00 PM', label: '10:00 PM' }
];

const bookingFormSchema = createBookingRequestSchema.pick({
  customerName: true,
  phone: true,
  appointmentDate: true,
  appointmentTime: true,
}).extend({
  phone: z.string()
    .trim()
    .regex(/^\d{10,11}$/, 'Số điện thoại phải gồm 10 đến 11 chữ số.'),
});

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayDateString = () => getLocalDateString();

const parseTimeToMinutes = (timeStr: string) => {
  const normalized = normalizeBookingTime24h(timeStr);
  if (!normalized) return 0;
  const [hour, minute] = normalized.split(':').map(Number);
  return hour * 60 + minute;
};

const getAppointmentTimezoneOffsetMinutes = (date: string, time: string) => {
  const normalized = normalizeBookingTime24h(time);
  if (!date || !normalized) return new Date().getTimezoneOffset();
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = normalized.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTimezoneOffset();
};

const hasBookableSlotToday = () => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return ALL_TIME_SLOTS.some(
    (slot) => parseTimeToMinutes(slot.value) >= currentMinutes + BOOKING_MIN_LEAD_MINUTES,
  );
};


type BookingFormValues = z.infer<typeof bookingFormSchema>;

export function usePublicRoomDetail(roomId: string, currentUser: AppIdentity) {
  const { data: room = null, isLoading: roomLoading, isFetching: roomFetching, error: roomError } = useRoomQuery(roomId);
  const buildingLookupId = room?.buildingId || room?.buildingCode || '';
  const { data: building = null, isLoading: buildingLoading, error: buildingError } = useBuildingQuery(buildingLookupId);
  const roomBuildingId = building?.id || building?.code || buildingLookupId;
  const { data: queriedBuildingRooms = [], isLoading: buildingRoomsLoading } =
    useRoomsByBuildingQuery(roomBuildingId);
  const buildingRooms =
    queriedBuildingRooms.length > 0 ? queriedBuildingRooms : (room ? [room] : []);
  const location = useLocation();
  const navigate = useNavigate();
  const affiliateToken = new URLSearchParams(location.search).get('ref')?.trim() || undefined;
  const loading =
    roomLoading ||
    (Boolean(room) && buildingLoading) ||
    (Boolean(roomBuildingId) && buildingRoomsLoading);
  const createBookingMutation = useCreateBookingMutation();

  const bookingFormRef = useRef<HTMLDivElement>(null);

  const [bookingReceipt, setBookingReceipt] = useState<BookingPublicReceipt | null>(null);

  const scrollToBooking = () => {
    if (bookingFormRef.current) {
      bookingFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Handle switching room types
  const handleSelectRoomType = (rt: RoomType) => {
    if (rt.id === room?.id) return;
    const firstUnit = Array.isArray(rt.roomUnits)
      ? rt.roomUnits.find((unit) => unit && unit.status !== 'archived')
      : null;
    navigate(roomSelectionHref(rt.id, firstUnit?.id, location.search, location.hash), { preventScrollReset: true });
  };

  // Direct list of room types in building
  const availableRoomTypes = room && !buildingRooms.some(rt => rt.id === room.id)
    ? [room, ...buildingRooms] : buildingRooms;

  // FE05.4: route + public detail own the selection, including reload/back/forward.
  const activeRoomType = room;
  const listingWithdrawn = building?.listingState === 'withdrawn'
    || Boolean(activeRoomType && 'listingState' in activeRoomType && activeRoomType.listingState === 'withdrawn');
  const acceptsBookings = building?.acceptsBookings === true
    && Boolean(activeRoomType && 'acceptsBookings' in activeRoomType && activeRoomType.acceptsBookings === true);

  // A01: Booking must point to one canonical Room Unit.
  const specificRoomUnits = Array.isArray(activeRoomType?.roomUnits)
    ? activeRoomType.roomUnits.filter((unit) => unit && unit.status !== 'archived')
    : [];
  const resolvedRoomUnit = resolveRoomUnit(specificRoomUnits, location.search);
  const selectedRoomHref = activeRoomType
    ? roomSelectionHref(activeRoomType.id, resolvedRoomUnit?.id, location.search, location.hash)
    : '';
  useEffect(() => {
    if (loading || roomFetching || roomError || buildingError || !building || !selectedRoomHref) return;
    if (`${location.pathname}${location.search}${location.hash}` !== selectedRoomHref) {
      navigate(selectedRoomHref, { replace: true, preventScrollReset: true });
    }
  }, [loading, roomFetching, roomError, buildingError, building, selectedRoomHref, location.pathname, location.search, location.hash, navigate]);
  const resolvedRoomNumber = String(resolvedRoomUnit?.code || '').trim();
  const resolvedRoomAvailableDate = formatRoomDate(resolvedRoomUnit?.availableFrom);

  // FE05.3: RHF/Zod owns public form state; Unit/ref/timezone are derived.
  const [initialAppointmentDate] = useState(() => {
    if (hasBookableSlotToday()) return getTodayDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getLocalDateString(tomorrow);
  });
  const [initialAppointmentTime] = useState(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return ALL_TIME_SLOTS.find((slot) =>
      parseTimeToMinutes(slot.value) >= currentMinutes + BOOKING_MIN_LEAD_MINUTES
    )?.value || ALL_TIME_SLOTS[0].value;
  });
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    mode: 'onTouched',
    defaultValues: {
      customerName: String(currentUser?.name || ''),
      phone: String(currentUser?.phone || '').replace(/\D/g, '').slice(0, 11),
      appointmentDate: initialAppointmentDate,
      appointmentTime: initialAppointmentTime,
    },
  });
  const appointmentDate = watch('appointmentDate');
  const appointmentTime = watch('appointmentTime');
  const todayDateStr = getLocalDateString(new Date(clock));

  const bookingDateMin = useMemo(() => {
    if (resolvedRoomUnit?.status === 'maintenance' && resolvedRoomUnit.availableFrom) {
      return resolvedRoomUnit.availableFrom > todayDateStr
        ? resolvedRoomUnit.availableFrom
        : todayDateStr;
    }
    if (resolvedRoomUnit?.status === 'occupied') {
      const tomorrow = new Date(`${todayDateStr}T00:00:00`);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return getLocalDateString(tomorrow);
    }
    return todayDateStr;
  }, [resolvedRoomUnit?.status, resolvedRoomUnit?.availableFrom, todayDateStr]);

  useEffect(() => {
    if (appointmentDate < bookingDateMin) {
      setValue('appointmentDate', bookingDateMin, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [appointmentDate, bookingDateMin, setValue]);

  const unitCanSchedule = Boolean(
    resolvedRoomUnit
    && (
      resolvedRoomUnit.status !== 'maintenance'
      || resolvedRoomUnit.availableFrom
    ),
  );

  const availableTimeSlots = useMemo(() => {
    if (!resolvedRoomUnit || !appointmentDate) return [];
    const nowMs = clock;
    return ALL_TIME_SLOTS.filter((slot) => bookingRoomUnitEligibility({
      status: resolvedRoomUnit.status,
      availableFrom: resolvedRoomUnit.availableFrom,
      appointmentDate,
      appointmentTime: slot.value,
      appointmentTimezoneOffsetMinutes: getAppointmentTimezoneOffsetMinutes(
        appointmentDate,
        slot.value,
      ),
      nowMs,
    }).allowed);
  }, [
    appointmentDate,
    resolvedRoomUnit,
    clock,
  ]);

  const resolvedAppointmentTime =
    availableTimeSlots.some(slot => slot.value === appointmentTime)
      ? appointmentTime
      : (availableTimeSlots[0]?.value || '');

  useEffect(() => {
    if (resolvedAppointmentTime !== appointmentTime) {
      setValue('appointmentTime', resolvedAppointmentTime, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [appointmentTime, resolvedAppointmentTime, setValue]);

  // FE05.1: gallery and amenities come only from strict public projections.
  const galleryImages = Array.from(new Set([
    activeRoomType?.coverImage,
    ...(Array.isArray(activeRoomType?.images) ? activeRoomType.images : []),
  ].map(img => getValidImageUrl(img)).filter(Boolean)));

  const roomAmenities = Array.from(new Set(
    (Array.isArray(activeRoomType?.amenities) ? activeRoomType.amenities : [])
      .map(item => String(item || '').trim())
      .filter(item => item && !item.startsWith('__')),
  ));

  const buildingAmenities = Array.from(new Set(
    (Array.isArray(building?.amenitiesBuilding) ? building.amenitiesBuilding : [])
      .map(item => String(item || '').trim())
      .filter(item => item && !item.startsWith('__')),
  ));

  const isBookingLoading = createBookingMutation.isPending;

  const handleBookingSubmit = async (values: BookingFormValues) => {
    if (!acceptsBookings) {
      setError('root.server', {
        message: listingWithdrawn
          ? PUBLIC_LISTING_WITHDRAWN_TEXT
          : 'Hiện chưa thể đặt lịch cho phòng này.',
      });
      return;
    }
    if (!resolvedRoomUnit?.id) {
      setError('root.server', { message: 'Vui lòng chọn một căn cụ thể để đặt lịch xem.' });
      return;
    }

    const appointmentTimezoneOffsetMinutes = getAppointmentTimezoneOffsetMinutes(
      values.appointmentDate,
      values.appointmentTime,
    );
    const eligibility = bookingRoomUnitEligibility({
      status: resolvedRoomUnit.status,
      availableFrom: resolvedRoomUnit.availableFrom,
      appointmentDate: values.appointmentDate,
      appointmentTime: values.appointmentTime,
      appointmentTimezoneOffsetMinutes,
    });
    if (!eligibility.allowed) {
      setError('root.server', { message: eligibility.message });
      return;
    }

    clearErrors('root.server');
    try {
      const receipt = await createBookingMutation.mutateAsync({
        customerName: values.customerName.trim(),
        phone: values.phone.replace(/\D/g, ''),
        email: '',
        notes: '',
        roomUnitId: resolvedRoomUnit.id,
        appointmentDate: values.appointmentDate,
        appointmentTime: values.appointmentTime,
        appointmentTimezoneOffsetMinutes,
        ...(affiliateToken ? { affiliateToken } : {}),
      });
      setBookingReceipt(receipt);
    } catch (err) {
      setError('root.server', {
        message: err instanceof Error ? err.message : 'Không thể gửi lịch hẹn. Vui lòng thử lại.',
      });
    }
  };


  const resetReceipt = () => { clearErrors(); setBookingReceipt(null); };
  return { room, building, loading, roomError, buildingError, location, navigate,
    availableRoomTypes, activeRoomType, listingWithdrawn, acceptsBookings, specificRoomUnits,
    resolvedRoomUnit, selectedRoomHref, resolvedRoomNumber, resolvedRoomAvailableDate,
    handleSelectRoomType, galleryImages, roomAmenities, buildingAmenities, bookingFormRef,
    control, handleSubmit, handleBookingSubmit, errors, isSubmitting, isBookingLoading,
    unitCanSchedule, bookingDateMin, availableTimeSlots, resolvedAppointmentTime,
    bookingReceipt, resetReceipt, scrollToBooking };
}
