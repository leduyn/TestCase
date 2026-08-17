import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userApi, type User } from '../services/api';

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

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

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 24px';
    toast.style.background = type === 'success' ? '#10b981' : '#ef4444';
    toast.style.color = 'white';
    toast.style.borderRadius = '6px';
    toast.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    toast.style.zIndex = '1000';
    toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">
        Quản lý Người dùng
      </h2>
      <p className="text-slate-500 dark:text-slate-400 mb-4">
        Tổng cộng: {filteredUsers.length} người
      </p>

      {/* Search and Add User */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm email hoặc tên..."
            value={search}
            onChange={handleSearch}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setEditingUser(null)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          Thêm người dùng
        </button>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="h-64 w-full flex items-center justify-center">
          <span className="text-slate-500">Đang tải...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="h-64 w-full flex items-center justify-center text-slate-500">
          Không có người dùng phù hợp
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-600 dark:text-slate-400">
            <thead className="text-xs text-slate-600 uppercase border-b dark:border-slate-800">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Họ tên</th>
                <th className="p-3">Vai trò</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Last Login</th>
                <th className="p-3">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.fullName || '-'}</td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'ADMIN'
                          ? 'bg-red-100 text-red-800'
                          : u.role === 'TESTER'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {u.role === 'ADMIN' ? 'Quản trị viên' : u.role === 'TESTER' ? 'Kiểm thử' : 'Xem chỉ đọc'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        u.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : u.status === 'INACTIVE'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {u.status === 'ACTIVE' ? 'Hoạt động' : u.status === 'INACTIVE' ? 'Vô hiệu hóa' : 'Chờ xác thực'}
                    </span>
                  </td>
                  <td className="p-3">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('vi-VN') : 'Chưa đăng nhập'}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(u)}
                        className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded hover:bg-blue-100 transition-colors"
                        title="Sửa"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => setDeleteModal(prev => ({ ...prev, open: true, userId: u.id }))}
                        className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded hover:bg-red-100 transition-colors"
                        title="Xóa"
                      >
                        Xóa
                      </button>
                      {user.role === 'ADMIN' && (
                        <>
                          <button
                            onClick={() =>
                              setStatusModal(prev => ({ ...prev, open: true, userId: u.id, status: u.status }))
                            }
                            className="px-2 py-1 bg-yellow-50 text-yellow-700 text-xs rounded hover:bg-yellow-100 transition-colors"
                            title="Kích hoạt/Khóa"
                          >
                            {u.status === 'ACTIVE' ? 'Khóa' : 'Kích hoạt'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit User Modal */}
      {editingUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white', padding: '24px', borderRadius: '8px',
            width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 className="text-lg font-bold mb-4">
              {editingUser.id ? 'Sửa người dùng' : 'Thêm người dùng mới'}
            </h3>
            <form
              onSubmit={
                editingUser.id ? handleUpdate : handleCreate
              } style={{ marginBottom: '24px' }}
            >
              <input
                type="email"
                placeholder="Email"
                defaultValue={editingUser?.email || newUser.email}
                onChange={(e) =>
                  setNewUser(prev => ({ ...prev, email: e.target.value }))
                }
                disabled={editingUser?.id ? true : false}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="password"
                placeholder="Mật khẩu (để trống nếu không đổi)"
                defaultValue={editingUser?.id ? '' : newUser.password}
                onChange={(e) =>
                  setNewUser(prev => ({ ...prev, password: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Họ tên"
                defaultValue={editingUser?.fullName || newUser.fullName}
                onChange={(e) =>
                  setNewUser(prev => ({ ...prev, fullName: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <select
                onChange={(e) =>
                  setNewUser(prev => ({ ...prev, role: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ADMIN">Quản trị viên (ADMIN)</option>
                <option value="TESTER">Kiểm thử (TESTER)</option>
                <option value="VIEWER">Xem chỉ đọc (VIEWER)</option>
              </select>
              <div style={{ display: 'flex', gap: '12' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  style={{ padding: '8px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={editingUser?.id && !newUser.fullName}
                  style={{
                    padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  {editingUser.id ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white', padding: '24px', borderRadius: '8px',
            width: '90%', maxWidth: '400px'
          }}>
            <h3 className="text-lg font-bold mb-4">Xác nhận xóa</h3>
            <p className="text-slate-600 mb-6">
              Bạn có chắc chắn muốn xóa người dùng không? Hành động này không thể hoàn tác.
            </p>
            <div style={{ display: 'flex', gap: '12' }}>
              <button
                type="button"
                onClick={() => setDeleteModal(prev => ({ ...prev, open: false }))}
                style={{ padding: '8px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(deleteModal.userId!)}
                style={{
                  padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Toggle Modal */}
      {statusModal.open && user.role === 'ADMIN' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white', padding: '24px', borderRadius: '8px',
            width: '90%', maxWidth: '400px'
          }}>
            <h3 className="text-lg font-bold mb-4">
              {statusModal.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}
            </h3>
            <p className="text-slate-600 mb-6">
              Bạn có chắc chắn muốn {statusModal.status === 'ACTIVE' ? 'khóa' : 'kích hoạt'} tài khoản này?
            </p>
            <div style={{ display: 'flex', gap: '12' }}>
              <button
                type="button"
                onClick={() => setStatusModal(prev => ({ ...prev, open: false }))}
                style={{
                  padding: '8px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                onClick={() => handleToggleStatus(statusModal.userId!, statusModal.status)}
                style={{
                  padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                {statusModal.status === 'ACTIVE' ? 'Khóa' : 'Kích hoạt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;