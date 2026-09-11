# Kế hoạch triển khai: Quản lý mối phụ thuộc giữa các Test Case

> Cho phép các Test Case liên kết với nhau nếu phụ thuộc lẫn nhau. Một Test Case có thể phụ thuộc vào Test Case khác, nghĩa là phải hoàn thành (PASSED) Test Case đứng trước trước khi có thể thực thi Test Case đứng sau.

---

## 1. Yêu cầu & Mục tiêu

1. **Quản lý phụ thuộc**: Cho phép thiết lập mối quan hệ phụ thuộc giữa các Test Case trong cùng một Test Suite.
2. **Kiểm tra hợp lệ**: Không cho phép tạo cycle (A phụ thuộc B, B phụ thuộc C, C phụ thuộc A).
3. **Kiểm soát thực thi**: Test Case chỉ có thể chuyển sang trạng thái thực thi khi tất cả các Test Case phụ thuộc BLOCKING đã PASSED.
4. **Trực quan hóa**: Hiển thị đồ thị phụ thuộc trên giao diện Kanban và chi tiết Test Case.

---

## 2. Chi tiết các thay đổi đề xuất

### A. Database & Prisma Schema

#### [ADD] Model `TestCaseDependency` (`server/prisma/schema.prisma`)
```prisma
model TestCaseDependency {
  id             String   @id @default(uuid())
  testCaseId     String   @map("test_case_id")
  testCase       TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
  dependsOnId    String   @map("depends_on_id")
  dependsOn      TestCase @relation("DependencyEdges", fields: [dependsOnId], references: [id], onDelete: Cascade)
  dependencyType String   @default("BLOCKING") // BLOCKING, OPTIONAL
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@unique([testCaseId, dependsOnId])
  @@map("test_case_dependencies")
}
```

#### [MODIFY] Model `TestCase` (`server/prisma/schema.prisma`)
Thêm 2 back-relation vào model `TestCase`:
```prisma
model TestCase {
  // ... các field hiện có ...
  
  dependencies   TestCaseDependency[]  @relation("DependencyEdges")
  blockedBy      TestCaseDependency[]  @relation("DependencyEdges")
}
```

#### [MODIFY] Model `User` (không cần thay đổi)

#### Migration
```bash
npx prisma migrate dev --name add-testcase-dependency
npx prisma generate
```

---

### B. Backend Services, Controllers & Routes

#### [NEW] `server/src/controllers/testCaseDependencyController.ts`

**`getDependencies(req, res)`**
- Params: `testCaseId`
- Trả về danh sách cả **outgoing** (test case này phụ thuộc vào ai) và **incoming** (ai phụ thuộc vào test case này)
- Include full thông tin `dependsOn` và `testCase`

**`addDependency(req, res)`**
- Body: `{ testCaseId, dependsOnId, dependencyType? }`
- Validate: `testCaseId !== dependsOnId` (không tự phụ thuộc vào chính mình)
- Validate: Không tạo cycle (dùng DFS/BFS kiểm tra)
- Validate: `dependencyType` phải là `BLOCKING` hoặc `OPTIONAL`
- Tạo mới dependency và trả về

**`removeDependency(req, res)`**
- Params: `testCaseId`, `depId`
- Xóa dependency theo ID

**`getTestCaseGraph(req, res)`**
- Params: `suiteId` hoặc `testCaseIds[]`
- Trả về adjacency list dạng JSON cho toàn bộ đồ thị phụ thuộc
- Dùng cho frontend render đồ thị

**`validateExecutionOrder(req, res)`**
- Body: `{ testCaseId }`
- Kiểm tra test case có thể thực thi không (tất cả BLOCKING dependencies đã PASSED)
- Trả về `{ canExecute: boolean, blockedBy: string[], blockedByStatus: string[] }`

**Kiểm tra Cycle Detection** (hàm nội bộ):
```ts
function hasCycle(testCaseId: string, prisma: PrismaClient): boolean {
  // DFS từ testCaseId, nếu gặp lại chính nó → có cycle
  const visited = new Set<string>();
  const stack = new Set<string>();
  
  function dfs(id: string): boolean {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    stack.add(id);
    const deps = await prisma.testCaseDependency.findMany({
      where: { testCaseId: id },
      select: { dependsOnId: true },
    });
    for (const dep of deps) {
      if (dfs(dep.dependsOnId)) return true;
    }
    stack.delete(id);
    return false;
  }
  
  return dfs(testCaseId);
}
```

