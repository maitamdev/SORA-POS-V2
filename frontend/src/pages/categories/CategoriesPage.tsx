import CrudPage from '../../components/common/CrudPage';
import { catalogAPI } from '../../services/catalog.api';
import { Category } from '../../types/domain.type';

const CategoriesPage = () => (
  <CrudPage<Category>
    title="Danh mục"
    subtitle="Quản lý nhóm sản phẩm dùng cho lọc hàng hóa và POS."
    initialForm={{ name: '', description: '', image_url: '' }}
    fields={[
      { key: 'name', label: 'Tên danh mục', required: true },
      { key: 'description', label: 'Mô tả', type: 'textarea' },
      { key: 'image_url', label: 'URL hình ảnh' },
    ]}
    columns={[
      { key: 'name', label: 'Tên' },
      { key: 'description', label: 'Mô tả' },
      { key: 'is_active', label: 'Trạng thái', render: (item) => (item.is_active ? 'Đang dùng' : 'Đã khóa') },
    ]}
    loadItems={async (search) => (await catalogAPI.categories.list({ search, is_active: true })).data.data.items}
    createItem={async (data) => { await catalogAPI.categories.create(data); }}
    updateItem={async (id, data) => { await catalogAPI.categories.update(id, data); }}
    deleteItem={async (id) => { await catalogAPI.categories.remove(id); }}
  />
);

export default CategoriesPage;
