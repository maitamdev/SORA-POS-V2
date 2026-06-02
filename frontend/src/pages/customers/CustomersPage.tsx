import CrudPage from '../../components/common/CrudPage';
import { catalogAPI } from '../../services/catalog.api';
import { Customer } from '../../types/domain.type';

const CustomersPage = () => (
  <CrudPage<Customer>
    title="Khách hàng"
    subtitle="Lưu thông tin khách hàng và theo dõi điểm/tổng chi tiêu realtime."
    initialForm={{ name: '', email: '', phone: '', address: '' }}
    fields={[
      { key: 'name', label: 'Tên khách hàng', required: true },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Số điện thoại' },
      { key: 'address', label: 'Địa chỉ', type: 'textarea' },
    ]}
    columns={[
      { key: 'name', label: 'Tên' },
      { key: 'phone', label: 'SĐT' },
      { key: 'points', label: 'Điểm', render: (item) => item.points || 0 },
      { key: 'total_spent', label: 'Tổng chi', render: (item) => `${Number(item.total_spent || 0).toLocaleString('vi-VN')}đ` },
    ]}
    loadItems={async (search) => (await catalogAPI.customers.list({ search })).data.data.items}
    createItem={async (data) => { await catalogAPI.customers.create(data); }}
    updateItem={async (id, data) => { await catalogAPI.customers.update(id, data); }}
    deleteItem={async (id) => { await catalogAPI.customers.remove(id); }}
  />
);

export default CustomersPage;
