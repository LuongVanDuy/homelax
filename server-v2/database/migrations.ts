export type DatabaseMigration = {
  id: string;
  sql: string;
};

// Keep applied entries immutable. Add a new migration to evolve the schema.
// This compiled registry is shared by existing databases and fresh installs.
export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    id: '20260923_001_customer_collaborator_profiles',
    sql: `
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        age INTEGER CHECK (age >= 0),
        age_recorded_at DATE,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT customers_age_recorded_at_check CHECK (
          (age IS NULL AND age_recorded_at IS NULL)
          OR (age IS NOT NULL AND age_recorded_at IS NOT NULL)
        )
      );

      CREATE INDEX IF NOT EXISTS idx_customers_archived_created_at
        ON customers (archived_at, created_at DESC);

      CREATE TABLE IF NOT EXISTS collaborators (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_collaborators_archived_created_at
        ON collaborators (archived_at, created_at DESC);
    `,
  },
  {
    id: '20260923_002_u03_contact_links_and_source',
    sql: `
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS source_channel TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS referred_by_collaborator_id TEXT REFERENCES collaborators(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS source_recorded_at TIMESTAMPTZ;

      ALTER TABLE collaborators
        ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS collaborator_id TEXT REFERENCES collaborators(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS source_channel TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS source_recorded_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers (user_id);
      CREATE INDEX IF NOT EXISTS idx_customers_referrer ON customers (referred_by_collaborator_id);
      CREATE INDEX IF NOT EXISTS idx_collaborators_user_id ON collaborators (user_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings (customer_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_collaborator_id ON bookings (collaborator_id);
    `,
  },
  {
    id: '20260923_003_ctv_profiles_follow_users',
    sql: `
      WITH ranked AS (
        SELECT id, user_id,
          row_number() OVER (
            PARTITION BY user_id
            ORDER BY (archived_at IS NULL) DESC, updated_at DESC, id
          ) AS rn
        FROM collaborators
        WHERE user_id IS NOT NULL
      )
      UPDATE collaborators AS c
      SET user_id = NULL,
          archived_at = COALESCE(c.archived_at, NOW()),
          updated_at = NOW()
      FROM ranked AS r
      WHERE c.id = r.id
        AND r.rn > 1;

      UPDATE collaborators
      SET archived_at = COALESCE(archived_at, NOW()),
          updated_at = NOW()
      WHERE user_id IS NULL
        AND archived_at IS NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_collaborators_user_id_unique
        ON collaborators (user_id);

      INSERT INTO collaborators (
        id, user_id, name, phone, email, address, notes, archived_at
      )
      SELECT
        'ctv_user_' || u.id,
        u.id,
        u.name,
        COALESCE(u.phone, ''),
        u.email,
        '',
        '',
        NULL
      FROM users AS u
      WHERE u.role_code = 'ctv_sale'
      ON CONFLICT (user_id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        archived_at = NULL,
        updated_at = NOW();

      UPDATE collaborators AS c
      SET archived_at = COALESCE(c.archived_at, NOW()),
          updated_at = NOW()
      FROM users AS u
      WHERE c.user_id = u.id
        AND u.role_code <> 'ctv_sale'
        AND c.archived_at IS NULL;
    `,
  },
  {
    id: '20260923_004_u04_1_building_core',
    sql: `
      ALTER TABLE buildings
        ADD COLUMN IF NOT EXISTS host_address TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    id: '20260923_005_u04_2_room_units',
    sql: `
      CREATE TABLE IF NOT EXISTS room_units (
        id TEXT PRIMARY KEY,
        room_type_id TEXT NOT NULL REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        building_id TEXT NOT NULL REFERENCES buildings(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'available'
          CHECK (status IN ('available', 'occupied', 'maintenance', 'archived')),
        available_from DATE,
        migration_source TEXT NOT NULL DEFAULT 'manual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_room_units_building_code_unique
        ON room_units (building_id, lower(code));
      CREATE INDEX IF NOT EXISTS idx_room_units_room_type_id ON room_units(room_type_id);
      CREATE INDEX IF NOT EXISTS idx_room_units_building_status ON room_units(building_id, status);
      CREATE INDEX IF NOT EXISTS idx_room_units_available_from ON room_units(available_from);

      CREATE TABLE IF NOT EXISTS room_unit_migration_review (
        id TEXT PRIMARY KEY,
        room_type_id TEXT NOT NULL REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE CASCADE,
        building_id TEXT NOT NULL REFERENCES buildings(id) ON UPDATE CASCADE ON DELETE CASCADE,
        source_field TEXT NOT NULL,
        candidate TEXT NOT NULL,
        legacy_status TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL CHECK (
          reason IN (
            'invalid_format',
            'duplicate_code_in_building',
            'legacy_status_requires_review'
          )
        ),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_room_unit_review_unique
        ON room_unit_migration_review (room_type_id, source_field, lower(candidate), reason);
      CREATE INDEX IF NOT EXISTS idx_room_unit_review_building
        ON room_unit_migration_review(building_id, reason);

      CREATE OR REPLACE FUNCTION rebuild_room_units_from_legacy()
      RETURNS void
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        WITH candidates AS (
          SELECT
            r.id AS room_type_id,
            r.building_id,
            btrim(item.value) AS candidate,
            'specific_rooms'::text AS source_field,
            COALESCE(r.status, '') AS legacy_status,
            COALESCE(r.available_from, '') AS legacy_available_from
          FROM rooms r
          CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(r.specific_rooms, '[]'::jsonb)
          ) AS item(value)
          WHERE r.building_id IS NOT NULL
            AND btrim(item.value) <> ''

          UNION ALL

          SELECT
            r.id,
            r.building_id,
            btrim(r.room_number),
            'room_number'::text,
            COALESCE(r.status, ''),
            COALESCE(r.available_from, '')
          FROM rooms r
          WHERE r.building_id IS NOT NULL
            AND jsonb_array_length(COALESCE(r.specific_rooms, '[]'::jsonb)) = 0
            AND btrim(COALESCE(r.room_number, '')) <> ''
            AND btrim(COALESCE(r.room_number, '')) NOT IN ('[]', '{}')
        ),
        annotated AS (
          SELECT
            c.*,
            (
              length(c.candidate) BETWEEN 1 AND 20
              AND c.candidate ~ '^[A-Za-z0-9]'
              AND c.candidate !~ '[^A-Za-z0-9._/-]'
              AND c.candidate ~ '[0-9]'
            ) AS safe_format,
            count(*) OVER (
              PARTITION BY c.building_id, lower(c.candidate)
            ) AS building_code_count
          FROM candidates c
        )
        INSERT INTO room_unit_migration_review (
          id, room_type_id, building_id, source_field,
          candidate, legacy_status, reason
        )
        SELECT
          'RUR-' || substr(
            md5(
              a.room_type_id || '|' || a.source_field || '|' ||
              lower(a.candidate) || '|' ||
              CASE
                WHEN NOT a.safe_format THEN 'invalid_format'
                WHEN a.building_code_count > 1 THEN 'duplicate_code_in_building'
                ELSE 'legacy_status_requires_review'
              END
            ),
            1,
            24
          ),
          a.room_type_id,
          a.building_id,
          a.source_field,
          a.candidate,
          a.legacy_status,
          CASE
            WHEN NOT a.safe_format THEN 'invalid_format'
            WHEN a.building_code_count > 1 THEN 'duplicate_code_in_building'
            ELSE 'legacy_status_requires_review'
          END
        FROM annotated a
        WHERE
          NOT a.safe_format
          OR a.building_code_count > 1
          OR lower(btrim(a.legacy_status)) NOT IN (
            'có sẵn', 'đã thuê', 'đang bảo trì', 'archived'
          )
        ON CONFLICT DO NOTHING;

        WITH candidates AS (
          SELECT
            r.id AS room_type_id,
            r.building_id,
            btrim(item.value) AS candidate,
            'specific_rooms'::text AS source_field,
            COALESCE(r.status, '') AS legacy_status,
            COALESCE(r.available_from, '') AS legacy_available_from
          FROM rooms r
          CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(r.specific_rooms, '[]'::jsonb)
          ) AS item(value)
          WHERE r.building_id IS NOT NULL
            AND btrim(item.value) <> ''

          UNION ALL

          SELECT
            r.id,
            r.building_id,
            btrim(r.room_number),
            'room_number'::text,
            COALESCE(r.status, ''),
            COALESCE(r.available_from, '')
          FROM rooms r
          WHERE r.building_id IS NOT NULL
            AND jsonb_array_length(COALESCE(r.specific_rooms, '[]'::jsonb)) = 0
            AND btrim(COALESCE(r.room_number, '')) <> ''
            AND btrim(COALESCE(r.room_number, '')) NOT IN ('[]', '{}')
        ),
        annotated AS (
          SELECT
            c.*,
            (
              length(c.candidate) BETWEEN 1 AND 20
              AND c.candidate ~ '^[A-Za-z0-9]'
              AND c.candidate !~ '[^A-Za-z0-9._/-]'
              AND c.candidate ~ '[0-9]'
            ) AS safe_format,
            count(*) OVER (
              PARTITION BY c.building_id, lower(c.candidate)
            ) AS building_code_count
          FROM candidates c
        )
        INSERT INTO room_units (
          id, room_type_id, building_id, code,
          status, available_from, migration_source
        )
        SELECT
          'RU-' || substr(
            md5(
              a.building_id || '|' || a.room_type_id || '|' ||
              lower(a.candidate)
            ),
            1,
            24
          ),
          a.room_type_id,
          a.building_id,
          a.candidate,
          CASE lower(btrim(a.legacy_status))
            WHEN 'có sẵn' THEN 'available'
            WHEN 'đã thuê' THEN 'occupied'
            WHEN 'đang bảo trì' THEN 'maintenance'
            WHEN 'archived' THEN 'archived'
          END,
          CASE
            WHEN length(a.legacy_available_from) = 10
              AND a.legacy_available_from ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN a.legacy_available_from::date
            ELSE NULL
          END,
          a.source_field
        FROM annotated a
        WHERE a.safe_format
          AND a.building_code_count = 1
          AND lower(btrim(a.legacy_status)) IN (
            'có sẵn', 'đã thuê', 'đang bảo trì', 'archived'
          )
        ON CONFLICT DO NOTHING;
      END;
      $function$;

      SELECT rebuild_room_units_from_legacy();

    `,
  },
  {
    id: '20260923_006_u04_3_room_type_lifecycle',
    sql: `
      ALTER TABLE rooms
        ADD COLUMN IF NOT EXISTS lifecycle_status TEXT;

      UPDATE rooms
      SET lifecycle_status = CASE
        WHEN lower(COALESCE(status, '')) IN ('archived', 'deleted')
          OR deleted_at IS NOT NULL
        THEN 'archived'
        ELSE 'active'
      END
      WHERE lifecycle_status IS NULL
         OR lifecycle_status NOT IN ('active', 'archived');

      ALTER TABLE rooms
        ALTER COLUMN lifecycle_status SET DEFAULT 'active',
        ALTER COLUMN lifecycle_status SET NOT NULL;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rooms_lifecycle_status_check'
        ) THEN
          ALTER TABLE rooms
            ADD CONSTRAINT rooms_lifecycle_status_check
            CHECK (lifecycle_status IN ('active', 'archived'));
        END IF;
      END;
      $block$;

      CREATE INDEX IF NOT EXISTS idx_rooms_lifecycle_status
        ON rooms (lifecycle_status);

      ALTER TABLE room_unit_migration_review
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS resolved_by TEXT,
        ADD COLUMN IF NOT EXISTS resolution_note TEXT NOT NULL DEFAULT '';

      CREATE INDEX IF NOT EXISTS idx_room_unit_review_unresolved
        ON room_unit_migration_review (building_id, reason, created_at)
        WHERE resolved_at IS NULL;
    `,
  },
  {
    id: '20260923_007_retire_room_unit_review_queue',
    sql: `
      DELETE FROM room_unit_migration_review;
    `,
  },
  {
    id: '20260923_008_u04_4_amenity_catalog',
    sql: `
      CREATE TABLE IF NOT EXISTS amenities (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        scope TEXT NOT NULL CHECK (scope IN ('building','room')),
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_amenities_scope_name
        ON amenities(scope, lower(btrim(name)));
      CREATE INDEX IF NOT EXISTS idx_amenities_scope_category_status
        ON amenities(scope, category, status, sort_order);

      CREATE TABLE IF NOT EXISTS building_amenities (
        building_id TEXT NOT NULL REFERENCES buildings(id) ON UPDATE CASCADE ON DELETE CASCADE,
        amenity_id TEXT NOT NULL REFERENCES amenities(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (building_id, amenity_id)
      );

      CREATE TABLE IF NOT EXISTS room_type_amenities (
        room_type_id TEXT NOT NULL REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE CASCADE,
        amenity_id TEXT NOT NULL REFERENCES amenities(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (room_type_id, amenity_id)
      );

      INSERT INTO amenities (
        id, code, name, scope, category, status, sort_order, source
      ) VALUES
        ('AMN-' || upper(substr(md5('building|thang máy'), 1, 16)), 'AMN-' || upper(substr(md5('building|thang máy'), 1, 16)), 'Thang máy', 'building', 'building_common', 'active', 10, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|wi-fi'), 1, 16)), 'AMN-' || upper(substr(md5('building|wi-fi'), 1, 16)), 'Wi-Fi', 'building', 'building_common', 'active', 20, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|máy giặt'), 1, 16)), 'AMN-' || upper(substr(md5('building|máy giặt'), 1, 16)), 'Máy giặt', 'building', 'building_common', 'active', 30, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|máy sấy'), 1, 16)), 'AMN-' || upper(substr(md5('building|máy sấy'), 1, 16)), 'Máy sấy', 'building', 'building_common', 'active', 40, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|sân phơi'), 1, 16)), 'AMN-' || upper(substr(md5('building|sân phơi'), 1, 16)), 'Sân phơi', 'building', 'building_common', 'active', 50, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|khu để xe'), 1, 16)), 'AMN-' || upper(substr(md5('building|khu để xe'), 1, 16)), 'Khu để xe', 'building', 'building_common', 'active', 60, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|bãi ô tô trong tòa nhà'), 1, 16)), 'AMN-' || upper(substr(md5('building|bãi ô tô trong tòa nhà'), 1, 16)), 'Bãi ô tô trong tòa nhà', 'building', 'building_common', 'active', 70, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|bãi ô tô gần tòa nhà'), 1, 16)), 'AMN-' || upper(substr(md5('building|bãi ô tô gần tòa nhà'), 1, 16)), 'Bãi ô tô gần tòa nhà', 'building', 'building_common', 'active', 80, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|khu sinh hoạt chung'), 1, 16)), 'AMN-' || upper(substr(md5('building|khu sinh hoạt chung'), 1, 16)), 'Khu sinh hoạt chung', 'building', 'building_common', 'active', 90, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|dọn vệ sinh chung'), 1, 16)), 'AMN-' || upper(substr(md5('building|dọn vệ sinh chung'), 1, 16)), 'Dọn vệ sinh chung', 'building', 'building_common', 'active', 100, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|thùng rác'), 1, 16)), 'AMN-' || upper(substr(md5('building|thùng rác'), 1, 16)), 'Thùng rác', 'building', 'building_common', 'active', 110, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|xe điện'), 1, 16)), 'AMN-' || upper(substr(md5('building|xe điện'), 1, 16)), 'Xe điện', 'building', 'building_common', 'active', 120, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|camera an ninh'), 1, 16)), 'AMN-' || upper(substr(md5('building|camera an ninh'), 1, 16)), 'Camera an ninh', 'building', 'building_security', 'active', 210, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|khóa vân tay/mã số/thẻ từ cổng ra vào'), 1, 16)), 'AMN-' || upper(substr(md5('building|khóa vân tay/mã số/thẻ từ cổng ra vào'), 1, 16)), 'Khóa vân tay/mã số/thẻ từ cổng ra vào', 'building', 'building_security', 'active', 220, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|khóa vân tay/mã số/thẻ từ thang máy'), 1, 16)), 'AMN-' || upper(substr(md5('building|khóa vân tay/mã số/thẻ từ thang máy'), 1, 16)), 'Khóa vân tay/mã số/thẻ từ thang máy', 'building', 'building_security', 'active', 230, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|bảo vệ'), 1, 16)), 'AMN-' || upper(substr(md5('building|bảo vệ'), 1, 16)), 'Bảo vệ', 'building', 'building_security', 'active', 240, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|quản lý tòa nhà'), 1, 16)), 'AMN-' || upper(substr(md5('building|quản lý tòa nhà'), 1, 16)), 'Quản lý tòa nhà', 'building', 'building_security', 'active', 250, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|cổng kiểm soát ra vào'), 1, 16)), 'AMN-' || upper(substr(md5('building|cổng kiểm soát ra vào'), 1, 16)), 'Cổng kiểm soát ra vào', 'building', 'building_security', 'active', 260, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|hệ thống báo cháy tự động'), 1, 16)), 'AMN-' || upper(substr(md5('building|hệ thống báo cháy tự động'), 1, 16)), 'Hệ thống báo cháy tự động', 'building', 'building_fire_safety', 'active', 310, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|đầu báo khói'), 1, 16)), 'AMN-' || upper(substr(md5('building|đầu báo khói'), 1, 16)), 'Đầu báo khói', 'building', 'building_fire_safety', 'active', 320, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|nút nhấn và chuông báo cháy'), 1, 16)), 'AMN-' || upper(substr(md5('building|nút nhấn và chuông báo cháy'), 1, 16)), 'Nút nhấn và chuông báo cháy', 'building', 'building_fire_safety', 'active', 330, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|hệ thống chữa cháy tự động sprinkler'), 1, 16)), 'AMN-' || upper(substr(md5('building|hệ thống chữa cháy tự động sprinkler'), 1, 16)), 'Hệ thống chữa cháy tự động Sprinkler', 'building', 'building_fire_safety', 'active', 340, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|họng nước/vòi chữa cháy'), 1, 16)), 'AMN-' || upper(substr(md5('building|họng nước/vòi chữa cháy'), 1, 16)), 'Họng nước/vòi chữa cháy', 'building', 'building_fire_safety', 'active', 350, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|đèn chiếu sáng sự cố'), 1, 16)), 'AMN-' || upper(substr(md5('building|đèn chiếu sáng sự cố'), 1, 16)), 'Đèn chiếu sáng sự cố', 'building', 'building_fire_safety', 'active', 360, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|biển chỉ dẫn thoát nạn'), 1, 16)), 'AMN-' || upper(substr(md5('building|biển chỉ dẫn thoát nạn'), 1, 16)), 'Biển chỉ dẫn thoát nạn', 'building', 'building_fire_safety', 'active', 370, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|cửa chống cháy'), 1, 16)), 'AMN-' || upper(substr(md5('building|cửa chống cháy'), 1, 16)), 'Cửa chống cháy', 'building', 'building_fire_safety', 'active', 380, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|hệ thống hút khói/tăng áp'), 1, 16)), 'AMN-' || upper(substr(md5('building|hệ thống hút khói/tăng áp'), 1, 16)), 'Hệ thống hút khói/tăng áp', 'building', 'building_fire_safety', 'active', 390, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|mặt nạ phòng độc'), 1, 16)), 'AMN-' || upper(substr(md5('building|mặt nạ phòng độc'), 1, 16)), 'Mặt nạ phòng độc', 'building', 'building_fire_safety', 'active', 400, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|thang thoát hiểm ngoài trời'), 1, 16)), 'AMN-' || upper(substr(md5('building|thang thoát hiểm ngoài trời'), 1, 16)), 'Thang thoát hiểm ngoài trời', 'building', 'building_fire_safety', 'active', 410, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|bình chữa cháy'), 1, 16)), 'AMN-' || upper(substr(md5('building|bình chữa cháy'), 1, 16)), 'Bình chữa cháy', 'building', 'building_fire_safety', 'active', 420, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|lối thoát hiểm có đèn chỉ dẫn'), 1, 16)), 'AMN-' || upper(substr(md5('building|lối thoát hiểm có đèn chỉ dẫn'), 1, 16)), 'Lối thoát hiểm có đèn chỉ dẫn', 'building', 'building_fire_safety', 'active', 430, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|hệ thống truyền tin báo cháy'), 1, 16)), 'AMN-' || upper(substr(md5('building|hệ thống truyền tin báo cháy'), 1, 16)), 'Hệ thống truyền tin báo cháy', 'building', 'building_fire_safety', 'active', 440, 'excel_f031'),
        ('AMN-' || upper(substr(md5('building|bình cầu chữa cháy tự động'), 1, 16)), 'AMN-' || upper(substr(md5('building|bình cầu chữa cháy tự động'), 1, 16)), 'Bình cầu chữa cháy tự động', 'building', 'building_fire_safety', 'active', 450, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|giường'), 1, 16)), 'AMN-' || upper(substr(md5('room|giường'), 1, 16)), 'Giường', 'room', 'room_furniture', 'active', 510, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|đệm'), 1, 16)), 'AMN-' || upper(substr(md5('room|đệm'), 1, 16)), 'Đệm', 'room', 'room_furniture', 'active', 520, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|ga bọc đệm'), 1, 16)), 'AMN-' || upper(substr(md5('room|ga bọc đệm'), 1, 16)), 'Ga bọc đệm', 'room', 'room_furniture', 'active', 530, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|chăn'), 1, 16)), 'AMN-' || upper(substr(md5('room|chăn'), 1, 16)), 'Chăn', 'room', 'room_furniture', 'active', 540, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|gối'), 1, 16)), 'AMN-' || upper(substr(md5('room|gối'), 1, 16)), 'Gối', 'room', 'room_furniture', 'active', 550, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|tủ quần áo'), 1, 16)), 'AMN-' || upper(substr(md5('room|tủ quần áo'), 1, 16)), 'Tủ quần áo', 'room', 'room_furniture', 'active', 560, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|sofa'), 1, 16)), 'AMN-' || upper(substr(md5('room|sofa'), 1, 16)), 'Sofa', 'room', 'room_furniture', 'active', 570, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|bàn trà'), 1, 16)), 'AMN-' || upper(substr(md5('room|bàn trà'), 1, 16)), 'Bàn trà', 'room', 'room_furniture', 'active', 580, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|bàn ghế ăn'), 1, 16)), 'AMN-' || upper(substr(md5('room|bàn ghế ăn'), 1, 16)), 'Bàn ghế ăn', 'room', 'room_furniture', 'active', 590, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|bàn làm việc/bàn học'), 1, 16)), 'AMN-' || upper(substr(md5('room|bàn làm việc/bàn học'), 1, 16)), 'Bàn làm việc/bàn học', 'room', 'room_furniture', 'active', 600, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|kệ/tủ tv'), 1, 16)), 'AMN-' || upper(substr(md5('room|kệ/tủ tv'), 1, 16)), 'Kệ/tủ TV', 'room', 'room_furniture', 'active', 610, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|kệ/tủ sách'), 1, 16)), 'AMN-' || upper(substr(md5('room|kệ/tủ sách'), 1, 16)), 'Kệ/tủ sách', 'room', 'room_furniture', 'active', 620, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|bàn trang điểm'), 1, 16)), 'AMN-' || upper(substr(md5('room|bàn trang điểm'), 1, 16)), 'Bàn trang điểm', 'room', 'room_furniture', 'active', 630, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|gương'), 1, 16)), 'AMN-' || upper(substr(md5('room|gương'), 1, 16)), 'Gương', 'room', 'room_furniture', 'active', 640, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|rèm cửa'), 1, 16)), 'AMN-' || upper(substr(md5('room|rèm cửa'), 1, 16)), 'Rèm cửa', 'room', 'room_furniture', 'active', 650, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|tủ giày'), 1, 16)), 'AMN-' || upper(substr(md5('room|tủ giày'), 1, 16)), 'Tủ giày', 'room', 'room_furniture', 'active', 660, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|tủ bếp trên'), 1, 16)), 'AMN-' || upper(substr(md5('room|tủ bếp trên'), 1, 16)), 'Tủ bếp trên', 'room', 'room_furniture', 'active', 670, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|tủ bếp dưới'), 1, 16)), 'AMN-' || upper(substr(md5('room|tủ bếp dưới'), 1, 16)), 'Tủ bếp dưới', 'room', 'room_furniture', 'active', 680, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|bồn rửa bát'), 1, 16)), 'AMN-' || upper(substr(md5('room|bồn rửa bát'), 1, 16)), 'Bồn rửa bát', 'room', 'room_furniture', 'active', 690, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|xoong/nồi'), 1, 16)), 'AMN-' || upper(substr(md5('room|xoong/nồi'), 1, 16)), 'Xoong/Nồi', 'room', 'room_furniture', 'active', 700, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|điều hòa'), 1, 16)), 'AMN-' || upper(substr(md5('room|điều hòa'), 1, 16)), 'Điều hòa', 'room', 'room_electrical', 'active', 710, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|nóng lạnh'), 1, 16)), 'AMN-' || upper(substr(md5('room|nóng lạnh'), 1, 16)), 'Nóng lạnh', 'room', 'room_electrical', 'active', 720, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|quạt trần/treo tường'), 1, 16)), 'AMN-' || upper(substr(md5('room|quạt trần/treo tường'), 1, 16)), 'Quạt trần/treo tường', 'room', 'room_electrical', 'active', 730, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|máy giặt'), 1, 16)), 'AMN-' || upper(substr(md5('room|máy giặt'), 1, 16)), 'Máy giặt', 'room', 'room_electrical', 'active', 740, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|máy sấy'), 1, 16)), 'AMN-' || upper(substr(md5('room|máy sấy'), 1, 16)), 'Máy sấy', 'room', 'room_electrical', 'active', 750, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|tủ lạnh'), 1, 16)), 'AMN-' || upper(substr(md5('room|tủ lạnh'), 1, 16)), 'Tủ lạnh', 'room', 'room_electrical', 'active', 760, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|bếp từ'), 1, 16)), 'AMN-' || upper(substr(md5('room|bếp từ'), 1, 16)), 'Bếp từ', 'room', 'room_electrical', 'active', 770, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|bếp gas'), 1, 16)), 'AMN-' || upper(substr(md5('room|bếp gas'), 1, 16)), 'Bếp gas', 'room', 'room_electrical', 'active', 780, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|nồi cơm điện'), 1, 16)), 'AMN-' || upper(substr(md5('room|nồi cơm điện'), 1, 16)), 'Nồi cơm điện', 'room', 'room_electrical', 'active', 790, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|máy hút mùi'), 1, 16)), 'AMN-' || upper(substr(md5('room|máy hút mùi'), 1, 16)), 'Máy hút mùi', 'room', 'room_electrical', 'active', 800, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|lò vi sóng'), 1, 16)), 'AMN-' || upper(substr(md5('room|lò vi sóng'), 1, 16)), 'Lò vi sóng', 'room', 'room_electrical', 'active', 810, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|máy rửa bát'), 1, 16)), 'AMN-' || upper(substr(md5('room|máy rửa bát'), 1, 16)), 'Máy rửa bát', 'room', 'room_electrical', 'active', 820, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|wi-fi'), 1, 16)), 'AMN-' || upper(substr(md5('room|wi-fi'), 1, 16)), 'Wi-Fi', 'room', 'room_other', 'active', 830, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|vệ sinh khép kín'), 1, 16)), 'AMN-' || upper(substr(md5('room|vệ sinh khép kín'), 1, 16)), 'Vệ sinh khép kín', 'room', 'room_other', 'active', 840, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|khóa vân tay/mã số/thẻ từ phòng'), 1, 16)), 'AMN-' || upper(substr(md5('room|khóa vân tay/mã số/thẻ từ phòng'), 1, 16)), 'Khóa vân tay/mã số/thẻ từ phòng', 'room', 'room_other', 'active', 850, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|nuôi thú cưng'), 1, 16)), 'AMN-' || upper(substr(md5('room|nuôi thú cưng'), 1, 16)), 'Nuôi thú cưng', 'room', 'room_other', 'active', 860, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|app hệ sinh thái cư dân'), 1, 16)), 'AMN-' || upper(substr(md5('room|app hệ sinh thái cư dân'), 1, 16)), 'App hệ sinh thái cư dân', 'room', 'room_other', 'active', 870, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|ban công'), 1, 16)), 'AMN-' || upper(substr(md5('room|ban công'), 1, 16)), 'Ban công', 'room', 'room_other', 'active', 880, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|cửa sổ'), 1, 16)), 'AMN-' || upper(substr(md5('room|cửa sổ'), 1, 16)), 'Cửa sổ', 'room', 'room_other', 'active', 890, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|gác xép'), 1, 16)), 'AMN-' || upper(substr(md5('room|gác xép'), 1, 16)), 'Gác xép', 'room', 'room_other', 'active', 900, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|gác lửng'), 1, 16)), 'AMN-' || upper(substr(md5('room|gác lửng'), 1, 16)), 'Gác lửng', 'room', 'room_other', 'active', 910, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|công tơ điện/nước riêng'), 1, 16)), 'AMN-' || upper(substr(md5('room|công tơ điện/nước riêng'), 1, 16)), 'Công tơ điện/nước riêng', 'room', 'room_other', 'active', 920, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|hệ thống chữa cháy tự động sprinkler'), 1, 16)), 'AMN-' || upper(substr(md5('room|hệ thống chữa cháy tự động sprinkler'), 1, 16)), 'Hệ thống chữa cháy tự động Sprinkler', 'room', 'room_fire_safety', 'active', 930, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|chuông báo cháy'), 1, 16)), 'AMN-' || upper(substr(md5('room|chuông báo cháy'), 1, 16)), 'Chuông báo cháy', 'room', 'room_fire_safety', 'active', 940, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|đầu báo khói'), 1, 16)), 'AMN-' || upper(substr(md5('room|đầu báo khói'), 1, 16)), 'Đầu báo khói', 'room', 'room_fire_safety', 'active', 950, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|đầu báo nhiệt'), 1, 16)), 'AMN-' || upper(substr(md5('room|đầu báo nhiệt'), 1, 16)), 'Đầu báo nhiệt', 'room', 'room_fire_safety', 'active', 960, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|thang dây thoát hiểm'), 1, 16)), 'AMN-' || upper(substr(md5('room|thang dây thoát hiểm'), 1, 16)), 'Thang dây thoát hiểm', 'room', 'room_fire_safety', 'active', 970, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|cửa chống cháy'), 1, 16)), 'AMN-' || upper(substr(md5('room|cửa chống cháy'), 1, 16)), 'Cửa chống cháy', 'room', 'room_fire_safety', 'active', 980, 'excel_f031'),
        ('AMN-' || upper(substr(md5('room|mặt nạ phòng độc'), 1, 16)), 'AMN-' || upper(substr(md5('room|mặt nạ phòng độc'), 1, 16)), 'Mặt nạ phòng độc', 'room', 'room_fire_safety', 'active', 990, 'excel_f031')
      ON CONFLICT DO NOTHING;

      CREATE OR REPLACE FUNCTION amenity_canonical_name(target_scope TEXT, raw_name TEXT)
      RETURNS TEXT
      LANGUAGE SQL
      IMMUTABLE
      AS $function$
        SELECT CASE
          WHEN target_scope = 'building' AND lower(btrim(raw_name)) = 'wi-fi chung' THEN 'Wi-Fi'
          WHEN target_scope = 'building' AND lower(btrim(raw_name)) = 'máy giặt chung' THEN 'Máy giặt'
          WHEN target_scope = 'building' AND lower(btrim(raw_name)) = 'máy sấy chung' THEN 'Máy sấy'
          WHEN target_scope = 'building' AND lower(btrim(raw_name)) = 'dọn vệ sinh khu vực chung' THEN 'Dọn vệ sinh chung'
          WHEN target_scope = 'building' AND lower(btrim(raw_name)) IN ('khóa vân tay/mã số','thẻ từ ra vào') THEN 'Khóa vân tay/mã số/thẻ từ cổng ra vào'
          WHEN target_scope = 'building' AND lower(btrim(raw_name)) = 'thẻ từ thang máy' THEN 'Khóa vân tay/mã số/thẻ từ thang máy'
          WHEN target_scope = 'building' AND lower(btrim(raw_name)) = 'hệ thống báo cháy' THEN 'Hệ thống báo cháy tự động'
          WHEN target_scope = 'building' AND lower(btrim(raw_name)) = 'đầu báo cháy, báo khói' THEN 'Đầu báo khói'
          WHEN target_scope = 'building' AND lower(btrim(raw_name)) = 'thang thoát hiểm ngoài nhà' THEN 'Thang thoát hiểm ngoài trời'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) = 'bình nóng lạnh' THEN 'Nóng lạnh'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) = 'máy giặt riêng' THEN 'Máy giặt'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) = 'máy sấy riêng' THEN 'Máy sấy'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) = 'quạt trần/quạt treo tường' THEN 'Quạt trần/treo tường'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) = 'bàn ghế' THEN 'Bàn ghế ăn'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) = 'chậu rửa bếp' THEN 'Bồn rửa bát'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) = 'nhà vệ sinh riêng' THEN 'Vệ sinh khép kín'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) = 'ban công/logia riêng' THEN 'Ban công'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) = 'khóa vân tay cửa phòng' THEN 'Khóa vân tay/mã số/thẻ từ phòng'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) = 'wi-fi riêng từng phòng' THEN 'Wi-Fi'
          WHEN target_scope = 'room' AND lower(btrim(raw_name)) IN ('công tơ điện riêng','đồng hồ nước riêng') THEN 'Công tơ điện/nước riêng'
          ELSE btrim(raw_name)
        END
      $function$;

      CREATE OR REPLACE FUNCTION rebuild_amenity_assignments_from_legacy()
      RETURNS void
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        DELETE FROM building_amenities;
        DELETE FROM room_type_amenities;

        WITH candidates AS (
          SELECT b.id entity_id, 'building'::text scope, 'building_common'::text source_category, amenity_canonical_name('building', x.value) name
          FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_security',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_fire_safety',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_fire_safety',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_thoat_nan,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_fire_safety',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_other',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_furniture',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_noi_that,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_electrical',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_thiet_bi_dien,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_khu_vuc_bep,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_dac_diem_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_fire_safety',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_toan,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_fire_safety',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities,'[]'::jsonb)) x(value)
        ), clean AS (
          SELECT DISTINCT entity_id, scope, source_category, name
          FROM candidates
          WHERE btrim(name) <> ''
            AND lower(btrim(name)) NOT LIKE 'viewers:%'
            AND btrim(name) NOT LIKE '__%'
        ), missing AS (
          SELECT c.scope, c.source_category, c.name
          FROM clean c
          WHERE NOT EXISTS (
            SELECT 1 FROM amenities a
            WHERE a.scope = c.scope AND lower(btrim(a.name)) = lower(btrim(c.name))
          )
          GROUP BY c.scope, c.source_category, c.name
        )
        INSERT INTO amenities (
          id, code, name, scope, category, status, sort_order, source
        )
        SELECT
          'AMN-' || upper(substr(md5(scope || '|' || lower(btrim(name))), 1, 16)),
          'AMN-' || upper(substr(md5(scope || '|' || lower(btrim(name))), 1, 16)),
          name, scope, source_category, 'active', 9000, 'legacy_mapping'
        FROM missing
        ON CONFLICT DO NOTHING;

        WITH candidates AS (
          SELECT b.id entity_id, 'building'::text scope, amenity_canonical_name('building', x.value) name
          FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_thoat_nan,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building,'[]'::jsonb)) x(value)
        )
        INSERT INTO building_amenities(building_id, amenity_id)
        SELECT DISTINCT c.entity_id, a.id
        FROM candidates c JOIN amenities a
          ON a.scope = 'building' AND lower(btrim(a.name)) = lower(btrim(c.name))
        WHERE btrim(c.name) <> '' AND lower(btrim(c.name)) NOT LIKE 'viewers:%' AND btrim(c.name) NOT LIKE '__%'
        ON CONFLICT DO NOTHING;

        WITH candidates AS (
          SELECT r.id entity_id, amenity_canonical_name('room', x.value) name
          FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_noi_that,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_thiet_bi_dien,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_khu_vuc_bep,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_dac_diem_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_toan,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities,'[]'::jsonb)) x(value)
        )
        INSERT INTO room_type_amenities(room_type_id, amenity_id)
        SELECT DISTINCT c.entity_id, a.id
        FROM candidates c JOIN amenities a
          ON a.scope = 'room' AND lower(btrim(a.name)) = lower(btrim(c.name))
        WHERE btrim(c.name) <> '' AND lower(btrim(c.name)) NOT LIKE 'viewers:%' AND btrim(c.name) NOT LIKE '__%'
        ON CONFLICT DO NOTHING;
      END;
      $function$;

      SELECT rebuild_amenity_assignments_from_legacy();
    `,
  },
  {
    id: '20260923_009_fix_amenity_legacy_mapping',
    sql: `
      CREATE OR REPLACE FUNCTION rebuild_amenity_assignments_from_legacy()
      RETURNS void
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        DELETE FROM building_amenities;
        DELETE FROM room_type_amenities;

        WITH candidates AS (
          SELECT b.id entity_id, 'building'::text scope, 'building_common'::text source_category, amenity_canonical_name('building', x.value) name
          FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_security',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_fire_safety',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_fire_safety',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_thoat_nan,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_fire_safety',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_other',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_furniture',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_noi_that,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_electrical',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_thiet_bi_dien,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_khu_vuc_bep,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_dac_diem_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_fire_safety',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_toan,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_fire_safety',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities,'[]'::jsonb)) x(value)
        ), clean AS (
          SELECT DISTINCT entity_id, scope, source_category, name
          FROM candidates
          WHERE btrim(name) <> ''
            AND lower(btrim(name)) NOT LIKE 'viewers:%'
            AND left(btrim(name), 2) <> '__'
        ), missing AS (
          SELECT c.scope, c.source_category, c.name
          FROM clean c
          WHERE NOT EXISTS (
            SELECT 1 FROM amenities a
            WHERE a.scope = c.scope AND lower(btrim(a.name)) = lower(btrim(c.name))
          )
          GROUP BY c.scope, c.source_category, c.name
        )
        INSERT INTO amenities (
          id, code, name, scope, category, status, sort_order, source
        )
        SELECT
          'AMN-' || upper(substr(md5(scope || '|' || lower(btrim(name))), 1, 16)),
          'AMN-' || upper(substr(md5(scope || '|' || lower(btrim(name))), 1, 16)),
          name, scope, source_category, 'active', 9000, 'legacy_mapping'
        FROM missing
        ON CONFLICT DO NOTHING;

        WITH candidates AS (
          SELECT b.id entity_id, 'building'::text scope, amenity_canonical_name('building', x.value) name
          FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_thoat_nan,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building,'[]'::jsonb)) x(value)
        )
        INSERT INTO building_amenities(building_id, amenity_id)
        SELECT DISTINCT c.entity_id, a.id
        FROM candidates c JOIN amenities a
          ON a.scope = 'building' AND lower(btrim(a.name)) = lower(btrim(c.name))
        WHERE btrim(c.name) <> '' AND lower(btrim(c.name)) NOT LIKE 'viewers:%' AND btrim(c.name) NOT LIKE '__%'
        ON CONFLICT DO NOTHING;

        WITH candidates AS (
          SELECT r.id entity_id, amenity_canonical_name('room', x.value) name
          FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_noi_that,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_thiet_bi_dien,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_khu_vuc_bep,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_dac_diem_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_toan,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities,'[]'::jsonb)) x(value)
        )
        INSERT INTO room_type_amenities(room_type_id, amenity_id)
        SELECT DISTINCT c.entity_id, a.id
        FROM candidates c JOIN amenities a
          ON a.scope = 'room' AND lower(btrim(a.name)) = lower(btrim(c.name))
        WHERE btrim(c.name) <> '' AND lower(btrim(c.name)) NOT LIKE 'viewers:%' AND btrim(c.name) NOT LIKE '__%'
        ON CONFLICT DO NOTHING;
      END;
      $function$;
      SELECT rebuild_amenity_assignments_from_legacy();
    `,
  },

  {
    id: '20260923_010_fix_amenity_assignment_filter',
    sql: `
      CREATE OR REPLACE FUNCTION rebuild_amenity_assignments_from_legacy()
      RETURNS void
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        DELETE FROM building_amenities;
        DELETE FROM room_type_amenities;

        WITH candidates AS (
          SELECT b.id entity_id, 'building'::text scope, 'building_common'::text source_category, amenity_canonical_name('building', x.value) name
          FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_security',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_fire_safety',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_fire_safety',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_thoat_nan,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_fire_safety',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building','building_other',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_furniture',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_noi_that,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_electrical',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_thiet_bi_dien,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_khu_vuc_bep,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_dac_diem_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_fire_safety',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_toan,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_fire_safety',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,'room','room_other',amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities,'[]'::jsonb)) x(value)
        ), clean AS (
          SELECT DISTINCT entity_id, scope, source_category, name
          FROM candidates
          WHERE btrim(name) <> ''
            AND lower(btrim(name)) NOT LIKE 'viewers:%'
            AND left(btrim(name), 2) <> '__'
        ), missing AS (
          SELECT c.scope, c.source_category, c.name
          FROM clean c
          WHERE NOT EXISTS (
            SELECT 1 FROM amenities a
            WHERE a.scope = c.scope AND lower(btrim(a.name)) = lower(btrim(c.name))
          )
          GROUP BY c.scope, c.source_category, c.name
        )
        INSERT INTO amenities (
          id, code, name, scope, category, status, sort_order, source
        )
        SELECT
          'AMN-' || upper(substr(md5(scope || '|' || lower(btrim(name))), 1, 16)),
          'AMN-' || upper(substr(md5(scope || '|' || lower(btrim(name))), 1, 16)),
          name, scope, source_category, 'active', 9000, 'legacy_mapping'
        FROM missing
        ON CONFLICT DO NOTHING;

        WITH candidates AS (
          SELECT b.id entity_id, 'building'::text scope, amenity_canonical_name('building', x.value) name
          FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building_thoat_nan,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT b.id,'building',amenity_canonical_name('building',x.value) FROM buildings b CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(b.amenities_building,'[]'::jsonb)) x(value)
        )
        INSERT INTO building_amenities(building_id, amenity_id)
        SELECT DISTINCT c.entity_id, a.id
        FROM candidates c JOIN amenities a
          ON a.scope = 'building' AND lower(btrim(a.name)) = lower(btrim(c.name))
        WHERE btrim(c.name) <> '' AND lower(btrim(c.name)) NOT LIKE 'viewers:%' AND left(btrim(c.name), 2) <> '__'
        ON CONFLICT DO NOTHING;

        WITH candidates AS (
          SELECT r.id entity_id, amenity_canonical_name('room', x.value) name
          FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_noi_that,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_thiet_bi_dien,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_khu_vuc_bep,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_dac_diem_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_toan,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_pccc,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_rieng,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_chung,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities_an_ninh,'[]'::jsonb)) x(value)
          UNION ALL SELECT r.id,amenity_canonical_name('room',x.value) FROM rooms r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.amenities,'[]'::jsonb)) x(value)
        )
        INSERT INTO room_type_amenities(room_type_id, amenity_id)
        SELECT DISTINCT c.entity_id, a.id
        FROM candidates c JOIN amenities a
          ON a.scope = 'room' AND lower(btrim(a.name)) = lower(btrim(c.name))
        WHERE btrim(c.name) <> '' AND lower(btrim(c.name)) NOT LIKE 'viewers:%' AND left(btrim(c.name), 2) <> '__'
        ON CONFLICT DO NOTHING;
      END;
      $function$;
      SELECT rebuild_amenity_assignments_from_legacy();
    `,
  },


  {
    id: '20260923_011_u04_5_school_catalog',
    sql: `
      CREATE TABLE IF NOT EXISTS schools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT NOT NULL DEFAULT '',
        campus TEXT NOT NULL DEFAULT '',
        school_type TEXT NOT NULL DEFAULT '',
        sector TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL,
        ward TEXT NOT NULL DEFAULT '',
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        radius_km NUMERIC(8,3),
        keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
        source TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT schools_coordinate_pair_check CHECK (
          (latitude IS NULL AND longitude IS NULL)
          OR (
            latitude BETWEEN -90 AND 90
            AND longitude BETWEEN -180 AND 180
          )
        ),
        CONSTRAINT schools_radius_check CHECK (
          radius_km IS NULL OR (radius_km > 0 AND radius_km <= 100)
        )
      );
      CREATE INDEX IF NOT EXISTS idx_schools_status_name
        ON schools(status, lower(name));
      CREATE INDEX IF NOT EXISTS idx_schools_location
        ON schools(latitude, longitude, radius_km);

      WITH seed AS (
        SELECT *
        FROM jsonb_to_recordset(
          '[{"id":"dhqghn-xt","name":"Đại học Quốc gia Hà Nội (144 Xuân Thủy)","short_name":"ĐHQGHN (Xuân Thủy)","school_type":"Đại học","sector":"Công lập","address":"144 Xuân Thủy","ward":"Phường Cầu Giấy","keywords":["ĐHQGHN","Quốc gia","Xuân Thủy","Cầu Giấy","VNU"]},{"id":"dhqghn-hl","name":"Đại học Quốc gia Hà Nội (Hòa Lạc)","short_name":"ĐHQGHN (Hòa Lạc)","school_type":"Đại học","sector":"Công lập","address":"Khu đô thị Hòa Lạc","ward":"Xã Hòa Lạc","keywords":["ĐHQGHN","Hòa Lạc"]},{"id":"uet","name":"Trường Đại học Công nghệ - ĐHQGHN","short_name":"ĐH Công nghệ (UET)","school_type":"Đại học","sector":"Công lập","address":"144 Xuân Thủy","ward":"Phường Cầu Giấy","keywords":["UET","Công nghệ","Xuân Thủy","Cầu Giấy"]},{"id":"hus","name":"Trường Đại học Khoa học Tự nhiên - ĐHQGHN","short_name":"ĐH Tự nhiên (HUS)","school_type":"Đại học","sector":"Công lập","address":"334 Nguyễn Trãi","ward":"Phường Thanh Xuân","keywords":["HUS","Tự nhiên","Nguyễn Trãi","Thanh Xuân"]},{"id":"ussh","name":"Trường Đại học Khoa học Xã hội và Nhân văn - ĐHQGHN","short_name":"ĐH Nhân văn (USSH)","school_type":"Đại học","sector":"Công lập","address":"336 Nguyễn Trãi","ward":"Phường Thanh Xuân","keywords":["USSH","Nhân văn","Nguyễn Trãi","Thanh Xuân"]},{"id":"ulis","name":"Trường Đại học Ngoại ngữ - ĐHQGHN","short_name":"ĐH Ngoại ngữ (ULIS)","school_type":"Đại học","sector":"Công lập","address":"2 Phạm Văn Đồng","ward":"Phường Cầu Giấy","keywords":["ULIS","Ngoại ngữ","Phạm Văn Đồng","Cầu Giấy"]},{"id":"ueb","name":"Trường Đại học Kinh tế - ĐHQGHN","short_name":"ĐH Kinh tế (UEB)","school_type":"Đại học","sector":"Công lập","address":"144 Xuân Thủy","ward":"Phường Cầu Giấy","keywords":["UEB","Kinh tế ĐHQG","Xuân Thủy","Cầu Giấy"]},{"id":"education","name":"Trường Đại học Giáo dục - ĐHQGHN","short_name":"ĐH Giáo dục","school_type":"Đại học","sector":"Công lập","address":"144 Xuân Thủy","ward":"Phường Cầu Giấy","keywords":["Giáo dục","Xuân Thủy","Cầu Giấy"]},{"id":"law-vnu","name":"Trường Đại học Luật - ĐHQGHN","short_name":"ĐH Luật (ĐHQGHN)","school_type":"Đại học","sector":"Công lập","address":"144 Xuân Thủy","ward":"Phường Cầu Giấy","keywords":["Luật ĐHQG","Xuân Thủy","Cầu Giấy"]},{"id":"smp-vnu","name":"Trường Đại học Y Dược - ĐHQGHN","short_name":"ĐH Y Dược (ĐHQGHN)","school_type":"Đại học","sector":"Công lập","address":"144 Xuân Thủy","ward":"Phường Cầu Giấy","keywords":["Y Dược ĐHQG","Xuân Thủy","Cầu Giấy"]},{"id":"vju","name":"Trường Đại học Việt Nhật - ĐHQGHN","short_name":"ĐH Việt Nhật (VJU)","school_type":"Đại học","sector":"Công lập","address":"Khu đô thị Hòa Lạc","ward":"Xã Hòa Lạc","keywords":["Việt Nhật","VJU","Hòa Lạc"]},{"id":"is-vnu","name":"Trường Quốc tế - ĐHQGHN","short_name":"ĐH Quốc tế (IS-VNU)","school_type":"Đại học","sector":"Công lập","address":"144 Xuân Thủy","ward":"Phường Cầu Giấy","keywords":["Quốc tế ĐHQG","IS","Xuân Thủy"]},{"id":"hust","name":"Trường Đại học Bách khoa Hà Nội","short_name":"ĐH Bách Khoa Hà Nội (HUST)","school_type":"Đại học","sector":"Công lập","address":"1 Đại Cồ Việt","ward":"Phường Bạch Mai","keywords":["Bách Khoa","HUST","Đại Cồ Việt","Bạch Mai","Hai Bà Trưng","Giải Phóng"]},{"id":"neu","name":"Trường Đại học Kinh tế Quốc dân","short_name":"ĐH Kinh tế Quốc dân (NEU)","school_type":"Đại học","sector":"Công lập","address":"207 Giải Phóng","ward":"Phường Bạch Mai","keywords":["Kinh tế Quốc dân","NEU","Giải Phóng","Bạch Mai","Đồng Tâm"]},{"id":"ftu","name":"Trường Đại học Ngoại thương","short_name":"ĐH Ngoại thương (FTU)","school_type":"Đại học","sector":"Công lập","address":"91 Chùa Láng","ward":"Phường Láng","keywords":["Ngoại thương","FTU","Chùa Láng","Láng Thượng","Đống Đa"]},{"id":"tmu","name":"Trường Đại học Thương mại","short_name":"ĐH Thương mại (TMU)","school_type":"Đại học","sector":"Công lập","address":"79 Hồ Tùng Mậu","ward":"Phường Từ Liêm","keywords":["Thương mại","TMU","Hồ Tùng Mậu","Mai Dịch","Cầu Giấy","Nam Từ Liêm"]},{"id":"hnue","name":"Trường Đại học Sư phạm Hà Nội","short_name":"ĐH Sư phạm Hà Nội (HNUE)","school_type":"Đại học","sector":"Công lập","address":"136 Xuân Thủy","ward":"Phường Cầu Giấy","keywords":["Sư phạm Hà Nội","HNUE","Xuân Thủy","Cầu Giấy"]},{"id":"huce","name":"Trường Đại học Xây dựng Hà Nội","short_name":"ĐH Xây dựng (HUCE)","school_type":"Đại học","sector":"Công lập","address":"55 Giải Phóng","ward":"Phường Bạch Mai","keywords":["Xây dựng","HUCE","Giải Phóng","Bạch Mai"]},{"id":"utc","name":"Trường Đại học Giao thông Vận tải","short_name":"ĐH Giao thông Vận tải (UTC)","school_type":"Đại học","sector":"Công lập","address":"3 Cầu Giấy","ward":"Phường Láng","keywords":["Giao thông Vận tải","UTC","Cầu Giấy","Láng"]},{"id":"tlu","name":"Trường Đại học Thủy lợi","short_name":"ĐH Thủy lợi (TLU)","school_type":"Đại học","sector":"Công lập","address":"175 Tây Sơn","ward":"Phường Kim Liên","keywords":["Thủy lợi","TLU","Tây Sơn","Kim Liên","Đống Đa"]},{"id":"humg","name":"Trường Đại học Mỏ - Địa chất","short_name":"ĐH Mỏ - Địa chất (HUMG)","school_type":"Đại học","sector":"Công lập","address":"18 Phố Viên","ward":"Phường Đông Ngạc","keywords":["Mỏ Địa chất","HUMG","Phố Viên","Đông Ngạc","Bắc Từ Liêm"]},{"id":"hau","name":"Trường Đại học Kiến trúc Hà Nội","short_name":"ĐH Kiến trúc Hà Nội (HAU)","school_type":"Đại học","sector":"Công lập","address":"129 Trần Phú","ward":"Phường Hà Đông","keywords":["Kiến trúc","HAU","Trần Phú","Hà Đông","Mộ Lao","Thanh Xuân"]},{"id":"haui","name":"Trường Đại học Công nghiệp Hà Nội","short_name":"ĐH Công nghiệp Hà Nội (HaUI)","school_type":"Đại học","sector":"Công lập","address":"298 Cầu Diễn","ward":"Phường Tây Tựu","keywords":["Công nghiệp Hà Nội","HaUI","Nhổn","Cầu Diễn","Tây Tựu","Bắc Từ Liêm"]},{"id":"hmu","name":"Trường Đại học Y Hà Nội","short_name":"ĐH Y Hà Nội (HMU)","school_type":"Đại học","sector":"Công lập","address":"1 Tôn Thất Tùng","ward":"Phường Kim Liên","keywords":["Y Hà Nội","HMU","Tôn Thất Tùng","Kim Liên","Đống Đa"]},{"id":"hup","name":"Trường Đại học Dược Hà Nội","short_name":"ĐH Dược Hà Nội (HUP)","school_type":"Đại học","sector":"Công lập","address":"13-15 Lê Thánh Tông","ward":"Phường Cửa Nam","keywords":["Dược Hà Nội","HUP","Lê Thánh Tông","Cửa Nam","Hoàn Kiếm"]},{"id":"dhrhm","name":"Trường Đại học Răng Hàm Mặt","short_name":"ĐH Răng Hàm Mặt","school_type":"Đại học","sector":"Công lập","address":"40A phố Tràng Thi","ward":"Phường Hàng Bông","keywords":["Răng Hàm Mặt","Tràng Thi","Hàng Bông","Hoàn Kiếm"]},{"id":"hlu","name":"Trường Đại học Luật Hà Nội","short_name":"ĐH Luật Hà Nội (HLU)","school_type":"Đại học","sector":"Công lập","address":"87 Nguyễn Chí Thanh","ward":"Phường Giảng Võ","keywords":["Luật Hà Nội","HLU","Nguyễn Chí Thanh","Giảng Võ","Đống Đa"]},{"id":"huc","name":"Trường Đại học Văn hóa Hà Nội","short_name":"ĐH Văn hóa Hà Nội","school_type":"Đại học","sector":"Công lập","address":"418 La Thành","ward":"Phường Ô Chợ Dừa","keywords":["Văn hóa Hà Nội","La Thành","Ô Chợ Dừa","Đống Đa"]},{"id":"skda","name":"Trường Đại học Sân khấu - Điện ảnh Hà Nội","short_name":"ĐH Sân khấu Điện ảnh","school_type":"Đại học","sector":"Công lập","address":"Khu văn hóa nghệ thuật","ward":"Phường Mai Dịch","keywords":["Sân khấu Điện ảnh","SKDA","Mai Dịch","Cầu Giấy"]},{"id":"vnufa","name":"Trường Đại học Mỹ thuật Việt Nam","short_name":"ĐH Mỹ thuật Việt Nam","school_type":"Đại học","sector":"Công lập","address":"42 Yết Kiêu","ward":"Phường Cửa Nam","keywords":["Mỹ thuật Việt Nam","Yết Kiêu","Cửa Nam"]},{"id":"vcad","name":"Trường Đại học Mỹ thuật Công nghiệp","short_name":"ĐH Mỹ thuật Công nghiệp","school_type":"Đại học","sector":"Công lập","address":"360 Đê La Thành","ward":"Phường Ô Chợ Dừa","keywords":["Mỹ thuật Công nghiệp","Đê La Thành","Ô Chợ Dừa"]},{"id":"spnttw","name":"Trường Đại học Sư phạm Nghệ thuật Trung ương","short_name":"ĐH Sư phạm Nghệ thuật TW","school_type":"Đại học","sector":"Công lập","address":"18 Nguyễn Phong Sắc","ward":"Phường Cầu Giấy","keywords":["Sư phạm Nghệ thuật","Nguyễn Phong Sắc","Cầu Giấy"]},{"id":"epu","name":"Trường Đại học Điện lực","short_name":"ĐH Điện lực (EPU)","school_type":"Đại học","sector":"Công lập","address":"235 Hoàng Quốc Việt","ward":"Phường Nghĩa Đô","keywords":["Điện lực","EPU","Hoàng Quốc Việt","Nghĩa Đô","Cầu Giấy"]},{"id":"utt","name":"Trường Đại học Công nghệ Giao thông Vận tải","short_name":"ĐH Công nghệ GTVT (UTT)","school_type":"Đại học","sector":"Công lập","address":"54 Triều Khúc","ward":"Phường Thanh Liệt","keywords":["Công nghệ GTVT","UTT","Triều Khúc","Thanh Liệt","Thanh Xuân","Hà Đông"]},{"id":"ulsa","name":"Trường Đại học Lao động - Xã hội","short_name":"ĐH Lao động - Xã hội (ULSA)","school_type":"Đại học","sector":"Công lập","address":"43 Trần Duy Hưng","ward":"Phường Yên Hòa","keywords":["Lao động Xã hội","ULSA","Trần Duy Hưng","Yên Hòa","Cầu Giấy"]},{"id":"huha","name":"Trường Đại học Nội vụ Hà Nội","short_name":"ĐH Nội vụ Hà Nội","school_type":"Đại học","sector":"Công lập","address":"36 Xuân La","ward":"Phường Xuân Đỉnh","keywords":["Nội vụ","Xuân La","Xuân Đỉnh","Tây Hồ"]},{"id":"dhcd","name":"Trường Đại học Công đoàn","short_name":"ĐH Công đoàn","school_type":"Đại học","sector":"Công lập","address":"169 Tây Sơn","ward":"Phường Ô Chợ Dừa","keywords":["Công đoàn","Tây Sơn","Ô Chợ Dừa","Đống Đa"]},{"id":"uneti","name":"Trường Đại học Kinh tế Kỹ thuật Công nghiệp","short_name":"ĐH Kinh tế Kỹ thuật Công nghiệp (UNETI)","school_type":"Đại học","sector":"Công lập","address":"456 Minh Khai","ward":"Phường Vĩnh Tuy","keywords":["UNETI","Minh Khai","Vĩnh Tuy","Hai Bà Trưng"]},{"id":"hict","name":"Trường Đại học Công nghiệp Dệt May Hà Nội","short_name":"ĐH Dệt May Hà Nội","school_type":"Đại học","sector":"Công lập","address":"478 Minh Khai","ward":"Phường Vĩnh Tuy","keywords":["Dệt May","Minh Khai","Vĩnh Tuy"]},{"id":"hunre","name":"Trường Đại học Tài nguyên và Môi trường Hà Nội","short_name":"ĐH Tài nguyên & Môi trường (HUNRE)","school_type":"Đại học","sector":"Công lập","address":"41A Phú Diễn","ward":"Phường Phú Diễn","keywords":["Tài nguyên Môi trường","HUNRE","Phú Diễn","Bắc Từ Liêm"]},{"id":"vnuf","name":"Trường Đại học Lâm nghiệp","short_name":"ĐH Lâm nghiệp","school_type":"Đại học","sector":"Công lập","address":"Thị trấn Xuân Mai","ward":"Xã Xuân Mai","keywords":["Lâm nghiệp","Xuân Mai"]},{"id":"vnua","name":"Học viện Nông nghiệp Việt Nam","short_name":"Học viện Nông nghiệp (VNUA)","school_type":"Học viện","sector":"Công lập","address":"236 Ngô Xuân Quảng","ward":"Xã Gia Lâm","keywords":["Nông nghiệp","VNUA","Gia Lâm","Ngô Xuân Quảng"]},{"id":"hvtc","name":"Học viện Tài chính","short_name":"Học viện Tài chính (AOF)","school_type":"Học viện","sector":"Công lập","address":"58 Lê Văn Hiến","ward":"Phường Đông Ngạc","keywords":["Tài chính","AOF","Lê Văn Hiến","Đông Ngạc","Bắc Từ Liêm"]},{"id":"hvnh","name":"Học viện Ngân hàng","short_name":"Học viện Ngân hàng (BA)","school_type":"Học viện","sector":"Công lập","address":"12 Chùa Bộc","ward":"Phường Kim Liên","keywords":["Ngân hàng","BA","Chùa Bộc","Kim Liên","Đống Đa"]},{"id":"ajc","name":"Học viện Báo chí và Tuyên truyền","short_name":"Học viện Báo chí (AJC)","school_type":"Học viện","sector":"Công lập","address":"36 Xuân Thủy","ward":"Phường Cầu Giấy","keywords":["Báo chí","AJC","Xuân Thủy","Cầu Giấy"]},{"id":"dav","name":"Học viện Ngoại giao","short_name":"Học viện Ngoại giao (DAV)","school_type":"Học viện","sector":"Công lập","address":"69 Chùa Láng","ward":"Phường Láng","keywords":["Ngoại giao","DAV","Chùa Láng","Láng Thượng","Đống Đa"]},{"id":"napa","name":"Học viện Hành chính và Quản trị công","short_name":"Học viện Hành chính","school_type":"Học viện","sector":"Công lập","address":"77 Nguyễn Chí Thanh","ward":"Phường Giảng Võ","keywords":["Hành chính","Nguyễn Chí Thanh","Giảng Võ"]},{"id":"ptit","name":"Học viện Công nghệ Bưu chính Viễn thông","short_name":"Học viện Bưu chính Viễn thông (PTIT)","school_type":"Học viện","sector":"Công lập","address":"96A Trần Phú","ward":"Phường Hà Đông","keywords":["Bưu chính Viễn thông","PTIT","Trần Phú","Hà Đông","Mộ Lao","Thanh Xuân"]},{"id":"apd","name":"Học viện Chính sách và Phát triển","short_name":"Học viện Chính sách (APD)","school_type":"Học viện","sector":"Công lập","address":"Khu đô thị Nam An Khánh","ward":"Xã An Khánh","keywords":["Chính sách","APD","An Khánh","Hoài Đức"]},{"id":"niem","name":"Học viện Quản lý Giáo dục","short_name":"Học viện Quản lý Giáo dục","school_type":"Học viện","sector":"Công lập","address":"31 Phan Đình Giót","ward":"Phường Phương Liệt","keywords":["Quản lý Giáo dục","Phan Đình Giót","Phương Liệt","Thanh Xuân"]},{"id":"vwa","name":"Học viện Phụ nữ Việt Nam","short_name":"Học viện Phụ nữ","school_type":"Học viện","sector":"Công lập","address":"68 Nguyễn Chí Thanh","ward":"Phường Láng","keywords":["Phụ nữ","Nguyễn Chí Thanh","Láng"]},{"id":"vya","name":"Học viện Thanh thiếu niên Việt Nam","short_name":"Học viện Thanh thiếu niên","school_type":"Học viện","sector":"Công lập","address":"3 Chùa Láng","ward":"Phường Láng","keywords":["Thanh thiếu niên","Chùa Láng","Láng"]},{"id":"vatm","name":"Học viện Y Dược học cổ truyền Việt Nam","short_name":"Học viện Y Dược Cổ truyền","school_type":"Học viện","sector":"Công lập","address":"2 Trần Phú","ward":"Phường Đại Mỗ","keywords":["Y Dược cổ truyền","Tuệ Tĩnh","Trần Phú","Đại Mỗ","Hà Đông"]},{"id":"vnam","name":"Học viện Âm nhạc Quốc gia Việt Nam","short_name":"Học viện Âm nhạc Quốc gia","school_type":"Học viện","sector":"Công lập","address":"77 Hào Nam","ward":"Phường Ô Chợ Dừa","keywords":["Âm nhạc Quốc gia","Hào Nam","Ô Chợ Dừa","Đống Đa"]},{"id":"dance","name":"Học viện Múa Việt Nam","short_name":"Học viện Múa Việt Nam","school_type":"Học viện","sector":"Công lập","address":"Khu Văn hoá nghệ thuật","ward":"Phường Phú Diễn","keywords":["Múa Việt Nam","Phú Diễn","Cầu Giấy"]},{"id":"upes1","name":"Trường Đại học Sư phạm Thể dục Thể thao Hà Nội","short_name":"ĐH Sư phạm TDTT Hà Nội","school_type":"Đại học","sector":"Công lập","address":"Phượng Bãi","ward":"Phường Chương Mỹ","keywords":["Thể dục Thể thao","Chương Mỹ"]},{"id":"mta","name":"Học viện Kỹ thuật Quân sự","short_name":"Học viện Kỹ thuật Quân sự (MTA)","school_type":"Học viện","sector":"Công lập","address":"236 Hoàng Quốc Việt","ward":"Phường Nghĩa Đô","keywords":["Kỹ thuật Quân sự","MTA","Hoàng Quốc Việt","Nghĩa Đô","Cầu Giấy"]},{"id":"vmmu","name":"Học viện Quân y","short_name":"Học viện Quân y","school_type":"Học viện","sector":"Công lập","address":"104 Phùng Hưng","ward":"Phường Hà Đông","keywords":["Quân y","Phùng Hưng","Hà Đông","Thanh Trì"]},{"id":"mha","name":"Học viện Hậu cần","short_name":"Học viện Hậu cần","school_type":"Học viện","sector":"Công lập","address":"Phường Bồ Đề","ward":"Phường Bồ Đề","keywords":["Hậu cần","Bồ Đề","Long Biên"]},{"id":"hcct","name":"Học viện Chính trị (Bộ Quốc phòng)","short_name":"Học viện Chính trị Quân đội","school_type":"Học viện","sector":"Công lập","address":"124 Ngô Quyền","ward":"Phường Hà Đông","keywords":["Chính trị","Ngô Quyền","Hà Đông"]},{"id":"misa","name":"Học viện Khoa học Quân sự","short_name":"Học viện Khoa học Quân sự","school_type":"Học viện","sector":"Công lập","address":"Lai Xá","ward":"Xã Hoài Đức","keywords":["Khoa học Quân sự","Lai Xá","Hoài Đức"]},{"id":"pkkq","name":"Học viện Phòng không - Không quân","short_name":"Học viện Phòng không Không quân","school_type":"Học viện","sector":"Công lập","address":"Đoài Phương","ward":"Xã Đoài Phương","keywords":["Phòng không","Không quân"]},{"id":"bpa","name":"Học viện Biên phòng","short_name":"Học viện Biên phòng","school_type":"Học viện","sector":"Công lập","address":"1 Thanh Vị","ward":"Phường Tùng Thiện","keywords":["Biên phòng","Tùng Thiện","Sơn Tây"]},{"id":"actvn","name":"Học viện Kỹ thuật Mật mã","short_name":"Học viện Kỹ thuật Mật mã (ACTVN)","school_type":"Học viện","sector":"Công lập","address":"141 Chiến Thắng","ward":"Phường Thanh Liệt","keywords":["Mật mã","Chiến Thắng","Thanh Liệt","Thanh Xuân","Hà Đông"]},{"id":"ppa","name":"Học viện Cảnh sát nhân dân","short_name":"Học viện Cảnh sát (PPA)","school_type":"Học viện","sector":"Công lập","address":"Phạm Văn Nghị","ward":"Phường Đông Ngạc","keywords":["Cảnh sát","PPA","Phạm Văn Nghị","Đông Ngạc","Bắc Từ Liêm"]},{"id":"t31","name":"Học viện An ninh nhân dân","short_name":"Học viện An ninh (T31)","school_type":"Học viện","sector":"Công lập","address":"125 Trần Phú","ward":"Phường Hà Đông","keywords":["An ninh","T31","Trần Phú","Hà Đông","Thanh Xuân"]},{"id":"t03","name":"Học viện Chính trị Công an nhân dân","short_name":"Học viện Chính trị CAND","school_type":"Học viện","sector":"Công lập","address":"Lương Châu","ward":"Xã Sóc Sơn","keywords":["Chính trị CAND","Sóc Sơn"]},{"id":"pccc","name":"Trường Đại học Phòng cháy Chữa cháy","short_name":"ĐH Phòng cháy Chữa cháy (PCCC)","school_type":"Đại học","sector":"Công lập","address":"243 Khuất Duy Tiến","ward":"Phường Đại Mỗ","keywords":["Phòng cháy","PCCC","Khuất Duy Tiến","Đại Mỗ","Thanh Xuân"]},{"id":"court","name":"Học viện Tòa án","short_name":"Học viện Tòa án","school_type":"Học viện","sector":"Công lập","address":"QL17 Kim Sơn","ward":"Xã Thuận An","keywords":["Tòa án","Gia Lâm","Thuận An"]},{"id":"vks","name":"Học viện Kiểm sát","short_name":"Học viện Kiểm sát","school_type":"Học viện","sector":"Công lập","address":"230 Đường Ỷ La","ward":"Phường Dương Nội","keywords":["Kiểm sát","Ỷ La","Dương Nội","Hà Đông"]},{"id":"fpt","name":"Trường Đại học FPT","short_name":"ĐH FPT Hà Nội","school_type":"Đại học","sector":"Tư thục","address":"Khu CNC Hòa Lạc","ward":"Xã Hòa Lạc","keywords":["FPT","Hòa Lạc","Thạch Thất"]},{"id":"phenikaa","name":"Trường Đại học Phenikaa","short_name":"ĐH Phenikaa","school_type":"Đại học","sector":"Tư thục","address":"Đường Nguyễn Trác","ward":"Phường Dương Nội","keywords":["Phenikaa","Nguyễn Trác","Dương Nội","Hà Đông","Yên Nghĩa"]},{"id":"vinuni","name":"Trường Đại học VinUni","short_name":"ĐH VinUni","school_type":"Đại học","sector":"Tư thục","address":"KĐT Vinhomes Ocean Park","ward":"Xã Gia Lâm","keywords":["VinUni","Ocean Park","Gia Lâm"]},{"id":"thang-long","name":"Trường Đại học Thăng Long","short_name":"ĐH Thăng Long (TLU)","school_type":"Đại học","sector":"Tư thục","address":"Đường Nghiêm Xuân Yêm","ward":"Phường Định Công","keywords":["Thăng Long","Nghiêm Xuân Yêm","Định Công","Hoàng Mai","Thanh Xuân"]},{"id":"phuong-dong","name":"Trường Đại học Phương Đông","short_name":"ĐH Phương Đông","school_type":"Đại học","sector":"Tư thục","address":"171 Trung Kính","ward":"Phường Yên Hòa","keywords":["Phương Đông","Trung Kính","Yên Hòa","Cầu Giấy"]},{"id":"dai-nam","name":"Trường Đại học Đại Nam","short_name":"ĐH Đại Nam","school_type":"Đại học","sector":"Tư thục","address":"1 Xốm","ward":"Phường Phú Lương","keywords":["Đại Nam","Xốm","Phú Lương","Hà Đông"]},{"id":"hoa-binh","name":"Trường Đại học Hòa Bình","short_name":"ĐH Hòa Bình","school_type":"Đại học","sector":"Tư thục","address":"CC2 Bùi Xuân Phái","ward":"Phường Mỹ Đình 2","keywords":["Hòa Bình","Bùi Xuân Phái","Mỹ Đình","Từ Liêm"]},{"id":"nguyen-trai","name":"Trường Đại học Nguyễn Trãi","short_name":"ĐH Nguyễn Trãi","school_type":"Đại học","sector":"Tư thục","address":"28A Lê Trọng Tấn","ward":"Phường Hà Đông","keywords":["Nguyễn Trãi","Lê Trọng Tấn","Hà Đông"]},{"id":"hubt","name":"Trường Đại học Kinh doanh và Công nghệ Hà Nội","short_name":"ĐH Kinh doanh & Công nghệ (HUBT)","school_type":"Đại học","sector":"Tư thục","address":"29A Ngõ 124 Vĩnh Tuy","ward":"Phường Vĩnh Hưng","keywords":["HUBT","Kinh doanh Công nghệ","Vĩnh Tuy","Vĩnh Hưng","Hai Bà Trưng"]},{"id":"thanh-do","name":"Trường Đại học Thành Đô","short_name":"ĐH Thành Đô","school_type":"Đại học","sector":"Tư thục","address":"Km 15 QL32","ward":"Xã Hoài Đức","keywords":["Thành Đô","QL32","Hoài Đức","Nhổn"]},{"id":"dong-do","name":"Trường Đại học Đông Đô","short_name":"ĐH Đông Đô","school_type":"Đại học","sector":"Tư thục","address":"60B Nguyễn Huy Tưởng","ward":"Phường Thanh Xuân","keywords":["Đông Đô","Nguyễn Huy Tưởng","Thanh Xuân"]},{"id":"eaut","name":"Trường Đại học Công nghệ Đông Á","short_name":"ĐH Công nghệ Đông Á (EAUT)","school_type":"Đại học","sector":"Tư thục","address":"Phan Tây Nhạc","ward":"Phường Xuân Phương","keywords":["Công nghệ Đông Á","EAUT","Xuân Phương","Nam Từ Liêm"]},{"id":"cmc","name":"Trường Đại học CMC","short_name":"ĐH CMC","school_type":"Đại học","sector":"Tư thục","address":"84C Nguyễn Thanh Bình","ward":"Phường Vạn Phúc","keywords":["CMC","Nguyễn Thanh Bình","Vạn Phúc","Hà Đông"]},{"id":"fbu","name":"Trường Đại học Tài chính - Ngân hàng Hà Nội","short_name":"ĐH Tài chính - Ngân hàng (FBU)","school_type":"Đại học","sector":"Tư thục","address":"136-138 Phạm Văn Đồng","ward":"Phường Xuân Đỉnh","keywords":["Tài chính Ngân hàng","FBU","Phạm Văn Đồng","Xuân Đỉnh","Bắc Từ Liêm"]},{"id":"dvu","name":"Trường Cao đẳng Đại Việt Hà Nội","short_name":"Cao đẳng Đại Việt Hà Nội","school_type":"Cao đẳng","sector":"Tư thục","address":"Khu đô thị Quận Nam","ward":"Phường Từ Liêm","keywords":["Đại Việt","Từ Liêm"]},{"id":"bhiu","name":"Trường Đại học Quốc tế Bắc Hà","short_name":"ĐH Quốc tế Bắc Hà","school_type":"Đại học","sector":"Tư thục","address":"Khu VHNT Hồ Tùng Mậu","ward":"Phường Mai Dịch","keywords":["Bắc Hà","Hồ Tùng Mậu","Mai Dịch","Cầu Giấy"]},{"id":"cdsptw","name":"Trường Cao đẳng Sư phạm Trung ương","short_name":"CĐ Sư phạm Trung ương","school_type":"Cao đẳng","sector":"Công lập","address":"Số 387 Hoàng Quốc Việt","ward":"Phường Nghĩa Đô","keywords":["Sư phạm TW","Hoàng Quốc Việt","Nghĩa Đô","Cầu Giấy"]},{"id":"hncaa","name":"Trường Cao đẳng Nghệ thuật Hà Nội","short_name":"CĐ Nghệ thuật Hà Nội","school_type":"Cao đẳng","sector":"Công lập","address":"Số 7 Hai Bà Trưng","ward":"Phường Cửa Nam","keywords":["Nghệ thuật Hà Nội","Hai Bà Trưng","Cửa Nam","Hoàn Kiếm"]},{"id":"hcaol","name":"Trường Cao đẳng Du lịch Hà Nội","short_name":"CĐ Du lịch Hà Nội","school_type":"Cao đẳng","sector":"Công lập","address":"Số 236 Hoàng Quốc Việt","ward":"Phường Nghĩa Đô","keywords":["Du lịch Hà Nội","Hoàng Quốc Việt","Nghĩa Đô","Cầu Giấy"]},{"id":"yshanoi","name":"Trường Cao đẳng Y tế Hà Nội","short_name":"CĐ Y tế Hà Nội","school_type":"Cao đẳng","sector":"Công lập","address":"Số 35 Đoàn Thị Điểm","ward":"Phường Ô Chợ Dừa","keywords":["Y tế Hà Nội","Đoàn Thị Điểm","Ô Chợ Dừa","Đống Đa"]},{"id":"bkc","name":"Trường Cao đẳng Công nghệ Bách khoa Hà Nội","short_name":"CĐ Công nghệ Bách khoa (BKC)","school_type":"Cao đẳng","sector":"Tư thục","address":"Số 18-20 Nhân Mỹ","ward":"Phường Từ Liêm","keywords":["Công nghệ Bách khoa","BKC","Nhân Mỹ","Mỹ Đình","Từ Liêm"]},{"id":"hnee","name":"Trường Cao đẳng Điện tử - Điện lạnh Hà Nội","short_name":"CĐ Điện tử - Điện lạnh Hà Nội","school_type":"Cao đẳng","sector":"Công lập","address":"Số 10 Nguyễn Văn Huyên","ward":"Phường Cầu Giấy","keywords":["Điện tử Điện lạnh","Nguyễn Văn Huyên","Cầu Giấy"]},{"id":"cdxd1","name":"Trường Cao đẳng Xây dựng số 1","short_name":"CĐ Xây dựng số 1","school_type":"Cao đẳng","sector":"Công lập","address":"Đường Trung Văn","ward":"Phường Đại Mỗ","keywords":["Xây dựng số 1","Trung Văn","Đại Mỗ","Nam Từ Liêm"]},{"id":"hnivc","name":"Trường Cao đẳng Công thương Hà Nội","short_name":"CĐ Công thương Hà Nội","school_type":"Cao đẳng","sector":"Công lập","address":"Số 54A1 Vũ Trọng Phụng","ward":"Phường Thanh Xuân","keywords":["Công thương Hà Nội","Vũ Trọng Phụng","Thanh Xuân"]},{"id":"hie","name":"Trường Cao đẳng Kinh tế Công nghiệp Hà Nội","short_name":"CĐ Kinh tế Công nghiệp Hà Nội","school_type":"Cao đẳng","sector":"Công lập","address":"Số 143 Nguyễn Ngọc Vũ","ward":"Phường Yên Hòa","keywords":["Kinh tế Công nghiệp","Nguyễn Ngọc Vũ","Yên Hòa","Cầu Giấy"]},{"id":"htc","name":"Trường Cao đẳng Thương mại và Du lịch Hà Nội","short_name":"CĐ Thương mại & Du lịch Hà Nội","school_type":"Cao đẳng","sector":"Công lập","address":"Đường Phạm Văn Đồng","ward":"Phường Phú Diễn","keywords":["Thương mại Du lịch","Phạm Văn Đồng","Phú Diễn","Bắc Từ Liêm"]},{"id":"hht","name":"Trường Cao đẳng Nghề Công nghệ cao Hà Nội","short_name":"CĐ Nghề Công nghệ cao Hà Nội","school_type":"Cao đẳng","sector":"Công lập","address":"Phố Nhuệ Giang","ward":"Phường Xuân Phương","keywords":["Công nghệ cao","Nhuệ Giang","Xuân Phương","Nam Từ Liêm"]},{"id":"fpt-poly","name":"Trường Cao đẳng FPT Polytechnic (Hà Nội)","short_name":"Cao đẳng FPT Polytechnic","school_type":"Cao đẳng","sector":"Tư thục","address":"Số 13 Trịnh Văn Bô","ward":"Phường Xuân Phương","keywords":["FPT Polytechnic","Poly","Trịnh Văn Bô","Xuân Phương","Nam Từ Liêm"]},{"id":"cdnongnghiep","name":"Trường Cao đẳng Nông nghiệp và PTNT Bắc Bộ","short_name":"CĐ Nông nghiệp Bắc Bộ","school_type":"Cao đẳng","sector":"Công lập","address":"TDP Chiến Thắng","ward":"Xã Xuân Mai","keywords":["Nông nghiệp Bắc Bộ","Xuân Mai"]},{"id":"tuetinh","name":"Trường Cao đẳng Y Dược Tuệ Tĩnh Hà Nội","short_name":"CĐ Y Dược Tuệ Tĩnh","school_type":"Cao đẳng","sector":"Tư thục","address":"Số 51 Phú Diễn","ward":"Phường Phú Diễn","keywords":["Tuệ Tĩnh","Phú Diễn","Bắc Từ Liêm"]},{"id":"vmc","name":"Trường Cao đẳng Việt Mỹ Hà Nội","short_name":"CĐ Việt Mỹ Hà Nội","school_type":"Cao đẳng","sector":"Tư thục","address":"Số 168 Trịnh Văn Bô","ward":"Phường Xuân Phương","keywords":["Việt Mỹ","Trịnh Văn Bô","Xuân Phương","Nam Từ Liêm"]}]'::jsonb
        ) AS x(
          id TEXT,
          name TEXT,
          short_name TEXT,
          school_type TEXT,
          sector TEXT,
          address TEXT,
          ward TEXT,
          keywords JSONB
        )
      )
      INSERT INTO schools (
        id, name, short_name, campus, school_type, sector,
        address, ward, latitude, longitude, radius_km,
        keywords, status, source
      )
      SELECT
        id, name, short_name, '', school_type, sector,
        address, ward, NULL, NULL, NULL,
        COALESCE(keywords, '[]'::jsonb), 'active', 'legacy_hanoi_universities'
      FROM seed
      ON CONFLICT (id) DO NOTHING;
    `,
  },
  {
    id: '20260923_012_u04_7_media_360',
    sql: `
      ALTER TABLE buildings
        ADD COLUMN IF NOT EXISTS media_360 JSONB NOT NULL DEFAULT '[]'::jsonb;

      ALTER TABLE rooms
        ADD COLUMN IF NOT EXISTS media_360 JSONB NOT NULL DEFAULT '[]'::jsonb;
    `,
  },
  {
    id: '20260924_013_u05_1_booking_appointment_instant',
    sql: `
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS appointment_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS appointment_timezone_offset_minutes SMALLINT;

      CREATE INDEX IF NOT EXISTS idx_bookings_appointment_at
        ON bookings(appointment_at);

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'bookings_timezone_offset_check'
        ) THEN
          ALTER TABLE bookings
            ADD CONSTRAINT bookings_timezone_offset_check
            CHECK (
              appointment_timezone_offset_minutes IS NULL
              OR appointment_timezone_offset_minutes BETWEEN -840 AND 840
            );
        END IF;
      END;
      $block$;
    `,
  },
  {
    id: '20260924_014_u05_2_booking_cms_fields',
    sql: `
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS room_type_id TEXT REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS assigned_user_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS final_price NUMERIC;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'bookings_final_price_check'
        ) THEN
          ALTER TABLE bookings
            ADD CONSTRAINT bookings_final_price_check
            CHECK (final_price IS NULL OR final_price >= 0);
        END IF;
      END;
      $block$;

      UPDATE bookings b
      SET room_type_id = matched.room_type_id
      FROM (
        SELECT b2.id AS booking_id, MIN(ru.room_type_id) AS room_type_id
        FROM bookings b2
        JOIN room_units ru
          ON ru.building_id = b2.building_id
         AND lower(ru.code) = lower(btrim(COALESCE(b2.room_number, '')))
        WHERE b2.room_type_id IS NULL
          AND btrim(COALESCE(b2.room_number, '')) <> ''
        GROUP BY b2.id
        HAVING COUNT(DISTINCT ru.room_type_id) = 1
      ) matched
      WHERE b.id = matched.booking_id;

      CREATE INDEX IF NOT EXISTS idx_bookings_room_type_id ON bookings(room_type_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_assigned_user_id ON bookings(assigned_user_id);
    `,
  },
  {
    id: '20260924_015_u05_3_booking_role_policy',
    sql: `
      ALTER TABLE roles
        ADD COLUMN IF NOT EXISTS booking_scope TEXT NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS booking_can_assign BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS booking_can_reassign BOOLEAN NOT NULL DEFAULT FALSE;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'roles_booking_scope_check'
        ) THEN
          ALTER TABLE roles
            ADD CONSTRAINT roles_booking_scope_check
            CHECK (booking_scope IN ('none', 'all', 'assigned'));
        END IF;
      END;
      $block$;

      UPDATE roles
      SET
        booking_scope = CASE
          WHEN code IN ('admin', 'superadmin', 'b2c_admin') THEN 'all'
          WHEN code = 'sale' THEN 'assigned'
          ELSE 'none'
        END,
        booking_can_assign = code IN ('admin', 'superadmin', 'b2c_admin'),
        booking_can_reassign = code IN ('admin', 'superadmin', 'b2c_admin'),
        allowed_screens = CASE
          WHEN code IN ('admin', 'superadmin', 'b2c_admin', 'sale') THEN
            CASE
              WHEN COALESCE(allowed_screens, '[]'::jsonb) ? 'bookings'
                THEN COALESCE(allowed_screens, '[]'::jsonb)
              ELSE COALESCE(allowed_screens, '[]'::jsonb) || '["bookings"]'::jsonb
            END
          ELSE COALESCE(allowed_screens, '[]'::jsonb) - 'bookings'
        END,
        updated_at = NOW();

      INSERT INTO roles (
        id, name, code, description, allowed_screens,
        booking_scope, booking_can_assign, booking_can_reassign
      ) VALUES
        (
          'role_b2c_admin', 'Admin B2C', 'b2c_admin',
          'Tiếp nhận và điều phối lịch xem phòng.',
          '["dashboard","bookings"]'::jsonb,
          'all', TRUE, TRUE
        ),
        (
          'role_sale', 'Sale / Người dẫn xem', 'sale',
          'Xử lý các lịch xem được phân công.',
          '["dashboard","bookings"]'::jsonb,
          'assigned', FALSE, FALSE
        )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        allowed_screens = EXCLUDED.allowed_screens,
        booking_scope = EXCLUDED.booking_scope,
        booking_can_assign = EXCLUDED.booking_can_assign,
        booking_can_reassign = EXCLUDED.booking_can_reassign,
        updated_at = NOW();
    `,
  },
  {
    id: '20260924_016_u05_4_booking_state_machine',
    sql: `
      ALTER TABLE roles
        ADD COLUMN IF NOT EXISTS booking_can_transition BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS booking_can_cancel BOOLEAN NOT NULL DEFAULT FALSE;

      UPDATE roles
      SET
        booking_can_transition = code IN ('admin', 'superadmin', 'b2c_admin'),
        booking_can_cancel = code IN ('admin', 'superadmin', 'b2c_admin'),
        updated_at = NOW();

      UPDATE bookings
      SET status = 'Đã huỷ', updated_at = NOW()
      WHERE status = 'Đã hủy';

      DO $block$
      DECLARE
        invalid_status TEXT;
      BEGIN
        SELECT status INTO invalid_status
        FROM bookings
        WHERE status NOT IN (
          'Chờ xác nhận', 'Đã xác nhận', 'Đã xem phòng',
          'Đã huỷ', 'Đã cọc', 'Đã chốt'
        )
        LIMIT 1;

        IF invalid_status IS NOT NULL THEN
          RAISE EXCEPTION 'Unexpected booking status before U05.4 migration: %', invalid_status;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check'
        ) THEN
          ALTER TABLE bookings
            ADD CONSTRAINT bookings_status_check
            CHECK (status IN (
              'Chờ xác nhận', 'Đã xác nhận', 'Đã xem phòng',
              'Đã huỷ', 'Đã cọc', 'Đã chốt'
            ));
        END IF;
      END;
      $block$;
    `,
  },
  {
    id: '20260924_017_u05_4_booking_reschedule_policy',
    sql: `
      ALTER TABLE roles
        ADD COLUMN IF NOT EXISTS booking_can_reschedule BOOLEAN NOT NULL DEFAULT FALSE;

      UPDATE roles
      SET
        booking_can_reschedule = code IN ('admin', 'superadmin', 'b2c_admin'),
        updated_at = NOW();
    `,
  },
  {
    id: '20260924_018_u05_5_attribution_guard',
    sql: `
      CREATE OR REPLACE FUNCTION preserve_initial_attribution()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        IF TG_TABLE_NAME = 'customers' THEN
          IF COALESCE(OLD.source_type, '') <> '' AND NEW.source_type IS DISTINCT FROM OLD.source_type THEN
            RAISE EXCEPTION 'Customer initial source_type cannot be changed.'
              USING ERRCODE = '23514', CONSTRAINT = 'customers_initial_attribution_guard';
          END IF;
          IF COALESCE(OLD.source_channel, '') <> '' AND NEW.source_channel IS DISTINCT FROM OLD.source_channel THEN
            RAISE EXCEPTION 'Customer initial source_channel cannot be changed.'
              USING ERRCODE = '23514', CONSTRAINT = 'customers_initial_attribution_guard';
          END IF;
          IF OLD.referred_by_collaborator_id IS NOT NULL
             AND NEW.referred_by_collaborator_id IS DISTINCT FROM OLD.referred_by_collaborator_id THEN
            RAISE EXCEPTION 'Customer initial collaborator cannot be changed.'
              USING ERRCODE = '23514', CONSTRAINT = 'customers_initial_attribution_guard';
          END IF;
          IF OLD.source_recorded_at IS NOT NULL
             AND NEW.source_recorded_at IS DISTINCT FROM OLD.source_recorded_at THEN
            RAISE EXCEPTION 'Customer source timestamp cannot be changed.'
              USING ERRCODE = '23514', CONSTRAINT = 'customers_initial_attribution_guard';
          END IF;
        ELSIF TG_TABLE_NAME = 'bookings' THEN
          IF OLD.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
            RAISE EXCEPTION 'Booking customer attribution cannot be changed.'
              USING ERRCODE = '23514', CONSTRAINT = 'bookings_initial_attribution_guard';
          END IF;
          IF OLD.collaborator_id IS NOT NULL AND NEW.collaborator_id IS DISTINCT FROM OLD.collaborator_id THEN
            RAISE EXCEPTION 'Booking collaborator attribution cannot be changed.'
              USING ERRCODE = '23514', CONSTRAINT = 'bookings_initial_attribution_guard';
          END IF;
          IF COALESCE(OLD.source_type, '') <> '' AND NEW.source_type IS DISTINCT FROM OLD.source_type THEN
            RAISE EXCEPTION 'Booking initial source_type cannot be changed.'
              USING ERRCODE = '23514', CONSTRAINT = 'bookings_initial_attribution_guard';
          END IF;
          IF COALESCE(OLD.source_channel, '') <> '' AND NEW.source_channel IS DISTINCT FROM OLD.source_channel THEN
            RAISE EXCEPTION 'Booking initial source_channel cannot be changed.'
              USING ERRCODE = '23514', CONSTRAINT = 'bookings_initial_attribution_guard';
          END IF;
          IF OLD.source_recorded_at IS NOT NULL AND NEW.source_recorded_at IS DISTINCT FROM OLD.source_recorded_at THEN
            RAISE EXCEPTION 'Booking source timestamp cannot be changed.'
              USING ERRCODE = '23514', CONSTRAINT = 'bookings_initial_attribution_guard';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $function$;

      DROP TRIGGER IF EXISTS trg_customers_preserve_initial_attribution ON customers;
      CREATE TRIGGER trg_customers_preserve_initial_attribution
      BEFORE UPDATE OF source_type, source_channel, referred_by_collaborator_id, source_recorded_at
      ON customers
      FOR EACH ROW EXECUTE FUNCTION preserve_initial_attribution();

      DROP TRIGGER IF EXISTS trg_bookings_preserve_initial_attribution ON bookings;
      CREATE TRIGGER trg_bookings_preserve_initial_attribution
      BEFORE UPDATE OF customer_id, collaborator_id, source_type, source_channel, source_recorded_at
      ON bookings
      FOR EACH ROW EXECUTE FUNCTION preserve_initial_attribution();
    `,
  },
  {
    id: '20260924_019_u06_1_deal_core',
    sql: `
      CREATE TABLE IF NOT EXISTS deals (
        id TEXT PRIMARY KEY,
        booking_id TEXT REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        collaborator_id TEXT REFERENCES collaborators(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        source_type TEXT NOT NULL DEFAULT '',
        source_channel TEXT NOT NULL DEFAULT '',
        source_recorded_at TIMESTAMPTZ,
        room_unit_id TEXT NOT NULL REFERENCES room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        final_price NUMERIC NOT NULL CHECK (final_price >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_deals_booking_id ON deals(booking_id);
      CREATE INDEX IF NOT EXISTS idx_deals_customer_id ON deals(customer_id);
      CREATE INDEX IF NOT EXISTS idx_deals_collaborator_id ON deals(collaborator_id);
      CREATE INDEX IF NOT EXISTS idx_deals_room_unit_id ON deals(room_unit_id);
      CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
    `,
  },
  {
    id: '20260924_020_u06_1_booking_deal_one_to_one',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS uq_deals_booking_id
        ON deals(booking_id)
        WHERE booking_id IS NOT NULL;
    `,
  },
  {
    id: '20260924_021_u06_1_deal_role_policy',
    sql: `
      ALTER TABLE roles
        ADD COLUMN IF NOT EXISTS deal_scope TEXT NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS deal_can_create BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS deal_can_create_direct BOOLEAN NOT NULL DEFAULT FALSE;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'roles_deal_scope_check'
        ) THEN
          ALTER TABLE roles
            ADD CONSTRAINT roles_deal_scope_check
            CHECK (deal_scope IN ('none', 'all', 'assigned'));
        END IF;
      END;
      $block$;

      UPDATE roles
      SET
        deal_scope = CASE
          WHEN code IN ('admin', 'superadmin', 'b2c_admin') THEN 'all'
          WHEN code = 'sale' THEN 'assigned'
          ELSE 'none'
        END,
        deal_can_create = code IN ('admin', 'superadmin', 'b2c_admin'),
        deal_can_create_direct = code IN ('admin', 'superadmin', 'b2c_admin'),
        allowed_screens = CASE
          WHEN code IN ('admin', 'superadmin', 'b2c_admin', 'sale') THEN
            CASE
              WHEN COALESCE(allowed_screens, '[]'::jsonb) ? 'deals'
                THEN COALESCE(allowed_screens, '[]'::jsonb)
              ELSE COALESCE(allowed_screens, '[]'::jsonb) || '["deals"]'::jsonb
            END
          ELSE COALESCE(allowed_screens, '[]'::jsonb) - 'deals'
        END,
        updated_at = NOW();
    `,
  },
  {
    id: '20260924_022_u06_2_contract_deposit',
    sql: `
      ALTER TABLE deals
        ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS deposit_required_amount NUMERIC,
        ADD COLUMN IF NOT EXISTS deposit_paid_amount NUMERIC NOT NULL DEFAULT 0;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'deals_deposit_required_nonnegative'
        ) THEN
          ALTER TABLE deals
            ADD CONSTRAINT deals_deposit_required_nonnegative
            CHECK (deposit_required_amount IS NULL OR deposit_required_amount >= 0);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'deals_deposit_paid_nonnegative'
        ) THEN
          ALTER TABLE deals
            ADD CONSTRAINT deals_deposit_paid_nonnegative
            CHECK (deposit_paid_amount >= 0);
        END IF;
      END;
      $block$;

      ALTER TABLE roles
        ADD COLUMN IF NOT EXISTS deal_can_manage_contract_deposit BOOLEAN NOT NULL DEFAULT FALSE;

      UPDATE roles
      SET
        deal_can_manage_contract_deposit = code IN ('admin', 'superadmin', 'b2c_admin'),
        updated_at = NOW();
    `,
  },
  {
    id: '20260924_023_u06_3_rental_schedule',
    sql: `
      ALTER TABLE deals
        ADD COLUMN IF NOT EXISTS rental_start_date DATE,
        ADD COLUMN IF NOT EXISTS rental_end_date DATE;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'deals_rental_date_order_check'
        ) THEN
          ALTER TABLE deals
            ADD CONSTRAINT deals_rental_date_order_check
            CHECK (
              rental_end_date IS NULL
              OR (rental_start_date IS NOT NULL AND rental_end_date >= rental_start_date)
            );
        END IF;
      END;
      $block$;

      CREATE INDEX IF NOT EXISTS idx_deals_rental_start_date
        ON deals(rental_start_date);
      CREATE INDEX IF NOT EXISTS idx_deals_rental_end_date
        ON deals(rental_end_date);

      ALTER TABLE roles
        ADD COLUMN IF NOT EXISTS deal_can_manage_rental_schedule BOOLEAN NOT NULL DEFAULT FALSE;

      UPDATE roles
      SET
        deal_can_manage_rental_schedule = code IN ('admin', 'superadmin', 'b2c_admin'),
        updated_at = NOW();
    `,
  },
  {
    id: '20260924_024_u06_4_deal_lifecycle_room_history',
    sql: `
      ALTER TABLE deals
        ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NOT NULL DEFAULT '';

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'deals_lifecycle_status_check'
        ) THEN
          ALTER TABLE deals
            ADD CONSTRAINT deals_lifecycle_status_check
            CHECK (lifecycle_status IN ('active', 'cancelled'));
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'deals_cancelled_timestamp_check'
        ) THEN
          ALTER TABLE deals
            ADD CONSTRAINT deals_cancelled_timestamp_check
            CHECK (
              (lifecycle_status = 'active' AND cancelled_at IS NULL)
              OR (lifecycle_status = 'cancelled' AND cancelled_at IS NOT NULL)
            );
        END IF;
      END;
      $block$;

      CREATE TABLE IF NOT EXISTS deal_room_unit_history (
        id TEXT PRIMARY KEY,
        deal_id TEXT NOT NULL REFERENCES deals(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        from_room_unit_id TEXT NOT NULL REFERENCES room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        to_room_unit_id TEXT NOT NULL REFERENCES room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        changed_by_user_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_deal_room_unit_history_deal
        ON deal_room_unit_history(deal_id, changed_at DESC);

      ALTER TABLE roles
        ADD COLUMN IF NOT EXISTS deal_can_manage_lifecycle BOOLEAN NOT NULL DEFAULT FALSE;

      UPDATE roles
      SET
        deal_can_manage_lifecycle = code IN ('admin', 'superadmin', 'b2c_admin'),
        updated_at = NOW();
    `,
  },
  {
    id: '20260924_025_u06_4_inventory_sync',
    sql: `
      DO $block$
      DECLARE duplicate_room_unit TEXT;
      BEGIN
        SELECT room_unit_id INTO duplicate_room_unit
        FROM deals
        WHERE lifecycle_status = 'active'
        GROUP BY room_unit_id
        HAVING COUNT(*) > 1
        ORDER BY room_unit_id
        LIMIT 1;

        IF duplicate_room_unit IS NOT NULL THEN
          RAISE EXCEPTION 'U06.4 cannot enforce one active Deal per Room Unit: duplicate active deals exist for %', duplicate_room_unit;
        END IF;
      END;
      $block$;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_deals_active_room_unit
        ON deals(room_unit_id)
        WHERE lifecycle_status = 'active';

      UPDATE room_units u
      SET
        status = 'occupied',
        available_from = d.rental_end_date,
        updated_at = NOW()
      FROM deals d
      WHERE d.room_unit_id = u.id
        AND d.lifecycle_status = 'active'
        AND d.contract_signed_at IS NOT NULL
        AND d.deposit_required_amount IS NOT NULL
        AND d.deposit_required_amount > 0
        AND d.deposit_paid_amount >= d.deposit_required_amount
        AND u.status NOT IN ('maintenance', 'archived');
    `,
  },
  {
    id: '20260925_026_u07_1_affiliate_token',
    sql: `
      ALTER TABLE collaborators
        ADD COLUMN IF NOT EXISTS affiliate_token TEXT;

      UPDATE collaborators
      SET affiliate_token =
        'ref_' || substr(
          md5(id || ':' || random()::text || ':' || clock_timestamp()::text),
          1,
          24
        )
      WHERE affiliate_token IS NULL OR btrim(affiliate_token) = '';

      ALTER TABLE collaborators
        ALTER COLUMN affiliate_token
          SET DEFAULT ('ref_' || substr(md5(random()::text || ':' || clock_timestamp()::text), 1, 24)),
        ALTER COLUMN affiliate_token SET NOT NULL;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'collaborators_affiliate_token_format_check'
        ) THEN
          ALTER TABLE collaborators
            ADD CONSTRAINT collaborators_affiliate_token_format_check
            CHECK (affiliate_token ~ '^ref_[0-9a-f]{24}$');
        END IF;
      END;
      $block$;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_collaborators_affiliate_token
        ON collaborators(affiliate_token);
    `,
  },
  {
    id: '20260925_027_u07_2_commission_config',
    sql: `
      CREATE TABLE IF NOT EXISTS collaborator_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_collaborator_types_active_name
        ON collaborator_types(lower(btrim(name)))
        WHERE archived_at IS NULL;

      ALTER TABLE collaborators
        ADD COLUMN IF NOT EXISTS collaborator_type_id TEXT
          REFERENCES collaborator_types(id) ON UPDATE CASCADE ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_collaborators_type
        ON collaborators(collaborator_type_id);

      CREATE TABLE IF NOT EXISTS commission_policy_configs (
        id TEXT PRIMARY KEY,
        room_unit_id TEXT NOT NULL REFERENCES room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        collaborator_type_id TEXT NOT NULL REFERENCES collaborator_types(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        percentage NUMERIC(7,4) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
        amount_6_months NUMERIC NOT NULL CHECK (amount_6_months >= 0),
        amount_12_months NUMERIC NOT NULL CHECK (amount_12_months >= 0),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        notes TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(room_unit_id, collaborator_type_id)
      );

      CREATE INDEX IF NOT EXISTS idx_commission_policy_room_unit
        ON commission_policy_configs(room_unit_id);
      CREATE INDEX IF NOT EXISTS idx_commission_policy_collaborator_type
        ON commission_policy_configs(collaborator_type_id);
      CREATE INDEX IF NOT EXISTS idx_commission_policy_active
        ON commission_policy_configs(is_active);
    `,
  },
  {
    id: '20260925_028_u07_3_commission_ledger',
    sql: `
      CREATE TABLE IF NOT EXISTS commission_ledger_entries (
        id TEXT PRIMARY KEY,
        deal_id TEXT NOT NULL UNIQUE REFERENCES deals(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        collaborator_id TEXT REFERENCES collaborators(id) ON UPDATE CASCADE ON DELETE SET NULL,
        collaborator_name_snapshot TEXT NOT NULL DEFAULT '',
        collaborator_type_id TEXT REFERENCES collaborator_types(id) ON UPDATE CASCADE ON DELETE SET NULL,
        collaborator_type_name_snapshot TEXT NOT NULL DEFAULT '',
        room_unit_id TEXT NOT NULL REFERENCES room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        room_unit_code_snapshot TEXT NOT NULL DEFAULT '',
        final_price_snapshot NUMERIC NOT NULL CHECK (final_price_snapshot >= 0),
        source_type_snapshot TEXT NOT NULL DEFAULT '',
        source_channel_snapshot TEXT NOT NULL DEFAULT '',
        source_recorded_at_snapshot TIMESTAMPTZ,
        policy_id TEXT REFERENCES commission_policy_configs(id) ON UPDATE CASCADE ON DELETE SET NULL,
        policy_percentage_snapshot NUMERIC(7,4),
        policy_amount_6_months_snapshot NUMERIC,
        policy_amount_12_months_snapshot NUMERIC,
        selected_contract_months INTEGER CHECK (selected_contract_months IN (6,12)),
        commission_amount NUMERIC CHECK (commission_amount IS NULL OR commission_amount >= 0),
        status TEXT NOT NULL CHECK (status IN (
          'blocked_no_collaborator',
          'blocked_no_collaborator_type',
          'blocked_no_policy',
          'eligible_pending_amount'
        )),
        review_required BOOLEAN NOT NULL DEFAULT FALSE,
        review_reason TEXT NOT NULL DEFAULT '',
        eligible_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_commission_ledger_collaborator
        ON commission_ledger_entries(collaborator_id);
      CREATE INDEX IF NOT EXISTS idx_commission_ledger_status
        ON commission_ledger_entries(status, review_required);

      CREATE OR REPLACE FUNCTION backfill_commission_ledger_u07_3()
      RETURNS void
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        INSERT INTO commission_ledger_entries (
          id, deal_id, customer_id, collaborator_id, collaborator_name_snapshot,
          collaborator_type_id, collaborator_type_name_snapshot,
          room_unit_id, room_unit_code_snapshot, final_price_snapshot,
          source_type_snapshot, source_channel_snapshot, source_recorded_at_snapshot,
          policy_id, policy_percentage_snapshot,
          policy_amount_6_months_snapshot, policy_amount_12_months_snapshot,
          selected_contract_months, commission_amount, status, eligible_at
        )
        SELECT
          'CLED-' || substr(md5(d.id || ':u07.3'), 1, 24),
          d.id, d.customer_id, d.collaborator_id, COALESCE(c.name, ''),
          c.collaborator_type_id, COALESCE(ct.name, ''),
          d.room_unit_id, COALESCE(u.code, ''), d.final_price,
          COALESCE(d.source_type, ''), COALESCE(d.source_channel, ''), d.source_recorded_at,
          p.id, p.percentage, p.amount_6_months, p.amount_12_months,
          NULL, NULL,
          CASE
            WHEN d.collaborator_id IS NULL THEN 'blocked_no_collaborator'
            WHEN c.collaborator_type_id IS NULL THEN 'blocked_no_collaborator_type'
            WHEN p.id IS NULL THEN 'blocked_no_policy'
            ELSE 'eligible_pending_amount'
          END,
          NOW()
        FROM deals d
        LEFT JOIN collaborators c ON c.id = d.collaborator_id
        LEFT JOIN collaborator_types ct ON ct.id = c.collaborator_type_id
        JOIN room_units u ON u.id = d.room_unit_id
        LEFT JOIN commission_policy_configs p
          ON p.room_unit_id = d.room_unit_id
         AND p.collaborator_type_id = c.collaborator_type_id
         AND p.is_active = TRUE
        WHERE d.lifecycle_status = 'active'
          AND d.contract_signed_at IS NOT NULL
          AND d.deposit_required_amount IS NOT NULL
          AND d.deposit_required_amount > 0
          AND d.deposit_paid_amount >= d.deposit_required_amount
        ON CONFLICT (deal_id) DO NOTHING;
      END;
      $function$;

      SELECT backfill_commission_ledger_u07_3();
    `,
  },
  {
    id: '20260925_029_u07_5_commission_payout_state',
    sql: `
      ALTER TABLE commission_ledger_entries
        ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
        ADD COLUMN IF NOT EXISTS withdrawal_requested_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS withdrawal_requested_by_user_id TEXT
          REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS paid_by_user_id TEXT
          REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'commission_ledger_payment_status_check'
        ) THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_payment_status_check
            CHECK (payment_status IN ('unpaid', 'paid'));
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'commission_ledger_paid_fact_check'
        ) THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_paid_fact_check
            CHECK (payment_status <> 'paid' OR paid_at IS NOT NULL);
        END IF;
      END;
      $block$;

      CREATE INDEX IF NOT EXISTS idx_commission_ledger_payment_status
        ON commission_ledger_entries(payment_status, withdrawal_requested_at);
    `,
  },
  {
    id: '20260925_030_deal_admin_clarity',
    sql: `
      ALTER TABLE deals
        ADD COLUMN IF NOT EXISTS assigned_user_id TEXT
          REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS activity_log JSONB NOT NULL DEFAULT '[]'::jsonb;

      UPDATE deals d
      SET assigned_user_id = b.assigned_user_id
      FROM bookings b
      WHERE d.booking_id = b.id
        AND d.assigned_user_id IS NULL
        AND b.assigned_user_id IS NOT NULL;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'deals_activity_log_array_check'
        ) THEN
          ALTER TABLE deals
            ADD CONSTRAINT deals_activity_log_array_check
            CHECK (jsonb_typeof(activity_log) = 'array');
        END IF;
      END;
      $block$;

      CREATE INDEX IF NOT EXISTS idx_deals_assigned_user_id
        ON deals(assigned_user_id);
    `,
  },
  {
    id: '20260925_031_a01_booking_room_unit',
    sql: `
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS room_unit_id TEXT
          REFERENCES room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;

      CREATE OR REPLACE FUNCTION backfill_booking_room_units_a01()
      RETURNS void LANGUAGE plpgsql AS $function$
      BEGIN
        WITH matches AS (
          SELECT b.id AS booking_id, MIN(u.id) AS room_unit_id, COUNT(*)::int AS match_count
          FROM bookings b
          JOIN room_units u
            ON lower(u.code) = lower(btrim(COALESCE(b.room_number, '')))
           AND (
             u.building_id = b.building_id
             OR (b.building_id IS NULL AND EXISTS (
               SELECT 1 FROM buildings bd
               WHERE bd.id = u.building_id
                 AND lower(bd.code) = lower(COALESCE(b.building_code, ''))
             ))
           )
           AND (b.room_type_id IS NULL OR u.room_type_id = b.room_type_id)
          WHERE b.room_unit_id IS NULL
            AND btrim(COALESCE(b.room_number, '')) <> ''
          GROUP BY b.id
        )
        UPDATE bookings b
        SET room_unit_id = m.room_unit_id,
            building_id = u.building_id,
            building_code = bd.code,
            room_type_id = u.room_type_id,
            room_number = u.code,
            updated_at = NOW()
        FROM matches m
        JOIN room_units u ON u.id = m.room_unit_id
        JOIN buildings bd ON bd.id = u.building_id
        WHERE b.id = m.booking_id
          AND m.match_count = 1
          AND b.room_unit_id IS NULL;
      END;
      $function$;

      SELECT backfill_booking_room_units_a01();

      CREATE INDEX IF NOT EXISTS idx_bookings_room_unit_id ON bookings(room_unit_id);

      CREATE OR REPLACE FUNCTION preserve_booking_room_unit_a01()
      RETURNS trigger LANGUAGE plpgsql AS $function$
      BEGIN
        IF OLD.room_unit_id IS NOT NULL
           AND NEW.room_unit_id IS DISTINCT FROM OLD.room_unit_id THEN
          RAISE EXCEPTION 'Booking room_unit_id is immutable after canonical assignment';
        END IF;
        RETURN NEW;
      END;
      $function$;

      DROP TRIGGER IF EXISTS trg_preserve_booking_room_unit_a01 ON bookings;
      CREATE TRIGGER trg_preserve_booking_room_unit_a01
        BEFORE UPDATE OF room_unit_id ON bookings
        FOR EACH ROW EXECUTE FUNCTION preserve_booking_room_unit_a01();
    `,
  },
  {
    id: '20260925_032_a02_deal_monthly_rent_contract_months',
    sql: `
      -- A02: deals.final_price remains the canonical one-month rent.
      -- Contract duration is explicit and is never inferred from rental dates.
      ALTER TABLE deals
        ADD COLUMN IF NOT EXISTS contract_months INTEGER;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'deals_contract_months_positive_check'
        ) THEN
          ALTER TABLE deals
            ADD CONSTRAINT deals_contract_months_positive_check
            CHECK (contract_months IS NULL OR contract_months > 0);
        END IF;
      END;
      $block$;
    `,
  },
  {
    id: '20260925_033_a03_commission_calculation_allocation',
    sql: `
      CREATE TABLE IF NOT EXISTS commission_allocation_targets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        target_kind TEXT NOT NULL CHECK (target_kind IN ('department','position')),
        percentage NUMERIC(7,4) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
        is_ctv BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        notes TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_allocation_target_name
        ON commission_allocation_targets(lower(btrim(name)));
      CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_allocation_single_active_ctv
        ON commission_allocation_targets((is_ctv))
        WHERE is_active = TRUE AND is_ctv = TRUE;

      UPDATE commission_policy_configs
      SET is_active = FALSE, updated_at = NOW()
      WHERE is_active = TRUE;

      ALTER TABLE commission_ledger_entries
        ADD COLUMN IF NOT EXISTS gross_commission_x NUMERIC,
        ADD COLUMN IF NOT EXISTS tax_rate_snapshot NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS tax_amount NUMERIC,
        ADD COLUMN IF NOT EXISTS allocation_pool NUMERIC,
        ADD COLUMN IF NOT EXISTS allocation_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS ctv_allocation_target_id TEXT
          REFERENCES commission_allocation_targets(id) ON UPDATE CASCADE ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS ctv_allocation_target_name_snapshot TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS ctv_percentage_snapshot NUMERIC(7,4),
        ADD COLUMN IF NOT EXISTS ctv_base_amount NUMERIC,
        ADD COLUMN IF NOT EXISTS ctv_bonus_amount NUMERIC,
        ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS calculated_by_user_id TEXT
          REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

      DO $block$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_ledger_a03_amounts_check') THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_a03_amounts_check CHECK (
              (gross_commission_x IS NULL OR gross_commission_x >= 0)
              AND (tax_rate_snapshot IS NULL OR (tax_rate_snapshot >= 0 AND tax_rate_snapshot <= 100))
              AND (tax_amount IS NULL OR tax_amount >= 0)
              AND (allocation_pool IS NULL OR allocation_pool >= 0)
              AND (ctv_percentage_snapshot IS NULL OR (ctv_percentage_snapshot >= 0 AND ctv_percentage_snapshot <= 100))
              AND (ctv_base_amount IS NULL OR ctv_base_amount >= 0)
              AND (ctv_bonus_amount IS NULL OR ctv_bonus_amount >= 0)
            );
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_ledger_a03_allocation_array_check') THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_a03_allocation_array_check
            CHECK (jsonb_typeof(allocation_snapshot) = 'array');
        END IF;
      END;
      $block$;

      UPDATE commission_ledger_entries
      SET status = 'eligible_pending_amount',
          policy_id = NULL,
          policy_percentage_snapshot = NULL,
          policy_amount_6_months_snapshot = NULL,
          policy_amount_12_months_snapshot = NULL,
          selected_contract_months = NULL,
          updated_at = NOW()
      WHERE collaborator_id IS NOT NULL
        AND status IN ('blocked_no_collaborator_type','blocked_no_policy')
        AND commission_amount IS NULL;
    `,
  },
  {
    id: '20260926_034_a04_commission_exception_resolution',
    sql: `
      ALTER TABLE commission_ledger_entries
        ADD COLUMN IF NOT EXISTS exception_resolution_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS exception_resolution_reason TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS exception_allocation_source TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS exception_resolved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS exception_resolved_by_user_id TEXT
          REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS exception_resolution_history JSONB NOT NULL DEFAULT '[]'::jsonb;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'commission_ledger_a04_resolution_count_check'
        ) THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_a04_resolution_count_check
            CHECK (exception_resolution_count >= 0);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'commission_ledger_a04_allocation_source_check'
        ) THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_a04_allocation_source_check
            CHECK (exception_allocation_source IN ('','previous_snapshot','current_config'));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'commission_ledger_a04_history_array_check'
        ) THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_a04_history_array_check
            CHECK (jsonb_typeof(exception_resolution_history) = 'array');
        END IF;
      END;
      $block$;
    `,
  },
  {
    id: '20260926_035_a05_commission_dual_approval_payout_cycles',
    sql: `
      -- Dedicated accounting authority. Do not repurpose the legacy accountant/BTV role.
      INSERT INTO roles (
        id, name, code, description, allowed_screens,
        booking_scope, booking_can_assign, booking_can_reassign,
        booking_can_transition, booking_can_cancel, booking_can_reschedule,
        deal_scope, deal_can_create, deal_can_create_direct,
        deal_can_manage_contract_deposit, deal_can_manage_rental_schedule, deal_can_manage_lifecycle
      ) VALUES (
        'role_commission_accountant',
        'Kế toán hoa hồng',
        'commission_accountant',
        'Duyệt và đối soát thanh toán hoa hồng.',
        '["dashboard","commissionHistory"]'::jsonb,
        'none', FALSE, FALSE, FALSE, FALSE, FALSE,
        'none', FALSE, FALSE, FALSE, FALSE, FALSE
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        allowed_screens = EXCLUDED.allowed_screens,
        booking_scope = 'none',
        booking_can_assign = FALSE,
        booking_can_reassign = FALSE,
        booking_can_transition = FALSE,
        booking_can_cancel = FALSE,
        booking_can_reschedule = FALSE,
        deal_scope = 'none',
        deal_can_create = FALSE,
        deal_can_create_direct = FALSE,
        deal_can_manage_contract_deposit = FALSE,
        deal_can_manage_rental_schedule = FALSE,
        deal_can_manage_lifecycle = FALSE,
        updated_at = NOW();

      ALTER TABLE commission_ledger_entries
        ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS admin_approved_by_user_id TEXT
          REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS accountant_approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS accountant_approved_by_user_id TEXT
          REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS payout_ready_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS payout_cycle_date DATE;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'commission_ledger_a05_admin_approval_pair_check'
        ) THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_a05_admin_approval_pair_check CHECK (
              (admin_approved_at IS NULL AND admin_approved_by_user_id IS NULL)
              OR (admin_approved_at IS NOT NULL AND admin_approved_by_user_id IS NOT NULL)
            );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'commission_ledger_a05_accountant_approval_pair_check'
        ) THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_a05_accountant_approval_pair_check CHECK (
              (accountant_approved_at IS NULL AND accountant_approved_by_user_id IS NULL)
              OR (accountant_approved_at IS NOT NULL AND accountant_approved_by_user_id IS NOT NULL)
            );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'commission_ledger_a05_payout_ready_check'
        ) THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_a05_payout_ready_check CHECK (
              (payout_ready_at IS NULL AND payout_cycle_date IS NULL)
              OR (
                payout_ready_at IS NOT NULL
                AND payout_cycle_date IS NOT NULL
                AND admin_approved_at IS NOT NULL
                AND accountant_approved_at IS NOT NULL
              )
            );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'commission_ledger_a05_cycle_day_check'
        ) THEN
          ALTER TABLE commission_ledger_entries
            ADD CONSTRAINT commission_ledger_a05_cycle_day_check CHECK (
              payout_cycle_date IS NULL
              OR EXTRACT(DAY FROM payout_cycle_date) IN (1, 15)
            );
        END IF;
      END;
      $block$;
    `,
  },
  {
    id: '20260926_036_u07_8_ctv_consumer_role_cleanup',
    sql: `
      -- U07.8: consumer CTV must not inherit legacy CMS dashboard/inventory authority.
      UPDATE roles
      SET description = 'CTV consumer: khách giới thiệu, công cụ bán phòng và hoa hồng self-scope',
          allowed_screens = '[]'::jsonb,
          booking_scope = 'none',
          booking_can_assign = FALSE,
          booking_can_reassign = FALSE,
          booking_can_transition = FALSE,
          booking_can_cancel = FALSE,
          booking_can_reschedule = FALSE,
          deal_scope = 'none',
          deal_can_create = FALSE,
          deal_can_create_direct = FALSE,
          deal_can_manage_contract_deposit = FALSE,
          deal_can_manage_rental_schedule = FALSE,
          deal_can_manage_lifecycle = FALSE,
          updated_at = NOW()
      WHERE code = 'ctv_sale';

      -- Accounting remains a dedicated commission-only authority; U09 dashboard is deferred.
      UPDATE roles
      SET allowed_screens = '["commissionHistory"]'::jsonb,
          booking_scope = 'none',
          booking_can_assign = FALSE,
          booking_can_reassign = FALSE,
          booking_can_transition = FALSE,
          booking_can_cancel = FALSE,
          booking_can_reschedule = FALSE,
          deal_scope = 'none',
          deal_can_create = FALSE,
          deal_can_create_direct = FALSE,
          deal_can_manage_contract_deposit = FALSE,
          deal_can_manage_rental_schedule = FALSE,
          deal_can_manage_lifecycle = FALSE,
          updated_at = NOW()
      WHERE code = 'commission_accountant';
    `,
  },
  {
    id: '20260928_037_c03_account_profile',
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS gender TEXT,
        ADD COLUMN IF NOT EXISTS birth_date DATE,
        ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_profile_gender_check'
            AND conrelid = 'users'::regclass
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_profile_gender_check
            CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));
        END IF;
      END;
      $block$;
    `,
  },
  {
    id: '20260929_038_room_type_catalog',
    sql: `
      CREATE TABLE IF NOT EXISTS room_type_catalog (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        sort_order INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT room_type_catalog_status_check CHECK (status IN ('active', 'archived')),
        CONSTRAINT room_type_catalog_sort_order_check CHECK (sort_order >= 0)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_room_type_catalog_name_ci
        ON room_type_catalog (lower(btrim(name)));

      INSERT INTO room_type_catalog (id, code, name, status, sort_order, source)
      VALUES
        ('RTC-PHONG-DON', 'phong-don', 'Phòng đơn', 'active', 10, 'canonical_seed'),
        ('RTC-STUDIO', 'studio', 'Studio', 'active', 20, 'canonical_seed'),
        ('RTC-1N1K', '1n1k', '1N1K', 'active', 30, 'canonical_seed'),
        ('RTC-2N1K', '2n1k', '2N1K', 'active', 40, 'canonical_seed'),
        ('RTC-2N2K', '2n2k', '2N2K', 'active', 50, 'canonical_seed'),
        ('RTC-3N2K', '3n2k', '3N2K', 'active', 60, 'canonical_seed'),
        ('RTC-HOMESTAY', 'homestay', 'Homestay', 'active', 70, 'canonical_seed'),
        ('RTC-NHA-NGUYEN-CAN', 'nha-nguyen-can', 'Nhà nguyên căn', 'active', 80, 'canonical_seed')
      ON CONFLICT (id) DO NOTHING;

      -- Preserve labels that cannot be confidently classified. They remain attached
      -- to existing Room Types but archived so public/new writes do not offer them.
      INSERT INTO room_type_catalog (id, code, name, status, sort_order, source)
      SELECT
        'RTC-LEGACY-' || upper(substr(md5(lower(btrim(r.type))), 1, 12)),
        'legacy-' || substr(md5(lower(btrim(r.type))), 1, 12),
        min(btrim(r.type)),
        'archived',
        1000,
        'legacy_migration'
      FROM rooms r
      WHERE btrim(COALESCE(r.type, '')) <> ''
        AND CASE
          WHEN lower(btrim(r.type)) LIKE '%2n2k%' THEN 'RTC-2N2K'
          WHEN lower(btrim(r.type)) LIKE '%3n2k%' OR lower(btrim(r.type)) ~ '(^|[^0-9])3n' THEN 'RTC-3N2K'
          WHEN lower(btrim(r.type)) LIKE '%2n1k%' THEN 'RTC-2N1K'
          WHEN lower(btrim(r.type)) LIKE '%1n1k%' THEN 'RTC-1N1K'
          WHEN lower(btrim(r.type)) LIKE '%homestay%' THEN 'RTC-HOMESTAY'
          WHEN lower(btrim(r.type)) LIKE '%nguyên căn%' OR lower(btrim(r.type)) LIKE '%nguyen can%' THEN 'RTC-NHA-NGUYEN-CAN'
          WHEN lower(btrim(r.type)) LIKE '%phòng đơn%' OR lower(btrim(r.type)) LIKE '%phong don%' THEN 'RTC-PHONG-DON'
          WHEN lower(btrim(r.type)) LIKE '%studio%' THEN 'RTC-STUDIO'
          ELSE NULL
        END IS NULL
      GROUP BY lower(btrim(r.type))
      ON CONFLICT DO NOTHING;

      INSERT INTO room_type_catalog (id, code, name, status, sort_order, source)
      SELECT 'RTC-LEGACY-UNKNOWN', 'legacy-unknown', 'Chưa phân loại', 'archived', 9999, 'legacy_migration'
      WHERE EXISTS (SELECT 1 FROM rooms WHERE btrim(COALESCE(type, '')) = '')
      ON CONFLICT (id) DO NOTHING;

      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type_catalog_id TEXT;

      UPDATE rooms
      SET room_type_catalog_id = CASE
        WHEN btrim(COALESCE(type, '')) = '' THEN 'RTC-LEGACY-UNKNOWN'
        WHEN lower(btrim(type)) LIKE '%2n2k%' THEN 'RTC-2N2K'
        WHEN lower(btrim(type)) LIKE '%3n2k%' OR lower(btrim(type)) ~ '(^|[^0-9])3n' THEN 'RTC-3N2K'
        WHEN lower(btrim(type)) LIKE '%2n1k%' THEN 'RTC-2N1K'
        WHEN lower(btrim(type)) LIKE '%1n1k%' THEN 'RTC-1N1K'
        WHEN lower(btrim(type)) LIKE '%homestay%' THEN 'RTC-HOMESTAY'
        WHEN lower(btrim(type)) LIKE '%nguyên căn%' OR lower(btrim(type)) LIKE '%nguyen can%' THEN 'RTC-NHA-NGUYEN-CAN'
        WHEN lower(btrim(type)) LIKE '%phòng đơn%' OR lower(btrim(type)) LIKE '%phong don%' THEN 'RTC-PHONG-DON'
        WHEN lower(btrim(type)) LIKE '%studio%' THEN 'RTC-STUDIO'
        ELSE 'RTC-LEGACY-' || upper(substr(md5(lower(btrim(type))), 1, 12))
      END
      WHERE room_type_catalog_id IS NULL;

      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'rooms_room_type_catalog_fk'
            AND conrelid = 'rooms'::regclass
        ) THEN
          ALTER TABLE rooms
            ADD CONSTRAINT rooms_room_type_catalog_fk
            FOREIGN KEY (room_type_catalog_id)
            REFERENCES room_type_catalog(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
        END IF;
      END;
      $block$;

      ALTER TABLE rooms ALTER COLUMN room_type_catalog_id SET NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_rooms_room_type_catalog_id
        ON rooms(room_type_catalog_id);
    `
  },
  {
    id: '20260929_039_room_type_catalog_unknown_seed',
    sql: `
      INSERT INTO room_type_catalog (id, code, name, status, sort_order, source)
      VALUES ('RTC-LEGACY-UNKNOWN', 'legacy-unknown', 'Chưa phân loại', 'archived', 9999, 'legacy_migration')
      ON CONFLICT (id) DO NOTHING;
    `
  },
  {
    id: '20260929_040_booking_self_ownership',
    sql: `
      ALTER TABLE bookings ADD COLUMN self_user_id TEXT
        REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
      CREATE INDEX idx_bookings_self_user_id ON bookings(self_user_id)
        WHERE self_user_id IS NOT NULL;
      -- No contact-based backfill: historical bookings require an admin link.
    `,
  },
  {
    id: '20260929_041_public_customer_registration',
    sql: `
      -- Fail on conflicting legacy contacts; never invent numbers in a migration.
      CREATE FUNCTION account_phone_key(value TEXT) RETURNS TEXT
      LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
        SELECT NULLIF(CASE
          WHEN digits LIKE '0084%' THEN '0' || substr(digits, 5)
          WHEN digits LIKE '84%' THEN '0' || substr(digits, 3)
          ELSE digits END, '')
        FROM (SELECT regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g') AS digits) clean
      $$;
      CREATE UNIQUE INDEX users_phone_key_unique ON users(account_phone_key(phone));
      CREATE UNIQUE INDEX users_email_key_unique ON users(lower(btrim(email)));
      INSERT INTO roles (
        id, code, name, description, allowed_screens,
        booking_scope, booking_can_assign, booking_can_reassign, booking_can_transition,
        booking_can_cancel, booking_can_reschedule,
        deal_scope, deal_can_create, deal_can_create_direct, deal_can_manage_contract_deposit,
        deal_can_manage_rental_schedule, deal_can_manage_lifecycle
      ) VALUES ('role_customer', 'customer', 'Khách hàng', 'Tài khoản khách public, không có quyền CMS.',
        '[]'::jsonb, 'none', FALSE, FALSE, FALSE, FALSE, FALSE, 'none', FALSE, FALSE, FALSE, FALSE, FALSE);
    `,
  },
  {
    id: '20260929_042_password_recovery',
    sql: `
      CREATE TABLE password_reset_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX password_reset_tokens_expiry ON password_reset_tokens(expires_at);
      CREATE TABLE password_reset_limits (
        key_hash TEXT PRIMARY KEY,
        hits INTEGER NOT NULL,
        window_started_at TIMESTAMPTZ NOT NULL,
        last_allowed_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX password_reset_limits_expiry ON password_reset_limits(window_started_at);
      CREATE FUNCTION invalidate_password_reset_links() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.password_hash IS DISTINCT FROM NEW.password_hash OR OLD.email IS DISTINCT FROM NEW.email THEN
          DELETE FROM password_reset_tokens WHERE user_id = NEW.id;
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER users_invalidate_password_reset_links AFTER UPDATE OF password_hash, email ON users
        FOR EACH ROW EXECUTE FUNCTION invalidate_password_reset_links();
    `,
  },
  {
    id: '20260929_043_self_favorites',
    sql: `
      CREATE TABLE favorites (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        -- Retain stable target IDs after inventory deletion for removal by the owner.
        unit_id TEXT NOT NULL CHECK (length(unit_id) BETWEEN 1 AND 160),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, unit_id)
      );
      CREATE INDEX idx_favorites_owner_created ON favorites(user_id, created_at DESC, unit_id);
    `,
  },
  {
    id: '20260929_044_public_intake',
    sql: `
      CREATE TABLE intake_requests (
        id UUID PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('landlord_consultation','collaborator_registration','collaborator_consultation','general_contact')),
        name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
        phone TEXT NOT NULL CHECK (phone ~ '^[0-9]{6,32}$'),
        need TEXT NOT NULL DEFAULT '' CHECK (length(need) <= 4000),
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','processing','completed','rejected','spam')),
        request_key_hash TEXT NOT NULL UNIQUE CHECK (request_key_hash ~ '^[a-f0-9]{64}$'),
        payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX intake_requests_created ON intake_requests(created_at DESC, id DESC);
      CREATE INDEX intake_requests_kind_status ON intake_requests(kind, status, created_at DESC);
      -- Transient abuse counters; no plaintext phone/IP, no FK and no exported secrets.
      CREATE TABLE intake_rate_events (
        phone_hash TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX intake_rate_phone ON intake_rate_events(phone_hash, created_at);
      CREATE INDEX intake_rate_ip ON intake_rate_events(ip_hash, created_at);
      CREATE INDEX intake_rate_expiry ON intake_rate_events(created_at);
    `,
  },
  {
    id: '20260929_045_intake_processing',
    sql: `
      ALTER TABLE intake_requests ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
      CREATE TABLE intake_history (
        id UUID PRIMARY KEY,
        request_id UUID NOT NULL REFERENCES intake_requests(id),
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        from_status TEXT NOT NULL CHECK (from_status IN ('new','processing','completed','rejected','spam')),
        to_status TEXT NOT NULL CHECK (to_status IN ('new','processing','completed','rejected','spam')),
        note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
        revision INTEGER NOT NULL CHECK (revision > 0),
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE (request_id, revision)
      );
    `,
  },
  {
    id: '20260929_046_blog',
    sql: `
      CREATE TABLE blog_categories (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
        CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
      );
      CREATE TABLE blog_posts (
        id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES blog_categories(id),
        title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, excerpt TEXT NOT NULL,
        cover_image TEXT NOT NULL, content TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft','published')),
        revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
        published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), CHECK (status <> 'published' OR published_at IS NOT NULL)
      );
      CREATE INDEX blog_posts_public ON blog_posts(status, published_at DESC, id);
      CREATE INDEX blog_posts_category ON blog_posts(category_id);
      INSERT INTO blog_categories(id,name,slug) VALUES
        ('blog-renting','Kinh nghiệm thuê phòng','kinh-nghiem-thue-phong'),
        ('blog-news','Tin tức Tiny Houses','tin-tuc-tiny-houses'),
        ('blog-careers','Tuyển dụng','tuyen-dung');
    `,
  },
  {
    id: '20260930_047_optional_email_verification',
    sql: `
      ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
      CREATE TABLE email_verification_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX email_verification_expiry ON email_verification_tokens(expires_at);
      CREATE FUNCTION invalidate_email_verification() RETURNS trigger AS $$
      BEGIN
        IF lower(btrim(NEW.email)) IS DISTINCT FROM lower(btrim(OLD.email)) THEN
          NEW.email_verified_at := NULL;
          DELETE FROM email_verification_tokens WHERE user_id = OLD.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER users_invalidate_email_verification BEFORE UPDATE OF email ON users
        FOR EACH ROW EXECUTE FUNCTION invalidate_email_verification();
    `,
  },
  {
    id: '20261013_048_room_audience_groups',
    sql: `
      ALTER TABLE rooms ADD COLUMN audience_groups JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(audience_groups) = 'array' AND jsonb_array_length(audience_groups) <= 4
          AND audience_groups <@ '["student","young-worker","couple","family"]'::jsonb);
      INSERT INTO room_type_catalog(id, code, name, status, sort_order, source)
        VALUES ('RTC-MAT-BANG-KINH-DOANH', 'mat-bang-kinh-doanh', 'Mặt bằng kinh doanh', 'active', 90, 'feedback_20261013')
        ON CONFLICT DO NOTHING;
    `,
  },
  {
    id: '20261027_049_room_type_3n1k',
    sql: `
      INSERT INTO room_type_catalog(id, code, name, status, sort_order, source)
        VALUES ('RTC-3N1K', '3n1k', '3N1K', 'active', 50, 'feedback_20261027')
        ON CONFLICT DO NOTHING;
      UPDATE rooms SET room_type_catalog_id = 'RTC-3N1K' WHERE room_type_catalog_id = 'RTC-3N2K';
      UPDATE room_type_catalog SET status = 'archived', updated_at = NOW()
        WHERE id IN ('RTC-2N2K', 'RTC-3N2K');
    `,
  },
  {
    id: '20261028_050_user_extra_roles',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_role_codes JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(extra_role_codes) = 'array');
    `,
  },
  {
    // Labels only: building_manager keeps all-building access and is the BTV who
    // posts/manages buildings; accountant keeps per-building access and is QLTN.
    id: '20261028_051_swap_btv_qltn_labels',
    sql: `
      UPDATE roles SET name = CASE code WHEN 'building_manager' THEN 'BTV' ELSE 'Quản lý Tòa nhà' END, updated_at = NOW()
        WHERE (code = 'building_manager' AND name = 'Quản lý Tòa nhà') OR (code = 'accountant' AND name = 'BTV');
      UPDATE users u SET role_name = r.name, updated_at = NOW()
        FROM roles r WHERE r.code = u.role_code AND u.role_code IN ('building_manager', 'accountant');
    `,
  },
];
