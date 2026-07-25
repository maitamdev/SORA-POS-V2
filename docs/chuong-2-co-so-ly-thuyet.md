# CHƯƠNG 2. CƠ SỞ LÝ THUYẾT

Chương này trình bày nền tảng lý thuyết và nghiệp vụ dùng để xây dựng hệ thống SORA-POS với trọng tâm là bán hàng tại quầy, quản lý kho và cảnh báo tồn kho thấp. Nội dung không tách rời POS khỏi kho hàng, bởi mỗi giao dịch bán, nhập hoặc hủy đơn đều làm thay đổi lượng hàng có thể bán và phải được phản ánh nhất quán trong dữ liệu. Bên cạnh các nghiệp vụ cốt lõi, chương giới thiệu phân quyền theo vai trò, khả năng hỗ trợ phân tích bằng trí tuệ nhân tạo và nhóm công nghệ được lựa chọn cho hệ thống.

## 2.1. Tổng quan về hệ thống POS

### 2.1.1. Khái niệm hệ thống POS

POS là viết tắt của *Point of Sale*, tức điểm bán hoặc thời điểm giao dịch bán lẻ được thực hiện. Xét theo nghĩa hẹp, POS là nơi thu ngân ghi nhận mặt hàng, xác định số tiền phải thanh toán, tiếp nhận phương thức thanh toán và hoàn tất giao dịch. Hướng dẫn nghiệp vụ của Oracle Retail mô tả một giao dịch POS bắt đầu khi mã hàng được nhập thủ công, quét bằng mã vạch hoặc chọn từ danh sách; sau khi các mặt hàng được thêm đầy đủ, hệ thống chuyển sang bước thanh toán và giao dịch kết thúc khi số dư cần thu bằng không [1]. Cách mô tả này cho thấy POS không chỉ là thiết bị thu tiền mà là một chuỗi xử lý có dữ liệu đầu vào, quy tắc tính toán và kết quả giao dịch rõ ràng.

Xét theo nghĩa rộng, hệ thống POS là một hệ thống thông tin tác nghiệp hỗ trợ ghi nhận và xử lý các giao dịch phát sinh hằng ngày tại điểm bán. Dữ liệu thường bao gồm sản phẩm, số lượng, đơn giá, giảm giá, thuế hoặc phụ phí, khách hàng, nhân viên thực hiện, thời gian bán và phương thức thanh toán. Theo Laudon và Laudon, hệ thống xử lý giao dịch có nhiệm vụ thu thập và xử lý các giao dịch thường nhật cần thiết cho hoạt động của tổ chức; dữ liệu tác nghiệp sau đó có thể trở thành đầu vào cho giám sát, quản lý và ra quyết định [2]. Vì vậy, một POS hiện đại vừa phục vụ thao tác tức thời tại quầy, vừa tạo ra nguồn dữ liệu có cấu trúc cho quản lý bán lẻ.

Trong phạm vi đề tài, SORA-POS được hiểu là hệ thống POS trên nền tảng web dành cho cửa hàng bán lẻ, tích hợp ba thành phần có quan hệ trực tiếp: xử lý bán hàng, kiểm soát kho và cảnh báo tồn kho thấp. Khi hóa đơn hoàn tất, số lượng bán được trừ khỏi tồn kho; khi nhập hàng hoặc hoàn trả hàng từ đơn bị hủy, tồn kho được cộng lại; mọi thay đổi được ghi vào lịch sử biến động. Sau mỗi thay đổi, hệ thống so sánh tồn hiện tại với ngưỡng tối thiểu của sản phẩm để xác định trạng thái an toàn, tồn thấp hoặc hết hàng. Cách tiếp cận này làm cho số liệu bán hàng và số liệu kho cùng xuất phát từ một nghiệp vụ thống nhất, hạn chế tình trạng cập nhật rời rạc giữa nhiều công cụ.

### 2.1.2. Vai trò của POS trong bán lẻ

Thứ nhất, POS góp phần tăng tốc độ phục vụ tại quầy. Việc tìm kiếm sản phẩm, quét mã vạch, tự động lấy giá bán, tính giảm giá và tính tiền thừa giúp giảm số thao tác thủ công của thu ngân. Đối với cửa hàng có nhiều mã hàng, khả năng nhận diện sản phẩm bằng SKU hoặc mã vạch còn giúp rút ngắn thời gian tra cứu. Luồng thao tác nhất quán cũng hỗ trợ nhân viên mới làm quen nhanh hơn và giảm ùn tắc trong thời điểm có nhiều khách.

Thứ hai, POS nâng cao độ chính xác của giao dịch. Các phép tính tổng tiền, giảm giá, số tiền khách đưa và tiền trả lại được thực hiện theo quy tắc đã cấu hình thay vì phụ thuộc hoàn toàn vào tính toán thủ công. Hệ thống đồng thời lưu chi tiết từng mặt hàng và thanh toán đi kèm hóa đơn, nhờ đó có thể truy vết khi cần đối chiếu. Tuy nhiên, độ chính xác không chỉ nằm ở phép tính tiền. Một giao dịch chỉ nhất quán khi việc ghi nhận doanh thu, thanh toán và xuất kho được thực hiện như một đơn vị xử lý logic: nếu một bước thất bại, các bước còn lại không nên được ghi nhận riêng lẻ.

