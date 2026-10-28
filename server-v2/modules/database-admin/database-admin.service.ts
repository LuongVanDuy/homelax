import { normalizeAccountPhone } from '@tinyhouse/contracts';
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  databaseSnapshotSchema,
  type DatabaseSnapshot,
} from '@tinyhouse/contracts';
import type {
  PoolClient,
} from 'pg';
import {
  bumpSystemDataVersion,
} from '../../common/version/system-version.js';
import {
  PostgresService,
} from '../../database/postgres.service.js';

type TableConfig = {
  columns: readonly string[];
  jsonColumns?: readonly string[];
};

const TABLES = {
  blog_categories: { columns: ['id','name','slug'] },
  blog_posts: { columns: ['id','category_id','title','slug','excerpt','cover_image','content','status','revision','published_at','created_at','updated_at'] },
  intake_history: { columns: ['id', 'request_id', 'actor_id', 'actor_name', 'from_status', 'to_status', 'note', 'revision', 'created_at'] },
  intake_requests: { columns: ['id', 'kind', 'name', 'phone', 'need', 'status', 'revision', 'request_key_hash', 'payload_hash', 'created_at', 'updated_at'] },
  favorites: { columns: ['user_id', 'unit_id', 'created_at'] },
  roles: {
    columns: [
      'id',
      'name',
      'code',
      'description',
      'allowed_screens',
      'booking_scope',
      'booking_can_assign',
      'booking_can_reassign',
      'booking_can_transition',
      'booking_can_cancel',
      'booking_can_reschedule',
      'deal_scope',
      'deal_can_create',
      'deal_can_create_direct',
      'deal_can_manage_contract_deposit',
      'deal_can_manage_rental_schedule',
      'deal_can_manage_lifecycle',
      'created_at',
      'updated_at',
    ],
    jsonColumns: [
      'allowed_screens',
    ],
  },
  users: {
    columns: [
      'id',
      'name',
      'email',
      'phone',
      'password_hash',
      'role_code',
      'role_name',
      'extra_role_codes',
      'status',
      'avatar',
      'gender',
      'birth_date',
      'address',
      'auth_provider',
      'email_verified_at',
      'created_at',
      'updated_at',
    ],
    jsonColumns: [
      'extra_role_codes',
    ],
  },
  customers: {
    columns: [
      'id', 'name', 'phone', 'email', 'address', 'notes', 'user_id',
      'age', 'age_recorded_at', 'source_type', 'source_channel',
      'referred_by_collaborator_id', 'source_recorded_at',
      'archived_at', 'created_at', 'updated_at',
    ],
  },
  collaborators: {
    columns: [
      'id', 'name', 'phone', 'email', 'address', 'notes', 'user_id',
      'affiliate_token', 'collaborator_type_id',
      'archived_at', 'created_at', 'updated_at',
    ],
  },
  collaborator_types: {
    columns: [
      'id', 'name', 'description', 'archived_at',
      'created_at', 'updated_at',
    ],
  },
  buildings: {
    columns: [
      'id',
      'code',
      'name',
      'is_tiny',
      'owner_type',
      'owner_id',
      'created_by',
      'allowed_viewer_ids',
      'status',
      'deleted_at',
      'rating',
      'address',
      'district',
      'ward',
      'city',
      'province',
      'latitude',
      'longitude',
      'vacant_rooms_count',
      'min_price',
      'max_price',
      'cover_image',
      'images',
      'media_360',
      'rooms',
      'host_name',
      'host_phone',
      'host_email',
      'host_address',
      'amenities_pccc',
      'amenities_building',
      'amenities_building_chung',
      'amenities_building_an_ninh',
      'amenities_building_pccc',
      'amenities_building_thoat_nan',
      'created_at',
      'updated_at',
    ],
    jsonColumns: [
      'allowed_viewer_ids',
      'images',
      'media_360',
      'rooms',
      'amenities_pccc',
      'amenities_building',
      'amenities_building_chung',
      'amenities_building_an_ninh',
      'amenities_building_pccc',
      'amenities_building_thoat_nan',
    ],
  },
  room_type_catalog: {
    columns: ['id','code','name','status','sort_order','source','created_at','updated_at'],
  },
  rooms: {
    columns: [
      'id',
      'room_type_id',
      'building_id',
      'building_code',
      'building_name',
      'room_number',
      'specific_rooms',
      'status',
      'lifecycle_status',
      'price',
      'type',
      'room_type_catalog_id',
      'audience_groups',
      'area',
      'max_occupants',
      'available_from',
      'cover_image',
      'images',
      'media_360',
      'description',
      'amenities',
      'amenities_noi_that',
      'amenities_thiet_bi_dien',
      'amenities_khu_vuc_bep',
      'amenities_dac_diem_rieng',
      'amenities_rieng',
      'amenities_chung',
      'amenities_an_ninh',
      'amenities_pccc',
      'amenities_an_toan',
      'owner_id',
      'created_by',
      'deleted_at',
      'created_at',
      'updated_at',
    ],
    jsonColumns: [
      'specific_rooms',
      'audience_groups',
      'images',
      'media_360',
      'amenities',
      'amenities_noi_that',
      'amenities_thiet_bi_dien',
      'amenities_khu_vuc_bep',
      'amenities_dac_diem_rieng',
      'amenities_rieng',
      'amenities_chung',
      'amenities_an_ninh',
      'amenities_pccc',
      'amenities_an_toan',
    ],
  },
  room_units: {
    columns: [
      'id',
      'room_type_id',
      'building_id',
      'code',
      'status',
      'available_from',
      'migration_source',
      'created_at',
      'updated_at',
    ],
  },
  room_unit_migration_review: {
    columns: [
      'id',
      'room_type_id',
      'building_id',
      'source_field',
      'candidate',
      'legacy_status',
      'reason',
      'resolved_at',
      'resolved_by',
      'resolution_note',
      'created_at',
    ],
  },
  amenities: {
    columns: [
      'id','code','name','scope','category','status','sort_order','source','created_at','updated_at',
    ],
  },
  building_amenities: {
    columns: ['building_id','amenity_id','created_at'],
  },
  room_type_amenities: {
    columns: ['room_type_id','amenity_id','created_at'],
  },
  schools: {
    columns: [
      'id','name','short_name','campus','school_type','sector','address','ward',
      'latitude','longitude','radius_km','keywords','status','source','created_at','updated_at',
    ],
    jsonColumns: ['keywords'],
  },
  bookings: {
    columns: [
      'self_user_id',
      'id',
      'customer_name',
      'phone',
      'email',
      'customer_id',
      'collaborator_id',
      'source_type',
      'source_channel',
      'source_recorded_at',
      'room_unit_id',
      'building_id',
      'building_code',
      'room_type_id',
      'room_number',
      'appointment_date',
      'appointment_time',
      'appointment_at',
      'appointment_timezone_offset_minutes',
      'status',
      'assigned_user_id',
      'final_price',
      'notes',
      'created_at',
      'updated_at',
    ],
  },
  deals: {
    columns: [
      'id',
      'booking_id',
      'customer_id',
      'collaborator_id',
      'source_type',
      'source_channel',
      'source_recorded_at',
      'assigned_user_id',
      'notes',
      'activity_log',
      'room_unit_id',
      'final_price',
      'contract_months',
      'contract_signed_at',
      'deposit_required_amount',
      'deposit_paid_amount',
      'rental_start_date',
      'rental_end_date',
      'lifecycle_status',
      'cancelled_at',
      'cancellation_reason',
      'created_at',
      'updated_at',
    ],
    jsonColumns: ['activity_log'],
  },
  deal_room_unit_history: {
    columns: [
      'id',
      'deal_id',
      'from_room_unit_id',
      'to_room_unit_id',
      'changed_by_user_id',
      'changed_at',
    ],
  },
  commission_policy_configs: {
    columns: [
      'id',
      'room_unit_id',
      'collaborator_type_id',
      'percentage',
      'amount_6_months',
      'amount_12_months',
      'is_active',
      'notes',
      'created_by_user_id',
      'updated_by_user_id',
      'created_at',
      'updated_at',
    ],
  },
  commission_allocation_targets: {
    columns: [
      'id',
      'name',
      'target_kind',
      'percentage',
      'is_ctv',
      'is_active',
      'notes',
      'created_by_user_id',
      'updated_by_user_id',
      'created_at',
      'updated_at',
    ],
  },
  commission_ledger_entries: {
    columns: [
      'id',
      'deal_id',
      'customer_id',
      'collaborator_id',
      'collaborator_name_snapshot',
      'collaborator_type_id',
      'collaborator_type_name_snapshot',
      'room_unit_id',
      'room_unit_code_snapshot',
      'final_price_snapshot',
      'source_type_snapshot',
      'source_channel_snapshot',
      'source_recorded_at_snapshot',
      'policy_id',
      'policy_percentage_snapshot',
      'policy_amount_6_months_snapshot',
      'policy_amount_12_months_snapshot',
      'selected_contract_months',
      'gross_commission_x',
      'tax_rate_snapshot',
      'tax_amount',
      'allocation_pool',
      'allocation_snapshot',
      'ctv_allocation_target_id',
      'ctv_allocation_target_name_snapshot',
      'ctv_percentage_snapshot',
      'ctv_base_amount',
      'ctv_bonus_amount',
      'commission_amount',
      'calculated_at',
      'calculated_by_user_id',
      'exception_resolution_count',
      'exception_resolution_reason',
      'exception_allocation_source',
      'exception_resolved_at',
      'exception_resolved_by_user_id',
      'exception_resolution_history',
      'status',
      'payment_status',
      'admin_approved_at',
      'admin_approved_by_user_id',
      'accountant_approved_at',
      'accountant_approved_by_user_id',
      'payout_ready_at',
      'payout_cycle_date',
      'withdrawal_requested_at',
      'withdrawal_requested_by_user_id',
      'paid_at',
      'paid_by_user_id',
      'review_required',
      'review_reason',
      'eligible_at',
      'created_at',
      'updated_at',
    ],
    jsonColumns: ['allocation_snapshot', 'exception_resolution_history'],
  },
  commissions: {
    columns: [
      'id',
      'ctv_id',
      'ctv_name',
      'ctv_phone',
      'building_code',
      'room_number',
      'contract_value',
      'commission_rate',
      'commission_amount',
      'status',
      'notes',
      'created_at',
      'updated_at',
    ],
  },
  audit_logs: {
    columns: [
      'id',
      'user_id',
      'user_name',
      'user_email',
      'action',
      'entity_type',
      'entity_id',
      'summary',
      'metadata',
      'created_at',
    ],
    jsonColumns: [
      'metadata',
    ],
  },
} as const satisfies Record<
  string,
  TableConfig
