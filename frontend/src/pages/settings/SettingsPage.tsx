import { ChangeEvent, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineCog, HiOutlineOfficeBuilding, HiOutlinePrinter, HiOutlineShieldCheck } from 'react-icons/hi';
import { defaultOperationSettings, settingsAPI, OperationSettings } from '../../services/settings.api';
import { useAuthStore } from '../../stores/auth.store';
import { getRoleLabel } from '../../utils/userDisplay';
import { POPULAR_BANKS } from '../../utils/banks';

const SettingsPage = () => {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<OperationSettings>(defaultOperationSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    settingsAPI
      .getOperation()
      .then((response) => {
        setSettings({ ...defaultOperationSettings, ...response.data.data.settings });
        setUpdatedAt(response.data.data.updated_at);
      })
      .catch((error) => {
        toast.error(error.response?.data?.message || 'Không tải được cài đặt');
      })
      .finally(() => setLoading(false));
  }, []);

  const updateSetting = <K extends keyof OperationSettings>(key: K, value: OperationSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    setSaving(true);
    settingsAPI
      .updateOperation(settings)
      .then((response) => {
        setSettings({ ...defaultOperationSettings, ...response.data.data.settings });
        setUpdatedAt(response.data.data.updated_at);
        toast.success('Đã lưu cài đặt');
      })
      .catch((error) => {
        toast.error(error.response?.data?.message || 'Lưu cài đặt thất bại');
      })
      .finally(() => setSaving(false));
  };

  const resetSettings = () => {
    setSettings(defaultOperationSettings);
    toast.success('Đã đưa form về mặc định, bấm Lưu để áp dụng');
  };

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sora-pos-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã xuất cấu hình');
  };

  const importSettings = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        setSettings({ ...defaultOperationSettings, ...parsed });
        toast.success('Đã nhập cấu hình');
      } catch {
        toast.error('File cấu hình không hợp lệ');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">Cài đặt vận hành</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Cấu hình cửa hàng, POS, hóa đơn, kho, dữ liệu và quyền thao tác cho quản lý.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportSettings} className="px-4 py-2 border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50 transition">
            Xuất cấu hình
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50 transition">
            Nhập cấu hình
          </button>
          <button onClick={resetSettings} className="px-4 py-2 border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50 transition">
            Mặc định
          </button>
          <button
            onClick={saveSettings}
            disabled={saving || loading}
            className="px-5 py-2 bg-blue-600 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={importSettings} className="hidden" />
        </div>
      </header>

      {loading && (
        <div className="border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-700">
          Đang tải cài đặt từ hệ thống...
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" icon={<HiOutlineOfficeBuilding />} title="Thông tin cửa hàng">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField label="Tên cửa hàng" value={settings.storeName} onChange={(value) => updateSetting('storeName', value)} placeholder="Ví dụ: SORA MART" />
            <TextField label="Chi nhánh" value={settings.branchName} onChange={(value) => updateSetting('branchName', value)} placeholder="Nhập tên chi nhánh nếu có" />
            <TextField label="Mã số thuế" value={settings.taxCode} onChange={(value) => updateSetting('taxCode', value)} placeholder="Nhập mã số thuế" />
            <TextField label="Giờ hoạt động" value={settings.businessHours} onChange={(value) => updateSetting('businessHours', value)} placeholder="08:00 - 22:00" />
            <TextField className="md:col-span-2" label="Địa chỉ" value={settings.address} onChange={(value) => updateSetting('address', value)} placeholder="Nhập địa chỉ in trên hóa đơn" />
            <TextField label="Hotline" value={settings.hotline} onChange={(value) => updateSetting('hotline', value)} placeholder="Nhập số điện thoại cửa hàng" />
            <SelectField
              label="Định dạng tiền tệ"
              value={settings.currency}
              onChange={(value) => updateSetting('currency', value)}
              options={[
                { value: 'VND', label: 'VND' },
                { value: 'USD', label: 'USD' },
              ]}
            />
          </div>
        </Panel>

        <Panel icon={<HiOutlineShieldCheck />} title="Tài khoản">
          <div className="space-y-3 text-sm">
            <InfoRow label="Họ tên" value={user?.full_name || 'Chưa có tên'} />
            <InfoRow label="Email / Mã đăng nhập" value={user?.email || ''} />
            <div>
              <p className="font-semibold text-slate-500">Vai trò</p>
              <p className="mt-1 inline-flex border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                {getRoleLabel(user?.role)}
              </p>
            </div>
            <InfoRow label="Phiên tự khóa" value={`${settings.sessionLockMinutes} phút`} />
            <InfoRow
              label="Cập nhật lần cuối"
              value={updatedAt ? new Date(updatedAt).toLocaleString('vi-VN') : 'Chưa lưu trên hệ thống'}
            />
          </div>
        </Panel>

        <Panel icon={<HiOutlineCog />} title="POS">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Thanh toán mặc định"
              value={settings.defaultPaymentMethod}
              onChange={(value) => updateSetting('defaultPaymentMethod', value as OperationSettings['defaultPaymentMethod'])}
              options={[
                { value: 'cash', label: 'Tiền mặt' },
                { value: 'transfer', label: 'Chuyển khoản' },
                { value: 'card', label: 'Thẻ' },
              ]}
            />
            <NumberField label="Số SP mỗi trang POS" value={settings.productPageSize} onChange={(value) => updateSetting('productPageSize', value)} min={8} max={100} />
            <NumberField label="Giảm giá tối đa (%)" value={settings.maxDiscountPercent} onChange={(value) => updateSetting('maxDiscountPercent', value)} min={0} max={100} />
            <NumberField label="Tự khóa sau (phút)" value={settings.sessionLockMinutes} onChange={(value) => updateSetting('sessionLockMinutes', value)} min={5} max={240} />
            <Toggle checked={settings.allowDiscount} label="Cho phép chiết khấu đơn hàng" onChange={(checked) => updateSetting('allowDiscount', checked)} />
            <Toggle checked={settings.barcodeAutoAdd} label="Quét mã vạch tự thêm vào giỏ" onChange={(checked) => updateSetting('barcodeAutoAdd', checked)} />
            <Toggle checked={settings.confirmBeforeCheckout} label="Xác nhận trước khi thanh toán" onChange={(checked) => updateSetting('confirmBeforeCheckout', checked)} />
            <Toggle checked={settings.compactMode} label="Giao diện POS thu gọn" onChange={(checked) => updateSetting('compactMode', checked)} />
          </div>
        </Panel>

        <Panel icon={<HiOutlinePrinter />} title="Hóa đơn và in ấn">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Khổ giấy"
              value={settings.receiptPaperSize}
              onChange={(value) => updateSetting('receiptPaperSize', value as OperationSettings['receiptPaperSize'])}
              options={[
                { value: 'k80', label: 'K80' },
                { value: 'a5', label: 'A5' },
              ]}
            />
            <NumberField label="Số bản in" value={settings.receiptCopies} onChange={(value) => updateSetting('receiptCopies', value)} min={1} max={5} />
            <TextAreaField
              className="md:col-span-2"
              label="Lời cảm ơn cuối hóa đơn"
              value={settings.receiptFooter}
              onChange={(value) => updateSetting('receiptFooter', value)}
              placeholder="Nhập nội dung cuối hóa đơn"
            />
            <Toggle checked={settings.autoPrintReceipt} label="Tự mở in hóa đơn sau thanh toán" onChange={(checked) => updateSetting('autoPrintReceipt', checked)} />
            <Toggle checked={settings.requireCustomerPhone} label="Nhắc nhập số điện thoại khách hàng" onChange={(checked) => updateSetting('requireCustomerPhone', checked)} />
          </div>
        </Panel>

        <Panel icon={<HiOutlineCog />} title="Kho hàng">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <NumberField label="Ngưỡng tồn kho mặc định" value={settings.defaultMinStockLevel} onChange={(value) => updateSetting('defaultMinStockLevel', value)} min={0} max={9999} />
            <Toggle checked={settings.lowStockWarning} label="Cảnh báo khi bán sản phẩm tồn thấp" onChange={(checked) => updateSetting('lowStockWarning', checked)} />
            <Toggle checked={settings.allowSellOutOfStock} label="Cho phép bán vượt tồn kho" onChange={(checked) => updateSetting('allowSellOutOfStock', checked)} />
          </div>
        </Panel>

        <Panel icon={<HiOutlineCog />} title="Chuyển khoản VietQR">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Ngân hàng thụ hưởng"
              value={settings.bankBin}
              onChange={(value) => updateSetting('bankBin', value)}
              options={[
                { value: '', label: '-- Chọn ngân hàng --' },
                ...POPULAR_BANKS.map((b) => ({ value: b.bin, label: `${b.shortName} - ${b.name}` })),
              ]}
            />
            <TextField
              label="Số tài khoản thụ hưởng"
              value={settings.bankAccountNumber}
              onChange={(value) => updateSetting('bankAccountNumber', value)}
              placeholder="Nhập số tài khoản ngân hàng"
            />
            <TextField
              className="md:col-span-2"
              label="Tên chủ tài khoản thụ hưởng"
              value={settings.bankAccountName}
              onChange={(value) => updateSetting('bankAccountName', value)}
              placeholder="Ví dụ: NGUYEN VAN A (Chữ in hoa không dấu)"
            />
          </div>
        </Panel>

        <Panel className="xl:col-span-2" icon={<HiOutlineShieldCheck />} title="Phân quyền thao tác">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2">Tính năng</th>
                  <th className="px-3 py-2 text-center">Quản trị viên</th>
                  <th className="px-3 py-2 text-center">Quản lý</th>
                  <th className="px-3 py-2 text-center">Thu ngân</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                {[
                  ['Dashboard tổng quan', true, true, false],
                  ['Bán hàng POS', true, true, true],
                  ['Thêm / sửa sản phẩm', true, true, false],
                  ['Xóa sản phẩm', true, true, false],
                  ['Quản lý nhân viên', true, true, false],
                  ['Báo cáo doanh thu', true, true, false],
                  ['Cài đặt vận hành', true, false, false],
                ].map(([feature, admin, manager, cashier]) => (
                  <tr key={String(feature)}>
                    <td className="px-3 py-2">{feature}</td>
                    <PermissionCell enabled={Boolean(admin)} />
                    <PermissionCell enabled={Boolean(manager)} />
                    <PermissionCell enabled={Boolean(cashier)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel icon={<HiOutlineCog />} title="Dữ liệu cấu hình">
          <div className="space-y-3">
            <button onClick={exportSettings} className="w-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
              Xuất file cấu hình JSON
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
              Nhập file cấu hình JSON
            </button>
            <div className="border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
              Cài đặt được lưu trên hệ thống và áp dụng cho các tài khoản quản trị/quản lý.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};

const Panel = ({
  title,
  icon,
  children,
  className = '',
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <section className={`border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
      <span className="h-5 w-5 text-blue-600">{icon}</span>
      <h2 className="text-sm font-black uppercase text-slate-700">{title}</h2>
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) => (
  <label className={`space-y-1.5 ${className}`}>
    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
      placeholder={placeholder}
    />
  </label>
);

const TextAreaField = ({
  label,
  value,
  onChange,
  placeholder,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) => (
  <label className={`space-y-1.5 ${className}`}>
    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-24 w-full resize-none border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
      placeholder={placeholder}
    />
  </label>
);

const NumberField = ({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) => (
  <label className="space-y-1.5">
    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
    />
  </label>
);

const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) => (
  <label className="space-y-1.5">
    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const Toggle = ({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 border border-slate-200 bg-white px-3 py-2.5">
    <span className="text-xs font-bold text-slate-700">{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
    />
  </label>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="font-semibold text-slate-500">{label}</p>
    <p className="mt-1 font-black text-slate-900">{value}</p>
  </div>
);

const PermissionCell = ({ enabled }: { enabled: boolean }) => (
  <td className={`px-3 py-2 text-center font-black ${enabled ? 'text-emerald-600' : 'text-slate-300'}`}>
    {enabled ? 'Có' : 'Không'}
  </td>
);

export default SettingsPage;