Thứ ba, POS tạo nền tảng dữ liệu cho quản lý cửa hàng. Dữ liệu giao dịch được tổng hợp theo ngày, nhân viên, ca làm việc, sản phẩm, danh mục và phương thức thanh toán. Từ đó, người quản lý có thể theo dõi doanh thu, số đơn, giá trị đơn trung bình, lợi nhuận gộp và sản phẩm bán chạy. Giá trị của POS vì thế không dừng ở “ghi nhận đã bán gì”, mà còn nằm ở khả năng chuyển dữ liệu tác nghiệp thành thông tin quản trị. Giáo trình quản trị bán lẻ nhấn mạnh vai trò của hệ thống thông tin trong việc phối hợp hoạt động, theo dõi hiệu quả và hỗ trợ quyết định về hàng hóa trong doanh nghiệp bán lẻ [3].

Thứ tư, POS tích hợp với kho giúp phản ánh mức tồn gần với thời điểm phát sinh giao dịch. Đây là điều đặc biệt quan trọng đối với đề tài. Nghiên cứu thực nghiệm của DeHoratius và Raman cho thấy sai lệch giữa tồn kho ghi trên hệ thống và tồn kho thực tế là một vấn đề đáng kể trong bán lẻ [4]. Khi bán hàng và kho được quản lý ở hai nơi khác nhau, việc chậm hoặc quên cập nhật dễ làm số liệu tồn không còn đáng tin cậy. SORA-POS giảm rủi ro này bằng cách liên kết trực tiếp chi tiết đơn hàng với giao dịch xuất kho, đồng thời lưu tồn trước và sau mỗi biến động để phục vụ kiểm tra.

Cuối cùng, POS hỗ trợ ra quyết định dựa trên dữ liệu. Lịch sử bán hàng cho phép nhận biết mặt hàng có tốc độ bán cao, mặt hàng bán chậm, khung giờ có doanh thu tốt hoặc tỷ trọng thanh toán tiền mặt và chuyển khoản. Khi kết hợp với tồn kho và giá vốn, người quản lý có thêm căn cứ để quyết định nhập hàng, điều chỉnh ngưỡng cảnh báo, xây dựng khuyến mãi và phân bổ nhân sự. POS không tự thay thế quyết định quản trị, nhưng cung cấp dữ liệu kịp thời và có cấu trúc để quyết định được đưa ra có căn cứ hơn.

### 2.1.3. Quy trình bán hàng cơ bản

Quy trình bán hàng cơ bản trong một hệ thống POS có thể mô tả qua sáu bước liên tiếp.

1. **Nhận diện và chọn hàng.** Thu ngân tìm theo tên, SKU, mã vạch hoặc quét mã để đưa sản phẩm vào giỏ hàng. Hệ thống kiểm tra sản phẩm còn hoạt động và hiển thị giá bán, đơn vị tính, lượng tồn khả dụng.
2. **Cập nhật giỏ hàng.** Thu ngân điều chỉnh số lượng, xóa mặt hàng hoặc chọn khách hàng. Hệ thống kiểm tra số lượng hợp lệ và không cho bán vượt tồn nếu cửa hàng không bật chính sách cho phép bán âm.
3. **Tính tiền.** Tổng tiền hàng được tính từ đơn giá nhân số lượng, sau đó trừ giảm giá theo dòng hàng, chương trình khuyến mãi, giảm giá thủ công hoặc điểm khách hàng thân thiết. Các giới hạn giảm giá phải được kiểm tra ở phía máy chủ để tránh phụ thuộc vào giao diện.
4. **Thanh toán.** Khách hàng chọn tiền mặt, thẻ hoặc chuyển khoản. Với tiền mặt, hệ thống ghi số tiền nhận và tính tiền thừa; với chuyển khoản, hệ thống có thể sinh mã QR, theo dõi trạng thái và lưu mã tham chiếu.
5. **Lập hóa đơn.** Sau khi thanh toán hợp lệ, hệ thống tạo mã đơn duy nhất, lưu thông tin chung, chi tiết mặt hàng và bản ghi thanh toán. Hóa đơn có thể được in, xem trước, xuất PDF hoặc gửi cho khách hàng.
6. **Cập nhật kho và báo cáo.** Số lượng của từng sản phẩm được trừ theo lượng bán, một giao dịch kho loại “xuất bán” được tạo, và trạng thái cảnh báo tồn kho được đồng bộ. Doanh thu theo ngày, ca và sản phẩm được cập nhật từ hóa đơn hoàn tất.

Về mặt toàn vẹn dữ liệu, các bước tạo đơn, ghi chi tiết, ghi thanh toán và trừ kho cần được thực hiện trong một giao dịch cơ sở dữ liệu. SORA-POS sử dụng hàm xử lý tại PostgreSQL để khóa các sản phẩm liên quan, kiểm tra tồn, lưu hóa đơn, trừ kho và ghi lịch sử trong cùng một giao dịch. Cách triển khai này ngăn trường hợp hai thu ngân đồng thời bán cùng lượng hàng cuối cùng mà cả hai yêu cầu đều đọc một số tồn cũ. Khi hủy đơn, hệ thống chỉ cho Admin hoặc Manager thực hiện; nếu chọn hoàn kho, lượng hàng được cộng lại và tạo giao dịch “hoàn trả”, đồng thời trạng thái thanh toán được chuyển sang hoàn tiền. Như vậy, quy trình bán hàng không kết thúc ở việc in hóa đơn mà còn bao gồm việc duy trì tính nhất quán của dữ liệu kho.