#### [NEW] `server/src/routes/testCaseDependencyRoutes.ts`
```ts
import { Router } from 'express';
import { TestCaseDependencyController } from '../controllers/testCaseDependencyController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// Lấy danh sách phụ thuộc của 1 Test Case
router.get('/:testCaseId/dependencies', authenticate, requirePermission('testcase:read'), TestCaseDependencyController.getDependencies);

// Thêm phụ thuộc
router.post('/:testCaseId/dependencies', authenticate, requirePermission('testcase:update'), TestCaseDependencyController.addDependency);

// Xóa phụ thuộc
router.delete('/:testCaseId/dependencies/:depId', authenticate, requirePermission('testcase:update'), TestCaseDependencyController.removeDependency);

// Lấy đồ thị phụ thuộc của 1 Test Suite
router.get('/suite/:suiteId/graph', authenticate, requirePermission('testcase:read'), TestCaseDependencyController.getTestCaseGraph);

// Kiểm tra thứ tự thực thi
router.post('/validate-order', authenticate, requirePermission('testcase:execute'), TestCaseDependencyController.validateExecutionOrder);

export default router;
```

#### [MODIFY] `server/src/routes/testCaseRoutes.ts`
Thêm import và sử dụng `testCaseDependencyRoutes`:
```ts
import testCaseDependencyRoutes from './testCaseDependencyRoutes';
// ...
router.use('/dependencies', testCaseDependencyRoutes);
```

#### [MODIFY] `server/src/controllers/testCaseController.ts`
- Trong `getTestCaseById` & `getSuiteById`: Include `dependencies` và `blockedBy` cho mỗi TestCase
- Trong `provisionExecutions`: Check `validateExecutionOrder` trước khi tạo execution
- Trong `executeTestCase` (executionController): Check dependency status trước khi cho phép thực thi

---

### C. Frontend

#### [MODIFY] `client/src/types/index.ts`
```ts
export type DependencyType = 'BLOCKING' | 'OPTIONAL';

export interface TestCaseDependency {
  id: string;
  testCaseId: string;
  testCase: TestCase;
  dependsOnId: string;
  dependsOn: TestCase;
  dependencyType: DependencyType;
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseGraph {
  nodes: TestCase[];
  edges: Array<{
    from: string;    // dependsOnId
    to: string;      // testCaseId
    type: DependencyType;
  }>;
}

export interface ExecutionValidationResult {
  canExecute: boolean;
  blockedBy: string[];        // IDs của test case đang block
  blockedByStatus: string[];   // Trạng thái hiện tại của các test case block
}
```

#### [MODIFY] `client/src/services/api.ts`
```ts
// Test Case Dependency API
export const testCaseDependencyApi = {
  getDependencies: (testCaseId: string) =>
    api.get<{
      outgoing: TestCaseDependency[];  // test case này phụ thuộc vào ai
      incoming: TestCaseDependency[];  // ai phụ thuộc vào test case này
    }>(`/testcases/${testCaseId}/dependencies`),
  
  addDependency: (testCaseId: string, data: {
    dependsOnId: string;
    dependencyType?: DependencyType;
  }) =>
    api.post<{ message: string; dependency: TestCaseDependency }>(
      `/testcases/${testCaseId}/dependencies`, data
    ),
  
  removeDependency: (testCaseId: string, depId: string) =>
    api.delete<{ message: string }>(
      `/testcases/${testCaseId}/dependencies/${depId}`
    ),
  
  getGraph: (suiteId: string) =>
    api.get<{ graph: TestCaseGraph }>(`/testcases/suite/${suiteId}/graph`),
  
  validateOrder: (data: { testCaseId: string }) =>
    api.post<{ result: ExecutionValidationResult }>('/testcases/validate-order', data),
};
```

#### [NEW] `client/src/components/TestCaseDependencyManager.tsx`

Giao diện quản lý phụ thuộc:
- Danh sách Test Case trong suite với icon phụ thuộc
- Nút "Thêm phụ thuộc" → chọn test case nguồn và đích
- Hiển thị tooltip/status về trạng thái phụ thuộc
- Visual indicator: icon `link` trên Kanban card có dependency

#### [MODIFY] `client/src/components/kanban/TestCaseKanbanCard.tsx`
- Thêm icon phụ thuộc (link/chain) nếu test case có dependencies
- Hiển thị số lượng dependency và trạng thái (blocked/passed)
- Click vào icon để xem chi tiết dependency

#### [MODIFY] `client/src/pages/TestCaseDetail.tsx`
- Thêm tab/section "Phụ thuộc" hiển thị danh sách dependency
- Cho phép thêm/xóa dependency từ đây

#### [MODIFY] `client/src/pages/TestCaseManagement.tsx`
- Có thể thêm cột "Phụ thuộc" vào bảng quản lý

---

### D. Logic nghiệp vụ quan trọng

#### 1. Cycle Detection
Khi thêm dependency mới, phải kiểm tra không tạo cycle:
```ts
// Trong addDependency controller
const cycle = await checkCycle(prisma, testCaseId, dependsOnId);
if (cycle) {
  return res.status(400).json({ message: 'Không được tạo vòng phụ thuộc (cycle)' });
}
```

