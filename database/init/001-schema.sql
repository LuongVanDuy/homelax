--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: account_phone_key(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.account_phone_key(value text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
        SELECT NULLIF(CASE
          WHEN digits LIKE '0084%' THEN '0' || substr(digits, 5)
          WHEN digits LIKE '84%' THEN '0' || substr(digits, 3)
          ELSE digits END, '')
        FROM (SELECT regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g') AS digits) clean
      $$;


--
-- Name: amenity_canonical_name(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.amenity_canonical_name(target_scope text, raw_name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
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
      $$;


--
-- Name: backfill_booking_room_units_a01(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.backfill_booking_room_units_a01() RETURNS void
    LANGUAGE plpgsql
    AS $$
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
      $$;


--
-- Name: backfill_commission_ledger_u07_3(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.backfill_commission_ledger_u07_3() RETURNS void
    LANGUAGE plpgsql
    AS $$
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
      $$;


--
-- Name: invalidate_email_verification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_email_verification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF lower(btrim(NEW.email)) IS DISTINCT FROM lower(btrim(OLD.email)) THEN
          NEW.email_verified_at := NULL;
          DELETE FROM email_verification_tokens WHERE user_id = OLD.id;
        END IF;
        RETURN NEW;
      END;
      $$;


--
-- Name: invalidate_password_reset_links(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_password_reset_links() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF OLD.password_hash IS DISTINCT FROM NEW.password_hash OR OLD.email IS DISTINCT FROM NEW.email THEN
          DELETE FROM password_reset_tokens WHERE user_id = NEW.id;
        END IF;
        RETURN NEW;
      END;
      $$;


--
-- Name: preserve_booking_room_unit_a01(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_booking_room_unit_a01() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF OLD.room_unit_id IS NOT NULL
           AND NEW.room_unit_id IS DISTINCT FROM OLD.room_unit_id THEN
          RAISE EXCEPTION 'Booking room_unit_id is immutable after canonical assignment';
        END IF;
        RETURN NEW;
      END;
      $$;


--
-- Name: preserve_initial_attribution(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_initial_attribution() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
      $$;


--
-- Name: rebuild_amenity_assignments_from_legacy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rebuild_amenity_assignments_from_legacy() RETURNS void
    LANGUAGE plpgsql
    AS $$
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
      $$;


--
-- Name: rebuild_room_units_from_legacy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rebuild_room_units_from_legacy() RETURNS void
    LANGUAGE plpgsql
    AS $$
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
      $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: amenities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amenities (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    scope text NOT NULL,
    category text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'admin'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amenities_scope_check CHECK ((scope = ANY (ARRAY['building'::text, 'room'::text]))),
    CONSTRAINT amenities_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    user_id text,
    user_name text,
    user_email text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    summary text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: blog_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_categories (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    CONSTRAINT blog_categories_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id text NOT NULL,
    category_id text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text NOT NULL,
    cover_image text NOT NULL,
    content text NOT NULL,
    status text NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blog_posts_check CHECK (((status <> 'published'::text) OR (published_at IS NOT NULL))),
    CONSTRAINT blog_posts_revision_check CHECK ((revision >= 0)),
    CONSTRAINT blog_posts_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT blog_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id text NOT NULL,
    customer_name text NOT NULL,
    phone text NOT NULL,
    email text,
    building_id text,
    building_code text,
    room_number text,
    appointment_date date,
    appointment_time text,
    status text DEFAULT 'Chờ xác nhận'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_id text,
    collaborator_id text,
    source_type text DEFAULT ''::text NOT NULL,
    source_channel text DEFAULT ''::text NOT NULL,
    source_recorded_at timestamp with time zone,
    appointment_at timestamp with time zone,
    appointment_timezone_offset_minutes smallint,
    room_type_id text,
    assigned_user_id text,
    final_price numeric,
    room_unit_id text,
    self_user_id text,
    CONSTRAINT bookings_final_price_check CHECK (((final_price IS NULL) OR (final_price >= (0)::numeric))),
    CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['Chờ xác nhận'::text, 'Đã xác nhận'::text, 'Đã xem phòng'::text, 'Đã huỷ'::text, 'Đã cọc'::text, 'Đã chốt'::text]))),
    CONSTRAINT bookings_timezone_offset_check CHECK (((appointment_timezone_offset_minutes IS NULL) OR ((appointment_timezone_offset_minutes >= '-840'::integer) AND (appointment_timezone_offset_minutes <= 840))))
);


--
-- Name: building_amenities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.building_amenities (
    building_id text NOT NULL,
    amenity_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: buildings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buildings (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_tiny boolean DEFAULT true NOT NULL,
    owner_type text DEFAULT 'tiny'::text NOT NULL,
    owner_id text,
    created_by text,
    allowed_viewer_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    deleted_at timestamp with time zone,
    rating numeric DEFAULT 5.0 NOT NULL,
    address text NOT NULL,
    district text NOT NULL,
    ward text,
    city text DEFAULT 'Hà Nội'::text NOT NULL,
    province text,
    latitude double precision,
    longitude double precision,
    vacant_rooms_count integer DEFAULT 0 NOT NULL,
    min_price numeric DEFAULT 0 NOT NULL,
    max_price numeric DEFAULT 0 NOT NULL,
    cover_image text,
    images jsonb DEFAULT '[]'::jsonb NOT NULL,
    rooms jsonb DEFAULT '[]'::jsonb NOT NULL,
    host_name text,
    host_phone text,
    host_email text,
    amenities_pccc jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_building jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_building_chung jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_building_an_ninh jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_building_pccc jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_building_thoat_nan jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    host_address text DEFAULT ''::text NOT NULL,
    media_360 jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: collaborator_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collaborator_types (
    id text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collaborators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collaborators (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id text,
    affiliate_token text DEFAULT ('ref_'::text || substr(md5((((random())::text || ':'::text) || (clock_timestamp())::text)), 1, 24)) NOT NULL,
    collaborator_type_id text,
    CONSTRAINT collaborators_affiliate_token_format_check CHECK ((affiliate_token ~ '^ref_[0-9a-f]{24}$'::text))
);


--
-- Name: commission_allocation_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_allocation_targets (
    id text NOT NULL,
    name text NOT NULL,
    target_kind text NOT NULL,
    percentage numeric(7,4) NOT NULL,
    is_ctv boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_by_user_id text,
    updated_by_user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commission_allocation_targets_percentage_check CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric))),
    CONSTRAINT commission_allocation_targets_target_kind_check CHECK ((target_kind = ANY (ARRAY['department'::text, 'position'::text])))
);


--
-- Name: commission_ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_ledger_entries (
    id text NOT NULL,
    deal_id text NOT NULL,
    customer_id text NOT NULL,
    collaborator_id text,
    collaborator_name_snapshot text DEFAULT ''::text NOT NULL,
    collaborator_type_id text,
    collaborator_type_name_snapshot text DEFAULT ''::text CONSTRAINT commission_ledger_entries_collaborator_type_name_snaps_not_null NOT NULL,
    room_unit_id text NOT NULL,
    room_unit_code_snapshot text DEFAULT ''::text NOT NULL,
    final_price_snapshot numeric NOT NULL,
    source_type_snapshot text DEFAULT ''::text NOT NULL,
    source_channel_snapshot text DEFAULT ''::text NOT NULL,
    source_recorded_at_snapshot timestamp with time zone,
    policy_id text,
    policy_percentage_snapshot numeric(7,4),
    policy_amount_6_months_snapshot numeric,
    policy_amount_12_months_snapshot numeric,
    selected_contract_months integer,
    commission_amount numeric,
    status text NOT NULL,
    review_required boolean DEFAULT false NOT NULL,
    review_reason text DEFAULT ''::text NOT NULL,
    eligible_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    withdrawal_requested_at timestamp with time zone,
    withdrawal_requested_by_user_id text,
    paid_at timestamp with time zone,
    paid_by_user_id text,
    gross_commission_x numeric,
    tax_rate_snapshot numeric(7,4),
    tax_amount numeric,
    allocation_pool numeric,
    allocation_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    ctv_allocation_target_id text,
    ctv_allocation_target_name_snapshot text DEFAULT ''::text CONSTRAINT commission_ledger_entries_ctv_allocation_target_name_s_not_null NOT NULL,
    ctv_percentage_snapshot numeric(7,4),
    ctv_base_amount numeric,
    ctv_bonus_amount numeric,
    calculated_at timestamp with time zone,
    calculated_by_user_id text,
    exception_resolution_count integer DEFAULT 0 NOT NULL,
    exception_resolution_reason text DEFAULT ''::text NOT NULL,
    exception_allocation_source text DEFAULT ''::text NOT NULL,
    exception_resolved_at timestamp with time zone,
    exception_resolved_by_user_id text,
    exception_resolution_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    admin_approved_at timestamp with time zone,
    admin_approved_by_user_id text,
    accountant_approved_at timestamp with time zone,
    accountant_approved_by_user_id text,
    payout_ready_at timestamp with time zone,
    payout_cycle_date date,
    CONSTRAINT commission_ledger_a03_allocation_array_check CHECK ((jsonb_typeof(allocation_snapshot) = 'array'::text)),
    CONSTRAINT commission_ledger_a03_amounts_check CHECK ((((gross_commission_x IS NULL) OR (gross_commission_x >= (0)::numeric)) AND ((tax_rate_snapshot IS NULL) OR ((tax_rate_snapshot >= (0)::numeric) AND (tax_rate_snapshot <= (100)::numeric))) AND ((tax_amount IS NULL) OR (tax_amount >= (0)::numeric)) AND ((allocation_pool IS NULL) OR (allocation_pool >= (0)::numeric)) AND ((ctv_percentage_snapshot IS NULL) OR ((ctv_percentage_snapshot >= (0)::numeric) AND (ctv_percentage_snapshot <= (100)::numeric))) AND ((ctv_base_amount IS NULL) OR (ctv_base_amount >= (0)::numeric)) AND ((ctv_bonus_amount IS NULL) OR (ctv_bonus_amount >= (0)::numeric)))),
    CONSTRAINT commission_ledger_a04_allocation_source_check CHECK ((exception_allocation_source = ANY (ARRAY[''::text, 'previous_snapshot'::text, 'current_config'::text]))),
    CONSTRAINT commission_ledger_a04_history_array_check CHECK ((jsonb_typeof(exception_resolution_history) = 'array'::text)),
    CONSTRAINT commission_ledger_a04_resolution_count_check CHECK ((exception_resolution_count >= 0)),
    CONSTRAINT commission_ledger_a05_accountant_approval_pair_check CHECK ((((accountant_approved_at IS NULL) AND (accountant_approved_by_user_id IS NULL)) OR ((accountant_approved_at IS NOT NULL) AND (accountant_approved_by_user_id IS NOT NULL)))),
    CONSTRAINT commission_ledger_a05_admin_approval_pair_check CHECK ((((admin_approved_at IS NULL) AND (admin_approved_by_user_id IS NULL)) OR ((admin_approved_at IS NOT NULL) AND (admin_approved_by_user_id IS NOT NULL)))),
    CONSTRAINT commission_ledger_a05_cycle_day_check CHECK (((payout_cycle_date IS NULL) OR (EXTRACT(day FROM payout_cycle_date) = ANY (ARRAY[(1)::numeric, (15)::numeric])))),
    CONSTRAINT commission_ledger_a05_payout_ready_check CHECK ((((payout_ready_at IS NULL) AND (payout_cycle_date IS NULL)) OR ((payout_ready_at IS NOT NULL) AND (payout_cycle_date IS NOT NULL) AND (admin_approved_at IS NOT NULL) AND (accountant_approved_at IS NOT NULL)))),
    CONSTRAINT commission_ledger_entries_commission_amount_check CHECK (((commission_amount IS NULL) OR (commission_amount >= (0)::numeric))),
    CONSTRAINT commission_ledger_entries_final_price_snapshot_check CHECK ((final_price_snapshot >= (0)::numeric)),
    CONSTRAINT commission_ledger_entries_selected_contract_months_check CHECK ((selected_contract_months = ANY (ARRAY[6, 12]))),
    CONSTRAINT commission_ledger_entries_status_check CHECK ((status = ANY (ARRAY['blocked_no_collaborator'::text, 'blocked_no_collaborator_type'::text, 'blocked_no_policy'::text, 'eligible_pending_amount'::text]))),
    CONSTRAINT commission_ledger_paid_fact_check CHECK (((payment_status <> 'paid'::text) OR (paid_at IS NOT NULL))),
    CONSTRAINT commission_ledger_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'paid'::text])))
);


--
-- Name: commission_policy_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_policy_configs (
    id text NOT NULL,
    room_unit_id text NOT NULL,
    collaborator_type_id text NOT NULL,
    percentage numeric(7,4) NOT NULL,
    amount_6_months numeric NOT NULL,
    amount_12_months numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_by_user_id text,
    updated_by_user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commission_policy_configs_amount_12_months_check CHECK ((amount_12_months >= (0)::numeric)),
    CONSTRAINT commission_policy_configs_amount_6_months_check CHECK ((amount_6_months >= (0)::numeric)),
    CONSTRAINT commission_policy_configs_percentage_check CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric)))
);


--
-- Name: commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commissions (
    id text NOT NULL,
    ctv_id text,
    ctv_name text NOT NULL,
    ctv_phone text,
    building_code text,
    room_number text,
    contract_value numeric DEFAULT 0 NOT NULL,
    commission_rate numeric DEFAULT 0 NOT NULL,
    commission_amount numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'Chờ duyệt'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    age integer,
    age_recorded_at date,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id text,
    source_type text DEFAULT ''::text NOT NULL,
    source_channel text DEFAULT ''::text NOT NULL,
    referred_by_collaborator_id text,
    source_recorded_at timestamp with time zone,
    CONSTRAINT customers_age_check CHECK ((age >= 0)),
    CONSTRAINT customers_age_recorded_at_check CHECK ((((age IS NULL) AND (age_recorded_at IS NULL)) OR ((age IS NOT NULL) AND (age_recorded_at IS NOT NULL))))
);


--
-- Name: deal_room_unit_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deal_room_unit_history (
    id text NOT NULL,
    deal_id text NOT NULL,
    from_room_unit_id text NOT NULL,
    to_room_unit_id text NOT NULL,
    changed_by_user_id text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deals (
    id text NOT NULL,
    booking_id text,
    customer_id text NOT NULL,
    collaborator_id text,
    source_type text DEFAULT ''::text NOT NULL,
    source_channel text DEFAULT ''::text NOT NULL,
    source_recorded_at timestamp with time zone,
    room_unit_id text NOT NULL,
    final_price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contract_signed_at timestamp with time zone,
    deposit_required_amount numeric,
    deposit_paid_amount numeric DEFAULT 0 NOT NULL,
    rental_start_date date,
    rental_end_date date,
    lifecycle_status text DEFAULT 'active'::text NOT NULL,
    cancelled_at timestamp with time zone,
    cancellation_reason text DEFAULT ''::text NOT NULL,
    assigned_user_id text,
    notes text DEFAULT ''::text NOT NULL,
    activity_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    contract_months integer,
    CONSTRAINT deals_activity_log_array_check CHECK ((jsonb_typeof(activity_log) = 'array'::text)),
    CONSTRAINT deals_cancelled_timestamp_check CHECK ((((lifecycle_status = 'active'::text) AND (cancelled_at IS NULL)) OR ((lifecycle_status = 'cancelled'::text) AND (cancelled_at IS NOT NULL)))),
    CONSTRAINT deals_contract_months_positive_check CHECK (((contract_months IS NULL) OR (contract_months > 0))),
    CONSTRAINT deals_deposit_paid_nonnegative CHECK ((deposit_paid_amount >= (0)::numeric)),
    CONSTRAINT deals_deposit_required_nonnegative CHECK (((deposit_required_amount IS NULL) OR (deposit_required_amount >= (0)::numeric))),
    CONSTRAINT deals_final_price_check CHECK ((final_price >= (0)::numeric)),
    CONSTRAINT deals_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['active'::text, 'cancelled'::text]))),
    CONSTRAINT deals_rental_date_order_check CHECK (((rental_end_date IS NULL) OR ((rental_start_date IS NOT NULL) AND (rental_end_date >= rental_start_date))))
);


