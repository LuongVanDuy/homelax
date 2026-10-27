import { useRef } from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import { Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import type { AppIdentity } from '../../auth/identityStore';
import { getPublicLoginUrl } from '../../auth/publicAccess';
import { toast } from '../../../lib/toast';
import { useFavorite } from '../api/selfAccount.api';

export function FavoriteButton({ unitId, user, href, removeOnly = false, compact = false }: {
  unitId: string; user: AppIdentity; href?: string; removeOnly?: boolean; compact?: boolean;
}) {
  const location = useLocation();
  const { query, mutation } = useFavorite(unitId, Boolean(user) && !removeOnly);
  const locked = useRef(false);
  if (!user) return <Button component={Link} to={getPublicLoginUrl(href || `${location.pathname}${location.search}`)} variant="outlined" startIcon={<Heart size={18} />}>Yêu thích</Button>;
  const saved = removeOnly || query.data?.saved;
  const change = async () => {
    if (locked.current) return;
    locked.current = true;
    try { await mutation.mutateAsync(!saved); toast.success(saved ? 'Đã bỏ yêu thích.' : 'Đã lưu căn yêu thích.'); }
    catch (error) { if ((error as { code?: string }).code !== 'SESSION_CHANGED') toast.error(error instanceof Error ? error.message : 'Không thể cập nhật yêu thích.'); }
    finally { locked.current = false; }
  };
  if (!removeOnly && query.isError) return <Button variant="outlined" onClick={() => void query.refetch()}>Thử tải yêu thích</Button>;
  if (compact && removeOnly) return <Tooltip title="Bỏ yêu thích">
    <IconButton aria-label="Bỏ yêu thích" aria-pressed={Boolean(saved)} disabled={mutation.isPending}
      onClick={() => void change()} sx={{ width: 44, height: 44, bgcolor: 'primary.main', color: 'primary.contrastText',
        boxShadow: 1, '&:hover': { bgcolor: 'primary.dark' } }}>
      <Heart size={20} fill="currentColor" />
    </IconButton>
  </Tooltip>;
  return <Button variant={saved ? 'contained' : 'outlined'} aria-pressed={Boolean(saved)}
    disabled={mutation.isPending || (!removeOnly && !query.data)} onClick={() => void change()}
    startIcon={<Heart size={18} fill={saved ? 'currentColor' : 'none'} />}>
    {mutation.isPending ? 'Đang lưu…' : removeOnly ? 'Bỏ yêu thích' : saved ? 'Đã yêu thích' : 'Yêu thích'}
  </Button>;
}
