import { Router } from 'express';
import { fnGetProducts, fnCreateProduct, fnUpdateProduct, fnDeleteProduct } from '../controllers/productController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission, fnRequirePermission } from '../middleware/permissionMiddleware';

const router = Router();

// GET /api/products - 목록 조회 (조회 또는 관리 권한)
router.get('/', fnAuthMiddleware, fnRequireAnyPermission('product.view', 'product.manage'), fnGetProducts);

// POST /api/products - 추가 (관리 권한)
router.post('/', fnAuthMiddleware, fnRequirePermission('product.manage'), fnCreateProduct);

// PUT /api/products/:id - 수정 (관리 권한)
router.put('/:id', fnAuthMiddleware, fnRequirePermission('product.manage'), fnUpdateProduct);

// DELETE /api/products/:id - 삭제 (관리 권한)
router.delete('/:id', fnAuthMiddleware, fnRequirePermission('product.manage'), fnDeleteProduct);

export default router;
