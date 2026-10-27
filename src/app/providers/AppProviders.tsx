import { Suspense, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, CircularProgress, GlobalStyles, ThemeProvider, Typography } from '@mui/material';
import { brandCssVariables } from '../theme/brandCssVariables';
import appTheme from '../theme/appTheme';
import { bindIdentityQueryCache } from '../../features/auth/identityStore';
import { AppToaster } from '../../components/ui/feedback/AppToaster';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const unbindIdentityCache = bindIdentityQueryCache(queryClient);
if (import.meta.hot) import.meta.hot.dispose(unbindIdentityCache);

function AppLoadingFallback() {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        backgroundColor: 'background.default',
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress size={34} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Đang tải ứng dụng...
        </Typography>
      </Box>
    </Box>
  );
}

type AppProvidersProps = {
  children: ReactNode;
};

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider theme={appTheme}>
      <GlobalStyles styles={{ ':root': brandCssVariables }} />
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<AppLoadingFallback />}>{children}</Suspense>
        <AppToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
