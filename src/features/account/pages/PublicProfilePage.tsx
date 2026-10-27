import { useState } from 'react';
import { Alert, Avatar, Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { KeyRound, Pencil } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useAccountDetailQuery } from '../api/account.api';
import { AccountProfileDialog } from '../components/AccountProfileDialog';
import { AccountPasswordDialog } from '../components/AccountPasswordDialog';
import { accountCardSx } from '../accountSurface';
import { EmailVerificationPanel } from '../components/EmailVerificationPanel';

export function PublicProfilePage() {
  const detail = useAccountDetailQuery();
  const [profileOpen, setProfileOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const passwordOpen = params.get('edit') === 'password';
  const setPasswordOpen = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set('edit', 'password'); else next.delete('edit');
    setParams(next, { replace: true });
  };
  if (detail.isError) return <Alert severity="error" action={<Button color="inherit" onClick={() => void detail.refetch()}>Thử lại</Button>}>Không tải được hồ sơ.</Alert>;
  if (!detail.data) return <Skeleton variant="rounded" height={300} />;
  const user = detail.data.user;
  const values = [
    ['Họ và tên', user.name], ['Email đăng nhập', user.email], ['Số điện thoại', user.phone],
    ['Giới tính', user.gender ? { male: 'Nam', female: 'Nữ', other: 'Khác' }[user.gender] : ''],
    ['Ngày sinh', user.birthDate?.split('-').reverse().join('/')], ['Địa chỉ', user.address],
  ];
  return <>
    <Paper variant="outlined" sx={{ ...accountCardSx, p: { xs: 2.5, md: 4 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, mb: 4 }}>
        <Avatar src={user.avatar || undefined} alt={user.name} sx={{ width: 72, height: 72 }}>{user.name.slice(0, 1)}</Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}><Typography component="h2" variant="h6" sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{user.name}</Typography></Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<Pencil size={18} />} onClick={() => setProfileOpen(true)}>Sửa hồ sơ</Button>
          <Button variant="outlined" startIcon={<KeyRound size={18} />} onClick={() => setPasswordOpen(true)}>Đổi mật khẩu</Button>
        </Stack>
      </Stack>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 3 }}>
        {values.map(([label, value]) => <Box key={label}>
          <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
          <Typography component="dd" sx={{ m: 0, mt: 0.5, fontWeight: 600, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value || 'Chưa cung cấp'}</Typography>
        </Box>)}
      </Box>
      <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
        <EmailVerificationPanel key={user.id} verifiedAt={user.emailVerifiedAt} />
      </Box>
    </Paper>
    {profileOpen && <AccountProfileDialog user={user} self onClose={() => setProfileOpen(false)} />}
    {passwordOpen && <AccountPasswordDialog onClose={() => setPasswordOpen(false)} loginTo="/dang-nhap?returnTo=%2Faccount" />}
  </>;
}
