# Hướng dẫn sử dụng theo vai trò

Tài liệu mô tả các trang và quyền đang có trong mã frontend `7650b6f`, đối chiếu với backend `abd4080`, ngày 12/10/2026. Đây là căn cứ từ mã nguồn; trạng thái máy chủ và thiết bị thực tế cần kiểm tra riêng khi vận hành.

Tên mục trong menu được giữ theo giao diện để người dùng dễ tìm. Chi tiết kết nối API xem tại [Tích hợp frontend và backend](INTEGRATION.md).

## Đăng nhập và phiên làm việc

1. Mở `/login`, nhập email và mật khẩu được cấp.
2. Nếu tài khoản ở trạng thái `PENDING_PASSWORD_CHANGE`, hệ thống chuyển đến `/change-password` trước khi cho sử dụng các trang khác. Nhập mật khẩu hiện tại, mật khẩu mới từ 12 đến 128 ký tự và xác nhận mật khẩu mới.
3. Khi đổi thành công, chọn **Enter Dashboard** hoặc chờ hệ thống chuyển về trang mặc định. Có thể đổi mật khẩu sau đó từ menu tài khoản trên thanh trên cùng.
4. Chọn **Logout** trong menu tài khoản khi kết thúc phiên.

Trang mặc định là `/admin` với Admin, `/farm-owner/dashboard` với Farmer và `/developer/dashboard` với Client Developer. Sau đăng nhập, đường dẫn được yêu cầu trước đó chỉ được dùng nếu thuộc nhóm trang của vai trò tương ứng và qua kiểm tra đường dẫn.

Truy cập trang được bảo vệ khi chưa đăng nhập sẽ chuyển về `/login`. Truy cập nhóm trang của vai trò khác sẽ chuyển đến `/unauthorized`. Đường dẫn không được đăng ký hiển thị **Page Not Found**. Khi đang khôi phục phiên, bộ bảo vệ chưa hiển thị nội dung trang; khi tải trang theo yêu cầu, giao diện có trạng thái **Loading page…**.

`/forgot-password` hướng dẫn liên hệ quản trị viên để nhận mật khẩu tạm. Khôi phục mật khẩu qua email chưa được triển khai. Không có đường dẫn `/reset-password` hoạt động trong cấu hình định tuyến hiện tại.

## Danh sách trang

Super Admin vẫn có vai trò `ADMIN`, kèm quyền `isSuperAdmin`; không có nhóm đường dẫn riêng.

