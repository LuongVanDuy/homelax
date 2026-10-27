import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { designTokens } from '../../app/theme/tokens';

export type PageContainerProps = {
  children?: ReactNode;
  admin?: boolean;
};

export function PageContainer({ children, admin = false }: PageContainerProps) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: admin
          ? designTokens.layout.adminContentMax
          : designTokens.layout.publicContentMax,
        mx: 'auto',
        px: { xs: 2, sm: 2.5, md: 3, xl: 4 },
      }}
    >
      {children}
    </Box>
  );
}
