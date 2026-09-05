import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Check,
  X,
  Search,
  Loader2,
  Bell,
  BellOff,
  Building2,
} from 'lucide-react';
import type { ProposalFollower } from '../../types/proposal';
import type { User } from '../../types/index';
import { proposalApi } from '../../services/proposalApi';
import { userApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { emitProposalUpdated } from '../../utils/proposalEvents';

interface ProposalFollowersCardProps {
  proposalId: string;
  creatorId: string;
  followers: ProposalFollower[];
  isFollower?: boolean;
  onFollowersChanged: () => void;
}

export const ProposalFollowersCard: React.FC<ProposalFollowersCardProps> = ({
  proposalId,
  creatorId,
  followers = [],
  isFollower = false,
  onFollowersChanged,
}) => {
  const { user } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [selfLoading, setSelfLoading] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const isCreator = user?.id === creatorId;
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Load directory users when modal opens
  useEffect(() => {
    if (isModalOpen && directoryUsers.length === 0) {
      setLoadingUsers(true);
      userApi
        .getDirectory()
        .then((res) => {
          setDirectoryUsers(res.data || []);
        })
        .catch((err) => {
          console.error('Error fetching directory users:', err);
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [isModalOpen, directoryUsers.length]);

  // Handle Self Follow / Unfollow toggle
  const handleToggleSelfFollow = async () => {
    if (!user) return;
    setSelfLoading(true);
    try {
      if (isFollower) {
        await proposalApi.removeFollower(proposalId, user.id);
      } else {
        await proposalApi.addFollowers(proposalId, [user.id]);
      }
      onFollowersChanged();
      emitProposalUpdated(proposalId);
    } catch (err: any) {
      console.error('Error toggling follow:', err);
      alert(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái theo dõi');
    } finally {
      setSelfLoading(false);
    }
  };

  // Handle Remove Follower
  const handleRemoveFollower = async (targetUserId: string, targetName: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa "${targetName}" khỏi danh sách theo dõi?`)) {
      return;
    }
    setRemovingUserId(targetUserId);
    try {
      await proposalApi.removeFollower(proposalId, targetUserId);
      onFollowersChanged();
      emitProposalUpdated(proposalId);
    } catch (err: any) {
      console.error('Error removing follower:', err);
      alert(err.response?.data?.message || 'Lỗi khi gỡ người theo dõi');
    } finally {
      setRemovingUserId(null);
    }
  };

  // Handle Submit Add Followers Modal
  const handleAddSelectedFollowers = async () => {
    if (selectedUserIds.length === 0) return;
    setActionLoading(true);
    try {
      await proposalApi.addFollowers(proposalId, selectedUserIds);
      setIsModalOpen(false);
      setSelectedUserIds([]);
      setSearchQuery('');
      onFollowersChanged();
      emitProposalUpdated(proposalId);
    } catch (err: any) {
      console.error('Error adding followers:', err);
      alert(err.response?.data?.message || 'Lỗi khi thêm người theo dõi');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter available users for selection (exclude users who are already followers)
  const existingFollowerIds = new Set(followers.map((f) => f.userId));
  const availableUsers = directoryUsers.filter((u) => {
    if (existingFollowerIds.has(u.id)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  });

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Người theo dõi ({followers.length})
            </h4>
            <p className="text-[11px] text-slate-400">Nhận thông báo & tham gia trao đổi</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Quick self-follow toggle button */}
          <button
            type="button"
            onClick={handleToggleSelfFollow}
            disabled={selfLoading}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isFollower
                ? 'bg-blue-50 hover:bg-rose-50 text-blue-700 hover:text-rose-600 border border-blue-200 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-rose-950/50 dark:hover:text-rose-300'
                : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
            }`}
            title={isFollower ? 'Nhấp để bỏ theo dõi đề xuất này' : 'Nhấp để theo dõi đề xuất này'}
          >
            {selfLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isFollower ? (
              <>
                <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Đang theo dõi</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5 text-slate-500" />
                <span>+ Theo dõi</span>
              </>
            )}
          </button>

          {/* Add follower modal trigger */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
            title="Thêm đồng nghiệp cùng theo dõi đề xuất"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Thêm</span>
          </button>
        </div>
      </div>

      {/* Followers List */}
      <div className="space-y-2">
        {followers.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
            Chưa có người theo dõi nào. Nhấn <strong>+ Theo dõi</strong> hoặc <strong>Thêm</strong> để cùng theo dõi tiến độ đề xuất.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {followers.map((follower) => {
              const u = follower.user;
              const isSelf = user?.id === follower.userId;
              const canRemove =
                isSelf ||
                isCreator ||
                isAdminOrManager ||
                follower.addedById === user?.id;

              return (
                <div
                  key={follower.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm flex-shrink-0">
                      {u?.fullName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {u?.fullName || 'Người dùng'}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium">
                            Tôi
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {u?.department && (
                          <span className="flex items-center gap-0.5">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {u.department}
                          </span>
                        )}
                        <span className="truncate">{u?.email}</span>
                      </div>
                    </div>
                  </div>

                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFollower(follower.userId, u?.fullName || 'Người dùng')}
                      disabled={removingUserId === follower.userId}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex-shrink-0"
                      title={isSelf ? 'Bỏ theo dõi' : 'Xóa khỏi danh sách theo dõi'}
                    >
                      {removingUserId === follower.userId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Thêm người theo dõi */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Bổ sung người theo dõi đề xuất
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo họ tên, email, phòng ban..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Người theo dõi sẽ có thể xem nội dung đề xuất, nhận thông báo tiến trình và tham gia trao đổi bình luận.
              </p>
            </div>

            {/* Modal Body: Users list */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {loadingUsers ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span>Đang tải danh bạ người dùng...</span>
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {searchQuery ? 'Không tìm thấy người dùng phù hợp' : 'Tất cả người dùng trong hệ thống đã theo dõi đề xuất này'}
                </div>
              ) : (
                availableUsers.map((u) => {
                  const isChecked = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleSelectUser(u.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                            {u.fullName}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {u.department && (
                              <span className="truncate">{u.department}</span>
                            )}
                            <span className="truncate">{u.email}</span>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950">
              <span className="text-xs text-slate-500">
                Đã chọn: <strong className="text-indigo-600">{selectedUserIds.length}</strong> người
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedFollowers}
                  disabled={actionLoading || selectedUserIds.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
                >
                  {actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Thêm người theo dõi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
