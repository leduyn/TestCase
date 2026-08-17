import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../Models/UserModel';

const router = Router();

// GET /api/users - Lấy danh sách tất cả người dùng (chỉ admin)
router.get('/', authenticate, authorize([UserRole.ADMIN]), async (req, res) => {
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
router.get('/:id', authenticate, async (req, res) => {
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
router.post('/', authenticate, authorize([UserRole.ADMIN]), async (req, res) => {
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
router.put('/:id', authenticate, authorize([UserRole.ADMIN]), async (req, res) => {
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
router.delete('/:id', authenticate, authorize([UserRole.ADMIN]), async (req, res) => {
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
router.post('/:id/toggle-status', authenticate, authorize([UserRole.ADMIN]), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = await prisma.user.findUnique({ where: { id } });

    if (!currentUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const newStatus = currentUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

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

    res.json({
      message: `Tài khoản ${newStatus === 'ACTIVE' ? 'kích hoạt' : 'khóa'} thành công`,
      user: updatedUser,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;