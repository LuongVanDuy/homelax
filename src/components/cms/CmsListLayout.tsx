import { Box, Paper, TextField, type BoxProps, type PaperProps, type TextFieldProps } from '@mui/material';

export function CmsListCard({ sx, ...props }: PaperProps) {
  return <Paper {...props} variant="outlined" sx={[
    ...(Array.isArray(sx) ? sx : [sx]),
    { minWidth: 0, borderRadius: '12px', borderColor: 'divider', overflow: 'hidden' },
  ]} />;
}

export function CmsFilterField({ slotProps, sx, ...props }: TextFieldProps) {
  return <TextField {...props} fullWidth size="small" sx={[...(Array.isArray(sx) ? sx : [sx]), { minWidth: 0 }]}
    slotProps={{
      ...slotProps,
      inputLabel: (state) => ({ shrink: true, ...(typeof slotProps?.inputLabel === 'function' ? slotProps.inputLabel(state) : slotProps?.inputLabel) }),
      select: (state) => ({ displayEmpty: true, ...(typeof slotProps?.select === 'function' ? slotProps.select(state) : slotProps?.select) }),
    }} />;
}

/** Filter width follows available CMS content width, including an expanded sidebar. */
export function CmsFilterBar({ sx, inset = false, ...props }: BoxProps & { inset?: boolean }) {
  return <Box {...props} sx={[
    ...(Array.isArray(sx) ? sx : [sx]),
    { display: 'flex', flexWrap: 'wrap', gap: 1.5, p: inset ? 0 : 2.5, alignItems: 'center',
      '& > *': { minWidth: 0, flex: '1 1 180px' },
      '& > :first-child': { flex: '2 1 280px' },
      '& > .MuiButton-root': { flex: '0 0 auto' },
      '& .MuiFormControl-root': { minWidth: 0 },
      '@media (max-width: 599px)': { p: inset ? 0 : 2, '& > *': { flexBasis: '100%' } } },
  ]} />;
}
