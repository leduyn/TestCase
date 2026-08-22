import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { UserStatus } from '@prisma/client';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// GET /api/users - Lấy danh sách tất cả người dùng
router.get('/', authenticate, requirePermission('users:read'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/users/:id - Lấy thông tin người dùng
router.get('/:id', authenticate, requirePermission('users:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/users - Tạo người dùng mới
router.post('/', authenticate, requirePermission('users:create'), async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được đăng ký' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role: role || 'TESTER',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/users/:id - Cập nhật người dùng
router.put('/:id', authenticate, requirePermission('users:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, role, status } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName;
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/users/:id - Xóa người dùng
router.delete('/:id', authenticate, requirePermission('users:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Xóa người dùng thành công' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/users/:id/toggle-status - Thay đổi trạng thái
router.post('/:id/toggle-status', authenticate, requirePermission('users:status'), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = await prisma.user.findUnique({ where: { id } });

    if (!currentUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // PENDING → ACTIVE (duyệt), ACTIVE → INACTIVE (khóa), INACTIVE → ACTIVE (mở khóa)
    let newStatus: UserStatus;
    if (currentUser.status === 'ACTIVE') {
      newStatus = 'INACTIVE';
    } else {
      // PENDING hoặc INACTIVE → ACTIVE
      newStatus = 'ACTIVE';
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: newStatus },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    const statusLabel = newStatus === 'ACTIVE'
      ? (currentUser.status === 'PENDING' ? 'phê duyệt' : 'kích hoạt')
      : 'khóa';

    res.json({
      message: `Tài khoản đã được ${statusLabel} thành công`,
      user: updatedUser,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;