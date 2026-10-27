import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Link } from "react-router";
import { designTokens } from "../../app/theme/tokens";
import type { CmsNavigationItem } from "./CmsShell";

type CmsSidebarProps = {
  navigation: CmsNavigationItem[];
  activeSection: string;
  collapsed: boolean;
  navigationId: string;
  mobile?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
  onToggleCollapse?: () => void;
};

const { colors, layout } = designTokens;

export function CmsSidebar({
  navigation,
  activeSection,
  collapsed,
  navigationId,
  mobile = false,
  onNavigate,
  onClose,
  onToggleCollapse,
}: CmsSidebarProps) {
  const groups = [...new Set(navigation.map((item) => item.group))];
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const renderNavigationItem = (
    item: CmsNavigationItem,
    child = false,
    parentHasActiveChild = false,
    dropdown?: {
      expanded: boolean;
      onToggle: () => void;
    },
  ) => {
    const active = item.code === activeSection;
    const Icon = item.icon;
    return (
      <Tooltip
        key={item.code}
        title={collapsed ? item.label : ""}
        placement="right"
        arrow
      >
        <ListItemButton
          component={Link}
          to={item.path}
          selected={active}
          onClick={onNavigate}
          aria-label={collapsed ? item.label : undefined}
          aria-current={active ? "page" : undefined}
          sx={{
            minHeight: child ? 38 : 46,
            px: collapsed ? 0 : child ? 1.25 : 1.5,
            ml: child ? 3.5 : 0,
            borderRadius: 1.5,
            justifyContent: collapsed ? "center" : "flex-start",
            color: parentHasActiveChild
              ? colors.neutral[0]
              : child
                ? colors.neutral[400]
                : colors.neutral[300],
            gap: collapsed ? 0 : child ? 1 : 1.5,
            borderLeft: child ? `1px solid ${colors.navy[700]}` : "none",
            transition: "background-color 150ms ease",
            "&:hover": { bgcolor: colors.navy[800], color: colors.neutral[0] },
            "&.Mui-selected, &.Mui-selected:hover": {
              bgcolor: colors.brand[500],
              color: colors.neutral[0],
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 0, color: "inherit", display: "flex", justifyContent: "center" }}>
            <Icon size={child ? 16 : 20} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
          </ListItemIcon>
          {!collapsed && (
            <Typography component="span" sx={{ minWidth: 0, flex: 1, fontSize: child ? 12.5 : 13, fontWeight: active ? 700 : 500, lineHeight: 1.45 }}>
              {item.label}
            </Typography>
          )}
          {!collapsed && dropdown && (
            <Box
              component="span"
              role="button"
              tabIndex={0}
              aria-label={dropdown.expanded ? `Thu gọn ${item.label}` : `Mở rộng ${item.label}`}
              aria-expanded={dropdown.expanded}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                dropdown.onToggle();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                dropdown.onToggle();
              }}
              sx={{
                width: 32,
                height: 32,
                ml: 0.5,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: 1,
                color: "inherit",
                "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
              }}
            >
              <ChevronDown
                size={16}
                aria-hidden="true"
                style={{
                  transform: dropdown.expanded ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 150ms ease",
                }}
              />
            </Box>
          )}
        </ListItemButton>
      </Tooltip>
    );
  };
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: colors.navy[950],
        color: colors.neutral[0],
        "& a:focus-visible, & button:focus-visible": {
          outline: `3px solid ${colors.brand[200]}`,
          outlineOffset: -3,
        },
        "@media (prefers-reduced-motion: reduce)": {
          "& *": { transition: "none", animation: "none" },
        },
      }}
    >
      <Box
        sx={{
          height: layout.headerHeight,
          flexShrink: 0,
          px: collapsed ? 2 : 2.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderBottom: `1px solid ${colors.navy[800]}`,
        }}
      >
        <Box
          component={Link}
          to={navigation[0]?.path || "/cms"}
          onClick={onNavigate}
          aria-label="Homelax - trang quản trị"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            color: "inherit",
            textDecoration: "none",
            minWidth: 0,
            minHeight: 44,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              bgcolor: colors.brand[500],
              color: colors.neutral[0],
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Box
              component="img"
              src="/logo-icon.png"
              alt=""
              sx={{ width: 30, height: 30, objectFit: "contain" }}
            />
          </Box>
          {!collapsed && (
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="span"
                sx={{
                  display: "block",
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 0.7,
                  lineHeight: 1.4,
                }}
              >
                HOMELAX
              </Typography>
              <Typography
                component="span"
                sx={{
                  color: colors.neutral[400],
                  fontSize: 11,
                  letterSpacing: 1,
                }}
              ></Typography>
            </Box>
          )}
        </Box>
        {mobile && (
          <IconButton
            onClick={onClose}
            aria-label="Đóng menu"
            sx={{
              ml: "auto",
              color: colors.neutral[300],
              width: 44,
              height: 44,
            }}
          >
            <X size={20} />
          </IconButton>
        )}
      </Box>

      <Box
        component="nav"
        id={navigationId}
        aria-label="Điều hướng quản trị"
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: `${colors.navy[700]} transparent`,
          "&::-webkit-scrollbar": {
            width: 8,
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: colors.navy[700],
            border: `2px solid ${colors.navy[950]}`,
            borderRadius: 999,
          },
          "&::-webkit-scrollbar-thumb:hover": {
            backgroundColor: colors.neutral[500],
          },
          px: collapsed ? 1.5 : 2,
          py: 2,
        }}
      >
        {groups.map((group, index) => (
          <Box key={group} sx={{ mb: 2.5 }}>
            {collapsed ? (
              index > 0 && (
                <Divider sx={{ my: 2, borderColor: colors.navy[700] }} />
              )
            ) : (
              <Typography
                component="p"
                variant="overline"
                sx={{
                  px: 1.5,
                  mb: 1,
                  display: "block",
                  color: colors.neutral[400],
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                }}
              >
                {group}
              </Typography>
            )}
            <List
              component="div"
              disablePadding
              sx={{ display: "grid", gap: 0.5 }}
            >
              {navigation
                .filter((item) => item.group === group && !item.parentCode)
                .map((item) => {
                  const children = navigation.filter(
                    (child) => child.group === group && child.parentCode === item.code,
                  );
                  const hasActiveChild = children.some(
                    (child) => child.code === activeSection,
                  );
                  const manuallyExpanded = expandedParents[item.code] ?? false;
                  const expanded =
                    item.code === activeSection
                    || hasActiveChild
                    || manuallyExpanded;
                  return (
                    <Box key={item.code}>
                      {renderNavigationItem(
                        item,
                        false,
                        hasActiveChild,
                        children.length > 0
                          ? {
                              expanded,
                              onToggle: () => setExpandedParents((current) => ({
                                ...current,
                                [item.code]: !(current[item.code] ?? false),
                              })),
                            }
                          : undefined,
                      )}
                      {!collapsed && expanded && children.length > 0 && (
                        <Box sx={{ display: "grid", gap: 0.35, mt: 0.35, mb: 0.5 }}>
                          {children.map((child) => renderNavigationItem(child, true))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
            </List>
          </Box>
        ))}
      </Box>

      {!mobile && (
        <Box
          sx={{
            flexShrink: 0,
            minHeight: 66,
            px: collapsed ? 2 : 2.5,
            borderTop: `1px solid ${colors.navy[800]}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Tooltip
            title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
            placement="right"
          >
            <IconButton
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
              aria-expanded={!collapsed}
              aria-controls={navigationId}
              sx={{
                width: 40,
                height: 44,
                color: colors.neutral[300],
                "&:hover": {
                  bgcolor: colors.navy[800],
                  color: colors.neutral[0],
                },
              }}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
