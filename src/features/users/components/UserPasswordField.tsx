import { useState } from 'react';
import { Box, Button, IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import { Copy, Eye, EyeOff, WandSparkles } from 'lucide-react';
import type { ControllerRenderProps } from 'react-hook-form';
import { toast } from '../../../lib/toast';

type Props = {
  field: Pick<ControllerRenderProps, 'value' | 'onChange' | 'onBlur' | 'name' | 'ref'>;
  error?: string;
  disabled?: boolean;
  onGenerate: (password: string) => void;
};

export function UserPasswordField({ field, error, disabled, onGenerate }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', columnGap: 1, alignItems: 'start' }}>
      <TextField
        {...field} inputRef={field.ref} ref={undefined} label="Mật khẩu mới" required
        type={visible ? 'text' : 'password'} autoComplete="new-password" disabled={disabled}
        fullWidth={false} sx={{ width: '100%', minWidth: 0 }}
        error={Boolean(error)} helperText={error || 'Tối thiểu 8 ký tự.'}
        slotProps={{ input: { endAdornment: <InputAdornment position="end">
          <IconButton aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible}
            onClick={() => setVisible(!visible)} disabled={disabled} edge="end" sx={{ width: 44, height: 44 }}>
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </IconButton>
        </InputAdornment> } }}
      />
      <Tooltip title="Tạo mật khẩu">
        <Box component="span" sx={{ height: 44, display: 'inline-flex', alignItems: 'center' }}>
        <Button type="button" size="small" color="inherit" variant="outlined" fullWidth={false} aria-label="Tạo mật khẩu" disabled={disabled}
          sx={{ width: { xs: 44, sm: 'auto' }, minWidth: 44, height: 44, px: { xs: 0, sm: 1.5 }, gap: 0.75, whiteSpace: 'nowrap' }} onClick={() => {
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
          const password = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => alphabet[byte & 63]).join('');
          onGenerate(password);
        }}><WandSparkles size={16} /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Tạo mật khẩu</Box></Button>
        </Box>
      </Tooltip>
      <Tooltip title="Sao chép">
        <Box component="span" sx={{ height: 44, display: 'inline-flex', alignItems: 'center' }}>
        <Button type="button" size="small" color="inherit" variant="outlined" fullWidth={false} aria-label="Sao chép mật khẩu" disabled={disabled || !field.value}
          sx={{ width: { xs: 44, sm: 'auto' }, minWidth: 44, height: 44, px: { xs: 0, sm: 1.5 }, gap: 0.75, whiteSpace: 'nowrap' }} onClick={async () => {
          try {
            await navigator.clipboard.writeText(String(field.value));
            toast.success('Đã sao chép mật khẩu.');
          } catch {
            toast.error('Không thể sao chép. Bạn có thể hiện mật khẩu và sao chép thủ công.');
          }
        }}><Copy size={16} /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Sao chép</Box></Button>
        </Box>
      </Tooltip>
    </Box>
  );
}
