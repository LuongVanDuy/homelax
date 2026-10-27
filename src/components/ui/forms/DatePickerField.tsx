import { useMemo, useState } from 'react';
import {
  Box, ButtonBase, IconButton, Popover, Stack, TextField, Typography,
  type TextFieldProps,
} from '@mui/material';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  error?: boolean;
  helperText?: TextFieldProps['helperText'];
  inputRef?: TextFieldProps['inputRef'];
  onBlur?: TextFieldProps['onBlur'];
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function parseDate(value: string) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayValue(value: string) {
  const date = parseDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function monthGrid(viewMonth: Date) {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  id, name, required, error, helperText, inputRef, onBlur,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const selected = parseDate(value);
    return selected
      ? new Date(selected.getFullYear(), selected.getMonth(), 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  const selected = parseDate(value);
  const min = parseDate(minDate || '');
  const max = parseDate(maxDate || '');
  const days = useMemo(() => monthGrid(viewMonth), [viewMonth]);
  const today = new Date();

  const openPicker = (target: HTMLElement) => {
    if (disabled) return;
    const next = parseDate(value) || new Date();
    setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setAnchorEl(target);
  };

  const choose = (date: Date) => {
    onChange(formatValue(date));
    setAnchorEl(null);
  };

  const isDisabled = (date: Date) => {
    const valueTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
    if (min) {
      const minTime = new Date(min.getFullYear(), min.getMonth(), min.getDate()).getTime();
      if (valueTime < minTime) return true;
    }
    if (max) {
      const maxTime = new Date(max.getFullYear(), max.getMonth(), max.getDate()).getTime();
      if (valueTime > maxTime) return true;
    }
    return false;
  };

  return <>
    <TextField
      id={id}
      name={name}
      required={required}
      error={error}
      helperText={helperText}
      inputRef={inputRef}
      onBlur={onBlur}
      label={label}
      value={displayValue(value)}
      placeholder="dd/mm/yyyy"
      disabled={disabled}
      onClick={(event) => openPicker(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement && ['Enter', ' ', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          openPicker(event.currentTarget);
        }
      }}
      slotProps={{
        htmlInput: {
          readOnly: true,
          inputMode: 'none',
          style: { cursor: disabled ? 'default' : 'pointer' },
        },
        input: {
          endAdornment: <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', mr: -0.5 }}>
            {value && !disabled && <IconButton
              size="small"
              aria-label={`Xóa ${label.toLowerCase()}`}
              onClick={(event) => {
                event.stopPropagation();
                onChange('');
              }}
            >
              <X size={15} />
            </IconButton>}
            <IconButton
              size="small"
              aria-label={`Chọn ${label.toLowerCase()}`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                openPicker(event.currentTarget);
              }}
            >
              <CalendarDays size={18} />
            </IconButton>
          </Stack>,
        },
      }}
      sx={{
        '& .MuiInputBase-root': { height: 44 },
        '& .MuiInputBase-input': { cursor: disabled ? 'default' : 'pointer' },
      }}
    />

    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={() => setAnchorEl(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            mt: 0.75,
            p: 1.5,
            width: 304,
            borderRadius: 2.5,
            boxShadow: 6,
          },
        },
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <IconButton
          size="small"
          aria-label="Tháng trước"
          onClick={() => setViewMonth((current) =>
            new Date(current.getFullYear(), current.getMonth() - 1, 1))}
        >
          <ChevronLeft size={18} />
        </IconButton>
        <Typography variant="body2" sx={{ fontWeight: 800, textTransform: 'capitalize' }}>
          {new Intl.DateTimeFormat('vi-VN', {
            month: 'long',
            year: 'numeric',
          }).format(viewMonth)}
        </Typography>
        <IconButton
          size="small"
          aria-label="Tháng sau"
          onClick={() => setViewMonth((current) =>
            new Date(current.getFullYear(), current.getMonth() + 1, 1))}
        >
          <ChevronRight size={18} />
        </IconButton>
      </Stack>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 0.25,
        mb: 0.5,
      }}>
        {WEEKDAYS.map((weekday) => <Typography
          key={weekday}
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: 'center', fontWeight: 700, py: 0.5 }}
        >
          {weekday}
        </Typography>)}
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 0.25,
      }}>
        {days.map((date) => {
          const activeMonth = date.getMonth() === viewMonth.getMonth();
          const active = Boolean(selected && sameDay(date, selected));
          const isToday = sameDay(date, today);
          const blocked = isDisabled(date);

          return <ButtonBase
            key={formatValue(date)}
            disabled={blocked}
            onClick={() => choose(date)}
            aria-label={new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(date)}
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              mx: 'auto',
              fontSize: '0.82rem',
              fontWeight: active || isToday ? 800 : 500,
              color: active
                ? 'primary.contrastText'
                : activeMonth
                  ? 'text.primary'
                  : 'text.disabled',
              bgcolor: active ? 'primary.main' : 'transparent',
              border: isToday && !active ? 1 : 0,
              borderColor: 'primary.main',
              '&:hover': {
                bgcolor: active ? 'primary.main' : 'action.hover',
              },
              '&.Mui-disabled': {
                color: 'action.disabled',
              },
            }}
          >
            {date.getDate()}
          </ButtonBase>;
        })}
      </Box>

      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1.25, pt: 1, borderTop: 1, borderColor: 'divider' }}>
        <ButtonBase
          onClick={() => choose(new Date())}
          disabled={isDisabled(new Date())}
          sx={{ px: 1, py: 0.75, borderRadius: 1.5, fontSize: '0.8rem', fontWeight: 700, color: 'primary.main' }}
        >
          Hôm nay
        </ButtonBase>
        {value && <ButtonBase
          onClick={() => {
            onChange('');
            setAnchorEl(null);
          }}
          sx={{ px: 1, py: 0.75, borderRadius: 1.5, fontSize: '0.8rem', color: 'text.secondary' }}
        >
          Xóa ngày
        </ButtonBase>}
      </Stack>
    </Popover>
  </>;
}
