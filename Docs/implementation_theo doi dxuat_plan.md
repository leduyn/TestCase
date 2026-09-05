# Kế hoạch triển khai: Danh sách người theo dõi (Proposal Followers) cho Đề xuất

## Tổng quan mục tiêu
Theo yêu cầu của người dùng:
1. **Bổ sung danh sách người theo dõi cho đề xuất**: Mỗi đề xuất sẽ có danh sách người theo dõi (followers/watchers) được lưu trữ và hiển thị rõ ràng.
2. **Có thể bổ sung người theo dõi vào đề xuất tại mọi trạng thái**: Người dùng có thể thêm/xóa người theo dõi bất kể đề xuất đang ở trạng thái nào (`DRAFT`, `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`).
3. **Người theo dõi có quyền xem thông tin và bình luận trong đề xuất**: Người theo dõi có thể truy cập xem toàn bộ nội dung đề xuất, nhận thông báo khi có bình luận mới và trực tiếp tham gia thảo luận/bình luận.

---

## Phân tích hiện trạng kiến trúc

1. **Cơ sở dữ liệu**:
   - Đang dùng PostgreSQL qua Prisma (`prisma/schema.prisma`).
   - Đã có mô hình tương tự `TestExecutionWatcher` cho việc theo dõi test execution.
   - `model Proposal` hiện có các quan hệ: `approvals`, `histories`, `comments`, `notifications`.
   - Cần thêm `model ProposalFollower` và liên kết với `Proposal` và `User`.
   - Cần bổ sung các giá trị cho enum `ProposalHistoryType` (`FOLLOWER_ADDED`, `FOLLOWER_REMOVED`) và `ProposalNotificationType` (`FOLLOWER_ADDED`).

2. **Backend Service & Routing**:
   - `proposalService.ts`: Cần bổ sung các hàm quản lý follower (`addFollowers`, `removeFollower`, `getFollowers`), cập nhật `getProposalById` để load followers và cờ `isFollower`, cập nhật `addComment` để gửi thông báo bình luận tới tất cả người theo dõi.
   - `proposalController.ts` & `proposalRoutes.ts`: Bổ sung endpoint `POST /api/proposals/:id/followers`, `DELETE /api/proposals/:id/followers/:userId`, `GET /api/proposals/:id/followers`.
   - `myProposalController.ts` & `myProposalRoutes.ts`: Bổ sung endpoint `GET /api/my/following` để người dùng lọc nhanh danh sách các đề xuất mà mình đang theo dõi.

3. **Frontend**:
   - `types/proposal.ts`: Bổ sung interface `ProposalFollower`, mở rộng `Proposal` với `followers?: ProposalFollower[]`, `isFollower?: boolean`.
   - `proposalApi.ts`: Thêm các hàm gọi API người theo dõi (`addFollowers`, `removeFollower`, `getFollowers`, `getMyFollowing`).
   - `ProposalFollowersCard.tsx` (Component mới): Hiển thị danh sách người theo dõi, nút "+ Thêm người theo dõi" (chọn user từ danh bạ active), nút toggle nhanh "Theo dõi / Đang theo dõi", nút xóa người theo dõi.
   - `ProposalDetail.tsx`: Tích hợp `ProposalFollowersCard` vào cột bên phải và thêm nút "Theo dõi" nhanh trên thanh công cụ Topbar.
   - `ProposalCommentsSection.tsx`: Cập nhật mô tả bình luận, đảm bảo người theo dõi có thể gửi và nhận bình luận thông suốt.
   - `ProposalHub.tsx`: Thêm tab "Đang theo dõi" (`MY_FOLLOWING`) giúp người dùng theo dõi đề xuất tập trung một chỗ.

---

## Chi tiết các thay đổi đề xuất

### 1. Database & Prisma Schema

#### [MODIFY] [schema.prisma](file:///d:/Java%20lean/TestCase/server/prisma/schema.prisma)
- Thêm model `ProposalFollower`:
  ```prisma
  model ProposalFollower {
    id          String   @id @default(uuid())
    proposalId  String   @map("proposal_id")
    proposal    Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)
    userId      String   @map("user_id")
    user        User     @relation("ProposalFollowerUser", fields: [userId], references: [id], onDelete: Cascade)
    addedById   String?  @map("added_by_id")
    addedBy     User?    @relation("ProposalFollowerAddedBy", fields: [addedById], references: [id], onDelete: SetNull)
    createdAt   DateTime @default(now()) @map("created_at")

    @@unique([proposalId, userId])
    @@map("proposal_followers")
  }
  ```
