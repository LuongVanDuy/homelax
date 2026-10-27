import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Box, Button, InputAdornment, Popover, Slider, SvgIcon, TextField, Typography } from '@mui/material';

const MAX = 50_000_000;
const format = (price: number) => `${price.toLocaleString('vi-VN')} đ`;

export function PublicPriceFilter({ minPrice, maxPrice, onChange }: {
  minPrice: number; maxPrice: number; onChange: (range: { minPrice: number; maxPrice: number }) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  // Only the in-progress gesture is local; the committed filter stays in the URL.
  const [draft, setDraft] = useState<{ minPrice: number; maxPrice: number; values: number[] } | null>(null);
  const range = draft?.minPrice === minPrice && draft.maxPrice === maxPrice ? draft.values : [minPrice, maxPrice];
  const id = useId();
  const open = () => {
    setDraft(null);
    setAnchor(fieldRef.current);
  };
  const summary = minPrice === 0 && maxPrice === MAX ? 'Tất cả mức giá'
    : `${(minPrice / 1_000_000).toLocaleString('vi-VN')} – ${(maxPrice / 1_000_000).toLocaleString('vi-VN')} triệu`;
  return <>
    <TextField ref={fieldRef} label="Khoảng giá" value={summary} variant="outlined" size="small" fullWidth
      focused={anchor ? true : undefined} onClick={open}
      slotProps={{
        inputLabel: { shrink: true },
        input: { readOnly: true, endAdornment: <InputAdornment position="end">
          <SvgIcon sx={{ color: 'action.active', pointerEvents: 'none' }}><path d="M7 10l5 5 5-5z" /></SvgIcon>
        </InputAdornment> },
        htmlInput: { role: 'button', 'aria-label': `Khoảng giá: ${summary}`, 'aria-haspopup': 'dialog',
          'aria-expanded': Boolean(anchor), 'aria-controls': anchor ? id : undefined,
          onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
            if (['Enter', ' ', 'ArrowDown'].includes(event.key)) { event.preventDefault(); open(); }
          },
        },
      }}
      sx={{ minWidth: 0, '& .MuiOutlinedInput-root': { height: 44, cursor: 'pointer',
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' } },
        '& .MuiInputBase-input': { cursor: 'pointer', fontSize: 14, textOverflow: 'ellipsis' },
        '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
      }} />
    <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { role: 'dialog', id, 'aria-labelledby': `${id}-title`, sx: { mt: 1, p: 2, width: 360, maxWidth: 'calc(100vw - 32px)' } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography id={`${id}-title`} component="h2" sx={{ fontSize: 14, fontWeight: 700 }}>Khoảng giá thuê / tháng</Typography>
        <Button type="button" size="small" onClick={() => {
          setDraft(null);
          onChange({ minPrice: 0, maxPrice: MAX });
        }}>Xóa lọc</Button>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, gap: 1, fontSize: 14 }}>
        <span>{format(range[0])}</span><span>{format(range[1])}</span>
      </Box>
      <Box sx={{ px: 1.5 }}>
        <Slider value={range} min={0} max={MAX} step={500_000} disableSwap
          getAriaLabel={index => index === 0 ? 'Giá thấp nhất' : 'Giá cao nhất'} getAriaValueText={format}
          onChange={(_, value) => {
            if (Array.isArray(value)) setDraft({ minPrice, maxPrice, values: value });
          }}
          onChangeCommitted={(_, value) => {
            if (Array.isArray(value) && (value[0] !== minPrice || value[1] !== maxPrice)) {
              onChange({ minPrice: value[0], maxPrice: value[1] });
            }
          }} />
      </Box>
    </Popover>
  </>;
}
