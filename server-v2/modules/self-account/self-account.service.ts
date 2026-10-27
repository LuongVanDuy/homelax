import { Injectable, NotFoundException } from '@nestjs/common';
import { favoritePageSchema, publicRoomTypeSchema, selfRentalSchema, type SelfPageQuery } from '@tinyhouse/contracts';
import { PostgresService } from '../../database/postgres.service.js';
import { pageOffset, pageResult } from '../../common/list/list-utils.js';
import { RoomsService } from '../rooms/rooms.service.js';

const rentalFrom = `FROM deals d JOIN customers c ON c.id = d.customer_id
  JOIN room_units u ON u.id = d.room_unit_id JOIN rooms r ON r.id = u.room_type_id
  JOIN buildings b ON b.id = u.building_id WHERE c.user_id = $1`;

@Injectable()
export class SelfAccountService {
  constructor(private readonly db: PostgresService, private readonly rooms: RoomsService) {}

  async favoriteState(userId: string, unitId: string) {
    const result = await this.db.query('SELECT 1 FROM favorites WHERE user_id = $1 AND unit_id = $2', [userId, unitId]);
    return { saved: result.rowCount! > 0 };
  }

  async saveFavorite(userId: string, unitId: string) {
    // Validate the current public hierarchy in the same statement as insertion.
    const result = await this.db.query(`INSERT INTO favorites (user_id, unit_id)
      SELECT $1, u.id FROM room_units u JOIN rooms r ON r.id = u.room_type_id
      JOIN buildings b ON b.id = u.building_id AND b.id = r.building_id
      WHERE u.id = $2 AND u.status IN ('available', 'occupied', 'maintenance')
        AND r.deleted_at IS NULL AND r.lifecycle_status = 'active'
        AND b.deleted_at IS NULL AND b.status = 'active'
      ON CONFLICT (user_id, unit_id) DO UPDATE SET unit_id = EXCLUDED.unit_id RETURNING unit_id`, [userId, unitId]);
    if (!result.rowCount) {
      if ((await this.favoriteState(userId, unitId)).saved) return { saved: true };
      throw new NotFoundException('Căn không còn được công khai.');
    }
    return { saved: true };
  }

  async removeFavorite(userId: string, unitId: string) {
    await this.db.query('DELETE FROM favorites WHERE user_id = $1 AND unit_id = $2', [userId, unitId]);
    return { saved: false };
  }

  async favorites(userId: string, query: SelfPageQuery) {
    const count = await this.db.query('SELECT count(*) FROM favorites WHERE user_id = $1', [userId]);
    const result = await this.db.query(`SELECT f.unit_id, f.created_at, u.room_type_id FROM favorites f
      LEFT JOIN room_units u ON u.id = f.unit_id WHERE f.user_id = $1
      ORDER BY f.created_at DESC, f.unit_id LIMIT $2 OFFSET $3`, [userId, query.pageSize, pageOffset(query.page, query.pageSize)]);
    // Reuse the safe inventory projection; never return archived/private content as a fallback.
    const rooms = new Map<string, ReturnType<RoomsService['detail']>>();
    const items = await Promise.all(result.rows.map(async row => {
      let room = null;
      if (row.room_type_id) {
        if (!rooms.has(row.room_type_id)) rooms.set(row.room_type_id, this.rooms.detail(row.room_type_id, null, 'public'));
        try {
          const candidate = publicRoomTypeSchema.parse(await rooms.get(row.room_type_id)!);
          if (candidate.listingState === 'listed' && candidate.roomUnits.some((unit: { id: string }) => unit.id === row.unit_id)) room = candidate;
        } catch (error) { if (!(error instanceof NotFoundException)) throw error; }
      }
      return { unitId: row.unit_id, savedAt: row.created_at.toISOString(), room };
    }));
    return favoritePageSchema.parse(pageResult(items, query.page, query.pageSize, Number(count.rows[0].count)));
  }

  async rentals(userId: string, query: SelfPageQuery) {
    const count = await this.db.query(`SELECT count(*) ${rentalFrom}`, [userId]);
    const result = await this.db.query(`SELECT d.id, d.room_unit_id, u.code AS unit_code,
      r.id AS type_id, r.type AS type_name, b.id AS building_id, b.code AS building_code, b.name AS building_name,
      d.final_price, d.contract_months, d.rental_start_date::text, d.rental_end_date::text,
      d.lifecycle_status, d.contract_signed_at, d.deposit_required_amount, d.deposit_paid_amount
      ${rentalFrom} ORDER BY d.created_at DESC, d.id LIMIT $2 OFFSET $3`, [userId, query.pageSize, pageOffset(query.page, query.pageSize)]);
    return pageResult(result.rows.map(row => selfRentalSchema.parse({
      id: row.id, roomUnitId: row.room_unit_id, roomUnitCode: row.unit_code,
      roomTypeId: row.type_id, roomTypeName: row.type_name,
      buildingId: row.building_id, buildingCode: row.building_code, buildingName: row.building_name,
      finalPrice: Number(row.final_price), contractMonths: row.contract_months == null ? null : Number(row.contract_months),
      rentalStartDate: row.rental_start_date, rentalEndDate: row.rental_end_date, lifecycleStatus: row.lifecycle_status,
      contractSignedAt: row.contract_signed_at?.toISOString() || null,
      depositRequiredAmount: row.deposit_required_amount == null ? null : Number(row.deposit_required_amount),
      depositPaidAmount: Number(row.deposit_paid_amount || 0),
    })), query.page, query.pageSize, Number(count.rows[0].count));
  }
}