| Vai trò          | Đường dẫn                                         | Nội dung và giới hạn                                                                                   |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Công khai        | `/login`, `/forgot-password`                      | Đăng nhập; hướng dẫn khôi phục tài khoản                                                               |
| Đã đăng nhập     | `/change-password`                                | Đổi mật khẩu; bắt buộc với tài khoản chờ đổi mật khẩu                                                  |
| Admin            | `/admin`                                          | Tổng quan trong phạm vi được phép                                                                      |
| Admin            | `/admin/devices`                                  | Duyệt farm, plot và station; mở chi tiết station                                                       |
| Admin            | `/admin/stations/:stationId`                      | Thông tin station và số đo gần nhất trong phạm vi được phép                                            |
| Admin            | `/admin/api-sources`                              | Nguồn API; thao tác quản lý tùy quyền chủ sở hữu                                                       |
| Admin            | `/admin/alert-center`                             | Cảnh báo, quy tắc và thao tác trong phạm vi được phép                                                  |
| Admin            | `/admin/users`                                    | Quản lý tài khoản; các thao tác nhạy cảm có giới hạn riêng                                             |
| Super Admin      | `/admin/audit-logs`                               | Nhật ký kiểm toán; Admin thường bị từ chối dù cùng nhóm định tuyến                                     |
| Admin            | `/admin/device-health`                            | Thông báo sức khỏe phần cứng chưa khả dụng do chưa có hợp đồng thiết bị; không có mục riêng trong menu |
| Admin            | `/admin/configuration`, `/admin/config-proposals` | Thông báo cấu hình thiết bị chưa khả dụng; không có mục riêng trong menu                               |
| Farmer           | `/farm-owner/dashboard`                           | Tổng quan các station được phép xem                                                                    |
| Farmer           | `/farm-owner/stations/:stationId`                 | Chi tiết station trong phạm vi được phép                                                               |
| Farmer           | `/farm-owner/soil-dashboard`                      | Số đo gần nhất và xu hướng 24 giờ                                                                      |
| Farmer           | `/farm-owner/historical-analysis`                 | Phân tích lịch sử theo chỉ số và khoảng ngày                                                           |
| Farmer           | `/farm-owner/history-reports`                     | Báo cáo lịch sử một station, xuất CSV                                                                  |
| Farmer           | `/farm-owner/api-sources`                         | Nguồn sở hữu hoặc được chia sẻ; quản lý nguồn sở hữu                                                   |
| Farmer           | `/farm-owner/notifications`                       | Hộp thư thông báo trong ứng dụng                                                                       |
| Farmer           | `/farm-owner/alert-center`                        | Cảnh báo và quy tắc theo quyền station                                                                 |
| Farmer           | `/farm-owner/alerts`                              | Chuyển đến `/farm-owner/alert-center`                                                                  |
| Client Developer | `/developer/dashboard`                            | Tổng quan quyền truy cập API và tình trạng khóa                                                        |
| Client Developer | `/developer/api-access/keys`                      | Tạo, xoay và thu hồi API key                                                                           |
| Client Developer | `/developer/api-access/scope`                     | Xem phạm vi station hiệu lực của khóa                                                                  |
| Client Developer | `/developer/api-tools/docs`                       | Tài liệu Client Developer API                                                                          |
| Client Developer | `/developer/api-tools/explorer`                   | Gửi yêu cầu API và đọc phản hồi thực tế                                                                |
| Client Developer | `/developer/api-metrics`                          | Hiển thị `N/A`: backend chưa cung cấp thống kê theo tài khoản; ẩn khỏi menu                            |

Menu Admin gồm **Dashboard**, **Stations & Devices**, **API Sources**, **Alert Center**, **Users**; **Audit Log** chỉ hiện với Super Admin. Menu Farmer gồm **Dashboard**, **Soil Dashboard**, **Historical Analysis**, **History Report**, **API Sources**, **Notifications**, **Alert Center**. Menu Client Developer gồm **Dashboard**, **API Access** và **API Tools**.

`/developer/api-access` chuyển đến trang khóa; `/developer/api-tools` chuyển đến tài liệu API. Các đường dẫn cũ `/developer/api-keys`, `/developer/api-permissions`, `/developer/api-docs`, `/developer/api-explorer` lần lượt chuyển đến các trang tương ứng trong hai nhóm này.

## Quyền dữ liệu và quản lý

Backend kiểm tra quyền ở mỗi yêu cầu. Menu và đường dẫn không thay thế việc cấp quyền dữ liệu.

| Nội dung                                                                          | Admin thường                                                 | Super Admin                                       | Farmer                                                                 | Client Developer                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| Số đo trên giao diện                                                              | Nguồn `SYSTEM` và nguồn do mình sở hữu                       | Mọi nguồn còn hoạt động trong phạm vi đọc hợp lệ  | Nguồn `SYSTEM` thuộc farm được cấp, nguồn sở hữu, station được chia sẻ | Đọc qua Client API bằng API key        |
| Nguồn API của người khác                                                          | Thông tin kết nối được giới hạn; không tự có quyền đọc số đo | Được đọc dữ liệu; không tự có quyền quản lý nguồn | Chỉ station đã được chủ nguồn chia sẻ                                  | Phạm vi được cấp cho tài khoản và khóa |
| Chia sẻ, kiểm tra kết nối, hiện khóa, xóa nguồn                                   | Chỉ nguồn sở hữu                                             | Chỉ nguồn sở hữu                                  | Chỉ nguồn sở hữu                                                       | Không có trang quản lý nguồn           |
| Sửa quy tắc, xác nhận hoặc giải quyết cảnh báo                                    | Nguồn sở hữu và nguồn `SYSTEM`                               | Nguồn sở hữu và nguồn `SYSTEM`                    | Chỉ nguồn sở hữu                                                       | Không được cấp quyền cảnh báo          |
| Thông báo trong ứng dụng                                                          | Thông báo gửi cho mình, còn quyền xem station                | Cùng giới hạn người nhận và station               | Cùng giới hạn người nhận và station                                    | Không có hộp thư hoặc chuông thông báo |
| Tạo tài khoản Admin, đổi vai trò, yêu cầu xóa tài khoản, chuyển quyền Super Admin | Không                                                        | Có, theo điều kiện backend                        | Không                                                                  | Không                                  |

