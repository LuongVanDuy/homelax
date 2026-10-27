import { useRef, useState } from 'react';
import { Button } from '@mui/material';
import { Share2 } from 'lucide-react';
import { toast } from '../../lib/toast';
import { sharePublicUrl } from '../../lib/publicShare';

export function PublicShareButton({ href, title }: { href: string; title: string }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const nativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const share = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await sharePublicUrl(new URL(href, window.location.origin).toString(), title);
      if (result === 'copied') toast.success('Đã sao chép liên kết.');
    } catch {
      toast.error('Không thể chia sẻ liên kết. Vui lòng sao chép URL trên thanh địa chỉ.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return <Button variant="outlined" color="secondary" startIcon={<Share2 size={17} />} disabled={busy || !href}
    onClick={() => void share()} sx={{ minHeight: 44, borderColor: 'divider', bgcolor: 'background.paper' }}>
    {nativeShare ? 'Chia sẻ' : 'Sao chép liên kết'}
  </Button>;
}
