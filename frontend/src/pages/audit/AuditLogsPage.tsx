import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineClipboardList, HiOutlineRefresh } from 'react-icons/hi';
import { auditAPI, AuditLog } from '../../services/audit.api';

const actionLabel: Record<string, string> = {
  'order.create': 'Tao hoa don',
  'order.cancel': 'Huy hoa don',
};

const formatDate = (value: string) => new Date(value).toLocaleString('vi-VN');

const metadataSummary = (metadata: Record<string, unknown>) => {
  const orderNumber = metadata.order_number ? `#${metadata.order_number}` : '';
  const finalAmount =
    typeof metadata.final_amount === 'number'
      ? `${metadata.final_amount.toLocaleString('vi-VN')}d`
      : '';
  const paymentMethod = metadata.payment_method ? String(metadata.payment_method).toUpperCase() : '';
  return [orderNumber, finalAmount, paymentMethod].filter(Boolean).join(' - ') || JSON.stringify(metadata);
};

const AuditLogsPage = () => {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (action !== 'all') params.action = action;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const response = await auditAPI.list(params);
      setItems(response.data.data.items);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Khong tai duoc audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [action, dateFrom, dateTo]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-black text-slate-800">
            <HiOutlineClipboardList className="h-6 w-6 text-blue-600" />
            Audit log
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">Nhat ky thao tac quan trong tren hoa don va kho.</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          <HiOutlineRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Tai lai
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <label className="space-y-1.5">
          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Action</span>
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
          >
            <option value="all">Tat ca</option>
            <option value="order.create">Tao hoa don</option>
            <option value="order.cancel">Huy hoa don</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Tu ngay</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Den ngay</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
          />
        </label>
        <button
          onClick={() => {
            setAction('all');
            setDateFrom('');
            setDateTo('');
          }}
          className="self-end rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
        >
          Xoa loc
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-black">Thoi gian</th>
                <th className="px-4 py-3 font-black">Nguoi thao tac</th>
                <th className="px-4 py-3 font-black">Action</th>
                <th className="px-4 py-3 font-black">Doi tuong</th>
                <th className="px-4 py-3 font-black">Chi tiet</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-semibold text-slate-400">Dang tai...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-semibold text-slate-400">Chua co audit log</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-800">{item.actor?.full_name || 'He thong'}</p>
                      <p className="text-xs font-semibold text-slate-400">{item.actor?.email || item.actor_id || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                        {actionLabel[item.action] || item.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">
                      <p>{item.entity_type}</p>
                      <p className="text-xs text-slate-400">{item.entity_id || '-'}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{metadataSummary(item.metadata || {})}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AuditLogsPage;
