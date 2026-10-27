import { BlogModule } from './modules/blog/blog.module.js';
import { LocationsModule } from './modules/locations/locations.module.js';
import { IntakeModule } from './modules/intake/intake.module.js';
import { SelfAccountModule } from './modules/self-account/self-account.module.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { SecurityModule } from './common/auth/security.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AmenitiesModule } from './modules/amenities/amenities.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { CommissionConfigModule } from './modules/commission-config/commission-config.module.js';
import { CommissionLedgerModule } from './modules/commission-ledger/commission-ledger.module.js';
import { DatabaseAdminModule } from './modules/database-admin/database-admin.module.js';
import { DealsModule } from './modules/deals/deals.module.js';
import { BuildingsModule } from './modules/buildings/buildings.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { RoomsModule } from './modules/rooms/rooms.module.js';
import { RoomTypeCatalogModule } from './modules/room-type-catalog/room-type-catalog.module.js';
import { SchoolsModule } from './modules/schools/schools.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ContactsModule } from './modules/contacts/contacts.module.js';

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    SystemModule,
    AuthModule,
    SelfAccountModule,
    IntakeModule,
    BlogModule,
    LocationsModule,
    BuildingsModule,
    AmenitiesModule,
    RoomsModule,
    RoomTypeCatalogModule,
    SchoolsModule,
    BookingsModule,
    DealsModule,
    CommissionConfigModule,
    CommissionLedgerModule,
    DatabaseAdminModule,
    UsersModule,
    ContactsModule,
    RolesModule,
    UploadsModule,
    AuditModule,
  ],
})
export class AppModule {}
