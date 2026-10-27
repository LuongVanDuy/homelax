import { z } from 'zod';

const rawRowsSchema = z.array(
  z.record(z.string(), z.unknown()),
);

const legacySnapshotDataSchema =
  z.object({
    roles: rawRowsSchema,
    users: rawRowsSchema,
    buildings: rawRowsSchema,
    rooms: rawRowsSchema,
    bookings: rawRowsSchema,
    commissions: rawRowsSchema,
    audit_logs: rawRowsSchema,
  }).strict();

const legacySnapshotSchema =
  z.object({
    version: z.literal('3.0.0'),
    schemaVersion: z.literal(1),
    databaseEngine:
      z.literal('PostgreSQL'),
    exportedAt: z.string().min(1),
    database: z.string().min(1),
    sensitive: z.literal(true),
    refreshTokensExcluded:
      z.literal(true),
    metadata: z.object({
      counts: z.record(
        z.string(),
        z.number().int().nonnegative(),
      ),
    }),
    data: legacySnapshotDataSchema,
  }).strict();

const profileSnapshotDataSchema = legacySnapshotDataSchema.extend({
  customers: rawRowsSchema,
  collaborators: rawRowsSchema,
});

const profileSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.1.0'),
  schemaVersion: z.literal(2),
  data: profileSnapshotDataSchema,
});

const roomInventorySnapshotDataSchema = profileSnapshotDataSchema.extend({
  room_units: rawRowsSchema,
  room_unit_migration_review: rawRowsSchema,
});

const roomUnitSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.2.0'),
  schemaVersion: z.literal(3),
  data: roomInventorySnapshotDataSchema,
});

const roomLifecycleSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.3.0'),
  schemaVersion: z.literal(4),
  data: roomInventorySnapshotDataSchema,
});

const amenitySnapshotDataSchema = roomInventorySnapshotDataSchema.extend({
  amenities: rawRowsSchema,
  building_amenities: rawRowsSchema,
  room_type_amenities: rawRowsSchema,
});

const amenitySnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.4.0'),
  schemaVersion: z.literal(5),
  data: amenitySnapshotDataSchema,
});

export const databaseSnapshotDataSchema = amenitySnapshotDataSchema.extend({
  schools: rawRowsSchema,
});

const schoolSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.5.0'),
  schemaVersion: z.literal(6),
  data: databaseSnapshotDataSchema,
});

const media360SnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.6.0'),
  schemaVersion: z.literal(7),
  data: databaseSnapshotDataSchema,
});

const exactBookingSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.7.0'),
  schemaVersion: z.literal(8),
  data: databaseSnapshotDataSchema,
});

const bookingCmsSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.8.0'),
  schemaVersion: z.literal(9),
  data: databaseSnapshotDataSchema,
});

const bookingRoleSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.9.0'),
  schemaVersion: z.literal(10),
  data: databaseSnapshotDataSchema,
});

const bookingStateSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.10.0'),
  schemaVersion: z.literal(11),
  data: databaseSnapshotDataSchema,
});

const bookingRescheduleSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.11.0'),
  schemaVersion: z.literal(12),
  data: databaseSnapshotDataSchema,
});

const dealSnapshotDataSchema = databaseSnapshotDataSchema.extend({
  deals: rawRowsSchema,
});

const dealCoreSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.12.0'),
  schemaVersion: z.literal(13),
  data: dealSnapshotDataSchema,
});

const dealRoleSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.13.0'),
  schemaVersion: z.literal(14),
  data: dealSnapshotDataSchema,
});

const dealContractDepositSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.14.0'),
  schemaVersion: z.literal(15),
  data: dealSnapshotDataSchema,
});

const dealRentalScheduleSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.15.0'),
  schemaVersion: z.literal(16),
  data: dealSnapshotDataSchema,
});

const dealLifecycleSnapshotDataSchema = dealSnapshotDataSchema.extend({
  deal_room_unit_history: rawRowsSchema,
});

const dealLifecycleSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.16.0'),
  schemaVersion: z.literal(17),
  data: dealLifecycleSnapshotDataSchema,
});

const affiliateTokenSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.17.0'),
  schemaVersion: z.literal(18),
  data: dealLifecycleSnapshotDataSchema,
});

