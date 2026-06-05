import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { orderAPI } from '../../services/order.api';
import { Order } from '../../types/domain.type';
import { useAuthStore } from '../../stores/auth.store';

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const OrdersPage = () => {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  // Bộ lọc ngày tháng và trạng thái
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await orderAPI.list(params);
      setOrders(response.data.data.items);
    } catch {
      toast.error('Không tải được hóa đơn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [dateFrom, dateTo, statusFilter]);

  const openDetail = async (id: string) => {
    try {
      const response = await orderAPI.get(id);
      setSelected(response.data.data);
    } catch {
      toast.error('Không tải được chi tiết hóa đơn');
    }
  };

  const cancel = async (order: Order) => {
    if (!window.confirm(`Hủy hóa đơn ${order.order_number} và hoàn tồn kho?`)) return;
    try {
      await orderAPI.cancel(order.id, 'Hủy từ giao diện quản lý hóa đơn');
      toast.success('Đã hủy hóa đơn');
      await loadOrders();
      setSelected(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Hủy hóa đơn thất bại');
    }
  };

  const remove = async (order: Order) => {
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA HOÀN TOÀN hóa đơn ${order.order_number}? Hành động này sẽ xóa dữ liệu hóa đơn, các khoản thanh toán và lịch sử kho hàng liên quan.`)) return;
    try {
      await orderAPI.remove(order.id);
      toast.success('Đã xóa hóa đơn');
      await loadOrders();
      setSelected(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Xóa hóa đơn thất bại');
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('CẢNH BÁO NGUY HIỂM!\nHành động này sẽ XÓA TOÀN BỘ hóa đơn, thanh toán và các lịch sử kho hàng liên quan trên hệ thống.\nHành động này không thể hoàn tác!\n\nBạn có chắc chắn muốn tiếp tục?')) return;

    setLoading(true);
    try {
      await orderAPI.removeAll();
      toast.success('Đã xóa toàn bộ hóa đơn thành công');
      await loadOrders();
      setSelected(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Xóa toàn bộ hóa đơn thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">Hóa đơn</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">Danh sách hóa đơn realtime từ POS.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button onClick={loadOrders} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white w-full sm:w-auto whitespace-nowrap">Tải lại</button>
          {user?.role === 'admin' && (
            <button
              onClick={handleDeleteAll}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white w-full sm:w-auto whitespace-nowrap hover:bg-red-700 transition"
            >
              Xóa tất cả
            </button>
          )}
        </div>
      </header>

      {/* Bộ lọc hóa đơn */}
      <div className="bg-white border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-end text-xs rounded-2xl">
        <div className="space-y-1.5 flex-1 min-w-[150px] w-full">
          <label className="block font-black text-slate-500 uppercase">Từ ngày</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full border border-slate-200 px-3 py-2 bg-white font-semibold outline-none focus:border-blue-500 rounded-xl"
          />
        </div>

        <div className="space-y-1.5 flex-1 min-w-[150px] w-full">
          <label className="block font-black text-slate-500 uppercase">Đến ngày</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full border border-slate-200 px-3 py-2 bg-white font-semibold outline-none focus:border-blue-500 rounded-xl"
          />
        </div>

        <div className="space-y-1.5 flex-1 min-w-[150px] w-full">
          <label className="block font-black text-slate-500 uppercase">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-slate-200 px-3 py-2 bg-white font-bold text-slate-600 outline-none focus:border-blue-500 rounded-xl"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="completed">Đã hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>

        <button
          onClick={() => {
            setDateFrom('');
            setDateTo('');
            setStatusFilter('all');
          }}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold w-full md:w-auto whitespace-nowrap transition rounded-xl"
        >
          Xóa bộ lọc
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-black">Mã</th>
                <th className="px-4 py-3 font-black">Khách hàng</th>
                <th className="px-4 py-3 font-black">Tổng tiền</th>
                <th className="px-4 py-3 font-black">Trạng thái</th>
                <th className="px-4 py-3 font-black">Ngày tạo</th>
                <th className="px-4 py-3 text-right font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Đang tải...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Chưa có hóa đơn</td></tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-black text-blue-600">{order.order_number}</td>
                    <td className="px-4 py-3 font-semibold">{order.customers?.name || 'Khách lẻ'}</td>
                    <td className="px-4 py-3 font-black">{money(order.final_amount)}</td>
                    <td className="px-4 py-3 font-semibold">{order.status}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(order.created_at).toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openDetail(order.id)} className="mr-3 text-xs font-bold text-blue-600">Chi tiết</button>
                      {order.status !== 'cancelled' && (
                        <button onClick={() => cancel(order)} className="mr-3 text-xs font-bold text-amber-600">Hủy</button>
                      )}
                      {(user?.role === 'admin' || user?.role === 'manager') && (
                        <button onClick={() => remove(order)} className="text-xs font-bold text-red-600">Xóa</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-800">Chi tiết hóa đơn</h2>
          {!selected ? (
            <p className="mt-8 text-center text-sm font-semibold text-slate-400">Chọn một hóa đơn để xem chi tiết</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Mã hóa đơn</p>
                <p className="font-black text-slate-800">{selected.order_number}</p>
              </div>
              <div className="divide-y divide-slate-100">
                {selected.order_details?.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 text-sm">
                    <div>
                      <p className="font-bold text-slate-700">{item.product_name}</p>
                      <p className="text-xs text-slate-400">{item.quantity} x {money(item.unit_price)}</p>
                    </div>
                    <p className="font-black">{money(item.subtotal)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-3">
                <div className="flex justify-between font-black">
                  <span>Thanh toán</span>
                  <span>{money(selected.final_amount)}</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default OrdersPage;
