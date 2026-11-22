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

Playwright chạy ba máy chủ thử localhost với dữ liệu giả và chặn kết nối HTTPS. Đóng các tiến trình đang chiếm cổng 4175/4176/4177 trước khi chạy. Trên Windows, nếu dùng máy chủ thử đã mở riêng, đặt `PW_EXTERNAL_SERVER=1`; máy chủ 4175 phải dùng `VITE_LOCAL_MODE=true`, máy chủ 4176 dùng URL/key giả, máy chủ 4177 bật chế độ hai mùa như `playwright.config.js`. Nếu máy đã có Chrome nhưng thiếu Chromium của Playwright, đặt `PW_CHROME_PATH` tới `chrome.exe`. Không dùng máy chủ production làm đích kiểm thử.

`VITE_LOCAL_MODE=true` chỉ cho phép chỉnh sửa trên localhost, không kết nối dữ liệu CLB. Chế độ này phải tắt trên Vercel. Mã không tự chọn Supabase mặc định khi thiếu cấu hình.

## Triển khai bản nâng cấp an toàn

**Không triển khai frontend mới riêng lẻ trước khi chuẩn bị backend.** Bản mới cần các RPC và quyền trong migration. Bản cũ sẽ mất quyền ghi khi migration có hiệu lực, nên cần một khoảng bảo trì và yêu cầu các quản trị viên ngừng chỉnh sửa.

1. Xác minh Supabase project đang hoạt động, `VITE_CLUB_ID` đúng bản ghi, bảng `public.pickleball_club` có `id bigint`, `data jsonb`, `updated_at timestamptz`. Kiểm tra trigger/policy hiện có và các ứng dụng khác đang dùng bảng; migration thay policy và thu hồi quyền ghi trực tiếp của anon/authenticated.
2. Xuất JSON từ từng thiết bị có thể còn dữ liệu chưa đồng bộ. Giữ các file gốc, không xóa localStorage. Nếu gói Supabase hỗ trợ thì sao lưu toàn bộ database và tải ra nơi lưu độc lập. **Gói Free của dự án hiện tại không có project backups/PITR**; `npm run backup:remote` là công cụ GET chỉ đọc dành cho **backend cũ**: lưu đúng một dòng CLB, manifest SHA-256 và số lượng bản ghi. Bản này bảo vệ dữ liệu ứng dụng trên cloud nhưng không bao gồm Auth, schema khác hay dữ liệu chỉ có trên thiết bị. Sau khi siết quyền, dùng tài khoản quản trị/nút xuất của bản mới hoặc backup database của chủ dự án. Không mở lại quyền anon chỉ để chạy script này.
3. Thử phục hồi bản sao vào dự án staging hoặc PostgreSQL thử nghiệm; đối chiếu số thành viên, sự kiện, trận, giao dịch, số dư, Elo và sơ đồ. Chạy kiểm thử phân quyền và hai phiên sửa đồng thời. Không áp dụng migration nếu chưa có bản sao dữ liệu thật đã được xác minh. Với gói Free, giữ nguyên bản JSON gốc và xác nhận trạng thái Auth/schema trước khi thay đổi.
4. Tạo tài khoản Supabase Auth với email `amaquangvp@gmail.com`. Nếu tài khoản đã tồn tại nhưng chưa có mật khẩu, trên website chọn **Đăng nhập Admin → Chưa có hoặc quên mật khẩu?**, tự yêu cầu email khôi phục rồi đặt mật khẩu trong trang mở từ email. Cấu hình Auth **Site URL** là `https://pickle-ball-pho.vercel.app/` và thêm đúng **Redirect URL** `https://pickle-ball-pho.vercel.app/?auth=reset` trước khi gửi email; URL mặc định `localhost` không dùng được cho production. Không gửi mật khẩu hoặc liên kết khôi phục qua chat, không lưu trong repository. Tắt public signup nếu chỉ dùng các tài khoản được cấp sẵn; kiểm tra các tài khoản hiện hữu.
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

## Tài khoản quản lý phụ

Migration `supabase/migrations/202609290001_manager_role.sql` thêm vai trò `manager`, chụp bản dữ liệu hiện tại vào `club_private.pre_migration_backup` và không sửa JSON CLB. Vai trò này được đọc dữ liệu CLB không có `transactions`; khi lưu thay đổi thành viên, trận hoặc sự kiện, máy chủ ghép lại nguyên giao dịch hiện có. Xung đột phiên bản cũng chỉ trả về bản đã loại giao dịch. Trang Thu Chi và CSDL bị ẩn/chặn; bản lưu trên trình duyệt của tài khoản phụ dùng khóa riêng theo user ID.

