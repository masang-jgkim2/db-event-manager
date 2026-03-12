import { Router } from 'express';
import {
  fnGetUsers, fnCreateUser, fnUpdateUser, fnDeleteUser, fnResetPassword,
} from '../controllers/userController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';

const router = Router();

router.use(fnAuthMiddleware);

// GET: 보기 권한. POST/PUT/DELETE/PATCH: 해당 액션 권한
router.get('/', fnRequireAnyPermission('user.view'), fnGetUsers);
router.post('/', fnRequireAnyPermission('user.create'), fnCreateUser);
router.put('/:id', fnRequireAnyPermission('user.edit'), fnUpdateUser);
router.delete('/:id', fnRequireAnyPermission('user.delete'), fnDeleteUser);
router.patch('/:id/password', fnRequireAnyPermission('user.reset_password'), fnResetPassword);

export default router;
