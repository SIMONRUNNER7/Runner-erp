import { Router } from 'express';
import { login, getMe, listUsers, createUser, updateUser, deleteUser } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.get('/users', authenticate, requireRole('president'), listUsers);
router.post('/users', authenticate, requireRole('president'), createUser);
router.put('/users/:id', authenticate, requireRole('president'), updateUser);
router.delete('/users/:id', authenticate, requireRole('president'), deleteUser);

export default router;
