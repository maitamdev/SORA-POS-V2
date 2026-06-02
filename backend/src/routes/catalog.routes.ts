import { Router } from 'express';
import {
  CategoryController,
  CustomerController,
  ProductController,
  SupplierController,
} from '../controllers/catalog.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  customerCreateSchema,
  customerUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  productBulkCreateSchema,
  supplierCreateSchema,
  supplierUpdateSchema,
} from '../validations/catalog.validation';

export const categoryRoutes = Router();
categoryRoutes.use(authMiddleware);
categoryRoutes.get('/', CategoryController.list);
categoryRoutes.post('/', roleMiddleware('admin', 'manager'), validateMiddleware(categoryCreateSchema), CategoryController.create);
categoryRoutes.put('/:id', roleMiddleware('admin', 'manager'), validateMiddleware(categoryUpdateSchema), CategoryController.update);
categoryRoutes.delete('/:id', roleMiddleware('admin'), CategoryController.delete);

export const supplierRoutes = Router();
supplierRoutes.use(authMiddleware);
supplierRoutes.get('/', SupplierController.list);
supplierRoutes.post('/', roleMiddleware('admin', 'manager'), validateMiddleware(supplierCreateSchema), SupplierController.create);
supplierRoutes.put('/:id', roleMiddleware('admin', 'manager'), validateMiddleware(supplierUpdateSchema), SupplierController.update);
supplierRoutes.delete('/:id', roleMiddleware('admin'), SupplierController.delete);

export const customerRoutes = Router();
customerRoutes.use(authMiddleware);
customerRoutes.get('/', CustomerController.list);
customerRoutes.post('/', validateMiddleware(customerCreateSchema), CustomerController.create);
customerRoutes.put('/:id', validateMiddleware(customerUpdateSchema), CustomerController.update);
customerRoutes.delete('/:id', roleMiddleware('admin', 'manager'), CustomerController.delete);

export const productRoutes = Router();
productRoutes.use(authMiddleware);
productRoutes.get('/', ProductController.list);
productRoutes.get('/:id', ProductController.get);
productRoutes.post('/bulk', roleMiddleware('admin', 'manager'), validateMiddleware(productBulkCreateSchema), ProductController.createBulk);
productRoutes.post('/', roleMiddleware('admin', 'manager'), validateMiddleware(productCreateSchema), ProductController.create);
productRoutes.put('/:id', roleMiddleware('admin', 'manager'), validateMiddleware(productUpdateSchema), ProductController.update);
productRoutes.delete('/all', roleMiddleware('admin'), ProductController.deleteAll);
productRoutes.delete('/:id', roleMiddleware('admin', 'manager'), ProductController.delete);
