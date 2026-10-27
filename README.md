# Homelax

Website tìm phòng và CMS quản lý tòa nhà, loại phòng, phòng cụ thể, lịch hẹn và giao dịch. Stack: React 19 / Vite 8, NestJS 12, PostgreSQL 18, Node.js 24.

Repository chứa mã chạy, tài nguyên giao diện, cấu hình Docker và bản dữ liệu kho phòng thực tế đã làm sạch. GitHub lưu mã nguồn và bộ khởi tạo SQL; PostgreSQL chạy trên máy của bạn hoặc máy chủ.

## Chạy toàn bộ bằng Docker

Yêu cầu: Git, Node.js 24 và Docker Engine/Desktop có Docker Compose v2 trở lên. Trên Windows, mở Docker Desktop ở chế độ Linux containers trước.

```sh
git clone https://github.com/LuongVanDuy/homelax.git
cd homelax
node scripts/setup-local.mjs
docker compose up -d --build
docker compose exec api node scripts/create-admin.mjs
```

Mở **http://localhost:8080**. Đăng nhập bằng `ADMIN_EMAIL` và `ADMIN_PASSWORD` trong file `.env` vừa tạo. Mỗi bản cài đặt có mật khẩu DB, mật khẩu admin và khóa JWT riêng; script không ghi đè `.env` đã có. Có thể sửa email/mật khẩu admin trong `.env` trước lệnh tạo admin. Lệnh này chỉ chạy khi bảng `users` còn trống, không reset tài khoản đã tồn tại.

Các dịch vụ:

| Thành phần | Địa chỉ |
| --- | --- |
| Website và API qua Nginx | http://localhost:8080 |
| Kiểm tra API/DB | http://localhost:8080/api/v2/health |
| Swagger API | http://localhost:8080/api/v2/docs |
| PostgreSQL từ máy host | 127.0.0.1:5433 |
| PostgreSQL trong mạng Compose | postgres:5432 |

```sh
docker compose ps
docker compose logs --tail=100 api postgres
docker compose stop
docker compose up -d
```

`postgres_data` lưu dữ liệu DB; `uploads` lưu ảnh mới tải lên. Chúng được giữ khi cập nhật/rebuild hoặc chạy `docker compose down`. **Không dùng `down -v` với dữ liệu cần giữ** vì nó xóa volume.

## Kết nối database

Thông số trong `.env`: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`. Dùng các giá trị này trong DBeaver/pgAdmin; host `127.0.0.1`, mặc định port `5433`. PostgreSQL chỉ mở trên localhost. API trong Docker tự dùng hostname `postgres`, còn `DATABASE_URL` trong `.env` dùng cho Node chạy trực tiếp trên máy.

```sh
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Khi volume DB còn trống, PostgreSQL tự chạy lần lượt `database/init/001-schema.sql` và `002-catalog.sql`. Đây là schema hiện hành có 48 migration và dữ liệu đã làm sạch; không import thủ công lần hai vào database đang có dữ liệu. Khi nâng phiên bản, API chạy các migration mới trong transaction, có kiểm tra checksum các migration cũ.

## Chạy phát triển bằng Node.js

```sh
npm ci
node scripts/setup-local.mjs
docker compose up -d postgres
```

Chờ PostgreSQL healthy (`docker compose ps`), sau đó mở hai terminal tại thư mục dự án:

```sh
# Terminal 1: API ở cổng 5001
npm run server:v2
```

```sh
# Terminal 2: Vite ở cổng 5173
npm run dev
```

Tạo admin ở lần chạy đầu: `node scripts/create-admin.mjs`. Mở http://localhost:5173; Vite chuyển `/api/v2` và `/uploads` tới API ở `localhost:5001`. Nếu Docker web/API đang chạy, dừng hai dịch vụ đó trước khi chạy Node API để cùng một database chỉ có một bộ app thử nghiệm.

Kiểm tra build: `npm run build`. Kiểm tra kiểu dữ liệu API: `npm run typecheck:server:v2`. Không dùng `vite preview` làm máy chủ production vì nó không cung cấp API/proxy như bộ Docker.

## Dữ liệu đi kèm và quyền riêng tư

Bản trích xuất ngày **27/10/2026** giữ số liệu và quan hệ kho phòng thực tế: **137 tòa, 253 loại phòng, 291 phòng cụ thể**, 116 tiện ích, 16 phân loại phòng và 118 trường/cơ sở (bao gồm bản ghi chưa đủ điều kiện hiển thị). Số lượng công khai trên giao diện tùy trạng thái tòa/phòng, tọa độ và bộ lọc; không bằng tổng số dòng DB.