Đăng nhập tài khoản phụ bằng tên `quanly`. Ứng dụng ánh xạ tên này tới tài khoản Auth kỹ thuật `amaquangvp+phoquanly@gmail.com`, nhận thư ở hộp thư Gmail của quản trị viên chủ. Tạo tài khoản Auth riêng với mật khẩu mạnh tối thiểu 8 ký tự và xác nhận email trước khi chạy `supabase/grant-manager.sql` để cấp quyền quản lý mùa 2027 (CLB id 3). Không dùng mã PIN bốn số, không hạ chính sách mật khẩu của dự án và không lưu mật khẩu trong repo. Quản trị viên chủ có thể dùng chức năng đặt lại mật khẩu trên website với tên `quanly`; liên kết sẽ gửi tới hộp thư chủ. Không cấp vai trò `admin` cho tài khoản này.

## Mùa giải 2027

Website có bộ chọn mùa trên cùng một địa chỉ. Khi Vercel được cấu hình thêm `VITE_CLUB_ID_2027=3`, trang mở mặc định mùa 2027; `?season=2026` mở mùa cũ. Mỗi mùa dùng một dòng Supabase và khóa localStorage riêng nên thao tác mùa mới không ghi vào bản thi đấu mùa cũ. Không bật biến môi trường này trước khi dòng 3 được tạo và kiểm tra.

`supabase/provision-season-2027.sql` là bước tạo mùa một lần trên project đã chọn. Trước khi chạy, cần có **bản sao lưu mới nhất** từ website đang dùng, xác nhận dòng id 1 đúng CLB Phở, dòng id 3 chưa được dùng, rồi đối chiếu số thành viên, trận, sự kiện và giao dịch. Nếu dùng project Supabase mới, trước tiên tạo tài khoản Auth của chủ, nhập bản sao 2026 vào dòng id 1, áp dụng `supabase/migrations/202609230001_safe_club.sql` và `supabase/migrations/202609290001_manager_role.sql`, sau đó mới tạo mùa 2027. Không dùng bản sao tháng 9 làm dữ liệu hiện tại nếu chưa đối chiếu. Script chụp dòng 2026 vào `club_private.pre_migration_backup`, rồi tạo dòng id 3 với danh sách thành viên giữ nguyên, Elo đơn khởi điểm 1.000, Elo đôi khởi điểm 1.200, trận/sự kiện/sơ đồ rỗng và toàn bộ sổ Thu Chi được mang sang. Dòng id 1 không bị cập nhật hoặc xóa. Nếu dòng id 3 đã tồn tại, script dừng và cần chọn ID khác sau khi kiểm tra.

Sau khi đối chiếu hai mùa, áp dụng `supabase/migrations/202611220001_archive_2026.sql` để khóa mọi cập nhật/xóa dòng 2026 ở cơ sở dữ liệu mới. Giao diện 2026 chỉ hiển thị dữ liệu, xếp hạng và cho chủ xem Thu Chi, tải bản lưu trữ. Project Supabase cũ giữ nguyên cho đến khi xác nhận chuyển đổi xong. Ngày 22/11/2026, project mới `hrohlnvlmxxukkljmvjq` đã nhận bản sao 2026, kiểm tra khớp JSONB, được phân quyền, tạo mùa 2027 và khóa mùa 2026. Hai dòng có 22 thành viên và 13 giao dịch; 2026 giữ 9 sự kiện, 90 trận và 4 sơ đồ, còn 2027 bắt đầu rỗng. Website production và biến `VITE_CLUB_ID_2027` trên Vercel chưa được thay đổi.

Trước khi chạy migration với bản sao thực, kiểm tra ngoại tuyến bằng `npm run verify:season-backup -- <đường-dẫn-file-json>`. Lệnh không ghi vào Supabase và chỉ in mã SHA-256 cùng số lượng bản ghi để đối chiếu.

Thể thức **Đấu Đôi Bí Ẩn** dành riêng cho 2027: 4–24 người chia hết cho 4, ba vòng đổi cặp ưu tiên không lặp đồng đội; chỉ khi ghi đủ kết quả mới bốc vòng cuối ghép người xếp cao với người xếp thấp. Mỗi trận thắng vòng loại được 1 điểm giải, vòng cuối được 2 điểm giải; Elo của mỗi trận vẫn tính như đấu đôi thông thường. Kết quả và sơ đồ đều lưu vào lịch sử trận chuẩn để có thể sửa điểm và đối chiếu.

## Phạm vi bảo đảm

Kiểm thử tự động dùng dữ liệu giả, PostgreSQL nhúng PGlite và Chromium desktop/mobile. Không thay thế kiểm chứng Auth, realtime, trigger, backup, hiệu năng và trình duyệt thật của môi trường production. Sổ quỹ hiện có kiểm tra số tiền và lịch sử phiên bản; chưa phải hệ thống kế toán có khóa kỳ/chứng từ/đối soát. Elo cũ đã sai do thao tác trước đây không được tự sửa bằng suy đoán; cần đối chiếu bản sao lịch sử.

Xem `IMPLEMENTATION_STATUS.md` để biết kết quả và việc còn chờ. Báo cáo `WEBSITE_REVIEW_2026-09-23.md` ghi nhận trạng thái **trước sửa**; các số dòng trong đó có thể đã đổi.