## Admin và Super Admin

### Duyệt station và nguồn

1. Mở **Stations & Devices**, chọn farm rồi plot để xem các station được phép truy cập.
2. Mở một station để đọc thông tin và số đo gần nhất. Nếu dữ liệu không có hoặc lỗi, xem thông báo tại trang và chọn **Retry** hoặc **Refresh** khi có.
3. Mở **API Sources** để xem nguồn và trạng thái kiểm tra kết nối. **Connection status only** nghĩa là tài khoản không có quyền đọc số đo của nguồn đó.

Trạng thái **Connected** là kết quả kiểm tra kết nối nguồn; không bảo đảm mọi chỉ số đều có mẫu mới. **Check unavailable** nghĩa là chưa xác minh được lần kiểm tra trong màn hình hiện tại. Chủ nguồn có thể dùng **Test** để kiểm tra lại.

### Quản lý tài khoản

1. Mở **Users**, tìm tài khoản và kiểm tra vai trò, trạng thái hiện tại.
2. Khi tạo tài khoản, lưu mật khẩu tạm được trả về và chuyển cho người nhận qua kênh phù hợp. Người nhận phải đổi mật khẩu sau đăng nhập.
3. Xem farm đã gán và nguồn/trạm đã chia sẻ trong phần phạm vi của tài khoản. Đây là thông tin chỉ đọc; cấp, thay đổi hoặc thu hồi quyền nguồn/trạm tại **API Sources**, không sửa trong trang Users.
4. Dùng **Reset credentials** khi cần cấp lại mật khẩu tạm cho tài khoản được phép quản lý. Việc cấp lại thu hồi phiên cũ và đưa tài khoản về trạng thái chờ đổi mật khẩu.

Admin thường có thể quản lý Farmer và Client Developer, nhưng không sửa tài khoản Admin hoặc chính mình, không đổi vai trò và không tạo Admin. Super Admin có các quyền quản trị bổ sung; đổi vai trò hoặc trạng thái sẽ ảnh hưởng phiên và khóa API của người nhận.

Chuyển quyền Super Admin chỉ cho một Admin khác đang `ACTIVE`. Thao tác yêu cầu xác nhận và mật khẩu hiện tại. Phải chuyển quyền trước khi vô hiệu hóa hoặc thay đổi vai trò tài khoản đang giữ quyền. Trang Users không cấp lại mật khẩu cho chính Super Admin; khôi phục khẩn cấp thuộc quy trình vận hành backend.

Yêu cầu xóa tài khoản chỉ dành cho Super Admin và được backend xử lý theo chính sách lưu giữ. Không hiểu thao tác này là xóa ngay mọi bản ghi liên quan. **Audit Log** có bộ lọc, phân trang bằng **Previous** và **Next**, cùng **Refresh** để lấy dữ liệu mới.

## Farmer

### Theo dõi đất

1. Mở **Soil Dashboard**, chọn farm, plot và station.
2. Đọc các thẻ chỉ số có dữ liệu. Các chỉ số hỗ trợ gồm độ ẩm, nhiệt độ, pH, EC và NPK; dữ liệu thực tế phụ thuộc station.
3. Xem xu hướng 24 giờ. Biểu đồ dùng giá trị trung bình theo giờ (`interval=1h`, `aggregate=mean`, tối đa 500 điểm).
4. Chọn **Refresh** để lấy lại dữ liệu. **Retry history** chỉ thử lại phần lịch sử khi phần này lỗi.