## 2.2. Các nghiệp vụ trong hệ thống bán hàng

### 2.2.1. Bán hàng và thanh toán

Giỏ hàng là cấu trúc tạm thời chứa các mặt hàng khách dự định mua. Mỗi dòng giỏ hàng tối thiểu có sản phẩm, số lượng, đơn giá và thành tiền; ngoài ra có thể có giảm giá theo dòng hoặc thông tin khuyến mãi. Khi một sản phẩm được quét nhiều lần, hệ thống có thể tăng số lượng thay vì tạo nhiều dòng trùng nhau. Trước khi thanh toán, giỏ hàng phải được kiểm tra lại ở máy chủ vì giá, trạng thái sản phẩm hoặc tồn kho có thể đã thay đổi kể từ lúc giao diện tải dữ liệu.

Giảm giá trong POS có thể xuất phát từ chương trình khuyến mãi, thao tác của người có quyền hoặc điểm tích lũy của khách hàng. Nguyên tắc quan trọng là giá trị giảm không được làm thành tiền âm và giảm giá thủ công không vượt quá mức cửa hàng cho phép. SORA-POS lưu tổng trước giảm, tổng giảm và số tiền cuối cùng; điểm khách hàng đã dùng và điểm được cộng cũng được ghi cùng đơn hàng. Việc tách các thành phần này giúp hóa đơn minh bạch, báo cáo doanh thu phản ánh số tiền thực thu và thao tác giảm giá có thể được kiểm tra sau này.

Đối với tiền mặt, hệ thống cần kiểm tra số tiền nhận không nhỏ hơn số phải trả và tính phần tiền thừa. Đối với chuyển khoản, mã đơn và số tiền cần được gắn vào yêu cầu thanh toán để hỗ trợ đối soát. Tài liệu payOS mô tả luồng tạo liên kết thanh toán, khách quét VietQR, hệ thống nhận kết quả qua trang trả về và đồng thời nhận webhook để cập nhật trạng thái đơn [21]. Trong SORA-POS, phương thức thanh toán và mã tham chiếu được lưu cùng bản ghi thanh toán; chức năng tạo và kiểm tra trạng thái payOS/VietQR đóng vai trò hỗ trợ, trong khi việc xác nhận hoàn tất đơn vẫn phải tuân theo quy tắc nghiệp vụ của hệ thống.

Hóa đơn là chứng từ ghi nhận kết quả giao dịch. Hóa đơn POS cần thể hiện mã đơn, thời gian, thu ngân, danh sách hàng, số lượng, đơn giá, giảm giá, tổng thanh toán, phương thức thanh toán, tiền nhận và tiền thừa nếu có. Ngoài vai trò giao cho khách, hóa đơn còn là căn cứ liên kết với thanh toán, giao dịch kho và ca làm việc. Vì yêu cầu truy vết, hệ thống không nên xóa cứng hóa đơn đã phát sinh; thao tác hủy phải giữ lại bản ghi cũ, lý do, người hủy và thời điểm hủy.

### 2.2.2. Quản lý kho và cảnh báo tồn kho thấp

Quản lý kho là quá trình ghi nhận, kiểm soát và phân tích sự thay đổi số lượng hàng hóa. Trong cửa hàng bán lẻ, các nguồn làm tăng tồn thường gồm nhập hàng và hoàn trả; các nguồn làm giảm tồn gồm xuất bán, hư hỏng, thất thoát hoặc điều chỉnh sau kiểm kê. Mỗi biến động nên được biểu diễn bằng một giao dịch kho chứa sản phẩm, loại nghiệp vụ, lượng thay đổi, tồn trước, tồn sau, chứng từ tham chiếu, người thực hiện và thời gian. Cấu trúc này tạo ra *audit trail* để giải thích vì sao tồn kho hiện tại có một giá trị cụ thể.

Nghiệp vụ nhập hàng bắt đầu từ nhà cung cấp và danh sách sản phẩm nhập, số lượng, đơn giá nhập, số tiền đã trả và ghi chú. Khi phiếu nhập hợp lệ, hệ thống tăng tồn của từng sản phẩm, cập nhật giá vốn theo chính sách của đề tài và ghi giao dịch nhập kho. Trạng thái thanh toán của phiếu có thể là chưa thanh toán, thanh toán một phần hoặc đã thanh toán. Việc cập nhật tồn và lưu chi tiết phiếu cần nằm trong cùng một giao dịch để tránh có phiếu nhưng kho chưa tăng, hoặc kho đã tăng nhưng không có chứng từ.

Nghiệp vụ xuất bán phát sinh tự động từ hóa đơn hoàn tất, không yêu cầu người dùng nhập lại. Đây là mối liên kết cốt lõi giữa POS và kho: số lượng bán trong chi tiết đơn chính là số lượng giảm của sản phẩm. Khi đơn bị hủy và hàng được hoàn lại, hệ thống tạo một biến động ngược thay vì xóa giao dịch xuất cũ. Cách lưu vết này phản ánh đúng lịch sử và hỗ trợ đối chiếu doanh thu với biến động kho.