- Cập nhật `Proposal`:
  ```prisma
  followers ProposalFollower[]
  ```
- Cập nhật `User`:
  ```prisma
  proposalFollowers ProposalFollower[] @relation("ProposalFollowerUser")
  addedProposalFollowers ProposalFollower[] @relation("ProposalFollowerAddedBy")
  ```
- Bổ sung enum:
  - `ProposalHistoryType`: thêm `FOLLOWER_ADDED`, `FOLLOWER_REMOVED`
  - `ProposalNotificationType`: thêm `FOLLOWER_ADDED`
- Tạo file migration SQL và chạy migration / push để cập nhật database.

---

### 2. Backend Services & Controllers

#### [MODIFY] [proposalService.ts](file:///d:/Java%20lean/TestCase/server/src/services/proposalService.ts)
- **`addFollowers(proposalId: string, userIds: string[], actorId: string)`**:
  - Không giới hạn bởi trạng thái đề xuất (cho phép tại mọi trạng thái).
  - Thêm người theo dõi (bỏ qua nếu đã tồn tại).
  - Tạo thông báo `ProposalNotification` (type: `FOLLOWER_ADDED`) cho người được thêm (nếu không phải tự thêm mình).
  - Ghi lịch sử `ProposalHistory` (type: `FOLLOWER_ADDED`).
- **`removeFollower(proposalId: string, targetUserId: string, actorId: string)`**:
  - Cho phép người dùng tự bỏ theo dõi (`targetUserId === actorId`), hoặc người tạo đề xuất, người đã thêm, quản trị viên (Admin/Manager) xóa follower.
  - Ghi lịch sử `ProposalHistory` (type: `FOLLOWER_REMOVED`).
- **`getProposalById(id: string, currentUserId?: string)`**:
  - Include `followers` với thông tin user (họ tên, email, phòng ban) và người thêm.
  - Trả về cờ `isFollower: true/false`.
- **`addComment(proposalId: string, userId: string, content: string, attachments?: any[])`**:
  - Bổ sung gửi thông báo bình luận tới tất cả người theo dõi trong danh sách `followers` (loại trừ chính người vừa bình luận).

#### [MODIFY] [proposalController.ts](file:///d:/Java%20lean/TestCase/server/src/controllers/proposalController.ts) & [proposalRoutes.ts](file:///d:/Java%20lean/TestCase/server/src/routes/proposalRoutes.ts)
- Thêm endpoints:
  - `POST /api/proposals/:id/followers`: Nhận `{ userIds: string[] }` hoặc `{ userId: string }` để thêm người theo dõi.
  - `DELETE /api/proposals/:id/followers/:userId`: Xóa một người khỏi danh sách theo dõi.
  - `GET /api/proposals/:id/followers`: Lấy danh sách người theo dõi.

#### [MODIFY] [myProposalController.ts](file:///d:/Java%20lean/TestCase/server/src/controllers/myProposalController.ts) & [myProposalRoutes.ts](file:///d:/Java%20lean/TestCase/server/src/routes/myProposalRoutes.ts)
- Thêm endpoint `GET /api/my/following`: Lấy danh sách các đề xuất mà user hiện tại đang theo dõi (`followers: { some: { userId } }`).

---

### 3. Frontend Implementation

#### [MODIFY] [proposal.ts](file:///d:/Java%20lean/TestCase/client/src/types/proposal.ts)
- Khai báo interface `ProposalFollower`:
  ```ts
  export interface ProposalFollower {
    id: string;
    proposalId: string;
    userId: string;
    user?: User;
    addedById?: string | null;
    addedBy?: User | null;
    createdAt: string;
  }
  ```
- Cập nhật interface `Proposal` thêm `followers?: ProposalFollower[]`, `isFollower?: boolean`.

#### [MODIFY] [proposalApi.ts](file:///d:/Java%20lean/TestCase/client/src/services/proposalApi.ts)
- Thêm `proposalFollowerApi`:
  - `getFollowers(proposalId: string)`
  - `addFollowers(proposalId: string, userIds: string[])`
  - `removeFollower(proposalId: string, userId: string)`
