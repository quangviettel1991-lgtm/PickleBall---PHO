**Báo cáo rà soát website quản lý CLB Pickleball — 23/09/2026**

**Kết luận:** ứng dụng có phạm vi chức năng khá đầy đủ cho một CLB nhỏ, nhưng chưa đủ tin cậy để mở công khai và sử dụng nhiều người cùng quản trị dữ liệu thật. Các điểm cản trở chính là quyền quản trị chỉ nằm ở trình duyệt, đồng bộ ghi đè toàn bộ dữ liệu và một số lỗi nghiệp vụ làm sai Elo, trạng thái trận đấu, thống kê. Cần xử lý các điểm này trước khi ưu tiên trang trí giao diện.

**Phạm vi và bằng chứng**

Đã rà soát App, toàn bộ 11 component, lớp dữ liệu, thuật toán Elo, dữ liệu mẫu, CSS và cấu hình build/lint. Đã chạy build, lint và thử nghiệm logic bằng Node VM với localStorage giả lập, thay hàm gửi Supabase bằng stub. Các thử nghiệm không gửi dữ liệu ra Supabase. Không sửa mã nguồn ứng dụng.

Chưa kiểm thử trực quan trên trình duyệt/điện thoại, chưa đo Lighthouse/Core Web Vitals, chưa kiểm tra HTTP headers/TLS ở tên miền thật, chưa đọc được cấu hình RLS/database/backup của Supabase. Các kết luận về UI dựa trên mã nguồn; các vấn đề backend cần xác minh được ghi rõ, không coi là lỗ hổng đã khai thác.

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` | Thành công; Vite 5.4.21; JavaScript 672,92 kB, gzip 168,57 kB; cảnh báo chunk vượt 500 kB |
| `npm run lint` | Không đạt: 196 lỗi, 1 cảnh báo; gồm cả script phụ, thiếu prop validation, biến thừa và vấn đề hook; không phải 196 lỗi chức năng |
| Thử đổi tên thành viên đã thi đấu | Elo đơn tăng từ 1016 thành 1031 dù không thay kết quả trận |
| Thử ghi trận thủ công | Trận không có `played`; bộ lọc Đối Đầu loại trận này |
| Thử cập nhật điểm trận chờ theo payload Ghi Điểm | `played` vẫn false, `eloChanges` vẫn rỗng |
| Thử thêm thành viên theo payload Tổng Quan | Yêu cầu Elo 1600 nhưng lưu 1200 |
| Thử xóa đối thủ rồi tính lại Elo | Điểm người còn lại đổi từ 998 thành 992 với cùng kết quả lịch sử |
| `npm audit --json` | Không hoàn thành vì endpoint registry trả lỗi; chưa kết luận tình trạng lỗ hổng dependency |

**Thang ưu tiên:** P1 cần xử lý trước vận hành công khai/dữ liệu quan trọng; P2 cần xử lý trong đợt ổn định chức năng; P3 là cải thiện chất lượng. Không gán P0 vì chưa xác nhận khai thác hay sự cố dữ liệu đang xảy ra trên hệ thống thật.

**Bảo mật, phân quyền và riêng tư**

1. **P1 — Mọi phiên mở ứng dụng đều mặc định có quyền Admin.** `src/App.jsx:26` khởi tạo `isAdmin = true`; đăng xuất chỉ đổi state, tải lại trang lại mở quyền. `src/components/Navbar.jsx:13` so PIN cố định trong JavaScript, không xác thực người dùng với máy chủ. Đây là hành vi có chủ ý theo comment hiện tại, nhưng không phù hợp nếu website được mở cho thành viên/người ngoài. Cần Supabase Auth và kiểm tra quyền ở database/API; đổi default sang false chỉ sửa giao diện, không giải quyết bảo mật máy chủ.

2. **P1 — Chưa có bằng chứng về phân quyền dữ liệu ở backend.** `src/utils/supabase.js:31` đọc nguyên trường JSON `data`; `:85` upsert nguyên dữ liệu bằng client Supabase, không có luồng đăng nhập trong mã ứng dụng. Bộ mã không kèm migration/policy RLS để kiểm chứng. Nếu backend cho anon ghi thì PIN không ngăn được API ghi trực tiếp; nếu backend chặn anon thì các thao tác lưu hiện tại không đồng bộ được. Cần kiểm tra policy thực tế cho anon, người đã đăng nhập, quản trị từng CLB và CLB khác.

   Anon key được dùng trên frontend không tự nó là bí mật bị lộ; Supabase yêu cầu bảo vệ quyền truy cập bằng RLS. Tham khảo [Supabase: Securing your data](https://supabase.com/docs/guides/database/secure-data) và [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security). Biến `VITE_*` cũng được đưa vào mã client, không phải nơi giấu mật khẩu: [Vite: Env Variables](https://vite.dev/guide/env-and-mode).

3. **P1 — Khóa màn hình không tách dữ liệu công khai và riêng tư.** App tải toàn bộ members, phone, transactions và lưu localStorage trước khi xét tab có quyền hay không. Nếu truy vấn anon được phép, người xem bảng xếp hạng cũng nhận dữ liệu điện thoại/thu chi dù giao diện ẩn tab. Cần public view/API chỉ trả thông tin công khai, dữ liệu tài chính và liên hệ có quyền đọc riêng.

4. **P2 — Tổng Quan vẫn thêm thành viên khi đã khóa quyền.** `src/components/Dashboard.jsx:27` gọi `addMember`; App không truyền `isAdmin` vào Dashboard và tab này luôn công khai. Luồng này bỏ qua quy tắc khóa các tab khác. Cần thống nhất quyền cho mọi thao tác và kiểm tra lại ở máy chủ.

5. **P1 — Cấu hình thiếu vẫn tự trỏ vào một Supabase project có sẵn.** `src/utils/supabase.js:3` có URL/key fallback và CLB mặc định 1. Bản cài mới hoặc staging thiếu biến môi trường có thể đọc/ghi nhầm CLB tùy policy. Cần cấu hình bắt buộc, hiển thị lỗi rõ, tách môi trường test/production; không tự chọn database thật khi cấu hình thiếu.

**Toàn vẹn dữ liệu và đồng bộ**

6. **P1 — Hai người lưu đồng thời có thể làm mất thay đổi của nhau.** `src/utils/supabase.js:91` upsert toàn bộ JSON, không so phiên bản hiện tại, không merge và không có transaction theo thao tác. A thêm thành viên, B nhập thu chi từ bản cũ: bản B lưu sau có thể xóa thành viên A vừa thêm. Timestamp máy khách không xử lý xung đột; request cũ đến sau cũng có thể ghi đè bản mới. Cần cập nhật từng bản ghi hoặc optimistic concurrency với revision do server kiểm soát, kèm cơ chế giải quyết xung đột.

7. **P1 — Xóa sạch hợp lệ có thể bị máy khác phục hồi dữ liệu cũ.** `src/App.jsx:36` coi danh sách thành viên rỗng là mock; các nhánh ở `:69`, `:126`, `:174` tự đẩy dữ liệu local lên khi remote bị coi là mock. Vì vậy thao tác clear hợp lệ trên A có thể bị B đảo ngược. Nhận diện dữ liệu thật bằng tiền tố ID cũng dễ sai với dữ liệu nhập từ hệ thống khác. Dùng schemaVersion, trạng thái khởi tạo và dấu xóa có version thay cho suy đoán nội dung.

8. **P1 — Lỗi đọc và chưa có dữ liệu bị gộp làm một.** `fetchRemoteData` trả null cả khi truy vấn lỗi và không có bản ghi; `src/App.jsx:95` có thể tiếp tục đẩy bản local lên sau lỗi đọc. Cần phân biệt not-found, lỗi mạng, lỗi quyền và lỗi schema. Không tự khởi tạo/ghi đè khi chưa xác nhận server thực sự chưa có dữ liệu.

9. **P1 — Đồng bộ bất đồng bộ có thể ghi đè thao tác đang làm.** Effect tải ban đầu giữ `clubData` và `localUpdatedAt` ở thời điểm mở trang. Khi response về, không đọc lại phiên bản mới nhất trước mọi quyết định ghi. Polling cũng lấy mốc trước request. Người dùng chỉnh sửa trong lúc request chậm có thể bị áp một response cũ. Cần version check tại thời điểm commit, hủy response lỗi thời và phối hợp giữa tải, ghi, realtime.

10. **P2 — Thông báo thành công chưa phản ánh đã lưu trên cloud.** `src/utils/db.js:59` chỉ lưu local rồi gửi ngầm; lỗi chỉ ghi console, không có hàng đợi retry/backoff/trạng thái đang chờ. Import còn báo “Ứng dụng đã đồng bộ” trước khi request hoàn tất. Cần phân biệt đã lưu trên máy, đang đồng bộ, đã lưu cloud và lỗi; khi online trở lại phải retry có kiểm soát xung đột.

11. **P1 — Import JSON thiếu kiểm tra cấu trúc từng bản ghi.** `src/components/BackupRestore.jsx:81` chỉ kiểm tra ba mảng. File `{members:[{}],events:[],matches:[]}` vẫn vượt kiểm tra và được lưu, nhưng Members/HeadToHead dùng `name.toLowerCase()`/`localeCompare`, gây lỗi render. Các giá trị amount, ID, teams, dates, Elo cũng không được kiểm tra đủ. Cần schema validation, version/migration, ràng buộc tham chiếu, giới hạn kích thước và xem trước thay đổi trước khi ghi.

12. **P2 — Snapshot chưa đảm bảo khả năng khôi phục dữ liệu.** `src/utils/db.js:59` chụp sau khi ghi thay đổi; import/reset/clear không luôn tạo bản trước thao tác như restoreSnapshot đang làm. Snapshot chỉ ở localStorage, không bảo vệ khi mất thiết bị/xóa trình duyệt; lỗi quota chỉ cảnh báo console. 14 bản, tối thiểu 5 phút một bản không tương đương bảo đảm giữ hai tuần: có thể quay vòng trong khoảng hơn một giờ sử dụng tích cực. Cần snapshot trước mọi thay thế dữ liệu, backup server theo chính sách thời gian và thử phục hồi thực tế.

13. **P2 — Sơ đồ giải đấu nằm riêng trong localStorage.** `src/components/TournamentDraw.jsx:79` đến `:104` lưu `draw_data_<eventId>` ngoài clubData. Export JSON không chứa đầy đủ sơ đồ, quan hệ sourceMatch và cấu hình bốc thăm; thiết bị khác có thể thấy trận nhưng không có cùng sơ đồ để điều hành tiếp. Các khóa draw cũng chưa có CLUB_ID. Cần lưu một cấu trúc giải đấu chuẩn lên server, đưa vào backup và phân vùng theo CLB.

**Nghiệp vụ Elo, trận đấu và giải đấu**

14. **P1 — Đổi thông tin thành viên làm tính Elo hai lần.** Form sửa nạp Elo hiện tại (`src/components/Members.jsx:185`); `src/utils/db.js:230` ghi giá trị đó thành initialElo rồi phát lại mọi trận. Đã tái hiện 1016 → 1031 chỉ khi đổi tên. Tách sửa hồ sơ với sửa điểm xuất phát; giữ initialElo khi đổi tên/điện thoại; điều chỉnh Elo phải có nghiệp vụ và lịch sử riêng.

15. **P1 — Trận chờ được nhập điểm nhưng không chuyển sang đã đấu.** `src/components/MatchRecorder.jsx:517` không gửi `played: true` khi update; `updateMatch` merge giữ false cũ nên thuật toán vẫn bỏ qua trận. Đã tái hiện. Cần một hàm chuyển trạng thái dùng chung cho mọi màn hình.

16. **P2 — Đối Đầu bỏ các trận ghi thủ công.** `recordMatch` không gán played; `src/components/HeadToHead.jsx:26` dùng `!match.played`, trong khi Leaderboard/Dashboard chấp nhận mọi trận trừ played=false. Đã xác nhận bằng trận ghi mới. Chuẩn hóa status và migrate dữ liệu cũ, dùng cùng một bộ lọc trận hoàn thành.

17. **P2 — Hồ sơ tính cả trận chưa diễn ra vào thắng/thua.** `src/components/Members.jsx:54` không loại played=false. Với 0–0, `aWon` là false nên người đội B còn bị tính thắng. Sai số trận, tỷ lệ thắng, chuỗi phong độ, đồng đội/đối thủ. Cần loại trận chưa đấu và xử lý trạng thái hòa/không hợp lệ thống nhất.

18. **P1 — Xóa thành viên làm biến đổi Elo lịch sử của người còn lại.** `src/utils/db.js:241` xóa hẳn thành viên nhưng giữ trận. Khi lần sau replay, điểm người đã xóa bị thay bằng fallback 1200. Đã tái hiện Elo đối thủ 998 → 992 không đổi kết quả trận. Cần soft-delete và giữ điểm gốc/định danh lịch sử, loại khỏi lựa chọn trận mới thay vì xóa dữ liệu phục vụ tính toán.

19. **P2 — Tổng Quan bỏ qua Elo nhập khi tạo thành viên.** Dashboard gửi `elo`, còn addMember đọc `eloSingles`/`eloDoubles`. Đã tái hiện nhập 1600 nhưng lưu 1200. Thống nhất DTO và tên trường giữa các form.

20. **P2 — Sửa kết quả ở Sự Kiện làm mất chi tiết nhiều set.** `src/components/Events.jsx:145` đến `:159` luôn thay sets bằng một phần tử `{a:scoreA,b:scoreB}`, và coi có điểm dương là đã đấu. Với trận thắng 2–1 qua ba set, lưu từ màn này thay lịch sử từng set bằng 2–1. Màn này cũng cho hòa dương, trong khi Ghi Điểm cấm hòa. Cần dùng chung bộ nhập và validator, phân biệt điểm từng set với số set thắng. Không áp cứng luật kết thúc set nếu chưa thống nhất thể thức giải.

21. **P1 — Kết quả/sơ đồ bốc thăm có hai nguồn dữ liệu có thể lệch nhau.** Ghi điểm bốc thăm cập nhật drawData và clubData, nhưng sửa/xóa từ Events/MatchRecorder chỉ cập nhật clubData. Chốt lại lịch từ drawData cũ có thể ghi đè kết quả sửa hoặc đưa trận đã xóa trở lại (`src/components/TournamentDraw.jsx:1030`). Cần một nguồn dữ liệu chuẩn theo matchId; mọi màn hình đọc và cập nhật cùng bản ghi.

22. **P2 — Sửa/xóa trận loại trực tiếp chưa xử lý đầy đủ vòng phụ thuộc.** `src/components/TournamentDraw.jsx:849` cập nhật người thắng vào vòng sau nhưng không vô hiệu hóa điểm/winner đã tồn tại hoặc lan truyền lại toàn nhánh. Xóa trận chỉ bỏ trận khỏi mảng. Với vòng sau đã đấu, bracket có thể giữ người thắng/kết quả không còn hợp lệ. Cần xác định các vòng phụ thuộc, yêu cầu xác nhận tác động, reset/recompute và đồng bộ kết quả liên quan.

23. **P2 — Ngày mặc định trộn UTC với giờ địa phương.** MatchRecorder dùng `toISOString().split('T')[0]` cho ngày, ghép với giờ địa phương và lưu chuỗi không timezone. Tại Việt Nam/Thái Lan trước 07:00 có thể nhận ngày hôm trước; thiết bị khác timezone có thể sắp thứ tự replay khác. Cần phân biệt ngày lịch của CLB với timestamp UTC, lưu thời điểm có timezone rõ ràng.

24. **P2 — Khóa sự kiện chủ yếu ở UI, thiếu ràng buộc lớp dữ liệu.** updateMatch/deleteMatch/updateEvent không thực thi kiểm tra khóa ở database. SelectedEvent lưu nguyên object trong state nên có thể cũ sau realtime; một dialog mở trước khi khóa cũng cần được kiểm tra lại khi lưu. Cần server từ chối mutation vào giải khóa, không chỉ disable nút.

**Trải nghiệm, hiệu năng, SEO và vận hành**

| Mảng | Điểm đang có | Vấn đề/công việc cần làm |
|---|---|---|
| Giao diện và mobile | Có hệ màu/font, breakpoint responsive, điều hướng mobile, form/modal | Chưa kiểm chứng tràn bảng, bàn phím che form, kích thước chạm và tương phản trên máy thật; cần QA 360/390/768/1440 px và cả landscape |
| Accessibility | Modal chung có ESC và nút đóng có nhãn | Modal thiếu role dialog, aria-modal, liên kết tiêu đề, focus trap và trả focus; các modal tự viết cần kiểm tra tương tự; chưa thấy reduced-motion |
| Điều hướng | Các tab quản trị phân theo nghiệp vụ rõ | activeTab chỉ là React state: tải lại về Tổng Quan, không deep-link trực tiếp, Back không phản ánh tab; nên đồng bộ URL và xử lý form chưa lưu |
| Hiệu năng tải | Build thành công, dependency tương đối gọn về số lượng | Tất cả màn hình import trực tiếp, JS 672,92 kB; tách lazy-load theo tab, đưa CSS lớn ra khỏi string trong JSX; đo thật trước và sau |
| Hiệu năng dữ liệu | Có useMemo ở nhiều phép thống kê | Replay Elo quét thành viên theo từng trận; Leaderboard quét trận theo từng thành viên; tải/ghi toàn bộ JSON và tối đa 14 bản snapshot; cần index theo ID, giới hạn dữ liệu và phân trang khi tăng quy mô |
| Mạng | Có realtime và polling dự phòng | Polling 10 giây tương đương khoảng 360 request timestamp/giờ/tab, kể cả khi realtime tốt; cần dừng khi tab ẩn/offline, backoff và điều chỉnh theo trạng thái realtime |
| SEO/chia sẻ | lang=vi, title, description, OG title/description | Favicon còn Vite; thiếu og:image/og:url/canonical; tab không có URL riêng. Với công cụ nội bộ, ưu tiên riêng tư; nếu quảng bá CLB, thêm landing page công khai có nội dung index được |
| Tài chính | Có thu/chi, phân loại, tìm kiếm, sửa/xóa | Chưa có nhật ký ai sửa/xóa, khóa kỳ, chứng từ hay đối soát; không nên coi là sổ tài chính có kiểm toán. Cần kiểm tra amount số nguyên hợp lệ tại lớp dữ liệu, ghi lịch sử thay đổi |
| Khả năng chịu lỗi | Có catch một số lỗi parse/network | Không thấy Error Boundary; lỗi dữ liệu render có thể làm trắng trang; localStorage chính không bắt lỗi quota; cần trạng thái lỗi có hướng phục hồi |
| Bảo trì | Tách màn hình thành component và Elo thành utility | TournamentDraw 2195 dòng, MatchRecorder 2066 dòng, nhiều CSS nhúng và logic lặp; nên tách nghiệp vụ, validator, hook đồng bộ, UI dùng chung |
| Kiểm thử | Có lệnh build và lint | Không có test script/bộ test tự động nghiệp vụ trong nguồn đã kiểm tra; lint không đạt; cần test hồi quy lỗi đã tái hiện, kiểm thử phân quyền và hai thiết bị cùng sửa |
| Triển khai | Vite có build/preview | README vẫn template; thiếu hướng dẫn môi trường, migration/RLS và quy trình rollback trong repo. Chưa xác minh HTTPS, headers, CSP, giám sát, backup server; không kết luận hosting đang thiếu các mục đó |
| Dependency | Có lockfile | Audit không truy cập được endpoint; cần chạy lại ở môi trường có mạng và phân biệt dependency build/dev với code chạy production trước khi đánh giá mức độ ảnh hưởng |

**Thứ tự xử lý đề xuất**

1. Chốt mô hình quyền: khách chỉ xem dữ liệu công khai, người ghi điểm, quản trị, người phụ trách thu chi. Thiết lập Auth/RLS; bỏ mặc định Admin và cấu hình fallback database thật. Kiểm tra quyền bằng API trực tiếp, không chỉ qua giao diện.
2. Sao lưu đầy đủ và kiểm tra phục hồi trước khi thay cơ chế lưu. Sửa đồng bộ có version, loại nhánh “mock tự phục hồi”, phân biệt lỗi đọc và chưa có dữ liệu, thêm trạng thái lưu/retry. Chưa coi multi-device là an toàn trước khi test xung đột.
3. Sửa các lỗi Elo, played, thống kê, soft-delete thành viên; tạo một validator và một luồng cập nhật trận dùng chung. Bổ sung test hồi quy với kết quả định lượng ở trên.
4. Đưa sơ đồ giải đấu vào nguồn dữ liệu chuẩn; xử lý phụ thuộc vòng loại trực tiếp và backup có schema/version.
5. Dọn lint có phân loại, tách bundle/module, hoàn thiện accessibility/điều hướng và kiểm thử mobile. Đo hiệu năng thực tế, kiểm tra tên miền thật và chuẩn hóa tài liệu triển khai.

**Điều kiện nghiệm thu tối thiểu:** khách không đọc được phone/thu chi và không ghi được dữ liệu; hai máy sửa không mất thay đổi; reset không bị máy khác phục hồi ngoài ý muốn; đổi tên không đổi Elo; nhập điểm trận chờ cập nhật mọi màn hình nhất quán; sửa/xóa ở một màn không bị chốt lịch phục hồi; import sai bị từ chối trước khi lưu; backup phục hồi được sang trình duyệt mới; lỗi mạng có thông báo đúng; build/lint và các test nghiệp vụ quan trọng đều đạt.
