import { ArchiveRestore, BadgePercent, Pencil, Plus } from 'lucide-react';
import { CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsBadge as Chip, CmsTable as Table } from '../../../components/cms';

import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';

import type { CollaboratorTypeSummary, CommissionAllocationTargetSummary } from '@tinyhouse/contracts';
import { toast } from '../../../lib/toast';
import { useCollaboratorTypeLifecycleMutation, useCollaboratorTypesQuery, useCommissionAllocationStatusQuery, useCommissionAllocationTargetsQuery, useSaveCollaboratorTypeMutation, useSaveCommissionAllocationTargetMutation } from '../api';

type TypeEditor = {
  id?: string;
  name: string;
  description: string;
};

type AllocationEditor = {
  id?: string;
  name: string;
  targetKind: 'department' | 'position';
  percentage: string;
  isCtv: boolean;
  isActive: boolean;
  notes: string;
};

const emptyType: TypeEditor = { name: '', description: '' };
const emptyAllocation: AllocationEditor = {
  name: '',
  targetKind: 'department',
  percentage: '',
  isCtv: false,
  isActive: true,
  notes: '',
};

export function CommissionConfigPage() {
  const typesQuery = useCollaboratorTypesQuery();
  const targetsQuery = useCommissionAllocationTargetsQuery();
  const statusQuery = useCommissionAllocationStatusQuery();
  const saveTypeMutation = useSaveCollaboratorTypeMutation();
  const lifecycleMutation = useCollaboratorTypeLifecycleMutation();
  const saveTargetMutation = useSaveCommissionAllocationTargetMutation();

  const [typeEditor, setTypeEditor] = useState<TypeEditor | null>(null);
  const [allocationEditor, setAllocationEditor] = useState<AllocationEditor | null>(null);

  const types = typesQuery.data || [];
  const targets = targetsQuery.data || [];
  const allocationStatus = statusQuery.data;

  const saveType = async () => {
    if (!typeEditor?.name.trim()) {
      toast.error('Vui lòng nhập tên loại cộng tác viên.');
      return;
    }
    try {
      await saveTypeMutation.mutateAsync({
        id: typeEditor.id,
        value: {
          name: typeEditor.name.trim(),
          description: typeEditor.description.trim(),
        },
      });
      toast.success(typeEditor.id ? 'Đã cập nhật loại cộng tác viên.' : 'Đã tạo loại cộng tác viên.');
      setTypeEditor(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu loại cộng tác viên.');
    }
  };

  const editType = (item: CollaboratorTypeSummary) => {
    setTypeEditor({ id: item.id, name: item.name, description: item.description });
  };

  const editAllocation = (item?: CommissionAllocationTargetSummary) => {
    setAllocationEditor(item ? {
      id: item.id,
      name: item.name,
      targetKind: item.targetKind,
      percentage: String(item.percentage),
      isCtv: item.isCtv,
      isActive: item.isActive,
      notes: item.notes,
    } : { ...emptyAllocation });
  };

  const saveAllocation = async () => {
    if (!allocationEditor) return;
    const rateText = allocationEditor.percentage.trim();
    const rate = Number(rateText);
    if (!allocationEditor.name.trim() || !rateText || !Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error('Vui lòng nhập tên và tỷ lệ từ 0 đến 100%.');
      return;
    }
    try {
      await saveTargetMutation.mutateAsync({
        id: allocationEditor.id,
        value: {
          name: allocationEditor.name.trim(),
          targetKind: allocationEditor.targetKind,
          percentage: rate,
          isCtv: allocationEditor.isCtv,
          isActive: allocationEditor.isActive,
          notes: allocationEditor.notes.trim(),
        },
      });
      toast.success('Đã lưu cơ cấu phân bổ hoa hồng.');
      setAllocationEditor(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu cơ cấu phân bổ.');
    }
  };

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Cấu hình hoa hồng </>} description={<> Thiết lập tỷ lệ phân bổ hoa hồng và quản lý loại cộng tác viên. </>} actions={<><Button variant="contained" startIcon={<Plus size={18} />} onClick={() => editAllocation()} sx={{ minHeight: 44 }}>
        Thêm phòng ban / vị trí
      </Button></>} />

    <CmsListCard variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}
      >
        <Box>
          <Typography sx={{ fontWeight: 800 }}>Cơ cấu phân bổ</Typography>
          <Typography variant="body2" color="text.secondary">
            Tổng tỷ lệ đang hoạt động phải bằng đúng 100% và có đúng một vị trí được đánh dấu CTV để tính được tiền.
          </Typography>
        </Box>
        <BadgePercent size={22} />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
        <Chip
          label={`Đang phân bổ: ${allocationStatus?.activePercentageTotal ?? 0}%`}
          color={allocationStatus?.readyForCalculation ? 'success' : 'warning'}
          variant="outlined"
        />
        <Typography variant="body2" color="text.secondary">
          Còn lại: {allocationStatus?.remainingPercentage ?? 100}% · CTV: {allocationStatus?.ctvTargetName || 'chưa chọn'}
        </Typography>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Phòng ban / vị trí</TableCell>
              <TableCell>Loại</TableCell>
              <TableCell align="right">Tỷ lệ quỹ</TableCell>
              <TableCell>CTV</TableCell>
              <TableCell>Trạng thái</TableCell>
              <CmsActionsCell>Thao tác</CmsActionsCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {targets.map((item) => <TableRow key={item.id}>
              <TableCell>
                <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                {item.notes && <Typography variant="caption" color="text.secondary">{item.notes}</Typography>}
              </TableCell>
              <TableCell>{item.targetKind === 'department' ? 'Phòng ban' : 'Vị trí'}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>{item.percentage}%</TableCell>
              <TableCell>{item.isCtv ? <Chip size="small" label="CTV" color="primary" variant="outlined" /> : '-'}</TableCell>
              <TableCell>
                <Chip size="small" label={item.isActive ? 'Đang áp dụng' : 'Tạm dừng'}
                  color={item.isActive ? 'success' : 'default'} variant="outlined" />
              </TableCell>
              <CmsActionsCell><CmsRowActions actions={[{id:'action-0',label:"Sửa",icon:<Pencil size={15} />,onClick:() => editAllocation(item)}]} /></CmsActionsCell>
            </TableRow>)}
            {!targets.length && <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                Chưa có cơ cấu phân bổ. Hãy thêm các phòng ban/vị trí theo chính sách thực tế.
              </TableCell>
            </TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </CmsListCard>

    <CmsListCard variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 800 }}>Loại cộng tác viên</Typography>
          <Typography variant="body2" color="text.secondary">
            Dùng để phân loại và quản lý hồ sơ cộng tác viên.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Plus size={17} />} onClick={() => setTypeEditor({ ...emptyType })}>
          Thêm loại CTV
        </Button>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Tên loại</TableCell><TableCell>Mô tả</TableCell>
            <TableCell>Trạng thái</TableCell><CmsActionsCell>Thao tác</CmsActionsCell>
          </TableRow></TableHead>
          <TableBody>
            {types.map((item) => <TableRow key={item.id}>
              <TableCell sx={{ fontWeight: 700 }}>{item.name}</TableCell>
              <TableCell>{item.description || '-'}</TableCell>
              <TableCell><Chip size="small" label={item.archivedAt ? 'Đã lưu trữ' : 'Đang dùng'}
                color={item.archivedAt ? 'default' : 'success'} variant="outlined" /></TableCell>
              <CmsActionsCell><CmsRowActions actions={[{id:'action-0',label:"Sửa",icon:<Pencil size={15} />,onClick:() => editType(item)},
{id:'action-1',label:item.archivedAt ? 'Khôi phục' : 'Lưu trữ',icon:<ArchiveRestore />,onClick:async () => {
                      try {
                        await lifecycleMutation.mutateAsync({ id: item.id, archived: !item.archivedAt });
                        toast.success(item.archivedAt ? 'Đã khôi phục loại cộng tác viên.' : 'Đã lưu trữ loại cộng tác viên.');
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'Không thể cập nhật loại cộng tác viên.');
                      }
                    },disabled:lifecycleMutation.isPending}]} /></CmsActionsCell>
            </TableRow>)}
            {!types.length && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>
              Chưa có loại cộng tác viên.
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </CmsListCard>

    <Dialog open={Boolean(typeEditor)} onClose={() => !saveTypeMutation.isPending && setTypeEditor(null)} fullWidth maxWidth="sm">
      <DialogTitle>{typeEditor?.id ? 'Sửa loại cộng tác viên' : 'Thêm loại cộng tác viên'}</DialogTitle>
      <DialogContent dividers><Stack spacing={2} sx={{ pt: 0.5 }}>
        <TextField label="Tên loại CTV" value={typeEditor?.name || ''}
          onChange={(event) => setTypeEditor((current) => current ? { ...current, name: event.target.value } : current)}
          autoFocus fullWidth />
        <TextField label="Mô tả" value={typeEditor?.description || ''}
          onChange={(event) => setTypeEditor((current) => current ? { ...current, description: event.target.value } : current)}
          multiline minRows={3} fullWidth />
      </Stack></DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={() => setTypeEditor(null)} disabled={saveTypeMutation.isPending}>Hủy</Button>
        <Button variant="contained" onClick={() => void saveType()} disabled={saveTypeMutation.isPending}>Lưu</Button>
      </DialogActions>
    </Dialog>

    <Dialog open={Boolean(allocationEditor)} onClose={() => !saveTargetMutation.isPending && setAllocationEditor(null)}
      fullWidth maxWidth="sm">
      <DialogTitle>{allocationEditor?.id ? 'Sửa cơ cấu phân bổ' : 'Thêm phòng ban / vị trí'}</DialogTitle>
      <DialogContent dividers><Stack spacing={2} sx={{ pt: 0.5 }}>
        <TextField label="Tên phòng ban / vị trí" value={allocationEditor?.name || ''}
          onChange={(event) => setAllocationEditor((current) => current ? { ...current, name: event.target.value } : current)}
          autoFocus fullWidth />
        <TextField select label="Loại" value={allocationEditor?.targetKind || 'department'}
          onChange={(event) => setAllocationEditor((current) => current
            ? { ...current, targetKind: event.target.value as 'department' | 'position' } : current)}>
          <MenuItem value="department">Phòng ban</MenuItem>
          <MenuItem value="position">Vị trí</MenuItem>
        </TextField>
        <TextField label="Tỷ lệ trên quỹ 90% X (%)" type="number"
          slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }}
          value={allocationEditor?.percentage || ''}
          onChange={(event) => setAllocationEditor((current) => current ? { ...current, percentage: event.target.value } : current)}
          helperText="Các mục đang hoạt động cộng lại phải đúng 100% mới có thể tính hoa hồng." />
        <TextField select label="Vai trò trong công thức" value={allocationEditor?.isCtv ? 'ctv' : 'normal'}
          onChange={(event) => setAllocationEditor((current) => current ? { ...current, isCtv: event.target.value === 'ctv' } : current)}>
          <MenuItem value="normal">Phân bổ thông thường</MenuItem>
          <MenuItem value="ctv">Phần của CTV</MenuItem>
        </TextField>
        <TextField select label="Trạng thái" value={allocationEditor?.isActive ? 'active' : 'inactive'}
          onChange={(event) => setAllocationEditor((current) => current ? { ...current, isActive: event.target.value === 'active' } : current)}>
          <MenuItem value="active">Đang áp dụng</MenuItem>
          <MenuItem value="inactive">Tạm dừng</MenuItem>
        </TextField>
        <TextField label="Ghi chú" value={allocationEditor?.notes || ''}
          onChange={(event) => setAllocationEditor((current) => current ? { ...current, notes: event.target.value } : current)}
          multiline minRows={3} />
      </Stack></DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={() => setAllocationEditor(null)} disabled={saveTargetMutation.isPending}>Hủy</Button>
        <Button variant="contained" onClick={() => void saveAllocation()} disabled={saveTargetMutation.isPending}>Lưu cơ cấu</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
