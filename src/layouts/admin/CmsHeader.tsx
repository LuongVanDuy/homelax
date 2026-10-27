import { useId, useState } from 'react';
import { Avatar, Box, Breadcrumbs, Button, ButtonBase, Divider, IconButton, ListItemIcon, Menu, MenuItem, Stack, Typography, useMediaQuery } from '@mui/material';
import { ChevronDown, ChevronRight, ExternalLink, LogOut, Menu as MenuIcon, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { designTokens } from '../../app/theme/tokens';
import type { CmsShellUser } from './CmsShell';

type CmsHeaderProps = {
  user: CmsShellUser;
  title: string;
  group: string;
  sidebarWidth: number;
  mobileOpen: boolean;
  onOpenMenu: () => void;
  onProfile: () => void;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
};

const { colors, layout, zIndex } = designTokens;

export function CmsHeader({ user, title, group, sidebarWidth, mobileOpen, onOpenMenu, onProfile, onLogout, loggingOut }: CmsHeaderProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const menuId = useId();
  const buttonId = `${menuId}-button`;
  const name = String(user.name || user.email || 'Tài khoản');
  const role = String(user.roleName || user.roleCode || 'Thành viên');
  const parts = name.trim().split(/\s+/);
  const initials = `${parts[0]?.[0] || 'T'}${parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : ''}`.toUpperCase();

  return (
    <Box component="header" sx={{
      position: 'fixed', top: 0, left: { xs: 0, lg: sidebarWidth }, right: 0, zIndex: zIndex.header,
      height: layout.headerHeight, bgcolor: colors.neutral[0], borderBottom: `1px solid ${colors.neutral[200]}`,
      display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, px: { xs: 1.5, sm: 3, xl: 4 },
      transition: 'left 180ms ease',
    }}>
      <IconButton onClick={onOpenMenu} aria-label="Mở menu quản trị" aria-expanded={mobileOpen} aria-controls="cms-mobile-navigation"
        sx={{ display: { xs: 'inline-flex', lg: 'none' }, width: 44, height: 44, flexShrink: 0, color: colors.navy[900] }}><MenuIcon size={22} /></IconButton>
      <Breadcrumbs aria-label="Vị trí hiện tại" separator={<ChevronRight size={13} aria-hidden="true" />}
        sx={{ minWidth: 0, flex: 1, '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' }, '& .MuiBreadcrumbs-li:last-child': { minWidth: 0 }, '& .MuiBreadcrumbs-li:first-of-type': { display: { xs: 'none', sm: 'list-item' } }, '& .MuiBreadcrumbs-separator': { display: { xs: 'none', sm: 'flex' }, mx: 0.75 } }}>
        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' }, whiteSpace: 'nowrap' }}>{group}</Typography>
        <Typography component="p" noWrap sx={{ fontSize: { xs: 15, sm: 17 }, fontWeight: 700, color: colors.navy[900], m: 0 }}>{title}</Typography>
      </Breadcrumbs>
      <Button component={Link} to="/" color="secondary" startIcon={<ExternalLink size={16} aria-hidden="true" />}
        sx={{ display: { xs: 'none', md: 'inline-flex' }, flexShrink: 0, minHeight: 44, px: 1.5, fontSize: 12.5 }}>Về trang web</Button>
      <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' }, my: 2.5 }} />
      <ButtonBase id={buttonId} onClick={(event) => setAnchor(event.currentTarget)} disabled={loggingOut}
        aria-label={`Tài khoản ${name}`} aria-haspopup="menu" aria-expanded={Boolean(anchor)} aria-controls={anchor ? menuId : undefined} aria-busy={loggingOut}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48, minWidth: 44, p: 0.5, borderRadius: 1.5, flexShrink: 0, textAlign: 'left', '&:hover': { bgcolor: colors.neutral[50] }, '&.Mui-disabled': { opacity: 0.6 } }}>
        <Avatar src={typeof user.avatar === 'string' ? user.avatar : undefined} alt={name} sx={{ width: 36, height: 36, fontSize: 13, fontWeight: 800, bgcolor: colors.brand[100], color: colors.navy[950] }}>{initials}</Avatar>
        <Stack sx={{ display: { xs: 'none', sm: 'flex' }, maxWidth: { sm: 120, xl: 190 }, gap: 0.25 }}>
          <Typography noWrap component="span" sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{name}</Typography>
          <Typography noWrap component="span" variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>{role}</Typography>
        </Stack>
        <ChevronDown size={15} aria-hidden="true" />
      </ButtonBase>
      <Menu id={menuId} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        transitionDuration={reducedMotion ? 0 : undefined}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ list: { 'aria-labelledby': buttonId }, paper: { sx: { minWidth: 240, maxWidth: 'calc(100vw - 32px)', mt: 1, border: `1px solid ${colors.neutral[200]}`, boxShadow: designTokens.shadows.lg, '& .MuiMenuItem-root': { minHeight: 44, fontSize: 13 }, '& .MuiMenuItem-root:focus-visible': { outline: `2px solid ${colors.brand[500]}`, outlineOffset: -2 } } } }}>
        <Box component="li" role="presentation" sx={{ px: 2, py: 1 }}>
          <Typography noWrap sx={{ fontWeight: 700, fontSize: 13, maxWidth: 280 }}>{name}</Typography>
          <Typography noWrap color="text.secondary" variant="caption" sx={{ display: 'block', maxWidth: 280 }}>{role}</Typography>
        </Box>
        <Divider />
        <MenuItem disabled={loggingOut} onClick={() => { setAnchor(null); onProfile(); }}><ListItemIcon><UserRound size={18} /></ListItemIcon>Thông tin tài khoản</MenuItem>
        <MenuItem component={Link} to="/" onClick={() => setAnchor(null)} sx={{ display: { xs: 'flex', md: 'none' } }}><ListItemIcon><ExternalLink size={18} /></ListItemIcon>Về trang web</MenuItem>
        <Divider />
        <MenuItem disabled={loggingOut} onClick={() => { void onLogout(); }} sx={{ color: '#B91C1C' }}>
          <ListItemIcon sx={{ color: 'inherit' }}><LogOut size={18} /></ListItemIcon>{loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </MenuItem>
      </Menu>
    </Box>
  );
}
