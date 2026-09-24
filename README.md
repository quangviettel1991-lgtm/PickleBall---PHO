# Pickleball Phở

Ứng dụng quản lý thành viên, Elo, lịch thi đấu, giải đấu và quỹ CLB. React 18, Vite, Supabase Auth/PostgreSQL. Khách xem Tổng Quan, Xếp Hạng và Đối Đầu; tài khoản quản trị được cấp quyền riêng mới có thể ghi dữ liệu.

## Chạy và kiểm thử

Node.js 20.11+ (bản đã kiểm thử: 20.11.0). Cài đúng lockfile bằng `npm ci`. Sao chép `.env.example` thành `.env` và cấu hình đúng dự án. Không đưa service-role key hay mật khẩu vào biến `VITE_*`.

```powershell
npm run dev
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright chạy hai máy chủ thử localhost với dữ liệu giả và chặn kết nối HTTPS. Đóng các tiến trình đang chiếm cổng 4175/4176 trước khi chạy. Trên Windows, nếu dùng máy chủ thử đã mở riêng, đặt `PW_EXTERNAL_SERVER=1`; máy chủ 4175 phải dùng `VITE_LOCAL_MODE=true`, máy chủ 4176 dùng URL/key giả được mô tả trong `playwright.config.js`. Không dùng máy chủ production làm đích kiểm thử.

`VITE_LOCAL_MODE=true` chỉ cho phép chỉnh sửa trên localhost, không kết nối dữ liệu CLB. Chế độ này phải tắt trên Vercel. Mã không tự chọn Supabase mặc định khi thiếu cấu hình.

## Triển khai bản nâng cấp an toàn

**Không triển khai frontend mới riêng lẻ trước khi chuẩn bị backend.** Bản mới cần các RPC và quyền trong migration. Bản cũ sẽ mất quyền ghi khi migration có hiệu lực, nên cần một khoảng bảo trì và yêu cầu các quản trị viên ngừng chỉnh sửa.

1. Xác minh Supabase project đang hoạt động, `VITE_CLUB_ID` đúng bản ghi, bảng `public.pickleball_club` có `id bigint`, `data jsonb`, `updated_at timestamptz`. Kiểm tra trigger/policy hiện có và các ứng dụng khác đang dùng bảng; migration thay policy và thu hồi quyền ghi trực tiếp của anon/authenticated.
2. Xuất JSON từ từng thiết bị có thể còn dữ liệu chưa đồng bộ. Giữ các file gốc, không xóa localStorage. Nếu gói Supabase hỗ trợ thì sao lưu toàn bộ database và tải ra nơi lưu độc lập. **Gói Free của dự án hiện tại không có project backups/PITR**; `npm run backup:remote` là công cụ GET chỉ đọc dành cho **backend cũ**: lưu đúng một dòng CLB, manifest SHA-256 và số lượng bản ghi. Bản này bảo vệ dữ liệu ứng dụng trên cloud nhưng không bao gồm Auth, schema khác hay dữ liệu chỉ có trên thiết bị. Sau khi siết quyền, dùng tài khoản quản trị/nút xuất của bản mới hoặc backup database của chủ dự án. Không mở lại quyền anon chỉ để chạy script này.
3. Thử phục hồi bản sao vào dự án staging hoặc PostgreSQL thử nghiệm; đối chiếu số thành viên, sự kiện, trận, giao dịch, số dư, Elo và sơ đồ. Chạy kiểm thử phân quyền và hai phiên sửa đồng thời. Không áp dụng migration nếu chưa có bản sao dữ liệu thật đã được xác minh. Với gói Free, giữ nguyên bản JSON gốc và xác nhận trạng thái Auth/schema trước khi thay đổi.
4. Tạo tài khoản Supabase Auth với email `amaquangvp@gmail.com` bằng mật khẩu riêng do chủ tài khoản đặt. Không gửi mật khẩu qua chat hay lưu trong repository. Tắt public signup nếu chỉ dùng các tài khoản được cấp sẵn; kiểm tra các tài khoản hiện hữu.
5. Trong khoảng bảo trì, chạy `supabase/migrations/202609230001_safe_club.sql`. Migration chỉ commit khi tài khoản `amaquangvp@gmail.com` và CLB 1 đã tồn tại; nó cấp quyền admin trong cùng transaction trước khi thay policy, chụp nguyên dòng vào `club_private.pre_migration_backup`, giữ nguyên JSON hiện hữu và thêm revision. `supabase/bootstrap-admin.sql` là script cấp lại quyền idempotent nếu cần về sau; không tự tạo hoặc thay dữ liệu CLB.
6. Cấu hình Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public key), `VITE_CLUB_ID=1`, `VITE_CLUB_NAME`, `VITE_LOCAL_MODE=false`. Build `npm run build`, output `dist`. Deploy cùng `vercel.json`. Supabase Auth Site URL dùng `https://pickle-ball-pho.vercel.app/`; chỉ thêm redirect URL thật sự dùng.
   Website A Sơn dùng chung Supabase project với `VITE_CLUB_ID=2`. Hiện database chưa có dòng 2 và chủ dự án xác nhận A Sơn không sử dụng; migration sẽ chặn client cũ ghi công khai ở cả hai CLB. Không tự tạo dòng 2 từ dữ liệu trống. Nếu A Sơn được sử dụng lại, trước tiên xuất dữ liệu từ các trình duyệt cũ, kiểm tra và cấp quyền/provision riêng.
