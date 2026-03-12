import { Router } from 'express';
import { fnGetProducts, fnCreateProduct, fnUpdateProduct, fnDeleteProduct } from '../controllers/productController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission, fnRequirePermission } from '../middleware/permissionMiddleware';

const router = Router();

// GET /api/products - 목록 조회 (보기/관리 등 또는 대시보드 보기 권한)
router.get('/', fnAuthMiddleware, fnRequireAnyPermission('product.view', 'product.manage', 'product.create', 'product.edit', 'product.delete', 'dashboard.view'), fnGetProducts);

// POST /api/products - 추가 (생성 또는 관리)
router.post('/', fnAuthMiddleware, fnRequireAnyPermission('product.manage', 'product.create'), fnCreateProduct);

// PUT /api/products/:id - 수정 (수정 또는 관리)
router.put('/:id', fnAuthMiddleware, fnRequireAnyPermission('product.manage', 'product.edit'), fnUpdateProduct);

// DELETE /api/products/:id - 삭제 (삭제 또는 관리)
router.delete('/:id', fnAuthMiddleware, fnRequireAnyPermission('product.manage', 'product.delete'), fnDeleteProduct);

export default router;