- Thêm `myProposalApi.getMyFollowing(params?: ProposalQueryFilter)`

#### [NEW] [ProposalFollowersCard.tsx](file:///d:/Java%20lean/TestCase/client/src/components/Proposals/ProposalFollowersCard.tsx)
- Widget hiển thị tại cột bên phải màn hình chi tiết đề xuất:
  - Header: Icon `Users` / `Eye`, số lượng người theo dõi `(count)`.
  - Nút **"Theo dõi" / "Đang theo dõi"**: Cho phép người dùng hiện tại 1-click tự theo dõi hoặc hủy theo dõi.
  - Nút **"+ Thêm người theo dõi"**: Mở modal/dialogue tìm kiếm và chọn nhân viên từ danh bạ (`/api/users/directory`), hỗ trợ chọn nhiều người cùng lúc.
  - Danh sách người theo dõi: Hiển thị avatar tròn, họ tên, email, phòng ban, thời gian thêm.
  - Nút xóa người theo dõi `(X)` (chỉ hiển thị nếu người dùng là người tạo, admin, người đã thêm họ hoặc chính họ).
  - Có thể thêm/xóa người theo dõi ở **bất kỳ trạng thái nào của đề xuất** (Draft, Pending, Approved, Rejected, Cancelled,...).

#### [MODIFY] [ProposalDetail.tsx](file:///d:/Java%20lean/TestCase/client/src/pages/Proposals/ProposalDetail.tsx)
- Đặt `ProposalFollowersCard` ở cột bên phải, bên dưới Thẻ thông tin người đề xuất.
- Bổ sung nút bấm nhanh "Theo dõi / Đang theo dõi" trên thanh Topbar cạnh nút "Làm mới".
- Khi thêm/xóa follower, gọi `emitProposalUpdated(id)` để đồng bộ tức thì.

#### [MODIFY] [ProposalHub.tsx](file:///d:/Java%20lean/TestCase/client/src/pages/Proposals/ProposalHub.tsx)
- Thêm tab **"Đang theo dõi" (`MY_FOLLOWING`)** bên cạnh các tab hiện có (Cần tôi duyệt, Đề xuất tôi đã gửi, Tôi đã duyệt, Tất cả đề xuất).
- Giúp người dùng dễ dàng truy cập và theo dõi các đề xuất mà mình là người theo dõi.

---

## Kế hoạch kiểm thử & xác minh

### Kiểm thử tự động & Biên dịch
1. Chạy `npm run build` trên backend (`server`): Đảm bảo TypeScript biên dịch thành công sau khi cập nhật schema Prisma và model mới.
2. Chạy `npm run build` trên frontend (`client`): Đảm bảo không phát sinh lỗi types hoặc component.

### Kiểm thử chức năng (Manual Scenarios)
1. **Thêm người theo dõi ở trạng thái DRAFT**:
   - Tạo đề xuất nháp, thêm người theo dõi -> kiểm tra danh sách follower hiển thị đúng.
2. **Thêm người theo dõi ở trạng thái PENDING / IN_REVIEW**:
   - Gửi duyệt đề xuất -> thêm tiếp người theo dõi -> kiểm tra thành công.
3. **Thêm người theo dõi ở trạng thái APPROVED / REJECTED / CANCELLED**:
   - Thử thêm người theo dõi khi đề xuất đã kết thúc duyệt -> hệ thống vẫn cho phép thêm và cập nhật bình thường.
4. **Quyền xem & bình luận của người theo dõi**:
   - Đăng nhập bằng tài khoản người theo dõi:
     - Truy cập vào đề xuất -> xem được toàn bộ thông tin đề xuất.
     - Viết bình luận -> gửi bình luận thành công.
     - Nhận được thông báo khi có người khác bình luận vào đề xuất đang theo dõi.
5. **Tự theo dõi (Self-follow) & Bỏ theo dõi**:
   - Nhấn nút "Theo dõi" -> trạng thái đổi sang "Đang theo dõi".
   - Nhấn "Đang theo dõi" -> xác nhận hủy theo dõi -> gỡ khỏi danh sách thành công.
6. **Bộ lọc "Đang theo dõi" tại ProposalHub**:
   - Chuyển sang tab "Đang theo dõi" -> hiển thị chính xác các đề xuất mà user có tên trong danh sách followers.
