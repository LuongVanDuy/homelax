/**
 * Tailwind v4 compatibility conventions.
 * Prefix is configured as prefix(tw), so prefix must come before variants:
 * tw:flex, tw:md:grid, tw:hover:bg-...
 */
export const layoutClasses = {
  publicPage:
    'tw:min-h-screen tw:bg-slate-50 tw:text-slate-800',
  adminPage:
    'tw:min-h-screen tw:bg-slate-100 tw:text-slate-800',
  publicContainer:
    'tw:mx-auto tw:w-full tw:max-w-[1240px] tw:px-4 tw:sm:px-5 tw:lg:px-6',
  adminContainer:
    'tw:mx-auto tw:w-full tw:max-w-[1440px] tw:px-4 tw:md:px-6 tw:xl:px-8',
  section:
    'tw:py-6 tw:md:py-8',
  sectionCompact:
    'tw:py-4 tw:md:py-6',
  stack:
    'tw:flex tw:flex-col tw:gap-4',
  stackTight:
    'tw:flex tw:flex-col tw:gap-2',
  inline:
    'tw:flex tw:flex-wrap tw:items-center tw:gap-3',
  grid2:
    'tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2',
  grid3:
    'tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2 tw:xl:grid-cols-3',
  grid4:
    'tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:xl:grid-cols-4',
  sidebar:
    'tw:grid tw:grid-cols-1 tw:gap-6 tw:lg:grid-cols-[280px_minmax(0,1fr)]',
  split:
    'tw:grid tw:grid-cols-1 tw:gap-6 tw:lg:grid-cols-2',
} as const;

export type LayoutClassName = keyof typeof layoutClasses;
