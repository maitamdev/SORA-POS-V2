import CrudPage from '../../components/common/CrudPage';
import { catalogAPI } from '../../services/catalog.api';
import { Supplier } from '../../types/domain.type';

const SuppliersPage = () => (
  <CrudPage<Supplier>
    title="Nhà cung cấp"
    subtitle="Quản lý thông tin đối tác cung ứng hàng hóa."
    initialForm={{ name: '', contact_person: '', email: '', phone: '', address: '', tax_code: '' }}
    fields={[
      { key: 'name', label: 'Tên NCC', required: true },
      { key: 'contact_person', label: 'Người liên hệ' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Số điện thoại' },
      { key: 'address', label: 'Địa chỉ', type: 'textarea' },
      { key: 'tax_code', label: 'Mã số thuế' },
    ]}
    columns={[
      { key: 'name', label: 'Tên' },
      { key: 'contact_person', label: 'Liên hệ' },
      { key: 'phone', label: 'SĐT' },
      { key: 'email', label: 'Email' },
    ]}
    loadItems={async (search) => (await catalogAPI.suppliers.list({ search, is_active: true })).data.data.items}
    createItem={async (data) => { await catalogAPI.suppliers.create(data); }}
    updateItem={async (id, data) => { await catalogAPI.suppliers.update(id, data); }}
    deleteItem={async (id) => { await catalogAPI.suppliers.remove(id); }}
  />
);

export default SuppliersPage;