Số đo gần nhất và biểu đồ lịch sử là hai yêu cầu riêng. Một phần có thể hiển thị dù phần còn lại lỗi. Nhãn **Stored**, **Cached**, **Stale**, **Empty** hoặc **Unavailable** giúp phân biệt dữ liệu lưu trong backend, bộ nhớ đệm, dữ liệu cũ, phản hồi rỗng và dữ liệu chưa khả dụng. Kiểm tra thời điểm đo và thời điểm lấy dữ liệu trước khi dùng kết quả.

Khi lỗi mạng, lỗi máy chủ, hết thời gian chờ hoặc giới hạn tần suất, trang có thể giữ số đo thành công gần nhất của đúng station và ghi rõ dữ liệu cũ. Khi đổi station, không dùng số đo của station trước đó. Lỗi `401`, `403`, `404` làm loại bỏ dữ liệu liên quan để tránh tiếp tục hiển thị sau khi mất quyền.

### Phân tích và xuất báo cáo

**Historical Analysis** so sánh dữ liệu các station trong phạm vi được phép theo độ ẩm, nhiệt độ, pH hoặc EC. Chọn khoảng 7, 30 hoặc 90 ngày, chỉ số và độ sâu có trong dữ liệu. Có thể chuyển biểu đồ đường hoặc vùng, làm mới và xuất CSV. Yêu cầu lịch sử dùng trung bình theo ngày, thứ tự thời gian tăng dần, tối đa 500 điểm cho mỗi station.

**History Report** dùng một station và một chỉ số, gồm cả NPK. Chọn ngày bắt đầu, ngày kết thúc rồi dùng **Apply** để làm mới. Ngày nhập được chuyển thành toàn ngày UTC; biểu đồ hiển thị thời gian theo múi giờ trình duyệt. Các mốc lấy dữ liệu dùng định dạng giờ Việt Nam `Asia/Ho_Chi_Minh`.

Các đơn vị hiển thị ưu tiên đơn vị backend trả về: độ ẩm `%`, nhiệt độ `°C`, EC `µS/cm`, NPK `mg/kg`; pH không phải nồng độ. Không tự đổi EC sang đơn vị khác khi so sánh hoặc xuất file.

Đọc nhãn nguồn dữ liệu và **Coverage** trước khi sử dụng biểu đồ hoặc CSV. `stored`, `cache`, `upstream` mô tả nơi lấy dữ liệu; **browser retained (Last known)** là kết quả trước đó được giữ trong trang sau lỗi tạm thời. Dữ liệu lịch sử chỉ được giữ khi station và toàn bộ truy vấn còn trùng khớp, gồm chỉ số, khoảng thời gian, bước tổng hợp và giới hạn.

`partial` hoặc `partial (truncated)` nghĩa là kết quả chưa đầy đủ; cursor trang tiếp theo làm kết quả được đánh dấu bị giới hạn. Hai trang báo cáo Farmer không tự gom mọi trang lịch sử. CSV xuất dữ liệu hiện có kèm thông tin nguồn và phạm vi bao phủ; không mặc định là toàn bộ dữ liệu trong khoảng đã chọn. Nút xuất bị vô hiệu hóa khi không có điểm đo.

Nếu một station lỗi trong **Historical Analysis**, các station thành công vẫn có thể hiển thị. Dùng **Retry** tại station lỗi. Phản hồi rỗng thành công thay thế dữ liệu cũ; khoảng thiếu mẫu được thể hiện bằng khoảng đứt trên biểu đồ.

### Nguồn API sở hữu và chia sẻ

Quy trình này áp dụng cho cả Admin và Farmer là chủ nguồn.

Cột **Stations** là số trạm đã đăng ký của nguồn hoặc số trạm được chia sẻ cho
tài khoản hiện tại. **Test** chỉ kiểm tra kết nối và báo riêng số trạm đất phát
hiện từ API; thao tác này không thêm trạm hoặc thay đổi quyền chia sẻ. Tên nguồn
tự sinh theo mẫu cũ được hiển thị bằng hostname, không kèm số trạm lúc tạo.

