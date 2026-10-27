import { useBlogCategories } from '../../features/blog/blog.api';
import { publicHref } from '../../app/router/publicNavigation';
import { publicBrand } from '../../app/theme/publicBrand';
import { useId, useState, type MouseEvent, type ReactNode } from 'react';
import { Box, Button, Divider, Drawer, IconButton, Menu, MenuItem, Skeleton, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Calendar, Heart, House, ImagePlus, ChevronDown, KeyRound, LayoutDashboard, LogOut, Menu as MenuIcon, UserRound, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { PublicLink } from '../../app/router/PublicLink';
import { canAccessCms } from '../../features/auth/adminAccess';
import { canUseCtvTools, ctvToolPaths } from '../../features/affiliate/ctvTools';
import { getPublicLoginUrl } from '../../features/auth/publicAccess';
import type { AppIdentity } from '../../features/auth/identityStore';
import { designTokens as tokens } from '../../app/theme/tokens';
import { isPublicHeaderLinkActive, publicHeaderGroupsWithCategories, publicHeaderLinks } from './headerNavigation';
import Logo from '../brand/Logo';

const focusStyles = {
  '& :is(a,button):focus-visible': { outline: `3px solid ${publicBrand.orange}`, outlineOffset: 2 },
  '& .MuiButton-root': { minHeight: 44, textTransform: 'none' },
  '& .MuiMenuItem-root': { minHeight: 44, gap: 1.5, whiteSpace: 'normal' },
};
const navStyle = { color: 'text.primary', fontSize: '0.9375rem', px: 1.5, whiteSpace: 'nowrap',
  '&[aria-current], &[data-active="true"]': { color: publicBrand.orange, bgcolor: tokens.colors.neutral[50], fontWeight: 700 },
};

export default function Header({ currentUser, onLogout, sessionReady = true, sessionError = false, onRetrySession }: {
  currentUser: AppIdentity; onLogout: () => void | Promise<void>; sessionReady?: boolean;
  sessionError?: boolean; onRetrySession?: () => void;
}) {
  const categories = useBlogCategories();
  const headerGroups = publicHeaderGroupsWithCategories(categories.data || []);
  const location = useLocation();
  const navigate = useNavigate();
  const desktop = useMediaQuery(useTheme().breakpoints.up('xl'));
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const id = useId();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdown, setDropdown] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const active = (to: string) => isPublicHeaderLinkActive(to, location.pathname, location.search);
  const closeNavigation = () => { setMobileOpen(false); setDropdown(null); };

  const context = `${location.key}:${desktop}:${currentUser?.id || 'guest'}:${sessionReady}:${sessionError}`;
  const [navigationContext, setNavigationContext] = useState(context);
  // Reset overlays when history or the layout changes, including browser Back.
  if (navigationContext !== context) {
    setNavigationContext(context);
    setMobileOpen(false);
    setDropdown(null);
  }
  const openMenu = (name: string, anchor: HTMLElement) => setDropdown({ id: name, anchor });
  const openAction = (action: 'bookings' | 'password') => {
    closeNavigation();
    if (action === 'bookings') navigate(publicHref('/tai-khoan/lich-xem-phong', location.search));
    else navigate(publicHref('/tai-khoan?edit=password', location.search));
  };
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    closeNavigation();
    try { await onLogout(); } finally { setLoggingOut(false); }
  };
  const loginLink = <Button component={PublicLink}
    to={getPublicLoginUrl(`${location.pathname}${location.search}${location.hash}`)} onClick={closeNavigation}
    variant="outlined" startIcon={<UserRound size={18} />} sx={{ minHeight: 44 }}>Đăng nhập</Button>;
  const sessionFailure = <Button onClick={onRetrySession} disabled={!onRetrySession} sx={{ minHeight: 44 }}
    title="Chưa xác minh được phiên đăng nhập" aria-label="Thử lại kiểm tra phiên đăng nhập">Thử lại phiên</Button>;
  const accountActions = (mobile = false) => {
    const action = (key: string, label: string, icon: ReactNode, onClick: () => void, danger = false) => mobile
      ? <Button key={key} onClick={onClick} disabled={key === 'logout' && loggingOut} startIcon={icon}
          sx={{ justifyContent: 'flex-start', color: danger ? 'error.main' : 'text.primary', px: 1.5 }}>{label}</Button>
      : <MenuItem key={key} onClick={onClick} disabled={key === 'logout' && loggingOut} sx={{ color: danger ? 'error.main' : 'text.primary' }}>{icon}{label}</MenuItem>;
    const workspaceLabel = currentUser?.roleCode === 'ctv_sale' ? 'Không gian CTV' : 'Vào CMS';
    return [
      action('profile', 'Hồ sơ cá nhân', <UserRound size={18} aria-hidden="true" />, () => { closeNavigation(); navigate(publicHref('/tai-khoan', location.search)); }),
      action('favorites', 'Căn yêu thích', <Heart size={18} aria-hidden="true" />, () => { closeNavigation(); navigate(publicHref('/tai-khoan/yeu-thich', location.search)); }),
      action('rentals', 'Phòng đã thuê', <House size={18} aria-hidden="true" />, () => { closeNavigation(); navigate(publicHref('/tai-khoan/phong-da-thue', location.search)); }),
      action('bookings', 'Lịch hẹn của tôi', <Calendar size={18} aria-hidden="true" />, () => openAction('bookings')),
      canAccessCms(currentUser) && (mobile
        ? <Button key="cms" component={PublicLink} to={canUseCtvTools(currentUser) ? ctvToolPaths.customers : "/cms"} onClick={closeNavigation} startIcon={<LayoutDashboard size={18} aria-hidden="true" />} sx={{ justifyContent: 'flex-start', color: 'text.primary', px: 1.5 }}>{workspaceLabel}</Button>
        : <MenuItem key="cms" component={PublicLink} to={canUseCtvTools(currentUser) ? ctvToolPaths.customers : "/cms"} onClick={closeNavigation}><LayoutDashboard size={18} aria-hidden="true" />{workspaceLabel}</MenuItem>),
      canUseCtvTools(currentUser) && action('sales-image', 'Tạo ảnh bán phòng', <ImagePlus size={18} aria-hidden="true" />, () => { closeNavigation(); navigate(ctvToolPaths.salesImage); }),
      action('password', 'Đổi mật khẩu', <KeyRound size={18} aria-hidden="true" />, () => openAction('password')),
      <Divider key="divider" />,
      action('logout', 'Đăng xuất', <LogOut size={18} aria-hidden="true" />, () => { void logout(); }, true),
    ];
  };
  const group = headerGroups.find(item => item.id === dropdown?.id);

  return <>
    <Box component="header" data-testid="public-header" sx={{ ...focusStyles, position: 'sticky', top: 0, zIndex: theme => theme.zIndex.appBar,
      bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
      fontFamily: tokens.typography.fontFamily }}>
      <Box sx={{ maxWidth: tokens.layout.publicContentMax, mx: 'auto', px: { xs: 2, sm: 3 }, gap: { xs: 1, xl: 2 }, display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', xl: 'minmax(0, 1fr) auto minmax(0, 1fr)' },
        minHeight: { xs: 64, xl: 72 }, alignItems: 'center' }}>
        <PublicLink to="/" aria-label="Homelax - Trang chủ" onClick={closeNavigation} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, justifySelf: 'start' }}><Logo size={44} /></PublicLink>
        <Stack component="nav" aria-label="Điều hướng chính" direction="row" sx={{ display: { xs: 'none', xl: 'flex' }, alignItems: 'center', gap: 3 }}>
          {publicHeaderLinks.map(link => <Button key={link.to} component={PublicLink} to={link.to} aria-current={active(link.to) ? 'page' : undefined} sx={navStyle}>{link.label}</Button>)}
          {headerGroups.map(item => <Button key={item.id} id={`${id}-${item.id}-trigger`} aria-haspopup="menu"
            aria-controls={dropdown?.id === item.id ? `${id}-dropdown` : undefined} aria-expanded={dropdown?.id === item.id}
            data-active={item.links.some(link => active(link.to)) || (item.id === 'news' && location.pathname.startsWith('/tin-tuc/'))}
            onClick={(event: MouseEvent<HTMLButtonElement>) => openMenu(item.id, event.currentTarget)}
            onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); openMenu(item.id, event.currentTarget); } }}
            endIcon={<ChevronDown size={16} aria-hidden="true" />} sx={navStyle}>{item.label}</Button>)}
        </Stack>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', minWidth: 0, justifySelf: 'end' }}>
          <Box sx={{ display: { xs: 'none', xl: 'block' } }}>
            {!sessionReady ? <Skeleton width={140} height={44} aria-label="Đang kiểm tra phiên đăng nhập" /> : sessionError ? sessionFailure : currentUser ?
              <Button id={`${id}-account-trigger`} aria-label="Tài khoản" aria-haspopup="menu" aria-expanded={dropdown?.id === 'account'}
                aria-controls={dropdown?.id === 'account' ? `${id}-dropdown` : undefined}
                onClick={event => openMenu('account', event.currentTarget)}
                onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); openMenu('account', event.currentTarget); } }}
                startIcon={<UserRound size={18} aria-hidden="true" />} endIcon={<ChevronDown size={16} aria-hidden="true" />} sx={{ ...navStyle, maxWidth: 180 }}>
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(currentUser.name || 'Tài khoản')}</Box>
              </Button> : loginLink}
          </Box>
          <IconButton aria-label="Mở menu" aria-haspopup="dialog" aria-expanded={mobileOpen} aria-controls={mobileOpen ? `${id}-mobile` : undefined}
            onClick={() => setMobileOpen(true)} sx={{ display: { xs: 'inline-flex', xl: 'none' }, width: 44, height: 44, color: 'text.primary' }}><MenuIcon size={24} /></IconButton>
        </Stack>
      </Box>
    </Box>
    <Menu id={`${id}-dropdown`} transitionDuration={reduceMotion ? 0 : undefined} anchorEl={dropdown?.anchor} open={Boolean(dropdown) && desktop} onClose={() => setDropdown(null)}
      slotProps={{ list: { 'aria-labelledby': `${id}-${dropdown?.id}-trigger` }, paper: { sx: { ...focusStyles, minWidth: 240, maxWidth: 'calc(100vw - 32px)', mt: 1 } } }}>
      {group ? group.links.map(link => <MenuItem key={link.to} component={PublicLink} to={link.to} selected={active(link.to)}
        aria-current={active(link.to) ? 'page' : undefined} onClick={() => setDropdown(null)}>{link.label}</MenuItem>) :
        [<MenuItem key="identity" disabled sx={{ '&.Mui-disabled': { opacity: 1 }, display: 'block', maxWidth: 300, overflowWrap: 'anywhere' }}>
          <Typography sx={{ fontWeight: 700 }}>{String(currentUser?.name || 'Tài khoản')}</Typography>
          <Typography variant="body2" color="text.secondary">{String(currentUser?.roleName || currentUser?.roleCode || '')}</Typography>
        </MenuItem>, ...accountActions()]}

    </Menu>
    <Drawer anchor="right" transitionDuration={reduceMotion ? 0 : undefined} open={mobileOpen && !desktop} onClose={() => setMobileOpen(false)}
      slotProps={{ paper: { id: `${id}-mobile`, role: 'dialog', 'aria-modal': true, 'aria-label': 'Menu điều hướng',
        sx: { ...focusStyles, width: 'min(360px, 100vw)', p: 2, pb: 'max(16px, env(safe-area-inset-bottom))', overflowY: 'auto' } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography component="h2" sx={{ fontWeight: 800 }}>Menu</Typography>
        <IconButton autoFocus aria-label="Đóng menu" onClick={() => setMobileOpen(false)} sx={{ width: 44, height: 44 }}><X size={24} /></IconButton>
      </Stack>
      <Stack component="nav" aria-label="Điều hướng mobile" sx={{ gap: 0.5 }}>
        {publicHeaderLinks.map(link => <Button key={link.to} component={PublicLink} to={link.to} aria-current={active(link.to) ? 'page' : undefined}
          onClick={closeNavigation} sx={{ ...navStyle, justifyContent: 'flex-start' }}>{link.label}</Button>)}
        {headerGroups.map(item => <Box key={item.id}>
          <Typography component="h3" variant="body2" sx={{ px: 1.5, pt: 2, pb: 0.5, fontWeight: 700, color: 'text.secondary' }}>{item.label}</Typography>
          {item.links.map(link => <Button key={link.to} component={PublicLink} to={link.to} fullWidth aria-current={active(link.to) ? 'page' : undefined}
            onClick={closeNavigation} sx={{ ...navStyle, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}>{link.label}</Button>)}
        </Box>)}
      </Stack>
      <Divider sx={{ my: 2 }} />
      {!sessionReady ? <Skeleton height={44} aria-label="Đang kiểm tra phiên đăng nhập" /> : sessionError ? sessionFailure : currentUser ?
        <Box><Typography sx={{ px: 1.5, pb: 1, fontWeight: 700, overflowWrap: 'anywhere' }}>{String(currentUser.name || 'Tài khoản')}</Typography>
          <Stack aria-label="Tài khoản">{accountActions(true)}</Stack></Box> : loginLink}
    </Drawer>
    {sessionReady && !sessionError && currentUser && <>
    </>}
  </>;
}