Để phù hợp repository công khai:

- Tên, mã và ID của tòa/phòng được thay bằng định danh mới; giữ giá, diện tích, trạng thái, nhãn và quan hệ tiện ích.
- Địa chỉ nhà được rút còn xã/phường, quận/huyện, thành phố; tọa độ được làm thô theo ô khoảng 200 m.
- Bỏ chủ nhà, người tạo, danh sách người được xem, liên hệ, ghi chú/mô tả tự do, lịch sử và media 360. Ảnh kho phòng được thay bằng ảnh minh họa đóng gói sẵn để tránh công khai ảnh/metadata hoặc phụ thuộc kho ảnh riêng.
- Các bảng tài khoản, khách hàng, CTV, lịch hẹn, giao dịch, hoa hồng, yêu cầu liên hệ, blog, audit, token và phiên đăng nhập chỉ có cấu trúc, không có bản ghi thực tế. Admin được tạo riêng sau khi cài.
- Không có `.env`, dump gốc, thư mục uploads riêng, tài liệu nội bộ hay lịch sử Git cũ trong repo.

Số lượng chi tiết nằm trong `database/manifest.json`. Đây là dữ liệu khởi tạo để chạy và phát triển, không phải bản sao vận hành để phục hồi hệ thống thật. Các biểu tượng bên thứ ba giữ thông báo giấy phép tại `public/brands/LICENSE-simple-icons.md`.

## Cấu hình email, bản đồ và máy chủ

Chỉnh `.env` trên máy chạy, không commit file này:

- Email: `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`, `EMAIL_FROM`, `EMAIL_ADMIN_TO`. Chức năng quên mật khẩu/xác thực email cần SMTP thật và `PUBLIC_APP_URL` đúng.
- Tìm địa chỉ dùng Nominatim: người dùng bấm tìm mới gửi; ứng dụng cache và giới hạn tổng khoảng một lượt/giây qua DB. Đặt `GEOCODING_USER_AGENT` có thông tin liên hệ của bản triển khai, hoặc `GEOCODING_SEARCH_URL` khi dùng máy chủ khác.
- `WEB_PORT` đổi cổng website; `POSTGRES_PORT` đổi cổng DB trên host. Nếu đổi thông tin DB, sửa đồng bộ `DATABASE_URL` cho Node chạy ngoài Docker. Mật khẩu do setup sinh chỉ có ký tự hex, an toàn khi ghép URL.
- Trên VPS: đặt reverse proxy HTTPS phía trước `127.0.0.1:8080`, đổi `PUBLIC_APP_URL=https://ten-mien-cua-ban`, đặt `AUTH_COOKIE_SECURE=true` rồi recreate API. Không mở thẳng PostgreSQL ra Internet. Mặc định `AUTH_COOKIE_SECURE=false` dành cho thử localhost HTTP.
- Nếu cần lấy IP thật qua proxy, chỉ khai báo IP/CIDR proxy được tin trong `TRUSTED_PROXY_CIDRS`; không dùng wildcard. Chưa cấu hình thì API dùng IP kết nối trực tiếp.

## Cập nhật, sao lưu và khôi phục

Trước khi cập nhật, tạo dump DB bên ngoài container và sao lưu volume uploads. Ví dụ dưới đây dùng được trong PowerShell và shell Linux, không chuyển dữ liệu nhị phân qua phép redirect của PowerShell:

```sh
docker compose exec postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/homelax.dump'
docker compose cp postgres:/tmp/homelax.dump ./homelax.dump
docker compose exec -u root api tar -czf /tmp/homelax-uploads.tar.gz -C /app/public uploads
docker compose cp api:/tmp/homelax-uploads.tar.gz ./homelax-uploads.tar.gz
git pull --ff-only
docker compose up -d --build
```

Giữ dump và ảnh ở nơi riêng, không đưa lên GitHub. Khôi phục vào **database trống mới**, dùng đúng bộ schema/dump của bản sao lưu; không import `database/init/002-catalog.sql` chồng lên dữ liệu vận hành. Có thể dùng `pg_restore` trong container PostgreSQL với tùy chọn `--no-owner --no-privileges`; đối chiếu đích trước khi chạy. Không tự xóa volume hiện có để thử lại bootstrap.

## Change Log

- 2026-10-27: chuẩn bị repository Homelax chỉ gồm mã chạy, cấu hình và bộ khởi tạo dữ liệu thực tế đã làm sạch; thêm Docker web/API/PostgreSQL, tạo môi trường và admin riêng. README nội bộ trước đây được đổi thành `README.old.md` và giữ ở workspace, không xuất bản.
