import React from 'react';
import type { Proposal, ProposalApproval } from '../../types/proposal';
import {
  APPROVAL_ACTION_CONFIG,
  APPROVAL_WORKFLOW_CONFIG,
} from '../../types/proposal';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  MessageSquare,
  Paperclip,
  Check,
} from 'lucide-react';

interface ApprovalTimelineProps {
  proposal: Proposal;
  currentUserId?: string;
}

export const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({ proposal, currentUserId }) => {
  const approvals: ProposalApproval[] = proposal.approvals || [];
  const workflowType = proposal.proposalType?.approvalWorkflow || 'SEQUENTIAL';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            Tiến trình phê duyệt
          </h4>
          <p className="text-[11px] text-slate-400">
            Quy trình:{' '}
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {APPROVAL_WORKFLOW_CONFIG[workflowType]?.label || workflowType}
            </span>
          </p>
        </div>

        {proposal.status === 'APPROVED' && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full">
            <Check className="w-3.5 h-3.5" /> Đã hoàn tất
          </span>
        )}
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {/* Step 0: Creator Submission */}
        <div className="relative">
          <div className="absolute -left-6 top-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shadow-sm ring-4 ring-white dark:ring-slate-900">
            <Check className="w-3.5 h-3.5" />
          </div>

          <div className="bg-slate-50/60 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {proposal.creator?.fullName || 'Người tạo'}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  Khởi tạo
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                {proposal.submittedAt
                  ? new Date(proposal.submittedAt).toLocaleString('vi-VN')
                  : new Date(proposal.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {proposal.status === 'DRAFT'
                ? 'Đang lưu bản nháp'
                : 'Đã gửi đề xuất yêu cầu phê duyệt'}
            </p>
          </div>
        </div>

        {/* Approvals Sequence */}
        {approvals.map((appr) => {
          const actionConfig = APPROVAL_ACTION_CONFIG[appr.action] || APPROVAL_ACTION_CONFIG.PENDING;
          const isCurrentPending =
            appr.action === 'PENDING' &&
            proposal.status !== 'DRAFT' &&
            proposal.status !== 'CANCELLED';
          const isCurrentUserApprover = currentUserId && appr.approverId === currentUserId;

          let icon = <Clock className="w-3.5 h-3.5" />;
          let iconBg = 'bg-amber-500 text-white';

          if (appr.action === 'APPROVED') {
            icon = <CheckCircle2 className="w-3.5 h-3.5" />;
            iconBg = 'bg-emerald-500 text-white';
          } else if (appr.action === 'REJECTED') {
            icon = <XCircle className="w-3.5 h-3.5" />;
            iconBg = 'bg-rose-500 text-white';
          } else if (appr.action === 'SKIPPED') {
            icon = <MinusCircle className="w-3.5 h-3.5" />;
            iconBg = 'bg-slate-400 text-white';
          } else if (isCurrentPending) {
            iconBg = 'bg-amber-500 text-white animate-pulse';
          }

          return (
            <div key={appr.id} className="relative">
              <div
                className={`absolute -left-6 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-sm ring-4 ring-white dark:ring-slate-900 ${iconBg}`}
              >
                {icon}
              </div>

              <div
                className={`rounded-xl p-3 border transition-all ${
                  isCurrentUserApprover && isCurrentPending
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-sm'
                    : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800/60'
                }`}
              >
                {/* Header of step */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {appr.approver?.fullName || 'Người phê duyệt'}
                    </span>
                    {isCurrentUserApprover && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold">
                        Bạn
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {workflowType === 'SEQUENTIAL' ? `Cấp ${appr.order}` : 'Đồng duyệt'}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${actionConfig.bgColor} ${actionConfig.color}`}
                  >
                    {actionConfig.label}
                  </span>
                </div>

                {/* Approver email / role */}
                <p className="text-[11px] text-slate-400 mb-1">{appr.approver?.email}</p>

                {/* Comment / Note from approver */}
                {appr.comment && (
                  <div className="mt-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold">
                      <MessageSquare className="w-3 h-3" />
                      Ý kiến phản hồi:
                    </div>
                    <p className="italic">"{appr.comment}"</p>
                  </div>
                )}

                {/* Attachments from approver */}
                {appr.attachments && appr.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {appr.attachments.map((att, attIdx) => (
                      <a
                        key={attIdx}
                        href={att.url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <Paperclip className="w-3 h-3" />
                        {att.name}
                      </a>
                    ))}
                  </div>
                )}

                {/* Decision Timestamp */}
                {appr.decidedAt && (
                  <p className="text-[10px] text-slate-400 mt-2 text-right">
                    Thời điểm: {new Date(appr.decidedAt).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default ApprovalTimeline;
