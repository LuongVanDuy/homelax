import { Link, useLocation, type LinkProps } from 'react-router';
import { publicHref } from './publicNavigation';

export function PublicLink({ to, ...props }: Omit<LinkProps, 'to'> & { to: string }) {
  const { search } = useLocation();
  return <Link {...props} to={publicHref(to, search)} />;
}
