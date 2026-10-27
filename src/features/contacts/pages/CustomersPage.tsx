import type { AppIdentity } from '../../auth/identityStore';
import { ContactsPage } from '../components/ContactsPage';

export function CustomersPage({ currentUser }: { currentUser: AppIdentity }) {
  return <ContactsPage
    kind="customers"
    canCreateBooking={currentUser?.bookingScope === 'all'}
    canCreateDirectDeal={Boolean(currentUser?.dealCanCreate && currentUser?.dealCanCreateDirect)}
  />;
}