>;

type TableName = keyof typeof TABLES;

const TABLE_ORDER: TableName[] = [
  'blog_categories',
  'blog_posts',
  'roles',
  'users',
  'collaborator_types',
  // Customers may reference the original CTV, so collaborators restore first.
  'collaborators',
  'customers',
  'buildings',
  'room_type_catalog',
  'rooms',
  'room_units',
  'favorites',
  'intake_requests',
  'intake_history',
  'commission_policy_configs',
  'commission_allocation_targets',
  'room_unit_migration_review',
  'amenities',
  'building_amenities',
  'room_type_amenities',
  'schools',
  'bookings',
  'deals',
  'deal_room_unit_history',
  'commission_ledger_entries',
  'commissions',
  'audit_logs',
];

const PROFILE_TABLES: readonly TableName[] = ['customers', 'collaborators'];
const U04_2_TABLES: readonly TableName[] = ['room_units', 'room_unit_migration_review'];
const U04_4_TABLES: readonly TableName[] = ['amenities', 'building_amenities', 'room_type_amenities'];
const U04_4_ASSIGNMENT_TABLES: readonly TableName[] = ['building_amenities', 'room_type_amenities'];
const U04_5_TABLES: readonly TableName[] = ['schools'];
const U06_1_TABLES: readonly TableName[] = ['deals'];
const U06_4_TABLES: readonly TableName[] = ['deal_room_unit_history'];
const U07_2_TABLES: readonly TableName[] = ['collaborator_types', 'commission_policy_configs'];
const U07_3_TABLES: readonly TableName[] = ['commission_ledger_entries'];
const A03_TABLES: readonly TableName[] = ['commission_allocation_targets'];
const ROOM_TYPE_CATALOG_TABLES: readonly TableName[] = ['room_type_catalog'];
type SnapshotRows = Array<Record<string, unknown>>;
type SnapshotData = Record<TableName, SnapshotRows>;