--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verification_tokens (
    token_hash text NOT NULL,
    user_id text NOT NULL,
    email text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    user_id text NOT NULL,
    unit_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT favorites_unit_id_check CHECK (((length(unit_id) >= 1) AND (length(unit_id) <= 160)))
);


--
-- Name: intake_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intake_history (
    id uuid NOT NULL,
    request_id uuid NOT NULL,
    actor_id text NOT NULL,
    actor_name text NOT NULL,
    from_status text NOT NULL,
    to_status text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    revision integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT intake_history_from_status_check CHECK ((from_status = ANY (ARRAY['new'::text, 'processing'::text, 'completed'::text, 'rejected'::text, 'spam'::text]))),
    CONSTRAINT intake_history_note_check CHECK ((length(note) <= 4000)),
    CONSTRAINT intake_history_revision_check CHECK ((revision > 0)),
    CONSTRAINT intake_history_to_status_check CHECK ((to_status = ANY (ARRAY['new'::text, 'processing'::text, 'completed'::text, 'rejected'::text, 'spam'::text])))
);


--
-- Name: intake_rate_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intake_rate_events (
    phone_hash text NOT NULL,
    ip_hash text NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: intake_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intake_requests (
    id uuid NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    need text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    request_key_hash text NOT NULL,
    payload_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    CONSTRAINT intake_requests_kind_check CHECK ((kind = ANY (ARRAY['landlord_consultation'::text, 'collaborator_registration'::text, 'collaborator_consultation'::text, 'general_contact'::text]))),
    CONSTRAINT intake_requests_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 160))),
    CONSTRAINT intake_requests_need_check CHECK ((length(need) <= 4000)),
    CONSTRAINT intake_requests_payload_hash_check CHECK ((payload_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT intake_requests_phone_check CHECK ((phone ~ '^[0-9]{6,32}$'::text)),
    CONSTRAINT intake_requests_request_key_hash_check CHECK ((request_key_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT intake_requests_revision_check CHECK ((revision >= 0)),
    CONSTRAINT intake_requests_status_check CHECK ((status = ANY (ARRAY['new'::text, 'processing'::text, 'completed'::text, 'rejected'::text, 'spam'::text])))
);


--
-- Name: password_reset_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_limits (
    key_hash text NOT NULL,
    hits integer NOT NULL,
    window_started_at timestamp with time zone NOT NULL,
    last_allowed_at timestamp with time zone NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    token_hash text NOT NULL,
    user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    allowed_screens jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_scope text DEFAULT 'none'::text NOT NULL,
    booking_can_assign boolean DEFAULT false NOT NULL,
    booking_can_reassign boolean DEFAULT false NOT NULL,
    booking_can_transition boolean DEFAULT false NOT NULL,
    booking_can_cancel boolean DEFAULT false NOT NULL,
    booking_can_reschedule boolean DEFAULT false NOT NULL,
    deal_scope text DEFAULT 'none'::text NOT NULL,
    deal_can_create boolean DEFAULT false NOT NULL,
    deal_can_create_direct boolean DEFAULT false NOT NULL,
    deal_can_manage_contract_deposit boolean DEFAULT false NOT NULL,
    deal_can_manage_rental_schedule boolean DEFAULT false NOT NULL,
    deal_can_manage_lifecycle boolean DEFAULT false NOT NULL,
    CONSTRAINT roles_booking_scope_check CHECK ((booking_scope = ANY (ARRAY['none'::text, 'all'::text, 'assigned'::text]))),
    CONSTRAINT roles_deal_scope_check CHECK ((deal_scope = ANY (ARRAY['none'::text, 'all'::text, 'assigned'::text])))
);


--
-- Name: room_type_amenities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_type_amenities (
    room_type_id text NOT NULL,
    amenity_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: room_type_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_type_catalog (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT room_type_catalog_sort_order_check CHECK ((sort_order >= 0)),
    CONSTRAINT room_type_catalog_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: room_unit_migration_review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_unit_migration_review (
    id text NOT NULL,
    room_type_id text NOT NULL,
    building_id text NOT NULL,
    source_field text NOT NULL,
    candidate text NOT NULL,
    legacy_status text DEFAULT ''::text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by text,
    resolution_note text DEFAULT ''::text NOT NULL,
    CONSTRAINT room_unit_migration_review_reason_check CHECK ((reason = ANY (ARRAY['invalid_format'::text, 'duplicate_code_in_building'::text, 'legacy_status_requires_review'::text])))
);


--
-- Name: room_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_units (
    id text NOT NULL,
    room_type_id text NOT NULL,
    building_id text NOT NULL,
    code text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    available_from date,
    migration_source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT room_units_status_check CHECK ((status = ANY (ARRAY['available'::text, 'occupied'::text, 'maintenance'::text, 'archived'::text])))
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id text NOT NULL,
    room_type_id text,
    building_id text,
    building_code text,
    building_name text,
    room_number text NOT NULL,
    specific_rooms jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'Có sẵn'::text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    type text DEFAULT 'Studio'::text NOT NULL,
    area numeric DEFAULT 25 NOT NULL,
    max_occupants integer DEFAULT 2 NOT NULL,
    available_from text,
    cover_image text,
    images jsonb DEFAULT '[]'::jsonb NOT NULL,
    description text,
    amenities jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_noi_that jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_thiet_bi_dien jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_khu_vuc_bep jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_dac_diem_rieng jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_rieng jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_chung jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_an_ninh jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_pccc jsonb DEFAULT '[]'::jsonb NOT NULL,
    amenities_an_toan jsonb DEFAULT '[]'::jsonb NOT NULL,
    owner_id text,
    created_by text,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lifecycle_status text DEFAULT 'active'::text NOT NULL,
    media_360 jsonb DEFAULT '[]'::jsonb NOT NULL,
    room_type_catalog_id text NOT NULL,
    audience_groups jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT rooms_audience_groups_check CHECK (((jsonb_typeof(audience_groups) = 'array'::text) AND (jsonb_array_length(audience_groups) <= 4) AND (audience_groups <@ '["student", "young-worker", "couple", "family"]'::jsonb))),
    CONSTRAINT rooms_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schools (
    id text NOT NULL,
    name text NOT NULL,
    short_name text DEFAULT ''::text NOT NULL,
    campus text DEFAULT ''::text NOT NULL,
    school_type text DEFAULT ''::text NOT NULL,
    sector text DEFAULT ''::text NOT NULL,
    address text NOT NULL,
    ward text DEFAULT ''::text NOT NULL,
    latitude double precision,
    longitude double precision,
    radius_km numeric(8,3),
    keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    source text DEFAULT 'admin'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schools_coordinate_pair_check CHECK ((((latitude IS NULL) AND (longitude IS NULL)) OR ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision) AND ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))))),
    CONSTRAINT schools_radius_check CHECK (((radius_km IS NULL) OR ((radius_km > (0)::numeric) AND (radius_km <= (100)::numeric)))),
    CONSTRAINT schools_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    password_hash text,
    role_code text,
    role_name text,
    status text DEFAULT 'Chờ duyệt'::text NOT NULL,
    avatar text,
    auth_provider text DEFAULT 'local'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    gender text,
    birth_date date,
    address text DEFAULT ''::text NOT NULL,
    email_verified_at timestamp with time zone,
    CONSTRAINT users_profile_gender_check CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))))
);