#### 2. Execution Order Validation
Trước khi cho phép thực thi một test case:
```ts
// Kiểm tra tất cả BLOCKING dependencies đã PASSED
const blockingDeps = await prisma.testCaseDependency.findMany({
  where: { testCaseId, dependencyType: 'BLOCKING' },
  include: { dependsOn: { include: { executions: { orderBy: { executedAt: 'desc' } } } } },
});

const allPassed = blockingDeps.every(dep => 
  dep.dependsOn.latestExecution?.status === 'PASSED'
);
```

#### 3. Dependency Status on Kanban
- **BLOCKING dependency PASSED**: Hiển thị icon xanh, click xem chi tiết
- **BLOCKING dependency FAILED**: Hiển thị icon đỏ, test case bị disable
- **BLOCKING dependency BLOCKED**: Hiển thị icon vàng
- **No blocking dependency or all passed**: Normal state, cho phép execute

---

### E. Quyền truy cập

Thêm permission `testcase:dependency` trong seed/admin:
- Category: `TESTCASE`
- Cho phép ADMIN, MANAGER, TESTER
- Sử dụng trong `requirePermission('testcase:dependency')` cho các route dependency

---

## 3. Kế hoạch kiểm thử & xác minh

| STT | Kiểm thử | Mô tả | Trạng thái |
|-----|----------|-------|------------|
| 1 | Schema migration | `npx prisma migrate dev` + `npx prisma generate` | Chưa thực hiện |
| 2 | TypeScript compile | `npx tsc --noEmit` (server) + `npm run build` (client) | Chưa thực hiện |
| 3 | Cycle detection | Tạo A→B→C→A, kiểm tra từ chối | Chưa thực hiện |
| 4 | Add/remove dependency | Tạo và xóa dependency bình thường | Chưa thực hiện |
| 5 | Graph API | Lấy adjacency list cho suite | Chưa thực hiện |
| 6 | Execution validation | Kiểm tra thứ tự thực thi | Chưa thực hiện |
| 7 | UI integration | Kanban card hiển thị dependency icon | Chưa thực hiện |
| 8 | Full flow | Tạo test case → thêm dependency → kiểm tra thực thi | Chưa thực hiện |

---

## 4. Giả định đã chọn

1. **Chỉ Test Case trong cùng Test Suite** có thể phụ thuộc nhau (đơn giản hóa).
2. **DependencyType mặc định là `BLOCKING`**: Test case bị block cho đến khi dependency PASSED.
3. **OPTIONAL dependency**: Không chặn thực thi nhưng hiển thị thông tin tham khảo.
4. **Tự động refresh trên Kanban**: Khi dependency status thay đổi, Kanban auto-update để phản ánh state mới.
5. **Không cho phép xóa Test Case đang có dependency**: Phải xóa dependency trước.

---

## 5. Phân tích ảnh hưởng

### Ảnh hưởng đến API hiện có
| Endpoint | Ảnh hưởng | Giải pháp |
|----------|-----------|-----------|
| `GET /testcases/:id` | Thêm `dependencies`, `blockedBy` | Add include vào Prisma query |
| `GET /testcases/suites/:id` | Thêm `dependencies` cho mỗi testCase | Add include vào Prisma query |
| `POST /executions/:testCaseId/execute` | Validate dependency trước khi execute | Thêm check ở execution controller |
| `PATCH /executions/:executionId` | Validate khi chuyển status | Thêm check ở execution controller |

### Ảnh hưởng đến frontend
| Component | Ảnh hưởng | Giải pháp |
|-----------|-----------|-----------|
| `TestCaseKanbanBoard.tsx` | Thêm icon dependency | Modify card rendering |
| `TestCaseKanbanCard.tsx` | Thêm icon + tooltip | Add dependency badge |
| `TestCaseDetail.tsx` | Thêm tab dependency | Add new section |
| `TestCaseManagement.tsx` | Có thể thêm cột | Optional enhancement |
| `TestCaseModal.tsx` | Thêm dependency selector | Optional enhancement |

---

## 6. Phase triển khai

| Phase | Nội dung | Trạng thái |
|-------|----------|------------|
| **Phase 1: Backend Core** | Schema, migration, controller, routes, cycle detection | Chưa thực hiện |
| **Phase 2: Backend Integration** | Tích hợp validation vào execution flow, include dependencies trong queries | Chưa thực hiện |
| **Phase 3: Frontend Types & API** | Types, API service methods | Chưa thực hiện |
| **Phase 4: Frontend UI** | Kanban card dependency icon, detail tab, dependency manager | Chưa thực hiện |
| **Phase 5: Verification** | TypeScript check, test flow, build | Chưa thực hiện |

---

## 7. Giả định kỹ thuật

1. **Database**: PostgreSQL (đã có trong project)
2. **Cycle Detection**: DFS thuật toán, chạy server-side để đảm bảo performance
3. **Real-time**: Sử dụng socket.io (đã có trong project) để cập nhật dependency status realtime khi execution thay đổi
4. **Pagination**: Với dependency list lớn, có thể pagination (limit 50/query)
5. **Validation**: Tất cả validation ở backend, frontend chỉ hiển thị
