import type { AuditSummary } from '@tinyhouse/contracts';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { auditAction, auditActor, auditEntity, auditTimestamp } from '../auditPresentation';

export function AuditLogDetailsDialog({ log, onClose }: { log: AuditSummary; onClose: () => void }) {
  const timestamp = auditTimestamp(log.createdAt);
  const facts = [
    ['Người thực hiện', auditActor(log)],
    ['Email', log.userEmail || '-'],
    ['Mã tài khoản', log.userId || '-'],
    ['Thời gian (UTC+7)', [timestamp.date, timestamp.time].filter(Boolean).join(' ')],
    ['Thao tác', auditAction(log.action).label],
    ['Loại đối tượng', auditEntity(log.entityType)],
    ['Mã đối tượng', log.entityId || '-'],
    ['Mã nhật ký', log.id],
  ];
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="audit-detail-title">
    <DialogTitle id="audit-detail-title">Chi tiết nhật ký</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={3}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>Nội dung</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {log.summary || 'Không có mô tả.'}
          </Typography>
        </Box>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '150px minmax(0, 1fr)' }, gap: 1 }}>
          {facts.map(([label, value]) => <Box key={label} sx={{ display: 'contents' }}>
            <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, mb: { xs: 1, sm: 0 }, overflowWrap: 'anywhere' }}>
              {value}
            </Typography>
          </Box>)}
        </Box>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}>
      <Button onClick={onClose} variant="outlined" sx={{ minHeight: 44 }}>Đóng</Button>
    </DialogActions>
  </Dialog>;
}