1. Trong **API Sources**, chọn thêm nguồn, nhập URL API và `X-API-Key` hợp lệ; chọn hoặc tạo farm và plot theo biểu mẫu rồi chọn **Connect Source**. Tên nguồn có thể để trống để hệ thống tạo từ kết nối.
2. Với nguồn sở hữu, chọn **Manage Access**. Nhập ít nhất 3 ký tự của email và chọn **Search accounts**.
3. Chọn tài khoản Farmer hoặc Client Developer đang `ACTIVE`, chọn các station cần chia sẻ rồi lưu. Có thể mở **Edit access** để thay đổi hoặc thu hồi quyền.
4. Dùng **Reveal Key** khi cần xem khóa nguồn: nhập mật khẩu hiện tại. Hộp thoại đóng và xóa khóa khỏi nội dung đang hiển thị sau 30 giây.
5. **Remove Source** yêu cầu xác nhận. Khi nguồn bị gỡ, quyền truy cập và quy tắc cảnh báo dừng; dữ liệu kiểm toán lịch sử được giữ theo backend.

Người được chia sẻ chỉ đọc station đã chọn. Họ không có quyền hiện khóa nguồn, kiểm tra chủ động bằng **Test**, sửa quyền chia sẻ hoặc gỡ nguồn. Super Admin đọc được số đo nhưng cũng tuân theo giới hạn chủ sở hữu đối với các thao tác này.

## Client Developer

1. Mở **API Access → Keys**. Nếu chưa có station được cấp, liên hệ quản trị viên hoặc chủ nguồn để được cấp quyền trước.
2. Chọn tạo khóa, nhập tên và chọn rõ các station cần dùng. Lưu secret vừa cấp, xác nhận **I have saved this API key** rồi đóng hộp thoại. Danh sách sau đó chỉ hiển thị prefix và thông tin khóa, không cho xem lại secret.
3. Mở **API Access → Scope**, chọn khóa và kiểm tra phạm vi hiệu lực. Phạm vi này là giao giữa các station ghi trong khóa và quyền hiện tại của tài khoản. Phạm vi rỗng không mở rộng thành mọi station của tài khoản.
4. Dùng **Rotate key** để thay secret khi cần; secret cũ ngừng hoạt động. **Revoke key** thu hồi khóa vĩnh viễn. Kiểm tra trạng thái hết hạn, thu hồi và giới hạn yêu cầu/phút trong danh sách.
5. Mở **API Tools → Docs** để xem hợp đồng; mở **Explorer**, chọn endpoint, nhập `X-API-Key` và tham số rồi chọn **Send Request**.

Client API dùng `X-API-Key`, tách biệt token đăng nhập dashboard. Explorer giữ secret trong bộ nhớ của trang, không lưu vào local storage hoặc chèn vào nội dung phản hồi. Secret vừa cấp cũng chỉ tồn tại trong trạng thái hộp thoại; cần lưu trước khi đóng hoặc rời trang.

Explorer có health công khai, danh sách station, số đo gần nhất và lịch sử có giới hạn. Nó hiển thị mã HTTP, thời gian phản hồi, header giới hạn tần suất và nội dung trả về. Khi có cursor, dùng **Load next page**. Ô ngày giờ lịch sử được hiểu theo UTC. **Reset** xóa cấu hình và kết quả hiện tại, gồm khóa đã nhập.

Dashboard và **API Metrics** không cung cấp thống kê lưu lượng sản xuất theo tài khoản. Các giá trị `N/A` là chức năng backend chưa cung cấp, không phải tổng số yêu cầu bằng không.

## Cảnh báo và thông báo

Admin và Farmer dùng **Alert Center** để lọc theo farm, plot, station, trạng thái và mức độ. Nếu chưa chọn station, danh sách cảnh báo vẫn được backend giới hạn theo quyền hiện tại; chọn station để xem quy tắc và metadata chỉ số.

Chủ nguồn có thể tạo quy tắc với điều kiện trên ngưỡng, dưới ngưỡng hoặc ngoài khoảng, mức độ và trạng thái bật/tạm dừng. Admin còn có thể quản lý quy tắc nguồn `SYSTEM`. Chỉ số và đơn vị phải có metadata xác nhận từ backend. Thiếu metadata thì phần thiết lập không khả dụng, nhưng vẫn có thể theo dõi cảnh báo được phép xem.

