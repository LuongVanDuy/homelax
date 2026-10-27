import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Button, Paper, ThemeProvider, Typography } from '@mui/material';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import appTheme from '../../../app/theme/appTheme';
import { designTokens } from '../../../app/theme/tokens';

/** Also catches provider failures, so the fallback supplies its own app theme. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi hiển thị ứng dụng:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <ThemeProvider theme={appTheme}>
      <Box role="alert" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3,
        bgcolor: 'background.default', color: 'text.primary', fontFamily: designTokens.typography.fontFamily }}>
        <Paper variant="outlined" sx={{ p: 4, maxWidth: 480, width: '100%', boxSizing: 'border-box', textAlign: 'center', borderRadius: 3 }}>
          <Box sx={{ color: 'primary.main', mb: 2 }}><TriangleAlert size={40} aria-hidden="true" /></Box>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Đã xảy ra sự cố hiển thị</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Vui lòng tải lại trang để tiếp tục.</Typography>
          <Button variant="contained" startIcon={<RefreshCw size={18} />} onClick={() => window.location.reload()}>Tải lại trang</Button>
        </Paper>
      </Box>
    </ThemeProvider>;
  }
}