function snapshotTables(snapshot: DatabaseSnapshot) {
  const availableTables = TABLE_ORDER.filter(table => (snapshot.schemaVersion >= 34 || table !== 'favorites')
    && (snapshot.schemaVersion >= 35 || table !== 'intake_requests')
    && (snapshot.schemaVersion >= 36 || table !== 'intake_history')
    && (snapshot.schemaVersion >= 37 || !['blog_categories','blog_posts'].includes(table)));
  const afterA03 = snapshot.schemaVersion < 25
    ? availableTables.filter((table) => !A03_TABLES.includes(table))
    : availableTables;
  const baseTables = snapshot.schemaVersion < 30
    ? afterA03.filter((table) => !ROOM_TYPE_CATALOG_TABLES.includes(table))
    : afterA03;
  if (snapshot.schemaVersion === 1) {
    return baseTables.filter(
      (table) =>
        !PROFILE_TABLES.includes(table) &&
        !U04_2_TABLES.includes(table) &&
        !U04_4_TABLES.includes(table) &&
        !U04_5_TABLES.includes(table) &&
        !U06_1_TABLES.includes(table) &&
        !U06_4_TABLES.includes(table) &&
        !U07_2_TABLES.includes(table) &&
        !U07_3_TABLES.includes(table),
    );
  }
  if (snapshot.schemaVersion === 2) {
    return baseTables.filter((table) =>
      !U04_2_TABLES.includes(table) &&
      !U04_4_TABLES.includes(table) &&
      !U04_5_TABLES.includes(table) &&
      !U06_1_TABLES.includes(table) &&
      !U06_4_TABLES.includes(table) &&
      !U07_2_TABLES.includes(table) &&
      !U07_3_TABLES.includes(table)
    );
  }
  if (snapshot.schemaVersion < 5) {
    return baseTables.filter((table) =>
      !U04_4_TABLES.includes(table) &&
      !U04_5_TABLES.includes(table) &&
      !U06_1_TABLES.includes(table) &&
      !U06_4_TABLES.includes(table) &&
      !U07_2_TABLES.includes(table) &&
      !U07_3_TABLES.includes(table)
    );
  }
  if (snapshot.schemaVersion < 6) {
    return baseTables.filter((table) =>
      !U04_5_TABLES.includes(table) &&
      !U06_1_TABLES.includes(table) &&
      !U06_4_TABLES.includes(table) &&
      !U07_2_TABLES.includes(table) &&
      !U07_3_TABLES.includes(table)
    );
  }
  if (snapshot.schemaVersion < 13) {
    return baseTables.filter((table) =>
      !U06_1_TABLES.includes(table) &&
      !U06_4_TABLES.includes(table) &&
      !U07_2_TABLES.includes(table) &&
      !U07_3_TABLES.includes(table)
    );
  }
  if (snapshot.schemaVersion < 17) {
    return baseTables.filter((table) =>
      !U06_4_TABLES.includes(table) &&
      !U07_2_TABLES.includes(table) &&
      !U07_3_TABLES.includes(table)
    );
  }
  if (snapshot.schemaVersion < 19) {
    return baseTables.filter((table) =>
      !U07_2_TABLES.includes(table) &&
      !U07_3_TABLES.includes(table)
    );
  }
  if (snapshot.schemaVersion < 20) {
    return baseTables.filter((table) => !U07_3_TABLES.includes(table));
  }
  return baseTables;
}

function legacyRoomTypeCatalogId(value: string) {
  const type = value.trim().toLocaleLowerCase('vi');
  if (type.includes('2n2k')) return 'RTC-2N2K';
  if (/(^|[^0-9])3n/.test(type)) return 'RTC-3N1K';
  if (type.includes('2n1k')) return 'RTC-2N1K';
  if (type.includes('1n1k')) return 'RTC-1N1K';
  if (type.includes('homestay')) return 'RTC-HOMESTAY';
  if (type.includes('nguyên căn') || type.includes('nguyen can')) return 'RTC-NHA-NGUYEN-CAN';
  if (type.includes('phòng đơn') || type.includes('phong don')) return 'RTC-PHONG-DON';
  if (type.includes('studio')) return 'RTC-STUDIO';
  return 'RTC-LEGACY-UNKNOWN';
}