**Acknowledge** ghi nhận cảnh báo mở; **Resolve** thực hiện quy trình giải quyết theo điều kiện backend. Thao tác bị từ chối sẽ hiển thị lỗi, không tự được coi là thành công. Khi có xung đột trạng thái, làm mới để kiểm tra dữ liệu hiện tại trước khi thao tác lại.

Thông báo được gửi trong ứng dụng cho người nhận đủ quyền. Admin và Farmer có chuông trên thanh trên cùng; Farmer có thêm trang **Notifications** với **All**, **Unread**, đánh dấu đã đọc/chưa đọc và tải thêm khi có dữ liệu. Đánh dấu đã đọc chỉ thay đổi trạng thái thông báo, không xác nhận hoặc giải quyết cảnh báo. Trang **Notifications** hiện là hộp thư, chưa có cấu hình gửi email hay SMS.

## Trạng thái cần xử lý

| Trạng thái                                    | Cách xử lý                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Đang tải hoặc làm mới                         | Chờ yêu cầu kết thúc; các thao tác liên quan có thể bị khóa tạm thời                          |
| Danh sách rỗng, không có station hoặc điểm đo | Kiểm tra bộ lọc, khoảng ngày và quyền đã cấp; không suy ra lỗi kết nối chỉ từ danh sách rỗng  |
| Lỗi tạm thời, dữ liệu giữ lại hoặc stale      | Kiểm tra thời điểm dữ liệu; chọn **Retry** hoặc **Refresh** tại phần lỗi                      |
| `401` của phiên web                           | Chờ cơ chế refresh; nếu phiên không phục hồi được thì đăng nhập lại                           |
| `401 INVALID_CREDENTIALS` khi Reveal          | Giữ phiên đang hợp lệ và nhập lại mật khẩu xác nhận; không đăng nhập lại chỉ vì lỗi này       |
| `403`                                         | Kiểm tra vai trò, quyền station và quyền chủ nguồn; đổi URL không cấp thêm quyền              |
| `404` với tài nguyên                          | Tài nguyên có thể không còn hoặc không thuộc phạm vi được phép; quay lại danh sách và làm mới |
| `409` hoặc trạng thái đã thay đổi             | Làm mới rồi kiểm tra điều kiện thao tác; tránh gửi lại dựa trên thông tin cũ                  |
| `429` trong Client API                        | Đọc thông tin giới hạn tần suất và chờ theo phản hồi trước khi gửi lại                        |
| Sao chép secret thất bại                      | Chọn và sao chép thủ công trước khi xác nhận đã lưu                                           |

## Giới hạn và lỗi còn tồn tại

Ghi cấu hình hoặc điều khiển thiết bị từ xa chưa được hỗ trợ. Các trang cấu hình hiển thị `NOT_AVAILABLE` với lý do `DEVICE_CONTRACT_PENDING`. Quy tắc cảnh báo chạy trên số đo và gửi thông báo trong ứng dụng; bật quy tắc không gửi lệnh cho thiết bị.

Một lỗi giao diện đã xác nhận trong mã hiện tại: **Acknowledge** và **Resolve** có thể vẫn xuất hiện với người chỉ được chia sẻ quyền đọc. Backend vẫn chặn thao tác này bằng `403` nếu người dùng không là chủ nguồn hoặc Admin quản lý nguồn `SYSTEM`. Người xem được chia sẻ nên dùng phần đọc cảnh báo và thông báo, rồi liên hệ chủ nguồn khi cần xử lý.

Khôi phục mật khẩu qua email và thống kê sử dụng API theo tài khoản chưa khả dụng như đã nêu ở trên. Những giới hạn này không được trình bày như chức năng đã hoàn tất.

Đọc thêm: [Kiến trúc frontend](ARCHITECTURE-FE.md) · [Triển khai với Nginx](DEPLOYMENT-NGINX.md) · [README](../README.md).