Tồn kho hiện tại cho biết số lượng được ghi nhận là có trong hệ thống, nhưng quyết định nhập hàng cần thêm một mốc so sánh. Trong lý thuyết kiểm soát tồn kho, điểm đặt hàng lại được dùng để kích hoạt bổ sung hàng khi vị thế tồn kho giảm đến một ngưỡng xác định; ngưỡng phụ thuộc vào nhu cầu trong thời gian chờ và mức dự trữ an toàn [5]. Đề tài áp dụng một dạng đơn giản phù hợp cửa hàng nhỏ: mỗi sản phẩm có ngưỡng tồn tối thiểu. Nếu tồn hiện tại lớn hơn ngưỡng, trạng thái là an toàn; nếu lớn hơn 0 nhưng nhỏ hơn hoặc bằng ngưỡng, trạng thái là tồn thấp; nếu nhỏ hơn hoặc bằng 0, trạng thái là hết hàng.

Cảnh báo tồn kho thấp là cơ chế chủ động thông báo rằng một sản phẩm đã chạm vùng cần chú ý. Sau mỗi lần bán, nhập, điều chỉnh hoặc hoàn kho, hệ thống kiểm tra lại sản phẩm. Nếu hàng chuyển từ an toàn sang tồn thấp hoặc hết hàng, một cảnh báo được tạo; nếu cảnh báo đang tồn tại, hệ thống cập nhật số lượng và trạng thái thay vì tạo trùng; nếu lượng tồn tăng vượt ngưỡng, cảnh báo được đánh dấu đã giải quyết. Ngoài danh sách trên màn hình, hệ thống có thể gửi thông báo qua kênh bên ngoài, nhưng bản ghi cảnh báo trong cơ sở dữ liệu vẫn là nguồn kiểm soát chính.

Ngưỡng tối thiểu không đồng nghĩa với số lượng phải nhập. Nó là tín hiệu cần xem xét. Với sản phẩm bán nhanh, ngưỡng quá thấp có thể khiến cửa hàng hết hàng trước khi nhà cung cấp giao; với sản phẩm bán chậm, ngưỡng quá cao có thể làm tăng vốn tồn. Do đó, Manager cần định kỳ hiệu chỉnh ngưỡng dựa trên tốc độ bán, thời gian cung ứng, tính mùa vụ và mức độ quan trọng của sản phẩm. Việc kiểm kê thực tế cũng cần thiết vì tích hợp tự động không loại bỏ hoàn toàn sai lệch do mất mát, hư hỏng hoặc thao tác ngoài hệ thống [4].

### 2.2.3. Quản lý nhân viên và ca làm việc

Quản lý ca làm việc giúp gắn doanh thu và trách nhiệm tiền mặt với một khoảng thời gian và một thu ngân cụ thể. Trong SORA-POS, Manager hoặc Admin mở ca và chỉ định nhân viên; thu ngân nhận ca bằng cách xác nhận số tiền đầu ca. Khi đang ở trạng thái đã nhận ca, thu ngân mới có thể hoàn tất giao dịch POS. Ràng buộc này bảo đảm mỗi hóa đơn của Cashier được liên kết với một ca đang hoạt động.

Trong ca, hệ thống tổng hợp số đơn hoàn tất, đơn hủy, doanh thu, giảm giá và doanh thu theo từng phương thức thanh toán. Các khoản đưa tiền vào hoặc lấy tiền ra khỏi ngăn kéo nhưng không phải doanh thu bán hàng cũng cần được ghi riêng với loại, số tiền, lý do và người thực hiện. Nhờ đó, số tiền mặt dự kiến cuối ca được tính theo công thức:

**Tiền mặt dự kiến = tiền đầu ca + doanh thu tiền mặt + tiền đưa vào ngăn kéo - tiền lấy ra khỏi ngăn kéo.**

Khi đóng ca, thu ngân nhập số tiền mặt kiểm đếm thực tế. Hệ thống tính chênh lệch giữa tiền thực tế và tiền dự kiến, lưu thời gian đóng cùng ghi chú. Manager có quyền đóng ca thay trong tình huống cần xử lý và có thể xem báo cáo theo ca để đối chiếu. Thu ngân chịu trách nhiệm thực hiện giao dịch đúng ca, kiểm tra phương thức thanh toán, bảo quản tiền mặt và giải trình chênh lệch; Manager chịu trách nhiệm giám sát, xử lý ngoại lệ và phê duyệt các thao tác có rủi ro cao hơn như hủy đơn.

### 2.2.4. Báo cáo doanh thu

Báo cáo doanh thu chuyển dữ liệu giao dịch thành các chỉ số phục vụ theo dõi hoạt động. Doanh thu thuần trong phạm vi hệ thống được tổng hợp từ số tiền cuối cùng của các đơn ở trạng thái hoàn tất, không bao gồm đơn đã hủy. Số đơn, tổng giảm giá và giá trị đơn trung bình là các chỉ số bổ sung giúp giải thích doanh thu. Báo cáo có thể nhóm theo ngày để quan sát xu hướng hoặc theo ca, nhân viên và phương thức thanh toán để phục vụ đối chiếu.

Lợi nhuận gộp được ước tính bằng doanh thu của từng dòng hàng trừ giá vốn tương ứng. Để báo cáo lịch sử không thay đổi khi giá nhập mới được cập nhật, SORA-POS lưu ảnh chụp giá vốn tại thời điểm bán trong chi tiết đơn hàng. Đây là điểm quan trọng: nếu luôn lấy giá vốn hiện tại của sản phẩm để tính lại đơn cũ, lợi nhuận của kỳ quá khứ sẽ biến động dù giao dịch không thay đổi.