--
-- Name: amenities amenities_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amenities
    ADD CONSTRAINT amenities_code_key UNIQUE (code);


--
-- Name: amenities amenities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amenities
    ADD CONSTRAINT amenities_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: blog_categories blog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_pkey PRIMARY KEY (id);


--
-- Name: blog_categories blog_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_slug_key UNIQUE (slug);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: building_amenities building_amenities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.building_amenities
    ADD CONSTRAINT building_amenities_pkey PRIMARY KEY (building_id, amenity_id);


--
-- Name: buildings buildings_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_code_key UNIQUE (code);


--
-- Name: buildings buildings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_pkey PRIMARY KEY (id);


--
-- Name: collaborator_types collaborator_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborator_types
    ADD CONSTRAINT collaborator_types_pkey PRIMARY KEY (id);


--
-- Name: collaborators collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborators
    ADD CONSTRAINT collaborators_pkey PRIMARY KEY (id);


--
-- Name: commission_allocation_targets commission_allocation_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_allocation_targets
    ADD CONSTRAINT commission_allocation_targets_pkey PRIMARY KEY (id);


--
-- Name: commission_ledger_entries commission_ledger_entries_deal_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_deal_id_key UNIQUE (deal_id);


--
-- Name: commission_ledger_entries commission_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: commission_policy_configs commission_policy_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_policy_configs
    ADD CONSTRAINT commission_policy_configs_pkey PRIMARY KEY (id);


