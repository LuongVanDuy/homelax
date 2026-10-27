import type { ReactNode } from 'react';
import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import type { StatusTone } from '../../../app/theme/tokens';

const statusColorMap: Record<StatusTone, ChipProps['color']> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
  neutral: 'default',
};

export type StatusChipProps = {
  label: ReactNode;
  tone?: StatusTone;
  size?: ChipProps['size'];
};

export function StatusChip({
  label,
  tone = 'neutral',
  size = 'small',
}: StatusChipProps) {
  return (
    <Chip
      label={label}
      color={statusColorMap[tone]}
      size={size}
      variant={tone === 'neutral' ? 'outlined' : 'filled'}
    />
  );
}