Báo cáo sản phẩm bán chạy tổng hợp số lượng và doanh thu theo sản phẩm, sau đó sắp xếp giảm dần. Chỉ số này hỗ trợ bố trí hàng, xây dựng khuyến mãi và ưu tiên nhập kho. Tuy nhiên, “bán chạy” cần được đọc cùng lợi nhuận và tồn kho: sản phẩm có doanh thu cao chưa chắc có biên lợi nhuận tốt; sản phẩm bán nhanh nhưng tồn thấp có nguy cơ mất doanh thu; sản phẩm tồn nhiều nhưng không bán có nguy cơ giam vốn. Vì vậy, dashboard của SORA-POS kết hợp doanh thu, lợi nhuận, sản phẩm bán chạy và cảnh báo kho thay vì trình bày các chỉ số độc lập.

## 2.3. Phân quyền người dùng

RBAC (*Role-Based Access Control*) là mô hình kiểm soát truy cập trong đó quyền được gán cho vai trò, còn người dùng được gán vào vai trò phù hợp với chức trách. Mô hình chuẩn của NIST phân biệt người dùng, vai trò, quyền và phiên làm việc; cách tổ chức này giúp quản trị quyền theo nhiệm vụ thay vì cấu hình riêng lẻ cho từng tài khoản [6]. Nguyên tắc quyền tối thiểu yêu cầu người dùng chỉ có các quyền cần thiết để hoàn thành công việc, nhờ đó giảm thao tác nhầm và giới hạn tác động khi tài khoản bị lạm dụng.

SORA-POS sử dụng ba vai trò:

- **Admin:** quản trị toàn hệ thống; tạo, cập nhật hoặc vô hiệu hóa nhân viên; cấu hình vận hành; quản lý dữ liệu nền; xem báo cáo, nhật ký; thực hiện các thao tác quản trị có mức ảnh hưởng cao.
- **Manager:** quản lý hoạt động cửa hàng; quản lý sản phẩm, danh mục, nhà cung cấp, nhập kho, điều chỉnh kho, khuyến mãi, ca làm việc, báo cáo và phân tích AI; được hủy hóa đơn nhưng không có toàn bộ quyền quản trị tài khoản và cấu hình nhạy cảm của Admin.
- **Cashier:** nhận và đóng ca của bản thân, thao tác bán hàng, thanh toán, in hoặc gửi hóa đơn, tra cứu hàng phục vụ bán; chỉ xem các đơn của chính mình trong phạm vi thời gian được giới hạn và không được nhập hoặc điều chỉnh kho.

Việc ẩn chức năng trên giao diện giúp người dùng tập trung vào nhiệm vụ, nhưng không đủ để bảo đảm an toàn. SORA-POS kiểm tra vai trò tại API bằng middleware; cơ sở dữ liệu còn kiểm tra vai trò trong các nghiệp vụ quan trọng như hủy đơn. Token JWT mang thông tin nhận dạng để máy chủ xác thực yêu cầu, nhưng trạng thái hoạt động và vai trò hiện tại của tài khoản vẫn được đọc lại nhằm tránh tiếp tục dùng quyền cũ sau khi tài khoản bị vô hiệu hóa hoặc đổi vai trò. Cách kiểm soát nhiều lớp phù hợp với mục tiêu vừa dễ sử dụng vừa bảo vệ dữ liệu bán hàng và kho.

## 2.4. Ứng dụng AI trong quản lý bán hàng và tồn kho

### 2.4.1. Khái niệm AI và mô hình ngôn ngữ lớn

Trí tuệ nhân tạo (AI) là lĩnh vực nghiên cứu và xây dựng các hệ thống có khả năng thực hiện những nhiệm vụ thường đòi hỏi năng lực nhận thức như suy luận, học từ dữ liệu, nhận biết mẫu và hỗ trợ ra quyết định. Russell và Norvig tiếp cận AI qua khái niệm tác tử thông minh: hệ thống nhận biết môi trường và lựa chọn hành động nhằm đạt mục tiêu [7]. Trong quản lý bán hàng, AI có thể được ứng dụng vào dự báo nhu cầu, phát hiện bất thường, phân nhóm sản phẩm và tạo diễn giải bằng ngôn ngữ tự nhiên.

Mô hình ngôn ngữ lớn (LLM) là mô hình học máy được huấn luyện trên lượng dữ liệu văn bản lớn để dự đoán và sinh chuỗi ngôn ngữ. Báo cáo về *foundation models* mô tả các mô hình được huấn luyện trên dữ liệu rộng ở quy mô lớn và có thể thích nghi cho nhiều nhiệm vụ phía sau, đồng thời lưu ý rằng lỗi và hạn chế của mô hình nền có thể lan truyền sang ứng dụng sử dụng nó [8]. Trong SORA-POS, LLM không trực tiếp ghi đơn, trừ kho hoặc tự đặt hàng. Mô hình được dùng để chuyển các số liệu đã tính toán thành nhận xét và khuyến nghị dễ đọc cho người quản lý.

### 2.4.2. AI phân tích doanh thu và đề xuất nhập hàng

Phân tích doanh thu sử dụng dữ liệu đầu vào gồm tổng doanh thu, số đơn, giảm giá, lợi nhuận gộp, biên lợi nhuận, doanh thu theo ngày, sản phẩm bán chạy, cơ cấu phương thức thanh toán và một số chỉ số khách hàng. Các phép tổng hợp định lượng được thực hiện trong hệ thống trước; LLM nhận dữ liệu đã cấu trúc để tạo phần diễn giải về xu hướng, ngày cao điểm, mức biến động, cơ cấu sản phẩm, rủi ro tập trung doanh thu và hành động đề xuất. Việc tách tính toán khỏi sinh văn bản giúp biểu đồ và chỉ số không phụ thuộc vào khả năng tính toán của mô hình.

