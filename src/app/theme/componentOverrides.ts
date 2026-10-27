import type { Components, Theme } from '@mui/material/styles';
import { designTokens } from './tokens';

export const componentOverrides: Components<Theme> = {
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: {
        minHeight: 40,
        borderRadius: designTokens.radius.sm,
        paddingInline: designTokens.spacing.lg,
        fontWeight: designTokens.typography.weights.bold,
        textTransform: 'none',
        boxShadow: 'none',
      },
      sizeLarge: {
        minHeight: 46,
        paddingInline: designTokens.spacing.xl,
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: designTokens.radius.sm,
      },
    },
  },
  MuiTextField: {
    defaultProps: {
      size: 'small',
      fullWidth: true,
    },
  },
  MuiFormControl: {
    defaultProps: {
      size: 'small',
      fullWidth: true,
    },
  },
  MuiFormLabel: {
    styleOverrides: {
      root: {
        color: designTokens.colors.neutral[700],
        fontWeight: designTokens.typography.weights.semibold,
      },
    },
  },
  MuiInputLabel: {
    styleOverrides: {
      root: {
        '&.MuiInputLabel-outlined:not(.MuiInputLabel-shrink)': {
          transform: 'translate(14px, 11px) scale(1)',
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        minHeight: 44,
        borderRadius: designTokens.radius.sm,
        backgroundColor: designTokens.colors.neutral[0],
        '&:not(.MuiInputBase-multiline)': {
          height: 44,
          '& .MuiOutlinedInput-input': {
            boxSizing: 'content-box',
            height: 22,
            minHeight: 22,
            lineHeight: '22px',
            paddingBlock: 11,
          },
        },
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: designTokens.colors.neutral[300],
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: designTokens.colors.neutral[400],
        },
      },
    },
  },
  MuiPaper: {
    defaultProps: {
      elevation: 0,
    },
    styleOverrides: {
      rounded: {
        borderRadius: designTokens.radius.md,
      },
    },
  },
  MuiDialog: {
    defaultProps: {
      fullWidth: true,
      maxWidth: 'sm',
    },
    styleOverrides: {
      paper: {
        borderRadius: designTokens.radius.lg,
        boxShadow: designTokens.shadows.overlay,
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontWeight: designTokens.typography.weights.extrabold,
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: designTokens.radius.full,
        fontWeight: designTokens.typography.weights.bold,
      },
    },
  },
  MuiTooltip: {
    defaultProps: {
      arrow: true,
    },
    styleOverrides: {
      tooltip: {
        borderRadius: designTokens.radius.sm,
        fontSize: '0.78rem',
        fontWeight: designTokens.typography.weights.semibold,
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottomColor: designTokens.colors.neutral[200],
      },
      head: {
        color: designTokens.colors.neutral[600],
        backgroundColor: designTokens.colors.neutral[50],
        fontWeight: designTokens.typography.weights.bold,
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: designTokens.radius.md,
      },
    },
  },
};
