import { CmsFilterField, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsFilterBar, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState } from 'react';
import { Box, Button, Divider, InputAdornment, LinearProgress, MenuItem, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Archive, ArchiveRestore, Eye, Pencil, Plus, Search, Users } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { EmptyState } from '../../../components/ui/feedback/EmptyState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { toast } from '../../../lib/toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useContactArchiveMutation, useContactsPageQuery, type ContactKind } from '../api';
import { contactErrorMessage, contactLabels } from '../contactPresentation';
import type { ContactSummary } from '../contact.types';
import { ContactDetailsDialog } from './ContactDetailsDialog';
import { ContactEditorDialog } from './ContactEditorDialog';

const SOURCE_LABELS: Record<string, string> = {
  website: 'Trang web',
  ctv: 'CTV',
  ads: 'Quảng cáo',
  social: 'Mạng xã hội',
  other: 'Khác',
};

function sourceLabel(contact: ContactSummary) {
  if (!('sourceType' in contact)) return '-';
  return [SOURCE_LABELS[contact.sourceType] || contact.sourceType, contact.sourceChannel]
    .filter(Boolean)
    .join(' · ') || 'Chưa ghi nhận';
}

export function ContactsPage({
  kind,
  onCreate,
  onEdit,
  allowArchive = true,
  canCreateBooking = false,
  canCreateDirectDeal = false,
  collaboratorMeta = {},
}: {
  kind: ContactKind;
  onCreate?: () => void;
  onEdit?: (contact: ContactSummary) => void;
  allowArchive?: boolean;
  canCreateBooking?: boolean;
  canCreateDirectDeal?: boolean;
  collaboratorMeta?: Record<string, { typeName: string; affiliateToken: string | null }>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const detailParam = kind === 'customers' ? 'customer' : 'ctv';
  const requestedContact = searchParams.get(detailParam);
  const archiveMutation = useContactArchiveMutation(kind);
  const labels = contactLabels[kind];
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'archived'>('active');
  const [search, setSearch] = useState(requestedContact || '');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(requestedContact);
  const [editor, setEditor] = useState<{ contact?: ContactSummary } | null>(null);
  
  const [archiveAction, setArchiveAction] = useState<{ contact: ContactSummary; archive: boolean } | null>(null);
  const debouncedSearch = useDebouncedValue(search, 350);

  const query = useContactsPageQuery(kind, {
    page: page + 1,
    pageSize: rowsPerPage,
    search: debouncedSearch,
    archived: statusFilter || 'all',
    sort: 'createdAt',
    order: 'desc',
  });

  const contacts: ContactSummary[] = (query.data?.items || []) as ContactSummary[];
  const selected = contacts.find((contact) => contact.id === selectedId);
  const totalContacts = query.data?.pagination.total || 0;
  const openCreate = () => onCreate ? onCreate() : setEditor({});
  const openEdit = (contact: ContactSummary) => onEdit ? onEdit(contact) : setEditor({ contact });

  const openDetails = (contact: ContactSummary) => {
    setSelectedId(contact.id);
    const next = new URLSearchParams(searchParams);
    next.set(detailParam, contact.id);
    setSearchParams(next, { replace: true });
  };

  const closeDetails = () => {
    const currentId = selectedId;
    setSelectedId(null);
    const next = new URLSearchParams(searchParams);
    next.delete(detailParam);
    setSearchParams(next, { replace: true });
    if (search === currentId) setSearch('');
  };

  

  const renderActions = (contact: ContactSummary) => <CmsRowActions disabled={archiveMutation.isPending} actions={[
 {id:'view',label:'Xem hồ sơ',icon:<Eye />,onClick:()=>openDetails(contact)},
 {id:'edit',label:kind==='collaborators'?'Chỉnh sửa tài khoản':'Chỉnh sửa hồ sơ',icon:<Pencil />,hidden:Boolean(contact.archivedAt),onClick:()=>openEdit(contact)},
 {id:'archive',label:contact.archivedAt?'Khôi phục hồ sơ':'Lưu trữ hồ sơ',icon:contact.archivedAt?<ArchiveRestore />:<Archive />,hidden:!allowArchive,onClick:()=>setArchiveAction({contact,archive:!contact.archivedAt})},
]} />;

  return <Stack spacing={3}>
    <CmsPageHeader title={labels.title} description={kind === 'customers' ? 'Quản lý hồ sơ, nguồn khách và lịch sử giao dịch.' : 'Quản lý hồ sơ cộng tác viên và thông tin liên kết tài khoản.'} actions={<><Button variant="contained" startIcon={<Plus size={18} />} onClick={openCreate}>{labels.create}</Button></>} />

    {query.isError && <ErrorState
      title={`Không tải được hồ sơ ${labels.singular}`}
      description={query.data ? 'Đang hiển thị dữ liệu lần tải trước.' : 'Vui lòng kiểm tra kết nối và thử lại.'}
      action={<Button color="inherit" onClick={() => void query.refetch()}>Thử lại</Button>}
    />}

    <CmsListCard variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ height: 3 }}>{query.isFetching && <LinearProgress sx={{ height: 3 }} />}</Box>
      <CmsFilterBar>
        <CmsFilterField
          label={`Tìm ${labels.singular}`}
          placeholder="Họ tên, số điện thoại, email hoặc mã hồ sơ"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
          fullWidth
          slotProps={{
            inputLabel: { shrink: true },
            input: {
              startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>,
            },
          }}
        />
        <CmsFilterField select label="Trạng thái" value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as '' | 'active' | 'archived');
            setPage(0);
          }}>
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="active">Đang hoạt động</MenuItem>
          <MenuItem value="archived">Lưu trữ</MenuItem>
        </CmsFilterField>
      </CmsFilterBar>

      {query.isPending ? <LoadingState label="Đang tải hồ sơ…" minHeight={260} /> :
        !query.data && query.isError ? null :
        !contacts.length ? <EmptyState
          icon={<Users size={36} />}
          title={search ? 'Không tìm thấy hồ sơ' : statusFilter === 'archived' ? 'Chưa có hồ sơ lưu trữ' : `Chưa có ${labels.singular}`}
          action={search
            ? <Button onClick={() => { setSearch(''); setPage(0); }}>Xóa tìm kiếm</Button>
            : statusFilter !== 'archived' ? <Button onClick={openCreate}>{labels.create}</Button> : undefined}
        /> : <>
          <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table aria-label={`Danh sách ${labels.singular}`}>
              <TableHead><TableRow>
                <TableCell>Họ tên</TableCell>
                <TableCell>Liên hệ</TableCell>
                {kind === 'customers' ? <>
                  <TableCell>Nguồn</TableCell>
                  <TableCell>Lịch xem</TableCell>
                  <TableCell>Giao dịch</TableCell>
                </> : <>
                  <TableCell>Loại CTV</TableCell>
                  <TableCell>Tài khoản</TableCell>
                </>}
                <CmsActionsCell>Thao tác</CmsActionsCell>
              </TableRow></TableHead>
              <TableBody>{contacts.map((contact) => <TableRow
                key={contact.id}
                hover
                tabIndex={contact.archivedAt ? -1 : 0}
                role={contact.archivedAt ? undefined : 'button'}
                onClick={() => { if (!contact.archivedAt) openDetails(contact); }}
                onKeyDown={(event) => {
                  if (contact.archivedAt || !['Enter', ' '].includes(event.key)) return;
                  event.preventDefault();
                  openDetails(contact);
                }}
                sx={{ cursor: contact.archivedAt ? 'default' : 'pointer' }}
              >
                <TableCell>
                  <Typography variant="body2" title={contact.id} sx={{ fontWeight: 800 }}>{contact.name}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{contact.phone || '-'}</Typography>
                  <Typography variant="caption" color="text.secondary">{contact.email || '-'}</Typography>
                </TableCell>
                {kind === 'customers' && 'sourceType' in contact ? <>
                  <TableCell><Typography variant="body2">{sourceLabel(contact)}</Typography></TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{contact.bookingIds.length}</Typography></TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{contact.dealIds.length}</Typography></TableCell>
                </> : <>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {collaboratorMeta[contact.id]?.typeName || 'Chưa phân loại'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{contact.userId ? 'Đã liên kết' : 'Chưa liên kết'}</Typography>
                  </TableCell>
                </>}
                <CmsActionsCell>{renderActions(contact)}</CmsActionsCell>
              </TableRow>)}</TableBody>
            </Table>
          </TableContainer>

          <Stack divider={<Divider />} sx={{ display: { xs: 'flex', md: 'none' } }}>
            {contacts.map((contact) => <Box
              key={contact.id}
              role={contact.archivedAt ? undefined : 'button'}
              tabIndex={contact.archivedAt ? -1 : 0}
              onClick={() => { if (!contact.archivedAt) openDetails(contact); }}
              sx={{ p: 2, cursor: contact.archivedAt ? 'default' : 'pointer' }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'start', gap: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{contact.name}</Typography>
                  <Typography variant="body2">{contact.phone || '-'}</Typography>
                  {contact.email && <Typography variant="caption" color="text.secondary">{contact.email}</Typography>}
                </Box>
                {renderActions(contact)}
              </Stack>
              {kind === 'customers' && 'sourceType' in contact ? <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {sourceLabel(contact)} · {contact.bookingIds.length} lịch xem · {contact.dealIds.length} giao dịch
              </Typography> : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {collaboratorMeta[contact.id]?.typeName || 'Chưa phân loại CTV'} · {contact.userId ? 'Đã liên kết tài khoản' : 'Chưa liên kết tài khoản'}
              </Typography>}
            </Box>)}
          </Stack>
        </>}

      {query.data && <TablePagination
        component="div"
        count={totalContacts}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
        labelRowsPerPage="Số dòng:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        onPageChange={(_, value) => setPage(value)}
        onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
        sx={{ borderTop: 1, borderColor: 'divider' }}
      />}
    </CmsListCard>

    

    {selected && <ContactDetailsDialog
      contact={selected}
      canCreateBooking={canCreateBooking}
      canCreateDirectDeal={canCreateDirectDeal}
      onClose={closeDetails}
    />}
    {editor && <ContactEditorDialog kind={kind} contact={editor.contact} onClose={() => setEditor(null)} />}

    {allowArchive && <ConfirmDialog
      open={Boolean(archiveAction)}
      title={archiveAction?.archive ? 'Lưu trữ hồ sơ?' : 'Khôi phục hồ sơ?'}
      confirmLabel={archiveAction?.archive ? 'Lưu trữ' : 'Khôi phục'}
      loading={archiveMutation.isPending}
      description={archiveAction
        ? `Chuyển hồ sơ “${archiveAction.contact.name}” sang danh sách ${archiveAction.archive ? 'đã lưu trữ' : 'đang dùng'}?`
        : ''}
      onClose={() => setArchiveAction(null)}
      onConfirm={async () => {
        if (!archiveAction || archiveMutation.isPending) return;
        try {
          await archiveMutation.mutateAsync({ id: archiveAction.contact.id, archive: archiveAction.archive });
          toast.success(archiveAction.archive ? 'Đã lưu trữ hồ sơ.' : 'Đã khôi phục hồ sơ.');
          setArchiveAction(null);
        } catch (error) {
          toast.error(contactErrorMessage(error));
        }
      }}
    />}
  </Stack>;
}