Đối với đề xuất nhập hàng, đầu vào chính gồm tồn hiện tại, ngưỡng tồn tối thiểu, lượng bán lịch sử, tốc độ bán trung bình, xu hướng gần đây, giá vốn và nhà cung cấp. SORA-POS so sánh tốc độ bán trong 7 ngày với 30 ngày; tốc độ bán bình quân được dùng để ước tính số ngày hàng còn đủ bán. Với khoảng bao phủ mục tiêu mặc định 14 ngày, lượng đề xuất cơ bản được xác định theo nguyên tắc:

**Tồn mục tiêu = tốc độ bán bình quân ngày × số ngày bao phủ mục tiêu.**

**Lượng đề xuất nhập = max(0, max(tồn tối thiểu, tồn mục tiêu) - tồn hiện tại).**

Đây là quy tắc hỗ trợ, không phải một mô hình tối ưu hóa đầy đủ. Lý thuyết tồn kho cho thấy quyết định bổ sung cần xét nhu cầu và thời gian chờ cung ứng [5]; nghiên cứu về dự báo nhu cầu cũng cho thấy các kỹ thuật học máy có thể khai thác mẫu phi tuyến nhưng phải được đánh giá theo dữ liệu và bối cảnh cụ thể [9]. Trong phạm vi đề tài, quy tắc tốc độ bán tạo kết quả định lượng có thể kiểm tra, còn LLM qua Groq diễn giải lý do ưu tiên, số ngày tồn dự kiến, xu hướng tăng hoặc giảm và đề xuất hành động.

Kết quả phân tích có thể chia sản phẩm thành hết hàng, tồn thấp, sắp thiếu theo số ngày bao phủ, tồn an toàn, tồn quá mức hoặc hàng không phát sinh bán trong kỳ. Manager sử dụng danh sách này để xem sản phẩm nào cần nhập gấp, ước tính chi phí bổ sung, xem nhà cung cấp và điều chỉnh lượng đặt thực tế. AI vì thế đóng vai trò hệ thống hỗ trợ quyết định: rút ngắn thời gian đọc dữ liệu và nêu các điểm đáng chú ý, trong khi quyền phê duyệt vẫn thuộc về con người.

### 2.4.3. Giới hạn của AI

Kết quả AI phụ thuộc trực tiếp vào chất lượng dữ liệu đầu vào. Nếu hóa đơn bị thiếu, tồn kho sai, giá vốn không được cập nhật, sản phẩm có thời gian bán quá ngắn hoặc giao dịch ngoài hệ thống không được ghi nhận, phân tích có thể không phản ánh đúng thực tế. Dữ liệu lịch sử cũng không tự chứa thông tin về sự kiện tương lai như ngày lễ, thay đổi giá, chiến dịch marketing, thời gian giao hàng của nhà cung cấp hoặc biến động thị trường.

LLM có khả năng tạo văn bản hợp lý về ngôn ngữ nhưng không bảo đảm mọi nhận định đều chính xác. Mô hình có thể nhấn mạnh sai nguyên nhân, diễn giải quá mức hoặc đưa ra khuyến nghị thiếu bối cảnh. NIST AI RMF nhấn mạnh việc quản trị, đo lường, giám sát và quản lý rủi ro trong toàn bộ vòng đời hệ thống AI [10]. Vì vậy, SORA-POS cần hiển thị số liệu nền bên cạnh phần phân tích, lưu lịch sử kết quả, cho phép người quản lý kiểm tra và không tự động tạo phiếu nhập chỉ từ câu trả lời của mô hình.

Khi Groq API chưa cấu hình hoặc không khả dụng, các nghiệp vụ bán hàng, cập nhật kho và cảnh báo tồn kho vẫn phải hoạt động bình thường. Hệ thống có thể trả về kết quả tính toán theo quy tắc cục bộ mà không có phần diễn giải mở rộng. Thiết kế này thể hiện nguyên tắc AI là thành phần hỗ trợ, không phải điểm phụ thuộc của quy trình cốt lõi.

## 2.5. Công nghệ sử dụng

### 2.5.1. Nhóm công nghệ frontend

**React** là thư viện JavaScript xây dựng giao diện từ các component có thể tái sử dụng và lồng ghép [11]. Cách tổ chức này phù hợp với giao diện POS gồm lưới sản phẩm, giỏ hàng, hộp thoại thanh toán, xem trước hóa đơn, dashboard và các trang quản lý. Trạng thái và sự kiện của từng component giúp giao diện phản hồi ngay khi người dùng thêm hàng hoặc thay đổi số lượng.

**TypeScript** bổ sung hệ thống kiểu cho JavaScript, giúp mô tả rõ cấu trúc dữ liệu như sản phẩm, đơn hàng, thanh toán và cảnh báo; tài liệu TypeScript nhấn mạnh kiểu dữ liệu giúp tăng khả năng kiểm tra và công cụ hỗ trợ trong quá trình phát triển [12]. **Vite** cung cấp máy chủ phát triển và quy trình đóng gói cho ứng dụng web hiện đại [13]. **Tailwind CSS** áp dụng các lớp tiện ích đơn nhiệm trực tiếp trong markup để tạo bố cục và trạng thái giao diện nhất quán [14]. **Zustand** được dùng quản lý trạng thái dùng chung bằng store và hook, phù hợp cho phiên đăng nhập, giỏ hàng và thông báo [15].

