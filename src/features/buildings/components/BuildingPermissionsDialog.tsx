import { useState } from 'react';
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputAdornment, List, ListItemButton, ListItemText, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import { Search } from 'lucide-react';
import { toast } from '../../../lib/toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useUsersPageQuery } from '../../users/api';
import { useSaveBuildingPermissionsMutation } from '../api';
import { buildingErrorMessage } from '../buildingPresentation';
import type { BuildingRecord } from '../building.types';

type Mode = 'replace' | 'add' | 'remove';

/** One building edits its viewer list; several buildings add or remove the chosen accounts on each. */
export function BuildingPermissionsDialog({
  buildings,
  onClose,
  onSaved,
}: {
  buildings: BuildingRecord[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const single = buildings.length === 1;
  const mutation = useSaveBuildingPermissionsMutation();
  const [mode, setMode] = useState<Mode>(single ? 'replace' : 'add');
  const [selected, setSelected] = useState<string[]>(single ? buildings[0].allowedViewerIds || [] : []);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const usersQuery = useUsersPageQuery({
    page: 1,
    pageSize: 30,
    search: debouncedSearch,
    sort: 'name',
    order: 'asc',
  });
  const users = (usersQuery.data?.items || []).filter(
    (user) => !['admin', 'superadmin'].includes(user.roleCode),
  );

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  const viewerIdsFor = (building: BuildingRecord) => {
    const current = building.allowedViewerIds || [];
    if (mode === 'replace') return selected;
    if (mode === 'add') return [...new Set([...current, ...selected])];
    return current.filter((id) => !selected.includes(id));
  };

  const save = async () => {
    setSaving(true);
    const results = await Promise.allSettled(buildings.map((building) =>
      mutation.mutateAsync({ id: building.id, viewerIds: viewerIdsFor(building) })));
    setSaving(false);
    onSaved?.();
    const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (!failed.length) {
      toast.success(single ? 'Đã cập nhật quyền xem tòa nhà.' : `Đã cập nhật quyền cho ${buildings.length} tòa nhà.`);
      onClose();
      return;
    }
    toast.error(`${failed.length}/${buildings.length} tòa chưa lưu được: ${buildingErrorMessage(failed[0].reason)}`);
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={saving ? undefined : onClose}>
    <DialogTitle>{single ? 'Phân quyền xem tòa nhà' : `Phân quyền ${buildings.length} tòa nhà`}</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {single
            ? `Chọn tài khoản được phép xem/quản lý tòa “${buildings[0].code}”.`
            : `Áp dụng cho: ${buildings.map((building) => building.code).join(', ')}.`}
        </Typography>
        {!single && <RadioGroup row value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
          <FormControlLabel value="add" control={<Radio />} label="Thêm quyền" />
          <FormControlLabel value="remove" control={<Radio />} label="Gỡ quyền" />
        </RadioGroup>}
        <TextField
          label="Tìm người dùng"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> } }}
        />
        <Typography variant="caption" color="text.secondary">
          {single
            ? 'Hiển thị tối đa 30 kết quả theo từ khóa. Các quyền đã lưu nhưng chưa nằm trong kết quả hiện tại vẫn được giữ nguyên khi lưu.'
            : `Đã chọn ${selected.length} tài khoản. Quyền hiện có của các tài khoản khác trên từng tòa được giữ nguyên.`}
        </Typography>
        <List disablePadding sx={{ maxHeight: 360, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
          {users.map((user) => <ListItemButton key={user.id} onClick={() => toggle(user.id)}>
            <Checkbox edge="start" checked={selected.includes(user.id)} tabIndex={-1} disableRipple />
            <ListItemText primary={user.name || user.email} secondary={`${user.roleName || user.roleCode} · ${user.email}`} />
          </ListItemButton>)}
          {!users.length && <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {usersQuery.isFetching ? 'Đang tìm…' : 'Không có tài khoản phù hợp.'}
          </Typography>}
        </List>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2.5 }}>
      <Button color="inherit" onClick={onClose} disabled={saving}>Hủy</Button>
      <Button variant="contained" disabled={saving || (!single && !selected.length)} onClick={() => void save()}>
        {saving ? 'Đang lưu…' : 'Lưu phân quyền'}
      </Button>
    </DialogActions>
  </Dialog>;
}