const commissionConfigSnapshotDataSchema = dealLifecycleSnapshotDataSchema.extend({
  collaborator_types: rawRowsSchema,
  commission_policy_configs: rawRowsSchema,
});

const commissionConfigSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.18.0'),
  schemaVersion: z.literal(19),
  data: commissionConfigSnapshotDataSchema,
});

const commissionLedgerSnapshotDataSchema = commissionConfigSnapshotDataSchema.extend({
  commission_ledger_entries: rawRowsSchema,
});

const commissionLedgerSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.19.0'),
  schemaVersion: z.literal(20),
  data: commissionLedgerSnapshotDataSchema,
});

const commissionPayoutSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.20.0'),
  schemaVersion: z.literal(21),
  data: commissionLedgerSnapshotDataSchema,
});

const dealAdminClaritySnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.21.0'),
  schemaVersion: z.literal(22),
  data: commissionLedgerSnapshotDataSchema,
});

const bookingRoomUnitSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.22.0'),
  schemaVersion: z.literal(23),
  data: commissionLedgerSnapshotDataSchema,
});

const dealCommercialTermsSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.23.0'),
  schemaVersion: z.literal(24),
  data: commissionLedgerSnapshotDataSchema,
});

const commissionA03SnapshotDataSchema = commissionLedgerSnapshotDataSchema.extend({
  commission_allocation_targets: rawRowsSchema,
});

const commissionA03SnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.24.0'),
  schemaVersion: z.literal(25),
  data: commissionA03SnapshotDataSchema,
});

const commissionA04SnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.25.0'),
  schemaVersion: z.literal(26),
  data: commissionA03SnapshotDataSchema,
});

const u078PreCleanupSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.26.0'),
  schemaVersion: z.literal(27),
  data: commissionA03SnapshotDataSchema,
});

const c03PreProfileSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.27.0'),
  schemaVersion: z.literal(28),
  data: commissionA03SnapshotDataSchema,
});

const c03SnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.28.0'),
  schemaVersion: z.literal(29),
  data: commissionA03SnapshotDataSchema,
});

const roomTypeCatalogSnapshotDataSchema = commissionA03SnapshotDataSchema.extend({
  room_type_catalog: rawRowsSchema,
});

const roomTypeCatalogSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.29.0'),
  schemaVersion: z.literal(30),
  data: roomTypeCatalogSnapshotDataSchema,
});

const selfBookingSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.30.0'),
  schemaVersion: z.literal(31),
  data: roomTypeCatalogSnapshotDataSchema,
});

const customerAccountSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.31.0'),
  schemaVersion: z.literal(32),
  data: roomTypeCatalogSnapshotDataSchema,
});

const passwordResetSnapshotSchema = legacySnapshotSchema.extend({
  version: z.literal('3.32.0'),
  schemaVersion: z.literal(33),
  passwordResetTokensExcluded: z.literal(true),
  data: roomTypeCatalogSnapshotDataSchema,
});

const favoritesSnapshotSchema = passwordResetSnapshotSchema.extend({
  version: z.literal('3.33.0'),
  schemaVersion: z.literal(34),
  data: roomTypeCatalogSnapshotDataSchema.extend({ favorites: rawRowsSchema }),
});

const intakeSnapshotSchema = favoritesSnapshotSchema.extend({
  version: z.literal('3.34.0'),
  schemaVersion: z.literal(35),
  data: favoritesSnapshotSchema.shape.data.extend({ intake_requests: rawRowsSchema }),
});

const intakeHistorySnapshotSchema = intakeSnapshotSchema.extend({
  version: z.literal('3.35.0'),
  schemaVersion: z.literal(36),
  data: intakeSnapshotSchema.shape.data.extend({ intake_history: rawRowsSchema }),
});

const blogSnapshotSchema = intakeHistorySnapshotSchema.extend({
  version: z.literal('3.36.0'), schemaVersion: z.literal(37),
  data: intakeHistorySnapshotSchema.shape.data.extend({ blog_categories: rawRowsSchema, blog_posts: rawRowsSchema }),
});