--
-- Name: commission_policy_configs commission_policy_configs_room_unit_id_collaborator_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_policy_configs
    ADD CONSTRAINT commission_policy_configs_room_unit_id_collaborator_type_id_key UNIQUE (room_unit_id, collaborator_type_id);


--
-- Name: commissions commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissions
    ADD CONSTRAINT commissions_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: deal_room_unit_history deal_room_unit_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_room_unit_history
    ADD CONSTRAINT deal_room_unit_history_pkey PRIMARY KEY (id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (token_hash);


--
-- Name: email_verification_tokens email_verification_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_key UNIQUE (user_id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, unit_id);


--
-- Name: intake_history intake_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_history
    ADD CONSTRAINT intake_history_pkey PRIMARY KEY (id);


--
-- Name: intake_history intake_history_request_id_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_history
    ADD CONSTRAINT intake_history_request_id_revision_key UNIQUE (request_id, revision);


--
-- Name: intake_requests intake_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_requests
    ADD CONSTRAINT intake_requests_pkey PRIMARY KEY (id);


--
-- Name: intake_requests intake_requests_request_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_requests
    ADD CONSTRAINT intake_requests_request_key_hash_key UNIQUE (request_key_hash);


--
-- Name: password_reset_limits password_reset_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_limits
    ADD CONSTRAINT password_reset_limits_pkey PRIMARY KEY (key_hash);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (token_hash);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_key UNIQUE (user_id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: room_type_amenities room_type_amenities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type_amenities
    ADD CONSTRAINT room_type_amenities_pkey PRIMARY KEY (room_type_id, amenity_id);


--
-- Name: room_type_catalog room_type_catalog_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type_catalog
    ADD CONSTRAINT room_type_catalog_code_key UNIQUE (code);


--
-- Name: room_type_catalog room_type_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type_catalog
    ADD CONSTRAINT room_type_catalog_pkey PRIMARY KEY (id);


--
-- Name: room_unit_migration_review room_unit_migration_review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_unit_migration_review
    ADD CONSTRAINT room_unit_migration_review_pkey PRIMARY KEY (id);


--
-- Name: room_units room_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_units
    ADD CONSTRAINT room_units_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: blog_posts_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blog_posts_category ON public.blog_posts USING btree (category_id);


--
-- Name: blog_posts_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blog_posts_public ON public.blog_posts USING btree (status, published_at DESC, id);


--
-- Name: email_verification_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_verification_expiry ON public.email_verification_tokens USING btree (expires_at);


--
-- Name: idx_amenities_scope_category_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amenities_scope_category_status ON public.amenities USING btree (scope, category, status, sort_order);


--
-- Name: idx_amenities_scope_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_amenities_scope_name ON public.amenities USING btree (scope, lower(btrim(name)));


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_bookings_appointment_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_appointment_at ON public.bookings USING btree (appointment_at);


--
-- Name: idx_bookings_assigned_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_assigned_user_id ON public.bookings USING btree (assigned_user_id);


--
-- Name: idx_bookings_collaborator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_collaborator_id ON public.bookings USING btree (collaborator_id);


--
-- Name: idx_bookings_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_customer_id ON public.bookings USING btree (customer_id);


--
-- Name: idx_bookings_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_email ON public.bookings USING btree (lower(email));


--
-- Name: idx_bookings_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_phone ON public.bookings USING btree (phone);


--
-- Name: idx_bookings_room_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_room_type_id ON public.bookings USING btree (room_type_id);


--
-- Name: idx_bookings_room_unit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_room_unit_id ON public.bookings USING btree (room_unit_id);


--
-- Name: idx_bookings_self_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_self_user_id ON public.bookings USING btree (self_user_id) WHERE (self_user_id IS NOT NULL);


--
-- Name: idx_buildings_district; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buildings_district ON public.buildings USING btree (district);


--
-- Name: idx_buildings_min_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buildings_min_price ON public.buildings USING btree (min_price);


--
-- Name: idx_buildings_owner_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buildings_owner_type ON public.buildings USING btree (owner_type);


--
-- Name: idx_buildings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buildings_status ON public.buildings USING btree (status);


--
-- Name: idx_collaborators_archived_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborators_archived_created_at ON public.collaborators USING btree (archived_at, created_at DESC);


--
-- Name: idx_collaborators_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborators_type ON public.collaborators USING btree (collaborator_type_id);


--
-- Name: idx_collaborators_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collaborators_user_id ON public.collaborators USING btree (user_id);


--
-- Name: idx_collaborators_user_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_collaborators_user_id_unique ON public.collaborators USING btree (user_id);


--
-- Name: idx_commission_ledger_collaborator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_ledger_collaborator ON public.commission_ledger_entries USING btree (collaborator_id);


--
-- Name: idx_commission_ledger_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_ledger_payment_status ON public.commission_ledger_entries USING btree (payment_status, withdrawal_requested_at);


--
-- Name: idx_commission_ledger_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_ledger_status ON public.commission_ledger_entries USING btree (status, review_required);


--
-- Name: idx_commission_policy_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_policy_active ON public.commission_policy_configs USING btree (is_active);


--
-- Name: idx_commission_policy_collaborator_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_policy_collaborator_type ON public.commission_policy_configs USING btree (collaborator_type_id);


--
-- Name: idx_commission_policy_room_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commission_policy_room_unit ON public.commission_policy_configs USING btree (room_unit_id);


--
-- Name: idx_commissions_ctv_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_ctv_id ON public.commissions USING btree (ctv_id);


--
-- Name: idx_customers_archived_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_archived_created_at ON public.customers USING btree (archived_at, created_at DESC);


--
-- Name: idx_customers_referrer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_referrer ON public.customers USING btree (referred_by_collaborator_id);


--
-- Name: idx_customers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_user_id ON public.customers USING btree (user_id);


--
-- Name: idx_deal_room_unit_history_deal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_room_unit_history_deal ON public.deal_room_unit_history USING btree (deal_id, changed_at DESC);


--
-- Name: idx_deals_assigned_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_assigned_user_id ON public.deals USING btree (assigned_user_id);


--
-- Name: idx_deals_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_booking_id ON public.deals USING btree (booking_id);


--
-- Name: idx_deals_collaborator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_collaborator_id ON public.deals USING btree (collaborator_id);


--
-- Name: idx_deals_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_created_at ON public.deals USING btree (created_at DESC);


--
-- Name: idx_deals_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_customer_id ON public.deals USING btree (customer_id);


--
-- Name: idx_deals_rental_end_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_rental_end_date ON public.deals USING btree (rental_end_date);


--
-- Name: idx_deals_rental_start_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_rental_start_date ON public.deals USING btree (rental_start_date);


--
-- Name: idx_deals_room_unit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_room_unit_id ON public.deals USING btree (room_unit_id);


--
-- Name: idx_favorites_owner_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_owner_created ON public.favorites USING btree (user_id, created_at DESC, unit_id);


--
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_room_unit_review_building; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_unit_review_building ON public.room_unit_migration_review USING btree (building_id, reason);


--
-- Name: idx_room_unit_review_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_room_unit_review_unique ON public.room_unit_migration_review USING btree (room_type_id, source_field, lower(candidate), reason);


--
-- Name: idx_room_unit_review_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_unit_review_unresolved ON public.room_unit_migration_review USING btree (building_id, reason, created_at) WHERE (resolved_at IS NULL);


--
-- Name: idx_room_units_available_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_units_available_from ON public.room_units USING btree (available_from);


--
-- Name: idx_room_units_building_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_room_units_building_code_unique ON public.room_units USING btree (building_id, lower(code));


--
-- Name: idx_room_units_building_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_units_building_status ON public.room_units USING btree (building_id, status);


--
-- Name: idx_room_units_room_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_units_room_type_id ON public.room_units USING btree (room_type_id);


--
-- Name: idx_rooms_building_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_building_code ON public.rooms USING btree (building_code);


--
-- Name: idx_rooms_building_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_building_id ON public.rooms USING btree (building_id);


--
-- Name: idx_rooms_lifecycle_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_lifecycle_status ON public.rooms USING btree (lifecycle_status);


--
-- Name: idx_rooms_room_type_catalog_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_room_type_catalog_id ON public.rooms USING btree (room_type_catalog_id);


--
-- Name: idx_rooms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_status ON public.rooms USING btree (status);


--
-- Name: idx_schools_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schools_location ON public.schools USING btree (latitude, longitude, radius_km);


--
-- Name: idx_schools_status_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schools_status_name ON public.schools USING btree (status, lower(name));


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (lower(email));


--
-- Name: idx_users_role_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_code ON public.users USING btree (role_code);


--
-- Name: intake_rate_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_rate_expiry ON public.intake_rate_events USING btree (created_at);


--
-- Name: intake_rate_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_rate_ip ON public.intake_rate_events USING btree (ip_hash, created_at);


--
-- Name: intake_rate_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_rate_phone ON public.intake_rate_events USING btree (phone_hash, created_at);


--
-- Name: intake_requests_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_requests_created ON public.intake_requests USING btree (created_at DESC, id DESC);


--
-- Name: intake_requests_kind_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_requests_kind_status ON public.intake_requests USING btree (kind, status, created_at DESC);


--
-- Name: password_reset_limits_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_reset_limits_expiry ON public.password_reset_limits USING btree (window_started_at);


--
-- Name: password_reset_tokens_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_reset_tokens_expiry ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: uq_collaborator_types_active_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_collaborator_types_active_name ON public.collaborator_types USING btree (lower(btrim(name))) WHERE (archived_at IS NULL);


--
-- Name: uq_collaborators_affiliate_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_collaborators_affiliate_token ON public.collaborators USING btree (affiliate_token);


--
-- Name: uq_commission_allocation_single_active_ctv; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_commission_allocation_single_active_ctv ON public.commission_allocation_targets USING btree (is_ctv) WHERE ((is_active = true) AND (is_ctv = true));


--
-- Name: uq_commission_allocation_target_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_commission_allocation_target_name ON public.commission_allocation_targets USING btree (lower(btrim(name)));


--
-- Name: uq_deals_active_room_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_deals_active_room_unit ON public.deals USING btree (room_unit_id) WHERE (lifecycle_status = 'active'::text);


--
-- Name: uq_deals_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_deals_booking_id ON public.deals USING btree (booking_id) WHERE (booking_id IS NOT NULL);


--
-- Name: uq_room_type_catalog_name_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_room_type_catalog_name_ci ON public.room_type_catalog USING btree (lower(btrim(name)));


--
-- Name: users_email_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key_unique ON public.users USING btree (lower(btrim(email)));


--
-- Name: users_phone_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_phone_key_unique ON public.users USING btree (public.account_phone_key(phone));


--
-- Name: bookings trg_bookings_preserve_initial_attribution; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bookings_preserve_initial_attribution BEFORE UPDATE OF customer_id, collaborator_id, source_type, source_channel, source_recorded_at ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.preserve_initial_attribution();


--
-- Name: customers trg_customers_preserve_initial_attribution; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customers_preserve_initial_attribution BEFORE UPDATE OF source_type, source_channel, referred_by_collaborator_id, source_recorded_at ON public.customers FOR EACH ROW EXECUTE FUNCTION public.preserve_initial_attribution();


--
-- Name: bookings trg_preserve_booking_room_unit_a01; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_preserve_booking_room_unit_a01 BEFORE UPDATE OF room_unit_id ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.preserve_booking_room_unit_a01();


--
-- Name: users users_invalidate_email_verification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_invalidate_email_verification BEFORE UPDATE OF email ON public.users FOR EACH ROW EXECUTE FUNCTION public.invalidate_email_verification();


--
-- Name: users users_invalidate_password_reset_links; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_invalidate_password_reset_links AFTER UPDATE OF password_hash, email ON public.users FOR EACH ROW EXECUTE FUNCTION public.invalidate_password_reset_links();


--
-- Name: blog_posts blog_posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.blog_categories(id);


--
-- Name: bookings bookings_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bookings bookings_collaborator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES public.collaborators(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bookings bookings_room_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_room_unit_id_fkey FOREIGN KEY (room_unit_id) REFERENCES public.room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_self_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_self_user_id_fkey FOREIGN KEY (self_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: building_amenities building_amenities_amenity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.building_amenities
    ADD CONSTRAINT building_amenities_amenity_id_fkey FOREIGN KEY (amenity_id) REFERENCES public.amenities(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: building_amenities building_amenities_building_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.building_amenities
    ADD CONSTRAINT building_amenities_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: collaborators collaborators_collaborator_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborators
    ADD CONSTRAINT collaborators_collaborator_type_id_fkey FOREIGN KEY (collaborator_type_id) REFERENCES public.collaborator_types(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: collaborators collaborators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborators
    ADD CONSTRAINT collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: commission_allocation_targets commission_allocation_targets_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_allocation_targets
    ADD CONSTRAINT commission_allocation_targets_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_allocation_targets commission_allocation_targets_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_allocation_targets
    ADD CONSTRAINT commission_allocation_targets_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_ledger_entries commission_ledger_entries_accountant_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_accountant_approved_by_user_id_fkey FOREIGN KEY (accountant_approved_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_ledger_entries commission_ledger_entries_admin_approved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_admin_approved_by_user_id_fkey FOREIGN KEY (admin_approved_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_ledger_entries commission_ledger_entries_calculated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_calculated_by_user_id_fkey FOREIGN KEY (calculated_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_ledger_entries commission_ledger_entries_collaborator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES public.collaborators(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_ledger_entries commission_ledger_entries_collaborator_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_collaborator_type_id_fkey FOREIGN KEY (collaborator_type_id) REFERENCES public.collaborator_types(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_ledger_entries commission_ledger_entries_ctv_allocation_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_ctv_allocation_target_id_fkey FOREIGN KEY (ctv_allocation_target_id) REFERENCES public.commission_allocation_targets(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_ledger_entries commission_ledger_entries_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commission_ledger_entries commission_ledger_entries_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commission_ledger_entries commission_ledger_entries_exception_resolved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_exception_resolved_by_user_id_fkey FOREIGN KEY (exception_resolved_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_ledger_entries commission_ledger_entries_paid_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_paid_by_user_id_fkey FOREIGN KEY (paid_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_ledger_entries commission_ledger_entries_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.commission_policy_configs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_ledger_entries commission_ledger_entries_room_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_room_unit_id_fkey FOREIGN KEY (room_unit_id) REFERENCES public.room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commission_ledger_entries commission_ledger_entries_withdrawal_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_ledger_entries
    ADD CONSTRAINT commission_ledger_entries_withdrawal_requested_by_user_id_fkey FOREIGN KEY (withdrawal_requested_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_policy_configs commission_policy_configs_collaborator_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_policy_configs
    ADD CONSTRAINT commission_policy_configs_collaborator_type_id_fkey FOREIGN KEY (collaborator_type_id) REFERENCES public.collaborator_types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commission_policy_configs commission_policy_configs_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_policy_configs
    ADD CONSTRAINT commission_policy_configs_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: commission_policy_configs commission_policy_configs_room_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_policy_configs
    ADD CONSTRAINT commission_policy_configs_room_unit_id_fkey FOREIGN KEY (room_unit_id) REFERENCES public.room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: commission_policy_configs commission_policy_configs_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_policy_configs
    ADD CONSTRAINT commission_policy_configs_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customers customers_referred_by_collaborator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_referred_by_collaborator_id_fkey FOREIGN KEY (referred_by_collaborator_id) REFERENCES public.collaborators(id) ON DELETE SET NULL;


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: deal_room_unit_history deal_room_unit_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_room_unit_history
    ADD CONSTRAINT deal_room_unit_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: deal_room_unit_history deal_room_unit_history_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_room_unit_history
    ADD CONSTRAINT deal_room_unit_history_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deal_room_unit_history deal_room_unit_history_from_room_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_room_unit_history
    ADD CONSTRAINT deal_room_unit_history_from_room_unit_id_fkey FOREIGN KEY (from_room_unit_id) REFERENCES public.room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deal_room_unit_history deal_room_unit_history_to_room_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_room_unit_history
    ADD CONSTRAINT deal_room_unit_history_to_room_unit_id_fkey FOREIGN KEY (to_room_unit_id) REFERENCES public.room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deals deals_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: deals deals_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deals deals_collaborator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES public.collaborators(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deals deals_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: deals deals_room_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_room_unit_id_fkey FOREIGN KEY (room_unit_id) REFERENCES public.room_units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: intake_history intake_history_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_history
    ADD CONSTRAINT intake_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.intake_requests(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: room_type_amenities room_type_amenities_amenity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type_amenities
    ADD CONSTRAINT room_type_amenities_amenity_id_fkey FOREIGN KEY (amenity_id) REFERENCES public.amenities(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: room_type_amenities room_type_amenities_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type_amenities
    ADD CONSTRAINT room_type_amenities_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: room_unit_migration_review room_unit_migration_review_building_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_unit_migration_review
    ADD CONSTRAINT room_unit_migration_review_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: room_unit_migration_review room_unit_migration_review_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_unit_migration_review
    ADD CONSTRAINT room_unit_migration_review_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: room_units room_units_building_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_units
    ADD CONSTRAINT room_units_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: room_units room_units_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_units
    ADD CONSTRAINT room_units_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rooms rooms_building_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rooms rooms_room_type_catalog_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_room_type_catalog_fk FOREIGN KEY (room_type_catalog_id) REFERENCES public.room_type_catalog(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_role_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


