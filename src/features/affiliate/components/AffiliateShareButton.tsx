import { Button } from '@mui/material';
import { Link2 } from 'lucide-react';
import type { AppIdentity } from '../../auth/identityStore';
import { toast } from '../../../lib/toast';
import { useAffiliateReferralQuery } from '../api';
import { affiliateShareUrl } from '../../../lib/publicShare';
import { canUseCtvTools } from '../ctvTools';

export function AffiliateShareButton({ currentUser, href }: { currentUser: AppIdentity; href?: string }) {
  const isCtv = canUseCtvTools(currentUser);
  const query = useAffiliateReferralQuery(isCtv);

  if (!isCtv) return null;

  const copy = async () => {
    if (!query.data?.affiliateToken) {
      toast.error('Chưa tải được liên kết giới thiệu của CTV.');
      return;
    }
    try {
      const target = new URL(href || window.location.href, window.location.origin).toString();
      await navigator.clipboard.writeText(affiliateShareUrl(target, query.data.affiliateToken));
      toast.success('Đã sao chép liên kết giới thiệu.');
    } catch {
      toast.error('Không thể sao chép liên kết. Vui lòng thử lại.');
    }
  };

  return (
    <Button
      variant="outlined"
      startIcon={<Link2 size={17} />}
      onClick={() => void copy()}
      disabled={query.isPending || query.isError}
      sx={{ minHeight: 44 }}
    >
      {query.isPending ? 'Đang tạo liên kết…' : 'Sao chép liên kết giới thiệu'}
    </Button>
  );
}
