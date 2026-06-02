import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

export interface FieldConfig<T> {
  key: keyof T & string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
}

interface CrudPageProps<T extends { id: string; is_active?: boolean }> {
  title: string;
  subtitle: string;
  fields: FieldConfig<T>[];
  columns: Array<{ key: keyof T & string; label: string; render?: (item: T) => ReactNode }>;
  loadItems: (search: string) => Promise<T[]>;
  createItem: (data: Partial<T>) => Promise<void>;
  updateItem: (id: string, data: Partial<T>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  initialForm: Partial<T>;
}

const normalizeValue = (value: FormDataEntryValue | null, type?: string) => {
  if (type === 'number') return Number(value || 0);
  return String(value || '').trim();
};

function CrudPage<T extends { id: string; is_active?: boolean }>({
  title,
  subtitle,
  fields,
  columns,
  loadItems,
  createItem,
  updateItem,
  deleteItem,
  initialForm,
}: CrudPageProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Partial<T>>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visibleFields = useMemo(() => fields.filter((field) => field.key !== 'id'), [fields]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      setItems(await loadItems(search));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const startEdit = (item: T) => {
    setEditing(item);
    setForm(item);
  };

  const resetForm = () => {
    setEditing(null);
    setForm(initialForm);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = visibleFields.reduce<Record<string, unknown>>((acc, field) => {
      acc[field.key] = normalizeValue(formData.get(field.key), field.type);
      return acc;
    }, {});

    setSaving(true);
    try {
      if (editing) await updateItem(editing.id, payload as Partial<T>);
      else await createItem(payload as Partial<T>);
      toast.success(editing ? 'Đã cập nhật' : 'Đã tạo mới');
      resetForm();
      await fetchItems();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Lưu dữ liệu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: T) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa mục này?')) return;
    try {
      await deleteItem(item.id);
      toast.success('Đã xóa');
      await fetchItems();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Xóa thất bại');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">{title}</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm kiếm..."
            className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-blue-500"
          />
          <button onClick={fetchItems} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white whitespace-nowrap">
            Tải lại
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <form key={editing?.id || 'new'} onSubmit={submit} className="h-fit rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">
              {editing ? 'Cập nhật' : 'Tạo mới'}
            </h2>
            {editing && (
              <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-500 hover:text-slate-900">
                Hủy
              </button>
            )}
          </div>
          <div className="space-y-3">
            {visibleFields.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{field.label}</span>
                {field.type === 'textarea' ? (
                  <textarea
                    name={field.key}
                    defaultValue={String(form[field.key as keyof T] ?? '')}
                    required={field.required}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                ) : field.type === 'select' ? (
                  <select
                    name={field.key}
                    value={String(form[field.key as keyof T] ?? '')}
                    onChange={(event) => setForm((state) => ({ ...state, [field.key]: event.target.value }))}
                    required={field.required}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Không chọn</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={field.key}
                    type={field.type || 'text'}
                    defaultValue={String(form[field.key as keyof T] ?? '')}
                    required={field.required}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                )}
              </label>
            ))}
          </div>
          <button
            disabled={saving}
            className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo mới'}
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-4 py-3 font-black">{column.label}</th>
                ))}
                <th className="px-4 py-3 text-right font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">Chưa có dữ liệu</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3 font-semibold text-slate-700">
                        {column.render ? column.render(item) : String(item[column.key] ?? '')}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(item)} className="mr-2 text-xs font-bold text-blue-600">Sửa</button>
                      <button onClick={() => remove(item)} className="text-xs font-bold text-red-600">Xóa</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CrudPage;