function normalizeValue(
  table: TableName,
  column: string,
  value: unknown,
) {
  const config: TableConfig = TABLES[table];

  if (table === 'bookings' && column === 'status' && value === 'Đã hủy') {
    return 'Đã huỷ';
  }

  if (
    config.jsonColumns?.includes(
      column as never,
    )
  ) {
    return JSON.stringify(
      value ?? (
        column === 'metadata'
          ? {}
          : []
      ),
    );
  }

  return value;
}

async function insertRows(
  client: PoolClient,
  table: TableName,
  rows: Array<Record<string, unknown>>,
) {
  const config = TABLES[table];

  for (const row of rows) {
    const columns =
      config.columns.filter(
        (column) =>
          Object.prototype.hasOwnProperty.call(
            row,
            column,
          ),
      );

    if (columns.length === 0) {
      throw new BadRequestException({
        error:
          `Snapshot contains an empty ${table} row.`,
      });
    }

    const params = columns.map(
      (column) =>
        normalizeValue(
          table,
          column,
          row[column],
        ),
    );

    const placeholders =
      columns.map(
        (_, index) =>
          `$${index + 1}`,
      );

    await client.query(
      `
        INSERT INTO "${table}"
          (${columns
            .map(
              (column) =>
                `"${column}"`,
            )
            .join(', ')})
        VALUES
          (${placeholders.join(', ')})
      `,
      params,
    );
  }
}

@Injectable()
export class DatabaseAdminService {
  constructor(
    private readonly db:
      PostgresService,
  ) {}

  private validateCounts(
    snapshot: DatabaseSnapshot,
  ) {
    const counts:
      Record<string, number> = {};

    for (const table of snapshotTables(snapshot)) {
      const actual =
        (snapshot.data as Partial<SnapshotData>)[table]!.length;

      const declared =
        snapshot.metadata.counts[
          table
        ];

      if (
        declared !== undefined &&
        declared !== actual
      ) {
        throw new BadRequestException({
          error:
            `Snapshot count mismatch for ${table}: metadata=${declared}, rows=${actual}.`,
        });
      }

      counts[table] = actual;
    }

    return counts;
  }

  async stats() {
    const health =
      await this.db.health();

    const counts:
      Record<string, number> = {};

    for (const table of [
      ...TABLE_ORDER,
      'refresh_tokens',
    ]) {
      const result =
        await this.db.query<{
          count: number;
        }>(
          `SELECT COUNT(*)::int AS count FROM "${table}"`,
        );

      counts[table] =
        Number(
          result.rows[0]?.count ||
            0,
        );
    }

    return {
      connected: true,
      provider: 'PostgreSQL',
      database: health.database,
      postgresVersion:
        health.version,
      latencyMs:
        health.latencyMs,
      counts,
      snapshotVersion: '3.38.0',
      timestamp:
        new Date().toISOString(),
    };
  }

  async backup(): Promise<
    DatabaseSnapshot
  > {
    const health =
      await this.db.health();

    const data =
      {} as SnapshotData;

    const counts:
      Record<string, number> = {};

    for (const table of TABLE_ORDER) {
      const result =
        await this.db.query(
          `
            SELECT ${table === 'users' ? '*, birth_date::text AS birth_date' : '*'}
            FROM "${table}"
            ORDER BY 1
          `,
        );

      data[table] =
        result.rows as Array<
          Record<string, unknown>
        >;

      counts[table] =
        result.rowCount || 0;
    }

    return {
      version: '3.38.0',
      schemaVersion: 39,
      databaseEngine:
        'PostgreSQL',
      exportedAt:
        new Date().toISOString(),
      database: health.database,
      sensitive: true,
      refreshTokensExcluded: true,
      passwordResetTokensExcluded: true,
      emailVerificationTokensExcluded: true,
      metadata: {
        counts,
      },
      data,
    };
  }

