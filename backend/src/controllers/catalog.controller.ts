import { Request, Response } from 'express';
import { CatalogService } from '../services/catalog.service';
import { successResponse, errorResponse } from '../utils/response';

const handle = async (res: Response, action: () => Promise<unknown>, message: string, status = 200) => {
  try {
    const data = await action();
    successResponse(res, data, message, status);
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    errorResponse(res, err.message || 'Có lỗi xảy ra', err.status || 500);
  }
};

export class CategoryController {
  static list(req: Request, res: Response) {
    return handle(res, () => CatalogService.listCategories(req.query), 'Lấy danh sách danh mục thành công');
  }

  static create(req: Request, res: Response) {
    return handle(res, () => CatalogService.createCategory(req.body), 'Tạo danh mục thành công', 201);
  }

  static update(req: Request, res: Response) {
    return handle(res, () => CatalogService.updateCategory(req.params.id, req.body), 'Cập nhật danh mục thành công');
  }

  static delete(req: Request, res: Response) {
    return handle(res, () => CatalogService.deleteCategory(req.params.id), 'Xóa danh mục thành công');
  }
}

export class SupplierController {
  static list(req: Request, res: Response) {
    return handle(res, () => CatalogService.listSuppliers(req.query), 'Lấy danh sách nhà cung cấp thành công');
  }

  static create(req: Request, res: Response) {
    return handle(res, () => CatalogService.createSupplier(req.body), 'Tạo nhà cung cấp thành công', 201);
  }

  static update(req: Request, res: Response) {
    return handle(res, () => CatalogService.updateSupplier(req.params.id, req.body), 'Cập nhật nhà cung cấp thành công');
  }

  static delete(req: Request, res: Response) {
    return handle(res, () => CatalogService.deleteSupplier(req.params.id), 'Xóa nhà cung cấp thành công');
  }
}

export class CustomerController {
  static list(req: Request, res: Response) {
    return handle(res, () => CatalogService.listCustomers(req.query), 'Lấy danh sách khách hàng thành công');
  }

  static create(req: Request, res: Response) {
    return handle(res, () => CatalogService.createCustomer(req.body), 'Tạo khách hàng thành công', 201);
  }

  static update(req: Request, res: Response) {
    return handle(res, () => CatalogService.updateCustomer(req.params.id, req.body), 'Cập nhật khách hàng thành công');
  }

  static delete(req: Request, res: Response) {
    return handle(res, () => CatalogService.deleteCustomer(req.params.id), 'Xóa khách hàng thành công');
  }
}

export class ProductController {
  static list(req: Request, res: Response) {
    return handle(res, () => CatalogService.listProducts(req.query), 'Lấy danh sách sản phẩm thành công');
  }

  static get(req: Request, res: Response) {
    return handle(res, () => CatalogService.getProduct(req.params.id), 'Lấy sản phẩm thành công');
  }

  static create(req: Request, res: Response) {
    return handle(res, () => CatalogService.createProduct(req.body), 'Tạo sản phẩm thành công', 201);
  }

  static createBulk(req: Request, res: Response) {
    return handle(res, () => CatalogService.createProductsBulk(req.body.products), 'Import hàng loạt sản phẩm thành công', 201);
  }

  static update(req: Request, res: Response) {
    return handle(res, () => CatalogService.updateProduct(req.params.id, req.body), 'Cập nhật sản phẩm thành công');
  }

  static delete(req: Request, res: Response) {
    return handle(res, () => CatalogService.deleteProduct(req.params.id), 'Xóa sản phẩm thành công');
  }

  static deleteAll(_req: Request, res: Response) {
    return handle(res, () => CatalogService.deleteAllProducts(), 'Đã xóa toàn bộ sản phẩm');
  }
}