const emailVerificationSnapshotSchema = blogSnapshotSchema.extend({
  version: z.literal('3.37.0'), schemaVersion: z.literal(38),
  emailVerificationTokensExcluded: z.literal(true),
});

const currentSnapshotSchema = emailVerificationSnapshotSchema.extend({
  version: z.literal('3.38.0'), schemaVersion: z.literal(39),
});

export const databaseSnapshotSchema = z.discriminatedUnion('schemaVersion', [
  emailVerificationSnapshotSchema,
  blogSnapshotSchema,
  intakeHistorySnapshotSchema,
  intakeSnapshotSchema,
  favoritesSnapshotSchema,
  passwordResetSnapshotSchema,
  legacySnapshotSchema,
  profileSnapshotSchema,
  roomUnitSnapshotSchema,
  roomLifecycleSnapshotSchema,
  amenitySnapshotSchema,
  schoolSnapshotSchema,
  media360SnapshotSchema,
  exactBookingSnapshotSchema,
  bookingCmsSnapshotSchema,
  bookingRoleSnapshotSchema,
  bookingStateSnapshotSchema,
  bookingRescheduleSnapshotSchema,
  dealCoreSnapshotSchema,
  dealRoleSnapshotSchema,
  dealContractDepositSnapshotSchema,
  dealRentalScheduleSnapshotSchema,
  dealLifecycleSnapshotSchema,
  affiliateTokenSnapshotSchema,
  commissionConfigSnapshotSchema,
  commissionLedgerSnapshotSchema,
  commissionPayoutSnapshotSchema,
  dealAdminClaritySnapshotSchema,
  bookingRoomUnitSnapshotSchema,
  dealCommercialTermsSnapshotSchema,
  commissionA03SnapshotSchema,
  commissionA04SnapshotSchema,
  u078PreCleanupSnapshotSchema,
  c03PreProfileSnapshotSchema,
  c03SnapshotSchema,
  roomTypeCatalogSnapshotSchema,
  selfBookingSnapshotSchema,
  customerAccountSnapshotSchema,
  currentSnapshotSchema,
]);

export const databaseRestoreRequestSchema =
  z.object({
    snapshot: databaseSnapshotSchema,
    confirm:
      z.literal('RESTORE_POSTGRESQL'),
    dryRun: z.boolean().default(true),
  }).strict();

export type DatabaseSnapshot =
  z.infer<typeof databaseSnapshotSchema>;

export type DatabaseRestoreRequest =
  z.infer<
    typeof databaseRestoreRequestSchema
  >;

// CMS Final Cutover C01: describe the existing DatabaseAdmin HTTP responses.
export const databaseCountsSchema = z.record(z.string(), z.number().int().nonnegative());

export const databaseStatsSchema = z.object({
  connected: z.boolean(),
  provider: z.literal('PostgreSQL'),
  database: z.string().min(1),
  postgresVersion: z.string(),
  latencyMs: z.number().nonnegative(),
  counts: databaseCountsSchema,
  snapshotVersion: z.string().min(1),
  timestamp: z.string().min(1),
});

export const databaseRestorePreviewSchema = z.object({
  success: z.literal(true),
  dryRun: z.literal(true),
  valid: z.literal(true),
  incomingCounts: databaseCountsSchema,
  currentCounts: databaseCountsSchema,
  preservedTables: z.array(z.string()),
  warning: z.string().nullable(),
});

export const databaseRestoreResultSchema = z.object({
  success: z.literal(true),
  dryRun: z.literal(false),
  restoredAt: z.string().min(1),
  beforeCounts: databaseCountsSchema,
  afterCounts: databaseCountsSchema,
  refreshSessionsRevoked: z.literal(true),
  preservedTables: z.array(z.string()),
  warning: z.string().nullable(),
});

export const databaseRestoreResponseSchema = z.discriminatedUnion('dryRun', [
  databaseRestorePreviewSchema, databaseRestoreResultSchema,
]);
export type DatabaseStats = z.infer<typeof databaseStatsSchema>;
export type DatabaseRestorePreview = z.infer<typeof databaseRestorePreviewSchema>;
export type DatabaseRestoreResult = z.infer<typeof databaseRestoreResultSchema>;
