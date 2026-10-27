import { useMemo, useState } from 'react';
import type { AppIdentity } from '../../auth/identityStore';
import { useRolesQuery } from '../../roles/api';
import { useCommissionCollaboratorsQuery } from '../../commission-config/api';
import { useUsersPageQuery } from '../../users/api';
import { UserEditorDialog } from '../../users/components/UserEditorDialog';
import { ContactsPage } from '../components/ContactsPage';
import type { ContactSummary } from '../contact.types';

export function CollaboratorsPage({ currentUser }: { currentUser: AppIdentity }) {
  const rolesQuery = useRolesQuery();
  const commissionCollaboratorsQuery = useCommissionCollaboratorsQuery();
  const [editorUserId, setEditorUserId] = useState<string | null>(null);
  const lookupUser = Boolean(editorUserId && editorUserId !== 'new');
  const usersQuery = useUsersPageQuery({
    page: 1,
    pageSize: 2,
    search: lookupUser ? editorUserId || '' : '',
    sort: 'createdAt',
    order: 'desc',
  }, lookupUser);
  const ctvRoles = useMemo(
    () => (rolesQuery.data || []).filter((role) => role.code === 'ctv_sale'),
    [rolesQuery.data],
  );
  const selectedUser = editorUserId && editorUserId !== 'new'
    ? (usersQuery.data?.items || []).find((user) => user.id === editorUserId)
    : undefined;

  const editCollaborator = (contact: ContactSummary) => {
    if (contact.userId) setEditorUserId(contact.userId);
  };

  const showEditor = editorUserId === 'new' || Boolean(selectedUser);
  const collaboratorMeta = useMemo(() => Object.fromEntries(
    (commissionCollaboratorsQuery.data || []).map((item) => [
      item.id,
      {
        typeName: item.collaboratorTypeName,
        affiliateToken: item.affiliateToken,
      },
    ]),
  ), [commissionCollaboratorsQuery.data]);

  return <>
    <ContactsPage
      kind="collaborators"
      allowArchive={false}
      collaboratorMeta={collaboratorMeta}
      onCreate={() => setEditorUserId('new')}
      onEdit={editCollaborator}
    />
    {showEditor && <UserEditorDialog
      user={selectedUser}
      roles={ctvRoles}
      currentUserId={String(currentUser?.id || '')}
      initialRoleCode="ctv_sale"
      lockRole
      title={selectedUser ? 'Chỉnh sửa cộng tác viên' : 'Thêm cộng tác viên'}
      onClose={() => setEditorUserId(null)}
    />}
  </>;
}
