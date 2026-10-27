import { designTokens } from '../../app/theme/tokens';

// One box treatment across profile, favorites, bookings and rentals.
export const accountCardSx = {
  border: '1px solid',
  borderColor: designTokens.colors.neutral[200],
  borderRadius: `${designTokens.radius.md}px`,
  boxShadow: designTokens.shadows.xs,
  bgcolor: 'background.paper',
};
