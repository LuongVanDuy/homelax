import { useState } from 'react';
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { Search } from 'lucide-react';
import { toast } from '../../../lib/toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useUsersPageQuery } from '../../users/api';
import { useSaveBuildingPermissionsMutation } from '../api';
import { buildingErrorMessage } from '../buildingPresentation';
import type { BuildingRecord } from '../building.types';

export function BuildingPermissionsDialog({
  building,
  onClose,
}: {
  building: BuildingRecord;
  onClose: () => void;
}) {
  const mutation = useSaveBuildingPermissionsMutation();
  const [selected, setSelected] = useState<string[]>(building.allowedViewerIds || []);
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

  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isPending ? undefined : onClose}>
    <DialogTitle>Phân quyền xem tòa nhà</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Chọn tài khoản được phép xem/quản lý “{building.name}”. Quyền backend vẫn là authority cuối.
        </Typography>
        <TextField
          label="Tìm người dùng"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> } }}
        />
        <Typography variant="caption" color="text.secondary">
          Hiển thị tối đa 30 kết quả theo từ khóa. Các quyền đã lưu nhưng chưa nằm trong kết quả hiện tại vẫn được giữ nguyên khi lưu.
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
      <Button color="inherit" onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
      <Button variant="contained" disabled={mutation.isPending} onClick={async () => {
        try {
          await mutation.mutateAsync({ id: building.id, viewerIds: selected });
          toast.success('Đã cập nhật quyền xem tòa nhà.');
          onClose();
        } catch (error) {
          toast.error(buildingErrorMessage(error));
        }
      }}>{mutation.isPending ? 'Đang lưu…' : 'Lưu phân quyền'}</Button>
    </DialogActions>
  </Dialog>;
}
