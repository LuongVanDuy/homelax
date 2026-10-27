import { forwardRef } from 'react';
import { Chip, type ChipProps } from '@mui/material';

/** One badge treatment for CMS; neutral metadata stays outlined, semantic states are filled. */
export const CmsBadge = forwardRef<HTMLDivElement, ChipProps>(function CmsBadge({ color = 'default', sx, ...props }, ref) {
  return <Chip ref={ref} {...props} color={color} size="small" variant={color === 'default' ? 'outlined' : 'filled'} sx={[
    ...(Array.isArray(sx) ? sx : [sx]),
    { height: 24, maxWidth: '100%', fontSize: 12, fontWeight: 700, lineHeight: 1.4, borderRadius: '12px',
      ...(color !== 'default' && { color: 'common.white', '& .MuiChip-icon, & .MuiChip-deleteIcon': { color: 'inherit' } }),
      '& .MuiChip-label': { px: 1 }, '& .MuiChip-icon': { width: 14, height: 14, ml: .75 } },
  ]} />;
});
