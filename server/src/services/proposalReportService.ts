import prisma from '../config/database';

export class ProposalReportService {
  /**
   * Thống kê đề xuất theo loại
   */
  static async getProposalsByType(options?: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = options || {};

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const types = await prisma.proposalType.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        color: true,
        icon: true,
        _count: {
          select: {
            proposals: { where },
          },
        },
      },
    });

    const totalProposals = types.reduce((acc, t) => acc + t._count.proposals, 0);

    const report = types.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      color: t.color,
      icon: t.icon,
      count: t._count.proposals,
      percentage: totalProposals > 0 ? Number(((t._count.proposals / totalProposals) * 100).toFixed(1)) : 0,
    }));

    return {
      total: totalProposals,
      byType: report,
    };
  }

  /**
   * Thống kê đề xuất theo trạng thái
   */
  static async getProposalsByStatus(options?: { startDate?: string; endDate?: string; proposalTypeId?: string }) {
    const { startDate, endDate, proposalTypeId } = options || {};

    const where: any = {};
    if (proposalTypeId) where.proposalTypeId = proposalTypeId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const groups = await prisma.proposal.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const total = groups.reduce((acc, g) => acc + g._count.id, 0);

    const statuses = ['DRAFT', 'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'];
    const byStatus = statuses.map((status) => {
      const found = groups.find((g) => g.status === status);
      const count = found ? found._count.id : 0;
      return {
        status,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
      };
    });

    return { total, byStatus };
  }

  /**
   * Thống kê hiệu suất theo người duyệt
   */
  static async getProposalsByApprover(options?: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = options || {};

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const approvals = await prisma.proposalApproval.findMany({
      where,
      include: {
        approver: {
          select: { id: true, fullName: true, email: true, department: true },
        },
      },
    });

    const approverMap = new Map<string, {
      approver: any;
      total: number;
      approved: number;
      rejected: number;
      pending: number;
      avgResponseHours: number;
      durations: number[];
    }>();

    for (const a of approvals) {
      if (!approverMap.has(a.approverId)) {
        approverMap.set(a.approverId, {
          approver: a.approver,
          total: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          avgResponseHours: 0,
          durations: [],
        });
      }

      const item = approverMap.get(a.approverId)!;
      item.total++;
      if (a.action === 'APPROVED') item.approved++;
      if (a.action === 'REJECTED') item.rejected++;
      if (a.action === 'PENDING') item.pending++;

      if (a.decidedAt && a.createdAt) {
        const diffHours = (new Date(a.decidedAt).getTime() - new Date(a.createdAt).getTime()) / (1000 * 3600);
        item.durations.push(diffHours);
      }
    }

    const result = Array.from(approverMap.values()).map((item) => ({
      approver: item.approver,
      total: item.total,
      approved: item.approved,
      rejected: item.rejected,
      pending: item.pending,
      avgResponseHours: item.durations.length > 0
        ? Number((item.durations.reduce((a, b) => a + b, 0) / item.durations.length).toFixed(1))
        : 0,
    }));

    return result.sort((a, b) => b.total - a.total);
  }

  /**
   * Thời gian xử lý phê duyệt trung bình
   */
  static async getApprovalTimeStats(options?: { proposalTypeId?: string }) {
    const { proposalTypeId } = options || {};

    const completedProposals = await prisma.proposal.findMany({
      where: {
        status: { in: ['APPROVED', 'REJECTED'] },
        submittedAt: { not: null },
        proposalTypeId: proposalTypeId || undefined,
        OR: [
          { approvedAt: { not: null } },
          { rejectedAt: { not: null } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        submittedAt: true,
        approvedAt: true,
        rejectedAt: true,
      },
    });

    if (completedProposals.length === 0) {
      return {
        totalEvaluated: 0,
        avgHours: 0,
        minHours: 0,
        maxHours: 0,
      };
    }

    const durations = completedProposals.map((p) => {
      const end = p.approvedAt || p.rejectedAt;
      return (new Date(end!).getTime() - new Date(p.submittedAt!).getTime()) / (1000 * 3600);
    });

    const sum = durations.reduce((a, b) => a + b, 0);
    const avgHours = Number((sum / durations.length).toFixed(1));
    const minHours = Number(Math.min(...durations).toFixed(1));
    const maxHours = Number(Math.max(...durations).toFixed(1));

    return {
      totalEvaluated: completedProposals.length,
      avgHours,
      minHours,
      maxHours,
    };
  }

  /**
   * Đề xuất quá hạn
   */
  static async getOverdueProposals() {
    const now = new Date();

    const proposals = await prisma.proposal.findMany({
      where: {
        OR: [
          { status: 'EXPIRED' },
          {
            status: { in: ['PENDING', 'IN_REVIEW'] },
            deadline: { lt: now },
          },
        ],
      },
      include: {
        proposalType: { select: { id: true, name: true, color: true } },
        creator: { select: { id: true, fullName: true, email: true } },
        approvals: {
          where: { action: 'PENDING' },
          include: {
            approver: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: { deadline: 'asc' },
    });

    return {
      total: proposals.length,
      proposals,
    };
  }
}
