import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineArrowRight,
  HiOutlineChartBar,
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineClock,
  HiOutlineCube,
  HiOutlineExclamationCircle,
  HiOutlineLightningBolt,
  HiOutlineRefresh,
  HiOutlineShieldCheck,
  HiOutlineShoppingCart,
  HiOutlineSparkles,
} from 'react-icons/hi';
import { auditAPI, AuditLog } from '../../services/audit.api';
import { DashboardData, reportAPI } from '../../services/report.api';
import { orderAPI } from '../../services/order.api';
import { stockAPI } from '../../services/stock.api';
import { Order, StockAlert } from '../../types/domain.type';

const money = (value: number) => `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}d`;

const todayKey = () => new Date().toISOString().slice(0, 10);

const actionLabel: Record<string, string> = {
  'order.create': 'Tao hoa don',
  'order.cancel': 'Huy hoa don',
};

const statusTone = (score: number) => {
  if (score >= 85) return { label: 'Van hanh tot', color: 'emerald', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (score >= 65) return { label: 'Can theo doi', color: 'amber', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { label: 'Can xu ly ngay', color: 'rose', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
};

const readAmount = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
};

const metricDelta = (value: number) => {
  const positive = value >= 0;
  return (
    <span className={`text-[11px] font-black ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
      {positive ? '+' : ''}{Number(value || 0).toFixed(1)}%
    </span>
  );
};

const CommandCenterPage = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, alertsRes, ordersRes, auditRes] = await Promise.all([
        reportAPI.dashboard(todayKey()),
        stockAPI.alerts({ limit: 8 }),
        orderAPI.list({ limit: 8, date_from: todayKey(), date_to: todayKey() }),
        auditAPI.list({ limit: 8 }),
      ]);

      setDashboard(dashboardRes.data.data);
      setAlerts(alertsRes.data.data.items);
      setOrders(ordersRes.data.data.items);
      setAuditLogs(auditRes.data.data.items);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Khong tai duoc command center');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const insights = useMemo(() => {
    const summary = dashboard?.summary;
    const lowStock = summary?.low_stock_count || alerts.length;
    const outOfStock = alerts.filter((item) => item.status === 'out_of_stock').length;
    const cancelledOrders = orders.filter((order) => order.status === 'cancelled').length;
    const todayRevenue = summary?.today_revenue || 0;
    const todayOrders = summary?.today_orders || orders.length;
    const aov = todayOrders ? todayRevenue / todayOrders : 0;
    const paymentStats = dashboard?.payment_stats || [];
    const topPayment = paymentStats.reduce((best, item) => (item.count > best.count ? item : best), { name: '-', count: 0, percentage: 0 });

    let score = 100;
    score -= Math.min(outOfStock * 10, 25);
    score -= Math.min(Math.max(lowStock - outOfStock, 0) * 4, 20);
    score -= Math.min(cancelledOrders * 8, 16);
    if ((summary?.today_revenue_growth || 0) < 0) score -= 10;
    if ((summary?.today_orders_growth || 0) < 0) score -= 8;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const actions = [
      {
        title: outOfStock > 0 ? 'Nhap hang gap' : 'Kiem tra canh bao ton',
        detail: outOfStock > 0 ? `${outOfStock} san pham dang het hang` : `${lowStock} san pham can theo doi`,
        href: '/stock',
        priority: outOfStock > 0 ? 'high' : lowStock > 0 ? 'medium' : 'low',
      },
      {
        title: 'Xem audit moi nhat',
        detail: `${auditLogs.length} su kien gan day can doi soat`,
        href: '/audit-logs',
        priority: cancelledOrders > 0 ? 'medium' : 'low',
      },
      {
        title: 'Day manh mat hang ban chay',
        detail: dashboard?.top_products?.[0]?.name ? `Top hien tai: ${dashboard.top_products[0].name}` : 'Chua co top san pham',
        href: '/reports',
        priority: 'low',
      },
    ];

    return {
      aov,
      cancelledOrders,
      lowStock,
      outOfStock,
      score,
      status: statusTone(score),
      todayOrders,
      todayRevenue,
      topPayment,
      actions,
    };
  }, [alerts, auditLogs.length, dashboard, orders]);

  const status = insights.status;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="space-y-6">
        <header className="relative overflow-hidden rounded-none border border-slate-200 bg-[#07111f] px-5 py-6 text-white shadow-sm sm:px-7">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,#1d7fd6_0,#0f3d66_34%,transparent_66%)] opacity-30 lg:block" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-100">
                <HiOutlineSparkles className="h-4 w-4 text-sky-300" />
                Executive command center
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Trung tam dieu hanh cua hang</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-300">
                Gom KPI, canh bao ton kho, audit log va hanh dong uu tien vao mot man hinh de demo van hanh nhu POS doanh nghiep.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to="/pos" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-900">
                <HiOutlineShoppingCart className="h-4 w-4" />
                Mo POS
              </Link>
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                <HiOutlineRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Lam moi
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
          <div className={`border ${status.border} ${status.bg} p-5 shadow-sm`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Store health</p>
                <p className={`mt-1 text-sm font-black ${status.text}`}>{status.label}</p>
              </div>
              <HiOutlineShieldCheck className={`h-7 w-7 ${status.text}`} />
            </div>

            <div className="mt-6 flex items-end justify-between">
              <div>
                <p className="text-5xl font-black tracking-tight text-slate-900">{insights.score}</p>
                <p className="text-xs font-bold text-slate-500">/100 diem van hanh</p>
              </div>
              <div className="h-24 w-24 rounded-full border-[10px] border-white bg-slate-900 text-white shadow-inner flex items-center justify-center">
                <HiOutlineLightningBolt className="h-9 w-9" />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              {[
                ['Het hang', insights.outOfStock],
                ['Sap het hang', insights.lowStock],
                ['Hoa don huy hom nay', insights.cancelledOrders],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between border-t border-slate-200/80 pt-2 text-sm">
                  <span className="font-bold text-slate-600">{label}</span>
                  <span className="font-black text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard
              icon={<HiOutlineChartBar />}
              label="Doanh thu hom nay"
              value={money(insights.todayRevenue)}
              footer={metricDelta(dashboard?.summary.today_revenue_growth || 0)}
            />
            <MetricCard
              icon={<HiOutlineShoppingCart />}
              label="Hoa don hom nay"
              value={`${insights.todayOrders.toLocaleString('vi-VN')} don`}
              footer={metricDelta(dashboard?.summary.today_orders_growth || 0)}
            />
            <MetricCard
              icon={<HiOutlineClipboardList />}
              label="Gia tri TB / don"
              value={money(insights.aov)}
              footer={<span className="text-[11px] font-black text-blue-600">{insights.topPayment.name} {insights.topPayment.percentage}%</span>}
            />

            <section className="border border-slate-200 bg-white p-5 shadow-sm md:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">Hanh dong uu tien</h2>
                  <p className="text-xs font-semibold text-slate-500">De xuat tu du lieu thuc trong ngay</p>
                </div>
                <HiOutlineSparkles className="h-5 w-5 text-blue-600" />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {insights.actions.map((action) => (
                  <Link
                    key={action.title}
                    to={action.href}
                    className={`group border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                      action.priority === 'high'
                        ? 'border-rose-200 bg-rose-50'
                        : action.priority === 'medium'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{action.title}</h3>
                        <p className="mt-1 text-xs font-semibold text-slate-600">{action.detail}</p>
                      </div>
                      <HiOutlineArrowRight className="mt-0.5 h-4 w-4 text-slate-500 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel title="Radar ton kho" icon={<HiOutlineCube />}>
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <EmptyState text="Ton kho dang an toan" />
              ) : (
                alerts.slice(0, 6).map((alert) => {
                  const product = alert.products;
                  const remaining = Number(alert.current_stock || product?.stock_quantity || 0);
                  const minStock = Number(alert.min_stock_level || product?.min_stock_level || 0);
                  const percent = Math.min(100, Math.max(0, minStock ? (remaining / minStock) * 100 : 0));
                  return (
                    <div key={alert.id} className="border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-800">{product?.name || alert.product_id}</p>
                          <p className="text-xs font-semibold text-slate-500">Con {remaining} / muc toi thieu {minStock}</p>
                        </div>
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase ${
                          alert.status === 'out_of_stock' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {alert.status === 'out_of_stock' ? 'Het hang' : 'Can nhap'}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div className={`h-full ${alert.status === 'out_of_stock' ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel title="Hoa don moi" icon={<HiOutlineShoppingCart />}>
            <div className="space-y-3">
              {orders.length === 0 ? (
                <EmptyState text="Chua co hoa don trong ngay" />
              ) : (
                orders.slice(0, 6).map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-800">{order.order_number}</p>
                      <p className="text-xs font-semibold text-slate-500">{new Date(order.created_at).toLocaleTimeString('vi-VN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{money(order.final_amount)}</p>
                      <p className={`text-[10px] font-black uppercase ${order.status === 'cancelled' ? 'text-rose-600' : 'text-emerald-600'}`}>{order.status}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Audit live feed" icon={<HiOutlineClock />}>
            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <EmptyState text="Chua co audit log" />
              ) : (
                auditLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="border-l-4 border-blue-500 bg-slate-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800">{actionLabel[log.action] || log.action}</p>
                        <p className="truncate text-xs font-semibold text-slate-500">{log.actor?.full_name || 'He thong'} - {new Date(log.created_at).toLocaleString('vi-VN')}</p>
                      </div>
                      <span className="text-xs font-black text-blue-700">{money(readAmount(log.metadata?.final_amount))}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <Panel title="Checklist demo doanh nghiep" icon={<HiOutlineCheckCircle />}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                ['Transaction checkout', 'Tao hoa don qua DB transaction, lock ton kho, rollback neu loi.'],
                ['Audit trail', 'Tao/huy hoa don deu ghi audit log de doi soat.'],
                ['No hard delete', 'Khong xoa cung hoa don/san pham tren UI van hanh.'],
                ['Offline ready', 'POS da co hang doi don offline va dong bo lai khi co mang.'],
              ].map(([title, detail]) => (
                <div key={title} className="flex gap-3 border border-slate-100 bg-slate-50 p-3">
                  <HiOutlineCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-black text-slate-800">{title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div className="border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">Quick actions</h2>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {[
                ['/stock', 'Xu ly ton kho', HiOutlineCube],
                ['/reports', 'Xem bao cao', HiOutlineChartBar],
                ['/audit-logs', 'Mo audit log', HiOutlineClipboardList],
                ['/products', 'Quan ly san pham', HiOutlineShoppingCart],
              ].map(([href, label, Icon]) => {
                const ActionIcon = Icon as typeof HiOutlineCube;
                return (
                  <Link key={String(href)} to={String(href)} className="flex items-center justify-between border border-slate-200 px-3 py-2 text-sm font-black text-slate-700 hover:border-blue-200 hover:bg-blue-50">
                    <span className="flex items-center gap-2">
                      <ActionIcon className="h-4 w-4 text-blue-600" />
                      {String(label)}
                    </span>
                    <HiOutlineArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const MetricCard = ({
  icon,
  label,
  value,
  footer,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  footer: ReactNode;
}) => (
  <div className="border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-2 text-xl font-black tracking-tight text-slate-900">{value}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">{icon}</span>
    </div>
    <div className="mt-4 border-t border-slate-100 pt-3">{footer}</div>
  </div>
);

const Panel = ({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) => (
  <section className="border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
      <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">{title}</h2>
      <span className="text-blue-600">{icon}</span>
    </div>
    {children}
  </section>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex min-h-32 items-center justify-center border border-dashed border-slate-200 bg-slate-50 text-center text-sm font-bold text-slate-400">
    <div>
      <HiOutlineExclamationCircle className="mx-auto mb-2 h-6 w-6 text-slate-300" />
      {text}
    </div>
  </div>
);

export default CommandCenterPage;
