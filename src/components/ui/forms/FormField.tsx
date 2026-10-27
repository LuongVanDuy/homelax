import type { ReactNode } from 'react';
import { FormHelperText, FormLabel, Stack } from '@mui/material';

export type FormFieldProps = {
  children?: ReactNode;
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  required?: boolean;
};

export function FormField({
  children,
  label,
  helperText,
  error,
  required = false,
}: FormFieldProps) {
  return (
    <Stack sx={{ gap: 0.75 }}>
      {label ? (
        <FormLabel required={required} error={Boolean(error)}>
          {label}
        </FormLabel>
      ) : null}
      {children}
      {error ? (
        <FormHelperText error sx={{ m: 0 }}>
          {error}
        </FormHelperText>
      ) : helperText ? (
        <FormHelperText sx={{ m: 0 }}>{helperText}</FormHelperText>
      ) : null}
    </Stack>
  );
}