### 2.5.2. Nhóm công nghệ backend và API

Backend sử dụng **Node.js** làm môi trường thực thi JavaScript/TypeScript phía máy chủ và **Express** để tổ chức ứng dụng web, middleware và các tuyến API; Express được mô tả là framework tối giản, linh hoạt cho ứng dụng web Node.js [16]. Mã nguồn được phân lớp Route–Controller–Service: route khai báo endpoint và middleware, controller tiếp nhận yêu cầu, service xử lý nghiệp vụ và làm việc với cơ sở dữ liệu.

API được thiết kế theo định hướng **REST**, trong đó tài nguyên như sản phẩm, đơn hàng, kho, ca làm việc và báo cáo được truy cập qua HTTP. REST là phong cách kiến trúc do Fielding hệ thống hóa cho các hệ thống phần mềm dựa trên mạng, nhấn mạnh các ràng buộc như client–server, stateless và giao diện thống nhất [17]. Dữ liệu trao đổi chủ yếu ở định dạng JSON.

Xác thực sử dụng **JWT**. Theo RFC 7519, JWT là phương thức biểu diễn nhỏ gọn và an toàn với URL cho một tập các claim truyền giữa các bên; claim có thể được ký hoặc bảo vệ toàn vẹn [18]. Sau khi đăng nhập, client gửi token trong các yêu cầu cần bảo vệ; backend xác minh token, kiểm tra tài khoản còn hoạt động và áp dụng middleware vai trò trước khi cho phép nghiệp vụ.

### 2.5.3. Dữ liệu và dịch vụ ngoài

**PostgreSQL** là hệ quản trị cơ sở dữ liệu quan hệ lưu trữ dữ liệu nghiệp vụ. **Supabase** cung cấp một cơ sở dữ liệu PostgreSQL đầy đủ cho mỗi dự án cùng giao diện và API hỗ trợ quản lý [19]. SORA-POS sử dụng quan hệ và ràng buộc giữa người dùng, sản phẩm, đơn hàng, thanh toán, phiếu nhập, giao dịch kho, cảnh báo và ca làm việc. Các hàm PostgreSQL được dùng cho nghiệp vụ cần tính nguyên tử như checkout, hủy đơn và nhập kho.

**Groq API** cung cấp điểm cuối tương thích cho chat completion, nhận danh sách thông điệp và mã mô hình để sinh phản hồi [20]. SORA-POS gửi dữ liệu phân tích đã tổng hợp tới mô hình ngôn ngữ để tạo nhận xét doanh thu và tồn kho. Phần tính KPI, số ngày tồn và lượng đề xuất nhập vẫn được thực hiện bằng logic xác định trong backend.

**payOS/VietQR** hỗ trợ thanh toán chuyển khoản. payOS tạo yêu cầu thanh toán chứa mã đơn, số tiền, mô tả và mã QR; webhook cho phép cửa hàng nhận kết quả giao dịch để đối soát [21]. Việc tích hợp này bổ sung lựa chọn thanh toán số bên cạnh tiền mặt và lưu mã tham chiếu cùng hóa đơn.

**Bảng 2.1. Tổng hợp công nghệ sử dụng trong SORA-POS**

| Nhóm | Công nghệ | Vai trò trong hệ thống |
|---|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Zustand | Xây dựng giao diện component, kiểm tra kiểu, đóng gói ứng dụng, định kiểu và quản lý trạng thái |
| Backend | Node.js, Express, RESTful API, JWT | Xử lý nghiệp vụ, cung cấp API, xác thực và phân quyền |
| Dữ liệu | PostgreSQL/Supabase | Lưu trữ quan hệ, giao dịch nguyên tử, truy vấn và tổng hợp dữ liệu |
| AI | Groq API và mô hình ngôn ngữ | Diễn giải số liệu, phân tích doanh thu và hỗ trợ đề xuất nhập hàng |
| Thanh toán | payOS/VietQR | Tạo yêu cầu chuyển khoản QR, kiểm tra và nhận trạng thái thanh toán |

Nhóm công nghệ trên phù hợp với kiến trúc web tách frontend và backend của đề tài. Việc lựa chọn không làm thay đổi nguyên tắc nghiệp vụ: cơ sở dữ liệu và backend chịu trách nhiệm bảo vệ tính đúng đắn của đơn hàng và tồn kho; frontend tối ưu thao tác; các dịch vụ AI và thanh toán được tích hợp qua API nhưng không được phép làm gián đoạn chức năng bán hàng cốt lõi khi tạm thời không khả dụng.

## 2.6. Kết luận chương

Chương 2 đã trình bày POS như một hệ thống thông tin tác nghiệp tại điểm bán và làm rõ vai trò của POS đối với tốc độ phục vụ, độ chính xác, quản lý dữ liệu và hỗ trợ ra quyết định. Đối với SORA-POS, bán hàng và quản lý kho được xem là một quy trình thống nhất: hóa đơn làm phát sinh xuất kho, phiếu nhập làm tăng kho, hủy đơn có thể hoàn kho, mọi biến động được lưu vết và lượng tồn được so sánh với ngưỡng tối thiểu để phát cảnh báo tồn thấp hoặc hết hàng.

