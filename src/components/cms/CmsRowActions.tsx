import { useId, useState, type ReactNode } from 'react';
import { Box, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { MoreVertical } from 'lucide-react';

export type CmsRowAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
};

export function CmsRowActions({ actions, disabled = false }: { actions: CmsRowAction[]; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const visible = actions.filter((action) => !action.hidden);
  const inline = visible.slice(0, 3);
  const overflow = visible.slice(3);
  if (!visible.length) return null;
  return <Box onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}
    sx={{ display: 'flex', gap: .25, justifyContent: 'flex-end', flexShrink: 0, '& svg': { width: 18, height: 18 } }}>
    {inline.map((action) => <Tooltip key={action.id} title={action.disabledReason || action.label}>
      <span><IconButton aria-label={action.label} disabled={disabled || action.disabled}
        {...(action.href ? { component: 'a', href: disabled || action.disabled ? undefined : action.href, target: action.external ? '_blank' : undefined, rel: action.external ? 'noopener noreferrer' : undefined } : {})}
        onClick={action.onClick} sx={{ width: 40, height: 40, color: action.danger ? 'error.main' : 'text.secondary', '@media (pointer: coarse)': { width: 44, height: 44 } }}>
        {action.icon}
      </IconButton></span>
    </Tooltip>)}
    {overflow.length > 0 && <>
      <Tooltip title="Thao tác khác"><IconButton aria-label="Thao tác khác" aria-haspopup="menu"
        aria-controls={anchor ? id : undefined} aria-expanded={anchor ? true : undefined} disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget)} sx={{ width: 40, height: 40, '@media (pointer: coarse)': { width: 44, height: 44 } }}>
        <MoreVertical />
      </IconButton></Tooltip>
      <Menu id={id} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {overflow.map((action) => <MenuItem key={action.id} disabled={disabled || action.disabled}
          {...(action.href ? { component: 'a', href: action.href, target: action.external ? '_blank' : undefined, rel: action.external ? 'noopener noreferrer' : undefined } : {})}
          onClick={() => { setAnchor(null); action.onClick?.(); }} sx={{ color: action.danger ? 'error.main' : 'text.primary', minHeight: 44 }}>
          <ListItemIcon sx={{ color: 'inherit' }}>{action.icon}</ListItemIcon>
          <ListItemText primary={action.label} secondary={action.disabledReason} />
        </MenuItem>)}
      </Menu>
    </>}
  </Box>;
}
