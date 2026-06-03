import { Request, Response } from 'express';
import { CatalogService } from '../services/catalog.service';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

export class CategoryController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.listCategories(req.query), 'Lấy danh sách danh mục thành công');
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.createCategory(req.body), 'Tạo danh mục thành công', 201);
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.updateCategory(req.params.id, req.body), 'Cập nhật danh mục thành công');
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.deleteCategory(req.params.id), 'Xóa danh mục thành công');
  });
}

export class SupplierController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.listSuppliers(req.query), 'Lấy danh sách nhà cung cấp thành công');
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.createSupplier(req.body), 'Tạo nhà cung cấp thành công', 201);
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.updateSupplier(req.params.id, req.body), 'Cập nhật nhà cung cấp thành công');
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.deleteSupplier(req.params.id), 'Xóa nhà cung cấp thành công');
  });
}

export class CustomerController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.listCustomers(req.query), 'Lấy danh sách khách hàng thành công');
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.createCustomer(req.body), 'Tạo khách hàng thành công', 201);
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.updateCustomer(req.params.id, req.body), 'Cập nhật khách hàng thành công');
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.deleteCustomer(req.params.id), 'Xóa khách hàng thành công');
  });
}

export class ProductController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.listProducts(req.query), 'Lấy danh sách sản phẩm thành công');
  });

  static get = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.getProduct(req.params.id), 'Lấy sản phẩm thành công');
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.createProduct(req.body), 'Tạo sản phẩm thành công', 201);
  });

  static createBulk = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.createProductsBulk(req.body.products), 'Import hàng loạt sản phẩm thành công', 201);
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.updateProduct(req.params.id, req.body), 'Cập nhật sản phẩm thành công');
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await CatalogService.deleteProduct(req.params.id), 'Xóa sản phẩm thành công');
  });

  static deleteAll = asyncHandler(async (_req: Request, res: Response) => {
    successResponse(res, await CatalogService.deleteAllProducts(), 'Đã xóa toàn bộ sản phẩm');
  });
}
