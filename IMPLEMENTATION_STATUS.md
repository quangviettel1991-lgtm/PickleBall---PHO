# Kết quả xử lý — 28/09/2026

## Cập nhật production ngày 28/09

- Đã push commit `df47ffc` lên nhánh `codex/safe-club-upgrade`. Vercel đã triển khai commit này cho riêng dự án Phở; [pickle-ball-pho.vercel.app](https://pickle-ball-pho.vercel.app/) hoạt động. Deployment production `7XvxeDbWkhbFaMsPA5qBNhcVrwju` ở trạng thái Ready. Nhánh `main` và deployment A Sơn không bị thay đổi.
- Migration `supabase/migrations/202609230001_safe_club.sql` đã chạy thành công trên Supabase `wnmatztyaowvudlellha`. Truy vấn hậu migration xác nhận CLB 1 vẫn có đúng JSON ban đầu (`data_unchanged=true`, revision 0) và có một bản chụp nguyên dòng trong `club_private.pre_migration_backup`.
- Bản sao độc lập gần nhất trước migration: `backups/2026-09-28T14-41-00-612Z/remote-row.json`, SHA-256 `b397809bfda9b4b2f85d98232c09c68bdd9802b88f36d65c8ba7650f6865fb6f`. Bản này chứa 22 thành viên tổng cộng, 9 sự kiện, 90 trận, 8 giao dịch. File được gitignore và không được đưa lên GitHub/Vercel. Bản sao trước đó ngày 24/09 có 8 sự kiện.
- `amaquangvp@gmail.com` có một quyền `admin` cho CLB 1. Cả bốn bảng `club_private` đều bật RLS. Role `anon` không có quyền dùng schema riêng, SELECT/UPDATE trực tiếp bảng CLB hoặc gọi RPC ghi; chỉ gọi được RPC đọc công khai.
- Preview và production đều tải dữ liệu sau migration. Trang Tổng Quan production hiển thị 10 thành viên đang hoạt động, 90 trận và 9 sự kiện. Số 22 trong backup gồm cả thành viên cũ/đã lưu trữ. Kiểm tra đăng nhập bằng mật khẩu của chủ tài khoản và một thao tác ghi thực tế vẫn cần hoàn tất.
- Trước deployment, `npm run lint`, `npm test` (32/32), `npm run build` và dry run migration với bản JSON ngày 28/09 đều đạt. Dry run giữ nguyên dữ liệu và chụp bản trước migration.
- Gói Supabase Free không có full project backup/PITR. `remote-row.json` chỉ sao lưu dòng dữ liệu ứng dụng trên cloud, không bao gồm Auth hoặc dữ liệu chưa đồng bộ trên thiết bị khác. Không xóa localStorage hay file backup.

## Nhật ký kiểm tra và triển khai ngày 24/09 (trạng thái lịch sử)

### Trạng thái dữ liệu và triển khai

- Đã sửa mã nguồn trong workspace, chưa commit/push/deploy và chưa chạy SQL trên Supabase thật.
- Đã sao chép mã nguồn/cấu hình trước sửa vào `backups/source-20260923-212653`. Thư mục này có `.env`, được gitignore; không đưa lên Vercel/GitHub hoặc chia sẻ công khai.
- Đã xác nhận dự án Supabase `wnmatztyaowvudlellha` thuộc tài khoản `quangviettel1991-lgtm` và đang Healthy. Bản sao dòng CLB 1 mới nhất nằm tại `backups/2026-09-23T23-12-56-803Z/remote-row.json`, manifest SHA-256 đã đối chiếu; gồm 22 thành viên, 8 sự kiện, 90 trận, 8 giao dịch. Bản sao này có dữ liệu của một dòng CLB, chưa phải backup toàn bộ database hoặc dữ liệu còn riêng trên thiết bị khác.
- Dashboard Supabase xác nhận gói Free **không có project backups**. Bảng ứng dụng duy nhất trong schema `public` là `pickleball_club` với các cột `id bigint`, `data jsonb`, `updated_at timestamptz`; không có trigger tùy chỉnh, hàm public hoặc Storage bucket. Chính sách RLS hiện hành `Allow public insert and update` cho phép role `public` thực hiện ALL với `USING true` và `WITH CHECK true`; `Allow public read access` cho SELECT công khai. Đây là lỗ hổng production cần siết bằng migration sau khi sẵn sàng client và tài khoản quản trị.
- Đã chạy thử migration trên PostgreSQL nhúng bằng đúng JSON của bản sao này. Dòng dữ liệu không đổi và bản trước migration được lưu trong bảng riêng. Migration nay kiểm tra tài khoản quản trị và cấp quyền trong cùng transaction trước khi thay chính sách; bài kiểm thử bổ sung xác nhận thiếu tài khoản thì toàn bộ migration rollback. Chưa áp dụng lên Supabase thật.
- Supabase Auth hiện hiển thị chưa có người dùng. Đã chuẩn bị biểu mẫu tạo tài khoản cho `amaquangvp@gmail.com`; chủ tài khoản cần tự nhập mật khẩu riêng. Chưa cấp quyền trên cloud.
- Vercel đã xác nhận các biến môi trường cần thiết của `pickle-ball-pho` tồn tại ở Production và Preview. Cả dự án này lẫn `pickle-ball-a-son` cùng liên kết repository `quangviettel1991-lgtm/PickleBall---PHO`, nên không push trực tiếp lên `main` trước khi cách ly quy trình triển khai. Bản production của Phở vẫn ở commit `53fbddb`.
- Đã push commit `5eee6e2` lên nhánh `codex/safe-club-upgrade`; Vercel báo preview của Phở **Ready**, chưa promote. Website A Sơn đang dùng cùng Supabase project nhưng `VITE_CLUB_ID=2`, trong khi bảng hiện chỉ có dòng ID 1. Chủ dự án xác nhận A Sơn hiện không dùng và có thể tạm ngừng; sau migration, client cũ của A Sơn sẽ không ghi được cho đến khi được nâng cấp và cấp quyền thích hợp.

### Đối chiếu 24 phát hiện

| Mục báo cáo | Thay đổi đã có trong mã nguồn |
|---|---|
| 1–4: admin/PIN/quyền/riêng tư | Supabase Auth, cấp quyền theo user và CLB, RPC công khai chỉ chiếu trường cho phép; giao diện và lớp dữ liệu chặn ghi khi chưa đủ quyền; SQL RLS và thu hồi ghi trực tiếp. Hiệu lực production chờ migration. |
| 5: cấu hình fallback | Bắt buộc cấu hình môi trường; không tự trỏ vào DB thật. |
| 6–10: mất thay đổi/đồng bộ/trạng thái | Revision server, transaction, idempotency, hàng đợi, retry, chống response cũ, đối chiếu bản legacy, dừng khi xung đột, không tự tạo dữ liệu, phân biệt lưu trên máy/cloud; một tab ghi và trì hoãn refresh khi form mở. |
| 11–12: import/backup | Schema/ID/ngày/số tiền/đội/điểm, giới hạn 8 MB, xem trước nhập, snapshot trước thay thế, lỗi quota dừng ghi, bản cứu hộ thô; SQL giữ lịch sử và bản trước migration. |
| 13 và 21–22: sơ đồ | Lưu chung với dữ liệu CLB, ánh xạ matchId, sửa/xóa ở mọi màn hình nhất quán; chặn đổi nhánh có vòng sau đã đấu; cho đặt lại điểm vòng sau trước; nhận sơ đồ legacy có xác nhận. |
| 14 và 18–19: Elo/thành viên | Đổi hồ sơ không thay initialElo, chỉnh điểm gốc riêng; lưu trữ mềm thành viên, giữ lịch sử; tạo thành viên giữ Elo đã nhập; không replay khi chỉ tải dữ liệu. |
| 15–17 và 20: kết quả/thống kê | Chuẩn hóa played, dùng bộ lọc chung, ghi điểm trận chờ chuyển trạng thái, loại trận chưa đấu khỏi thống kê, giữ từng set và kiểm tra kết quả. |
| 23: thời gian | Ngày mặc định theo địa phương; timestamp trận mới có timezone. Không tự viết lại ngày lịch sử. |
| 24: khóa sự kiện | Kiểm tra ở lớp dữ liệu và SQL; mở khóa riêng trước khi đổi kết quả; lựa chọn sự kiện lấy bản mới nhất. |

### Giao diện và vận hành

Đã thêm lazy loading theo màn hình, tách CSS, phân trang danh sách chính, Error Boundary, điều hướng hash/Back/reload, cảnh báo dữ liệu chưa lưu, dialog có focus/ESC, nhãn điều khiển, reduced motion, sửa tương phản, favicon/ảnh chia sẻ và security headers/CSP trong cấu hình Vercel. README có môi trường, thứ tự backup/migration/deploy, xử lý xung đột và rollback.

### Kiểm chứng

Kết quả cuối: `npm run lint` và `npm run build` đạt; `npm test` đạt 32/32; Playwright đạt 15 bài, bỏ qua 1 bản chạy accessibility trùng lặp trên mobile (bản desktop đã đạt); `npm audit --json` báo 0 lỗ hổng trong dependency tại thời điểm kiểm tra.

Các lệnh kiểm chứng nằm trong `package.json`; dùng dữ liệu giả, không gửi thao tác ghi tới database thật. Các test bao gồm giữ Elo khi đổi tên, snapshot/restore, nhập sai không đổi byte đã lưu, lỗi quota, lịch sử thành viên đã xóa, sơ đồ, mất phản hồi, đồng thời, SQL RLS/quyền/riêng tư/revision và trình duyệt desktop/mobile. Kiểm tra accessibility bao gồm 9 màn hình và 4 dialog quản lý, không thấy vi phạm trong tập quy tắc WCAG A/AA tự động đã chạy.

Bundle đầu vào sau tách màn hình khoảng 394 kB (gzip 115 kB), so với 673 kB (gzip 169 kB) trước sửa. Đây là kích thước build, không phải kết quả Core Web Vitals. Kiểm tra accessibility tự động có phạm vi màn hình và dialog đã mở trong test, không chứng nhận toàn bộ WCAG.

### Chưa thể xác nhận

Đã sao lưu dòng CLB thật và thử migration trên bản sao, nhưng gói Free không cung cấp full project backup/PITR, và chưa khôi phục trên Supabase staging. Dữ liệu chưa đồng bộ chỉ có trên thiết bị khác không nằm trong bản sao cloud. Chưa đo Lighthouse/Core Web Vitals production, chưa thử trên thiết bị iOS/Safari thật. JSON toàn CLB vẫn là một bản ghi có revision; phù hợp phạm vi hiện tại nhưng cần tách bảng khi dữ liệu lớn. Chưa thể coi lỗi production đã được khắc phục trước khi migration, cấp quyền và triển khai client mới thành công.