  async restore(
    input: unknown,
    dryRun: boolean,
  ) {
    // CLI restore reaches the service directly, without the controller's pipe.
    const parsed = databaseSnapshotSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Snapshot format is invalid or unsupported.',
      });
    }
    const snapshot = parsed.data;
    if (snapshot.schemaVersion < 39) {
      const tagged = await this.db.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM rooms WHERE audience_groups <> '[]'::jsonb");
      if (Number(tagged.rows[0]?.count || 0) > 0) throw new BadRequestException({ error: 'Bản sao cũ chưa có nhóm khách. Hãy dùng bản sao schema39 để tránh mất nhãn đã gán.' });
    }
    const emails = new Set<string>();
    const phones = new Set<string>();
    for (const user of snapshot.data.users) {
      const email = String(user.email || '').trim().toLowerCase();
      const phone = normalizeAccountPhone(String(user.phone || ''));
      if (emails.has(email) || (phone && phones.has(phone))) {
        throw new BadRequestException({ success: false,
          error: 'Snapshot có email hoặc SĐT tài khoản trùng. Hãy sửa bản nhập trước khi restore; hệ thống không tự gộp hoặc thay liên hệ.' });
      }
      emails.add(email);
      if (phone) phones.add(phone);
    }

    const tables = snapshotTables(snapshot);
    const preservedProfiles = PROFILE_TABLES.filter((table) => !tables.includes(table));
    const preservedSchools = U04_5_TABLES.filter((table) => !tables.includes(table));
    const preservedCommissionConfig = U07_2_TABLES.filter((table) => !tables.includes(table));
    const preservedCommissionLedger = U07_3_TABLES.filter((table) => !tables.includes(table));
    const preservedA03Config = A03_TABLES.filter((table) => !tables.includes(table));
    const preservedTables = [
      ...(snapshot.schemaVersion < 37 ? ['blog_categories', 'blog_posts'] : []),
      ...(snapshot.schemaVersion < 35 ? ['intake_requests', 'intake_history'] : []),
      ...preservedProfiles,
      ...preservedSchools,
      ...preservedCommissionConfig,
      ...preservedCommissionLedger,
      ...preservedA03Config,
    ];
    // Old snapshots cannot grant self access by importing contact-derived links.
    if (snapshot.schemaVersion < 31) {
      snapshot.data.bookings = snapshot.data.bookings.map((row) => ({ ...row, self_user_id: null }));
    }
    const rebuildRoomUnits = snapshot.schemaVersion < 3;
    const rebuildRoomTypeLifecycle = snapshot.schemaVersion < 4;
    const rebuildAmenities = snapshot.schemaVersion < 5;
    const legacyWithoutRoomTypeCatalog = snapshot.schemaVersion < 30;
    const legacyWithoutMedia360 = snapshot.schemaVersion < 7;
    const legacyWithoutExactBookingTime = snapshot.schemaVersion < 8;
    const legacyWithoutBookingCmsFields = snapshot.schemaVersion < 9;
    const legacyWithoutBookingRolePolicy = snapshot.schemaVersion < 10;
    const legacyWithoutBookingStatePolicy = snapshot.schemaVersion < 11;
    const legacyWithoutBookingReschedulePolicy = snapshot.schemaVersion < 12;
    const legacyWithoutDeals = snapshot.schemaVersion < 13;
    const legacyWithoutDealRolePolicy = snapshot.schemaVersion < 14;
    const legacyWithoutDealContractDeposit = snapshot.schemaVersion < 15;
    const legacyWithoutRentalSchedule = snapshot.schemaVersion < 16;
    const legacyWithoutDealLifecycle = snapshot.schemaVersion < 17;
    const legacyWithoutAffiliateToken = snapshot.schemaVersion < 18;
    const legacyWithoutCommissionConfig = snapshot.schemaVersion < 19;
    const legacyWithoutCommissionLedger = snapshot.schemaVersion < 20;
    const legacyWithoutCommissionPayoutState = snapshot.schemaVersion < 21;
    const legacyWithoutBookingRoomUnit = snapshot.schemaVersion < 23;
    const legacyWithoutDealCommercialTerms = snapshot.schemaVersion < 24;
    const legacyWithoutA03Commission = snapshot.schemaVersion < 25;
    const legacyWithoutA04ExceptionResolution = snapshot.schemaVersion < 26;
    const legacyWithoutA05Payout = snapshot.schemaVersion < 27;
    const legacyWithoutU078ConsumerBoundary = snapshot.schemaVersion < 28;
    const legacyWithoutSelfBooking = snapshot.schemaVersion < 31;
    const legacyWithoutC03Profile = snapshot.schemaVersion < 29;
    const warningParts = [
      snapshot.schemaVersion < 38
        ? 'Bản sao lưu cũ chưa có trạng thái xác thực email; tài khoản được khôi phục sẽ cần xác thực lại nếu muốn, không bị chặn sử dụng.'
        : null,
      legacyWithoutC03Profile
        ? 'Bản sao lưu trước C03 chưa có giới tính, ngày sinh và địa chỉ tài khoản; các trường thiếu sẽ để trống, không suy từ hồ sơ khách/CTV.'
        : null,
      preservedProfiles.length > 0
        ? 'Bản sao lưu cũ không có hồ sơ khách hàng và cộng tác viên. Các hồ sơ hiện tại sẽ được giữ nguyên.'
        : null,
      preservedSchools.length > 0
        ? 'Bản sao lưu cũ chưa có danh mục trường học U04.5. Danh mục trường hiện tại sẽ được giữ nguyên.'
        : null,
      rebuildRoomUnits
        ? 'Bản sao lưu cũ chưa có Room Unit canonical; hệ thống sẽ dựng lại các mã căn an toàn từ dữ liệu phòng legacy và đưa phần mơ hồ vào hàng chờ rà soát.'
        : null,
      rebuildRoomTypeLifecycle
        ? 'Bản sao lưu cũ chưa có lifecycle Room Type; hệ thống sẽ khôi phục active/archived từ dữ liệu legacy.'
        : null,
      rebuildAmenities
        ? 'Bản sao lưu cũ chưa có catalog tiện ích canonical; hệ thống sẽ dựng lại catalog và assignment từ các mảng tiện ích legacy.'
        : null,
      legacyWithoutMedia360
        ? 'Bản sao lưu cũ chưa có media 360° U04.7; các tòa và loại phòng được restore sẽ dùng danh sách media 360° rỗng.'
        : null,
      legacyWithoutExactBookingTime
        ? 'Bản sao lưu cũ chưa có appointment_at/timezone offset U05.1; lịch cũ vẫn giữ ngày/giờ text nhưng không được suy ngược múi giờ.'
        : null,
      legacyWithoutSelfBooking
        ? 'Snapshot cũ chưa có tài khoản được xem lịch; lịch restore để chưa liên kết, admin xác minh lại.'
        : null,
      legacyWithoutBookingCmsFields
        ? 'Bản sao lưu cũ chưa có các trường CMS U05.2 (room_type_id, assigned_user_id, final_price); các trường này sẽ để trống nếu snapshot không có dữ liệu.'
        : null,
      legacyWithoutBookingRolePolicy
        ? 'Bản sao lưu cũ chưa có booking role policy U05.3; sau restore áp dụng policy hiện hành từ migration thay vì suy quyền từ allowed_screens cũ.'
        : null,
      legacyWithoutBookingStatePolicy
        ? 'Bản sao lưu cũ chưa có action policy/state machine U05.4; trạng thái Đã hủy được chuẩn hóa thành Đã huỷ và quyền transition/cancel áp dụng theo role hiện hành.'
        : null,
      legacyWithoutBookingReschedulePolicy
        ? 'Bản sao lưu cũ chưa có quyền reschedule U05.4; quyền đổi lịch được áp lại theo role hiện hành.'
        : null,
      legacyWithoutDeals
        ? 'Bản sao lưu cũ chưa có bảng Deal U06.1. Dry-run vẫn kiểm được; restore thật chỉ cho phép khi database hiện tại chưa có Deal để tránh mất giao dịch mới.'
        : null,
      legacyWithoutDealRolePolicy
        ? 'Bản sao lưu cũ chưa có Deal role policy U06.1; sau restore áp dụng policy hiện hành: B2C all/create, Sale assigned/read-only.'
        : null,
      legacyWithoutDealContractDeposit
        ? 'Bản sao lưu cũ chưa có dữ kiện hợp đồng/cọc U06.2; Deal restore sẽ dùng contract unsigned, required deposit NULL và paid deposit 0 nếu snapshot không có các field này. Quyền cập nhật hợp đồng/cọc được áp lại theo policy hiện hành.'
        : null,
      legacyWithoutRentalSchedule
        ? 'Bản sao lưu cũ chưa có lịch thuê U06.3; Deal restore sẽ giữ lịch thuê trống và áp lại quyền cập nhật lịch thuê cho Admin/B2C.'
        : null,
      legacyWithoutDealLifecycle
        ? 'Bản sao lưu cũ chưa có Deal lifecycle/lịch sử đổi căn U06.4. Deal restore mặc định active; lịch sử đổi căn hiện tại không thể ghép an toàn vào snapshot cũ nên restore thật bị chặn nếu đã có history rows. Quyền lifecycle được áp lại cho Admin/B2C.'
        : null,
      legacyWithoutAffiliateToken
        ? 'Bản sao lưu trước U07.1 chưa có affiliate token. Hồ sơ CTV được restore sẽ nhận token mới từ PostgreSQL default; các snapshot này chưa từng chứa link affiliate để bảo toàn.'
        : null,
      legacyWithoutCommissionConfig
        ? 'Bản sao lưu trước U07.2 chưa có loại CTV và cấu hình hoa hồng theo phòng. Các bảng cấu hình hiện tại được giữ nguyên khi dry-run; restore thật bị chặn nếu database đã có cấu hình để tránh mất phân loại CTV.'
        : null,
      legacyWithoutCommissionLedger
        ? 'Bản sao lưu trước U07.3 chưa có commission ledger canonical. Dry-run giữ ledger hiện tại; restore thật bị chặn nếu đã có ledger, còn database chưa có ledger sẽ rebuild từ Deal đủ điều kiện sau restore.'
        : null,
      legacyWithoutCommissionPayoutState
        ? 'Bản sao lưu trước U07.5 chưa có trạng thái paid/unpaid và yêu cầu rút tiền. Nếu database hiện có payout state, restore thật bị chặn để tránh mất dấu thanh toán.'
        : null,
      legacyWithoutBookingRoomUnit
        ? 'Bản sao lưu trước A01 chưa có booking.room_unit_id canonical; sau restore hệ thống sẽ backfill an toàn từ tòa + mã căn và giữ NULL cho record không map duy nhất.'
        : null,
      legacyWithoutDealCommercialTerms
        ? 'Bản sao lưu trước A02 chưa có contract_months; Deal được restore giữ thời hạn hợp đồng NULL. final_price được giữ nguyên và được hiểu là giá thuê một tháng; hệ thống không suy số tháng từ lịch thuê.'
        : null,
      legacyWithoutA03Commission
        ? 'Bản sao lưu trước A03 chưa có cơ cấu phân bổ X/10%/90% và calculation snapshot. Cấu hình A03 hiện tại được giữ nguyên; ledger cũ không được tự suy X hay bonus.'
        : null,
      legacyWithoutA04ExceptionResolution
        ? 'Bản sao lưu trước A04 chưa có lịch sử resolve X cho case hủy/bỏ cọc. Các cột A04 sẽ dùng mặc định rỗng khi restore.'
        : null,
      legacyWithoutA05Payout
        ? 'Bản sao lưu trước A05 chưa có dual approval và payout cycle 1/15. Role Kế toán hoa hồng sẽ được khôi phục theo policy hiện hành; không tự backfill approval cho khoản cũ.'
        : null,
      legacyWithoutU078ConsumerBoundary
        ? 'Bản sao lưu trước U07.8 có thể còn quyền CMS dashboard/inventory cũ cho CTV/Kế toán; restore sẽ áp lại consumer boundary hiện hành.'
        : null,
    ].filter(Boolean);
    const warning = warningParts.length ? warningParts.join(' ') : null;
    const incomingCounts =
      this.validateCounts(snapshot);

    const before =
      await this.stats();

    const payoutStateCount = legacyWithoutCommissionPayoutState
      ? Number((
          await this.db.query<{ count: number }>(
            `
              SELECT COUNT(*)::int AS count
              FROM commission_ledger_entries
              WHERE payment_status = 'paid'
                 OR withdrawal_requested_at IS NOT NULL
            `,
          )
        ).rows[0]?.count || 0)
      : 0;

    if (!dryRun && legacyWithoutCommissionPayoutState && payoutStateCount > 0) {
      throw new BadRequestException({
        error: 'Không thể restore snapshot trước U07.5 khi database hiện tại đã có trạng thái thanh toán/yêu cầu rút tiền. Hãy export snapshot 3.20/schema21 hiện tại trước.',
      });
    }

    if (
      !dryRun &&
      legacyWithoutCommissionConfig &&
      (Number(before.counts.collaborator_types || 0) > 0 ||
        Number(before.counts.commission_policy_configs || 0) > 0)
    ) {
      throw new BadRequestException({
        error: 'Không thể restore snapshot trước U07.2 khi database hiện tại đã có cấu hình hoa hồng. Hãy export snapshot 3.18/schema19 hiện tại trước.',
      });
    }

    if (
      !dryRun &&
      legacyWithoutCommissionLedger &&
      Number(before.counts.commission_ledger_entries || 0) > 0
    ) {
      throw new BadRequestException({
        error: 'Không thể restore snapshot trước U07.3 khi database hiện tại đã có commission ledger. Hãy export snapshot 3.19/schema20 hiện tại trước.',
      });
    }

    if (!dryRun && legacyWithoutA04ExceptionResolution) {
      const a04Resolved = await this.db.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM commission_ledger_entries WHERE exception_resolution_count > 0',
      );
      if (Number(a04Resolved.rows[0]?.count || 0) > 0) {
        throw new BadRequestException({
          error: 'Không thể restore snapshot trước A04 khi database hiện tại đã có lịch sử xử lý hủy/bỏ cọc. Hãy export snapshot 3.25/schema26 hiện tại trước.',
        });
      }
    }

    if (!dryRun && legacyWithoutC03Profile) {
      const profileState = await this.db.query<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM users WHERE gender IS NOT NULL OR birth_date IS NOT NULL OR COALESCE(address, '') <> ''",
      );
      if (Number(profileState.rows[0]?.count || 0) > 0) {
        throw new BadRequestException({ error: 'Database đã có hồ sơ C03. Hãy sao lưu phiên bản 3.28/schema29 trước; không khôi phục bản cũ làm mất trường hồ sơ.' });
      }
    }

    if (!dryRun && legacyWithoutA05Payout) {
      const a05State = await this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM commission_ledger_entries
         WHERE admin_approved_at IS NOT NULL
            OR accountant_approved_at IS NOT NULL
            OR payout_ready_at IS NOT NULL
            OR payout_cycle_date IS NOT NULL`,
      );
      if (Number(a05State.rows[0]?.count || 0) > 0) {
        throw new BadRequestException({
          error: 'Không thể restore snapshot trước A05 khi database hiện tại đã có approval/payout cycle. Hãy export snapshot 3.26/schema27 hiện tại trước.',
        });
      }
    }

    if (!dryRun && legacyWithoutDealLifecycle && Number(before.counts.deal_room_unit_history || 0) > 0) {
      throw new BadRequestException({
        error: 'Không thể restore snapshot trước U06.4 khi database hiện tại đã có lịch sử đổi căn. Hãy export snapshot 3.16/schema17 hiện tại trước.',
      });
    }

    if (!dryRun && legacyWithoutDeals && Number(before.counts.deals || 0) > 0) {
      throw new BadRequestException({
        error: 'Không thể restore snapshot trước U06.1 khi database hiện tại đã có Deal. Hãy export snapshot 3.12/schema13 hiện tại trước.',
      });
    }

    if (!dryRun && legacyWithoutSelfBooking) {
      const linked = await this.db.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM bookings WHERE self_user_id IS NOT NULL',
      );
      if (Number(linked.rows[0]?.count || 0) > 0) {
        throw new BadRequestException({
          error: 'Không thể restore snapshot trước FE06.2 khi đã có liên kết tài khoản lịch xem. Hãy export snapshot 3.30/schema31 hiện tại trước.',
        });
      }
    }

    if (!dryRun && snapshot.schemaVersion < 34 && Number(before.counts.favorites || 0) > 0) {
      throw new BadRequestException({ error: 'Hãy export snapshot 3.33/schema34 trước khi restore: snapshot cũ không có danh sách yêu thích.' });
    }

    if (!dryRun && snapshot.schemaVersion === 35 && Number(before.counts.intake_history || 0) > 0) {
      throw new BadRequestException({ error: 'Hãy export snapshot 3.35/schema36 trước khi restore: bản cũ thiếu lịch sử xử lý yêu cầu.' });
    }

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        valid: true,
        incomingCounts,
        currentCounts:
          before.counts,
        preservedTables,
        warning:
          ['Chỉ kiểm tra bản sao lưu. Chưa thay đổi dữ liệu PostgreSQL.', warning].filter(Boolean).join(' '),
      };
    }

    await this.db.transaction(
      async (client) => {
        const truncateTables = Array.from(new Set([
          ...tables,
          ...(snapshot.schemaVersion === 35 ? ['intake_history' as TableName] : []),
          'favorites' as TableName,
          ...(rebuildRoomUnits ? U04_2_TABLES : []),
          ...(rebuildAmenities ? U04_4_ASSIGNMENT_TABLES : []),
          ...(legacyWithoutDeals ? U06_1_TABLES : []),
        ]));
        await client.query(
          `TRUNCATE TABLE "email_verification_tokens", "password_reset_tokens", "password_reset_limits", "refresh_tokens", ${truncateTables.map((table) => `"${table}"`).join(', ')}`,
        );

        for (const table of tables) {
          const rows = (snapshot.data as Partial<SnapshotData>)[table]!;
          if (legacyWithoutRoomTypeCatalog && table === 'rooms') {
            const normalizedRooms = rows.map((row) => ({
              ...row,
              room_type_catalog_id: legacyRoomTypeCatalogId(String(row.type || '')),
            }));
            await insertRows(client, table, normalizedRooms);
          } else {
            await insertRows(client, table, rows);
          }
        }

        if (rebuildRoomUnits) {
          await client.query('SELECT rebuild_room_units_from_legacy()');
        }
        if (legacyWithoutBookingRoomUnit) {
          await client.query('SELECT backfill_booking_room_units_a01()');
        }
        if (legacyWithoutA03Commission) {
          await client.query(
            'UPDATE commission_policy_configs SET is_active = FALSE, updated_at = NOW() WHERE is_active = TRUE',
          );
        }

        if (rebuildRoomTypeLifecycle) {
          await client.query(
            `
              UPDATE rooms
              SET lifecycle_status = CASE
                WHEN lower(COALESCE(status, '')) IN ('archived', 'deleted')
                  OR deleted_at IS NOT NULL
                THEN 'archived'
                ELSE 'active'
              END
            `,
          );
        }
        if (rebuildAmenities) {
          await client.query('SELECT rebuild_amenity_assignments_from_legacy()');
        }
        if (legacyWithoutCommissionLedger) {
          await client.query('SELECT backfill_commission_ledger_u07_3()');
        }
        if (legacyWithoutBookingRolePolicy) {
          await client.query(`
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
              updated_at = NOW()
          `);
          await client.query(`
            INSERT INTO roles (
              id, name, code, description, allowed_screens,
              booking_scope, booking_can_assign, booking_can_reassign
            ) VALUES
              ('role_b2c_admin', 'Admin B2C', 'b2c_admin', 'Tiếp nhận và điều phối lịch xem phòng.', '["dashboard","bookings"]'::jsonb, 'all', TRUE, TRUE),
              ('role_sale', 'Sale / Người dẫn xem', 'sale', 'Xử lý các lịch xem được phân công.', '["dashboard","bookings"]'::jsonb, 'assigned', FALSE, FALSE)
            ON CONFLICT (code) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              allowed_screens = EXCLUDED.allowed_screens,
              booking_scope = EXCLUDED.booking_scope,
              booking_can_assign = EXCLUDED.booking_can_assign,
              booking_can_reassign = EXCLUDED.booking_can_reassign,
              updated_at = NOW()
          `);
        }
        if (legacyWithoutBookingStatePolicy) {
          await client.query(`
            UPDATE roles
            SET
              booking_can_transition = code IN ('admin', 'superadmin', 'b2c_admin'),
              booking_can_cancel = code IN ('admin', 'superadmin', 'b2c_admin'),
              updated_at = NOW()
          `);
        }
        if (legacyWithoutBookingReschedulePolicy) {
          await client.query(`
            UPDATE roles
            SET
              booking_can_reschedule = code IN ('admin', 'superadmin', 'b2c_admin'),
              updated_at = NOW()
          `);
        }
        if (legacyWithoutDealRolePolicy) {
          await client.query(`
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
              updated_at = NOW()
          `);
        }
        if (legacyWithoutDealContractDeposit) {
          await client.query(`
            UPDATE roles
            SET
              deal_can_manage_contract_deposit = code IN ('admin', 'superadmin', 'b2c_admin'),
              updated_at = NOW()
          `);
        }
        if (legacyWithoutRentalSchedule) {
          await client.query(`
            UPDATE roles
            SET
              deal_can_manage_rental_schedule = code IN ('admin', 'superadmin', 'b2c_admin'),
              updated_at = NOW()
          `);
        }
        if (legacyWithoutDealLifecycle) {
          await client.query(`
            UPDATE roles
            SET
              deal_can_manage_lifecycle = code IN ('admin', 'superadmin', 'b2c_admin'),
              updated_at = NOW()
          `);
        }
        if (legacyWithoutA05Payout) {
          await client.query(`
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
              updated_at = NOW()
          `);
        }

        await client.query(`
          INSERT INTO roles (id, code, name, description, allowed_screens)
          VALUES ('role_customer', 'customer', 'Khách hàng', 'Tài khoản khách public, không có quyền CMS.', '[]'::jsonb)
          ON CONFLICT (code) DO NOTHING
        `);

        // U07.8 fixed consumer/accounting authorities are policy, not snapshot-owned grants.
        await client.query(`
          UPDATE roles
          SET
            description = CASE
              WHEN code = 'ctv_sale'
                THEN 'CTV consumer: khách giới thiệu, công cụ bán phòng và hoa hồng self-scope'
              ELSE description
            END,
            allowed_screens = CASE
              WHEN code IN ('ctv_sale', 'customer') THEN '[]'::jsonb
              WHEN code = 'commission_accountant' THEN '["commissionHistory"]'::jsonb
              ELSE allowed_screens
            END,
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
          WHERE code IN ('ctv_sale', 'commission_accountant', 'customer')
        `);

        // Re-apply the current U06.4 inventory projection after every restore.
        // This also makes pre-migration 025 schema-17 snapshots safe to restore:
        // signed + fully-deposited active Deals occupy their current Unit without
        // overwriting maintenance/archived inventory states.
        await client.query(`
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
            AND u.status NOT IN ('maintenance', 'archived')
        `);
      },
    );

    bumpSystemDataVersion();

    const after =
      await this.stats();

    return {
      success: true,
      dryRun: false,
      restoredAt:
        new Date().toISOString(),
      beforeCounts:
        before.counts,
      afterCounts:
        after.counts,
      refreshSessionsRevoked: true,
      preservedTables,
      warning,
    };
  }
}
