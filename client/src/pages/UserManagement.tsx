import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UsersOff,
  Trash2,
  RefreshCcw,
  Search,
  Plus,
  Edit,
  Loader2,
  ToggleOff,
  ToggleOn,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userApi, type User } from '../services/api';
import { Table, TableHeader, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-tooltip';

interface UserTableRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  lastLogin?: string;
  actions: React.ReactNode;
}

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<{ email: string; password: string; fullName: string; role: string }>({
    email: '',
    password: '',
    fullName: '',
    role: 'TESTER',
  });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; userId?: string }>({
    open: false,
  });
  const [statusModal, setStatusModal] = useState<{ open: boolean; userId?: string; status: string }>({
    open: false,
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await userApi.getUsers();
      setUsers(data);
    } catch (error: any) {
      showToast('Lỗi khi tải danh sách người dùng', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await userApi.createUser(newUser);
      showToast('Tạo người dùng thành công', 'success');
      setUsers([...users, data]);
      setNewUser({ email: '', password: '', fullName: '', role: 'TESTER' });
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Lỗi tạo người dùng', 'error');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setNewUser({
      email: user.email,
      password: '',
      fullName: user.fullName,
      role: user.role,
    });
  };

  const handleUpdate = async (id: string) => {
    try {
      const { data } = await userApi.updateUser(id, {
        fullName: newUser.fullName,
        role: newUser.role,
      });
      showToast('Cập nhật người dùng thành công', 'success');
      const updatedIndex = users.findIndex(u => u.id === id);
      if (updatedIndex > -1) {
        setUsers(users.map(u => u.id === id ? data : u));
      }
      setEditingUser(null);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Lỗi cập nhật', 'error');
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await userApi.deleteUser(userId);
      showToast('Xóa người dùng thành công', 'success');
      setUsers(users.filter(u => u.id !== userId));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Lỗi xóa người dùng', 'error');
    }
    setDeleteModal(prev => ({ ...prev, open: false }));
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const { data } = await userApi.toggleStatus(userId);
      showToast(`Tài khoản ${newStatus === 'ACTIVE' ? 'kích hoạt' : 'khóa'} thành công`, 'success');
      const updatedIndex = users.findIndex(u => u.id === userId);
      if (updatedIndex > -1) {
        setUsers(users.map(u => u.id === userId ? data : u));
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Lỗi thay đổi trạng thái', 'error');
    }
    setStatusModal(prev => ({ ...prev, open: false }));
  };

  if (!user) {
    return null;
  }

  const filteredUsers = users.filter(
    u => u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="h-full">
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            <Users className="text-blue-600 mr-2" /> Quản lý Người dùng
          </h2>
          <div>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Tổng cộng: {filteredUsers.length} người
            </span>
          </div>
        </div>

        {/* Search and Add User */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1">
            <Input
              placeholder="Tìm kiếm email hoặc tên..."
              value={search}
              onChange={handleSearch}
              className="w-full"
            />
          </div>
          <Button
            variant="primary"
            onClick={() => setEditingUser(null)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Thêm người dùng
          </Button>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="h-64 w-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="h-64 w-full flex items-center justify-center text-slate-500 dark:text-slate-400">
            Không có người dùng phù hợp
          </div>
        ) : (
          <Table
            data={filteredUsers.map((u): UserTableRow => ({
              id: u.id,
              email: u.email,
              fullName: u.fullName,
              role: u.role,
              status: u.status,
              lastLogin: u.lastLogin,
              actions: (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(u)}
                    title="Sửa"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteModal(prev => ({ ...prev, open: true, userId: u.id }))}
                    title="Xóa"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                  {user.role === 'ADMIN' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatusModal(prev => ({ ...prev, open: true, userId: u.id, status: u.status }))}
                        title="Kích hoạt/Khóa"
                      >
                        <ToggleOff className="w-3 h-3 text-red-500" />
                        <ToggleOn className="w-3 h-3 text-green-500" />
                      </Button>
                    </>
                  )}
                </div>
              ),
            }))}
            columns={[
              {
                header: 'Email',
                accessorKey: 'email',
                size: '150',
              },
              {
                header: 'Họ tên',
                accessorKey: 'fullName',
                size: '150',
              },
              {
                header: 'Vai trò',
                accessorKey: 'role',
                size: '100',
                cell: ({ row }) => {
                  const role = row.original.role;
                  const roleClasses = {
                    ADMIN: 'bg-red-100 text-red-800',
                    TESTER: 'bg-blue-100 text-blue-800',
                    VIEWER: 'bg-green-100 text-green-800',
                  };
                  const roleLabels = {
                    ADMIN: 'Quản trị viên',
                    TESTER: 'Kiểm thử',
                    VIEWER: 'Xem chỉ đọc',
                  };
                  return (
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${roleClasses[role as keyof typeof roleClasses]}`}
                    >
                      {roleLabels[role as keyof typeof roleLabels]}
                    </span>
                  );
                },
              },
              {
                header: 'Trạng thái',
                accessorKey: 'status',
                size: '100',
                cell: ({ row }) => {
                  const status = row.original.status;
                  const statusClasses = {
                    ACTIVE: 'bg-green-100 text-green-800',
                    INACTIVE: 'bg-red-100 text-red-800',
                    PENDING: 'bg-yellow-100 text-yellow-800',
                  };
                  const statusLabels = {
                    ACTIVE: 'Hoạt động',
                    INACTIVE: 'Vô hiệu hóa',
                    PENDING: 'Chờ xác thực',
                  };
                  return (
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClasses[status as keyof typeof statusClasses]}`}
                    >
                      {statusLabels[status as keyof typeof statusLabels]}
                    </span>
                  );
                },
              },
              {
                header: 'Last Login',
                accessorKey: 'lastLogin',
                size: '120',
                cell: ({ row }) => {
                  const lastLogin = row.original.lastLogin;
                  if (!lastLogin) return 'Chưa đăng nhập';
                  return new Date(lastLogin).toLocaleDateString('vi-VN');
                },
              },
              {
                header: 'Hành động',
                accessorKey: 'actions',
                size: '180',
                cell: ({ row }) => {
                  return row.original.actions;
                },
              },
            ]}
          />
        )}

        {/* Create/Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur z-50 flex items-center justify-center">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-bold mb-4">
                {editingUser.id ? 'Sửa người dùng' : 'Thêm người dùng mới'}
              </h3>
              <form onSubmit={handleEdit ? handleUpdate : handleCreate} className="space-y-4">
                <Input
                  placeholder="Email"
                  type="email"
                  defaultValue={editingUser?.email || newUser.email}
                  onChange={(e) =>
                    setNewUser(prev => ({ ...prev, email: e.target.value }))
                  }
                  disabled={editingUser?.id ? true : false}
                />
                <Input
                  placeholder="Mật khẩu (để trống nếu không đổi)"
                  type="password"
                  defaultValue={editingUser?.id ? '' : newUser.password}
                  onChange={(e) =>
                    setNewUser(prev => ({ ...prev, password: e.target.value }))
                  }
                />
                <Input
                  placeholder="Họ tên"
                  defaultValue={editingUser?.fullName || newUser.fullName}
                  onChange={(e) =>
                    setNewUser(prev => ({ ...prev, fullName: e.target.value }))
                  }
                />
                <Select
                  defaultValue={editingUser?.role || newUser.role}
                  onValueChange={(value: string) =>
                    setNewUser(prev => ({ ...prev, role: value as any }))
                  }
                >
                  <SelectValue className="w-full" />
                  <SelectContent>
                    <SelectItem value="ADMIN">Quản trị viên (ADMIN)</SelectItem>
                    <SelectItem value="TESTER">Kiểm thử (TESTER)</SelectItem>
                    <SelectItem value="VIEWER">Xem chỉ đọc (VIEWER)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-3">
                  <Button type="button" onClick={() => setEditingUser(null)}>Hủy</Button>
                  <Button type="submit" disabled={editingUser?.id && !newUser.fullName}>
                    {editingUser.id ? 'Cập nhật' : 'Thêm'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {deleteModal.open && user && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur z-50 flex items-center justify-center">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-bold mb-4">Xác nhận xóa</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                Bạn có chắc chắn muốn xóa người dùng <strong>{deleteModal.userId ? users.find(u => u.id === deleteModal.userId)?.fullName : ''}</strong> không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3">
                <Button type="button" onClick={() => setDeleteModal(prev => ({ ...prev, open: false }))}>Hủy</Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(deleteModal.userId!)}
                >
                  Xóa
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Status Toggle Modal */}
        {statusModal.open && user.role === 'ADMIN' && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur z-50 flex items-center justify-center">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-bold mb-4">
                {statusModal.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                Bạn có chắc chắn muốn {statusModal.status === 'ACTIVE' ? 'khóa' : 'kích hoạt'} tài khoản này?
              </p>
              <div className="flex gap-3">
                <Button type="button" onClick={() => setStatusModal(prev => ({ ...prev, open: false }))}>Hủy</Button>
                <Button
                  variant="secondary"
                  onClick={() => handleToggleStatus(statusModal.userId!, statusModal.status)}
                >
                  {statusModal.status === 'ACTIVE' ? 'Khóa' : 'Kích hoạt'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Card>
  );
};

export default UserManagement;