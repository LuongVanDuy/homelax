import { Box, Typography } from '@mui/material';
import { PublicLink } from './PublicLink';

export function PublicRouteState({ pending = false, error = false }: { pending?: boolean; error?: boolean }) {
  return <Box sx={{ maxWidth: 680, mx: 'auto', px: 3, py: 8, textAlign: 'center' }} role={error ? 'alert' : undefined}>
    <Typography component="h1" variant="h4" sx={{ mb: 2 }}>
      {error ? 'Chưa tải được thông tin' : pending ? 'Nội dung đang được cập nhật' : 'Không tìm thấy trang'}
    </Typography>
    <Typography sx={{ mb: 3 }}>{error ? 'Vui lòng thử lại sau ít phút.' : pending ? 'Trang này chưa có nội dung công khai.' : 'Đường dẫn không tồn tại hoặc nội dung không còn khả dụng.'}</Typography>
    <PublicLink to="/tim-phong">Tìm phòng</PublicLink>
  </Box>;
}
