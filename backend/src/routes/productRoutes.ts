import { Router } from 'express';
import { fnGetProducts, fnCreateProduct, fnUpdateProduct, fnDeleteProduct } from '../controllers/productController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnAdminOnly } from '../middleware/roleMiddleware';

const router = Router();

// GET /api/products - 목록 조회 (인증 사용자 전체)
router.get('/', fnAuthMiddleware, fnGetProducts);

// POST /api/products - 추가 (관리자)
router.post('/', fnAuthMiddleware, fnAdminOnly, fnCreateProduct);

// PUT /api/products/:id - 수정 (관리자)
router.put('/:id', fnAuthMiddleware, fnAdminOnly, fnUpdateProduct);

// DELETE /api/products/:id - 삭제 (관리자)
router.delete('/:id', fnAuthMiddleware, fnAdminOnly, fnDeleteProduct);

export default router;
