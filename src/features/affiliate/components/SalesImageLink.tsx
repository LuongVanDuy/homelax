import { Button } from '@mui/material';
import { ImagePlus } from 'lucide-react';
import { PublicLink } from '../../../app/router/PublicLink';
import type { AppIdentity } from '../../auth/identityStore';
import { canUseCtvTools, salesImageHref } from '../ctvTools';

export function SalesImageLink({ currentUser, buildingId, roomId, unitId }: {
  currentUser: AppIdentity; buildingId: string; roomId?: string; unitId?: string;
}) {
  if (!canUseCtvTools(currentUser)) return null;
  return <Button component={PublicLink} to={salesImageHref(buildingId, roomId, unitId)} variant="outlined" startIcon={<ImagePlus size={17} />}>Tạo ảnh bán phòng</Button>;
}
