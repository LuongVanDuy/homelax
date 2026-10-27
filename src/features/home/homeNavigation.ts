import { defaultPublicSearch, readPublicSearch, selectedSchoolIds, writePublicSearch } from '../../app/router/publicSearch';

/** Submit only Home's three quick filters; preserve referral and external query tags. */
export function homeSearchHref(search: string) {
  const filters = readPublicSearch(search);
  const { ward, minPrice, maxPrice } = filters;
  const schoolId = selectedSchoolIds(filters)[0] || 'all';
  return `/tim-phong${writePublicSearch({ ...defaultPublicSearch, ward, schoolId, minPrice, maxPrice }, search)}`;
}
