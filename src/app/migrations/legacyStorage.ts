const LEGACY_STORAGE_KEYS = [
  'tinyhouse_db_buildings_v4',
  'tinyhouse_db_rooms_v4',
  'tinyhouse_db_bookings_v4',
  'tinyhouse_db_ctvs_v4',
  'tinyhouse_db_blogs_v4',
  'tinyhouse_db_roles_v4',
  'tinyhouse_db_users_v4',
  'tinyhouse_db_current_user_v4',
  'tinyhouse_db_last_sync_timestamp_v4',
  'tinyhouse_db_audit_logs_v4',
  'tinyhouse_db_data_version_v4',
  'tinyhouse_cms_selected_building_for_rooms',
  'tiny_auth_epoch',
  'tinyhouse_jwt',
] as const;

const CLEANUP_MARKER =
  'tinyhouse_phase8_storage_cleanup_v2';

export function cleanupLegacyStorage() {
  try {
    if (
      localStorage.getItem(
        CLEANUP_MARKER,
      ) === 'done'
    ) {
      return;
    }

    for (
      const key of
      LEGACY_STORAGE_KEYS
    ) {
      localStorage.removeItem(key);
    }

    localStorage.setItem(
      CLEANUP_MARKER,
      'done',
    );
  } catch {
    // Storage may be unavailable in
    // private/locked browser contexts.
  }
}