7. Kiểm tra production: khách không đọc điện thoại/thu chi, gọi API ghi bị từ chối; quản trị đăng nhập được, đọc đúng số liệu gốc; thử thay đổi có thể đảo ngược rồi xuất backup. Xác minh đồng bộ sang trình duyệt khác, xử lý xung đột, CSP/headers, realtime hoặc polling. Chỉ kết thúc bảo trì sau khi đối chiếu xong.

## Đồng bộ và phục hồi

- Máy chủ kiểm tra revision và operation ID trong transaction. Hai máy sửa cùng bản cũ không được âm thầm ghi đè nhau. Trong cùng trình duyệt, chỉ một tab được giữ quyền ghi.
- Khi xung đột, tải cả bản trên máy và máy chủ. Chọn bản máy chủ để cập nhật revision, rồi nhập lại những thay đổi cần giữ có đối chiếu. Không có nút ép ghi bản cũ lên server. Bản trước khi chọn vẫn có snapshot.
- Bản cũ ở localStorage và khóa sơ đồ cũ được giữ lại; không tự xóa hay tự tải dữ liệu demo. Sơ đồ cũ chỉ nhập vào lịch chuẩn khi người quản trị xác nhận.
- Mỗi thay đổi chụp snapshot trước khi ghi. Giữ tối đa 30 snapshot trên thiết bị; lỗi quota dừng thao tác. Đây không phải cam kết lưu 30 ngày hay backup độc lập. Định kỳ tải JSON và giữ ở nơi khác; cấu hình backup/PITR theo khả năng dự án Supabase và lịch lưu của CLB.
- `club_private.history` giữ bản trước mỗi lần lưu và người thực hiện. `club_private.operations` giúp thử lại sau mất kết nối không ghi hai lần. Hai bảng chưa tự dọn; theo dõi dung lượng và chỉ áp dụng chính sách dọn sau khi có backup độc lập, không xóa tùy tiện.
- Nếu giao diện lỗi, dùng nút tải bản cứu hộ. File `pickleball-raw-recovery` giữ nguyên chuỗi localStorage, cần đối chiếu kỹ thuật; không phải file nhập trực tiếp. Không xóa cache để chữa lỗi trước khi tải bản cứu hộ.
- Nếu cần rollback, giữ chế độ bảo trì; export cả trạng thái hiện tại và history trước khi phục hồi. Ưu tiên sửa tiến bản mới. Chạy frontend cũ với policy mới sẽ không ghi được; **không khôi phục quyền ghi công khai** để làm frontend cũ hoạt động. Phục hồi dữ liệu từ bản đã xác minh trên staging rồi thực hiện có đối chiếu, không chạy DROP/TRUNCATE/reset trên production.

## Phạm vi bảo đảm

Kiểm thử tự động dùng dữ liệu giả, PostgreSQL nhúng PGlite và Chromium desktop/mobile. Không thay thế kiểm chứng Auth, realtime, trigger, backup, hiệu năng và trình duyệt thật của môi trường production. Sổ quỹ hiện có kiểm tra số tiền và lịch sử phiên bản; chưa phải hệ thống kế toán có khóa kỳ/chứng từ/đối soát. Elo cũ đã sai do thao tác trước đây không được tự sửa bằng suy đoán; cần đối chiếu bản sao lịch sử.

Xem `IMPLEMENTATION_STATUS.md` để biết kết quả và việc còn chờ. Báo cáo `WEBSITE_REVIEW_2026-09-23.md` ghi nhận trạng thái **trước sửa**; các số dòng trong đó có thể đã đổi.
