import { designTokens } from './tokens';

/** Compatibility alias: public consumers share the exact CMS brand token. */
export const publicBrand = {
  orange: designTokens.colors.brand[500],
} as const;
