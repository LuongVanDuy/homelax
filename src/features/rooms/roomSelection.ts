import { routeHref } from '../../app/router/routePaths.js';

/** Resolve only against the public units of the Type addressed by the route. */
export function resolveRoomUnit<T extends { id: string; status: string }>(units: T[], search: string): T | null {
  const publicUnits = units.filter(unit => unit.status !== 'archived');
  const unitId = new URLSearchParams(search).get('unitId');
  return publicUnits.find(unit => unit.id === unitId) || publicUnits[0] || null;
}

export function roomSelectionHref(roomTypeId: string, unitId: string | undefined, search = '', hash = '') {
  const params = new URLSearchParams(search);
  if (unitId) params.set('unitId', unitId);
  else params.delete('unitId');
  return `${routeHref.room(roomTypeId)}${params.size ? `?${params}` : ''}${hash}`;
}