Chương cũng xác định các nền tảng bổ trợ gồm quản lý nhân viên và ca làm việc, báo cáo doanh thu–lợi nhuận, RBAC với ba vai trò Admin–Manager–Cashier, và AI hỗ trợ phân tích nhưng không thay thế quyết định của người quản lý. Cuối cùng, bộ công nghệ React–TypeScript–Vite–Tailwind CSS–Zustand, Node.js–Express–REST–JWT, PostgreSQL/Supabase, Groq và payOS/VietQR tạo nền tảng triển khai các yêu cầu trên. Những cơ sở này là tiền đề cho phần phân tích yêu cầu, thiết kế kiến trúc, dữ liệu và các luồng nghiệp vụ ở chương tiếp theo.

# TÀI LIỆU THAM KHẢO

[1] Oracle, “Completing Transactions,” *Oracle Retail Point-of-Service User Guide*, Release 14.1, 2014. [Trực tuyến]. Có tại: https://docs.oracle.com/cd/E12521_01/point_of_service/pdf/141/html/pos_ug/Output/transactions.htm. Truy cập ngày 24/07/2026.

[2] K. C. Laudon và J. P. Laudon, *Management Information Systems: Managing the Digital Firm*, ấn bản Global thứ 16. Pearson, 2020. ISBN: 978-1-292-29656-2.

[3] M. Levy, B. A. Weitz và D. Grewal, *Retailing Management*, ấn bản thứ 10. McGraw-Hill Education, 2019. ISBN: 978-1-259-57308-8.

[4] N. DeHoratius và A. Raman, “Inventory Record Inaccuracy: An Empirical Analysis,” *Management Science*, tập 54, số 4, tr. 627–641, 2008. DOI: 10.1287/mnsc.1070.0789.

[5] E. A. Silver, D. F. Pyke và R. Peterson, *Inventory Management and Production Planning and Scheduling*, ấn bản thứ 3. New York: John Wiley & Sons, 1998. ISBN: 978-0-471-11947-0.

[6] D. F. Ferraiolo, R. Sandhu, S. Gavrila, D. R. Kuhn và R. Chandramouli, “Proposed NIST Standard for Role-Based Access Control,” *ACM Transactions on Information and System Security*, tập 4, số 3, tr. 224–274, 2001. DOI: 10.1145/501978.501980.

[7] S. Russell và P. Norvig, *Artificial Intelligence: A Modern Approach*, ấn bản thứ 4. Pearson, 2021. ISBN: 978-1-292-40113-3.

[8] R. Bommasani và cộng sự, “On the Opportunities and Risks of Foundation Models,” *arXiv preprint arXiv:2108.07258*, 2021. DOI: 10.48550/arXiv.2108.07258.

[9] R. Carbonneau, K. Laframboise và R. Vahidov, “Application of Machine Learning Techniques for Supply Chain Demand Forecasting,” *European Journal of Operational Research*, tập 184, số 3, tr. 1140–1154, 2008. DOI: 10.1016/j.ejor.2006.12.004.

[10] E. Tabassi, *Artificial Intelligence Risk Management Framework (AI RMF 1.0)*, NIST AI 100-1. National Institute of Standards and Technology, 2023. DOI: 10.6028/NIST.AI.100-1.

[11] React Team, “Describing the UI,” *React Documentation*. [Trực tuyến]. Có tại: https://react.dev/learn/describing-the-ui. Truy cập ngày 24/07/2026.

[12] Microsoft, “TypeScript Documentation,” *TypeScript*. [Trực tuyến]. Có tại: https://www.typescriptlang.org/docs/. Truy cập ngày 24/07/2026.

[13] Vite Team, “Getting Started,” *Vite Documentation*. [Trực tuyến]. Có tại: https://vite.dev/guide/. Truy cập ngày 24/07/2026.

[14] Tailwind Labs, “Styling with Utility Classes,” *Tailwind CSS Documentation*. [Trực tuyến]. Có tại: https://tailwindcss.com/docs/styling-with-utility-classes. Truy cập ngày 24/07/2026.

[15] pmndrs, “Introduction,” *Zustand Documentation*. [Trực tuyến]. Có tại: https://zustand.docs.pmnd.rs/learn/getting-started/introduction. Truy cập ngày 24/07/2026.

[16] OpenJS Foundation, “Express – Node.js Web Application Framework,” *Express*. [Trực tuyến]. Có tại: https://expressjs.com/. Truy cập ngày 24/07/2026.

[17] R. T. Fielding, “Architectural Styles and the Design of Network-based Software Architectures,” Luận án tiến sĩ, University of California, Irvine, 2000. Có tại: https://www.ics.uci.edu/~fielding/pubs/dissertation/top.htm.

[18] M. Jones, J. Bradley và N. Sakimura, “JSON Web Token (JWT),” RFC 7519, Internet Engineering Task Force, 2015. DOI: 10.17487/RFC7519.

[19] Supabase, “Database,” *Supabase Documentation*. [Trực tuyến]. Có tại: https://supabase.com/docs/guides/database/overview. Truy cập ngày 24/07/2026.

[20] Groq, “API Reference,” *GroqDocs*. [Trực tuyến]. Có tại: https://console.groq.com/docs/api-reference. Truy cập ngày 24/07/2026.

[21] payOS, “Bắt đầu” và “payOS API,” *Tài liệu payOS*. [Trực tuyến]. Có tại: https://payos.vn/docs/ và https://payos.vn/docs/api/. Truy cập ngày 24/07/2026.
