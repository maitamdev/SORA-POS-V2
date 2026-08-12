import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineCheckCircle,
  HiOutlineCog,
  HiOutlineCube,
  HiOutlineDatabase,
  HiOutlineDownload,
  HiOutlineExclamationCircle,
  HiOutlineInformationCircle,
  HiOutlineOfficeBuilding,
  HiOutlinePrinter,
  HiOutlineRefresh,
  HiOutlineShieldCheck,
  HiOutlineUpload,
} from 'react-icons/hi';
import {
  defaultOperationSettings,
  normalizeOperationSettings,
  OperationSettings,
  settingsAPI,
  subscribeOperationSettings,
} from '../../services/settings.api';
import { useAuthStore } from '../../stores/auth.store';
import { getRoleLabel } from '../../utils/userDisplay';
import { POPULAR_BANKS } from '../../utils/banks';

type SettingsSection = {
  id: string;
  label: string;
  description: string;
  icon: typeof HiOutlineCog;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'store', label: 'Cửa hàng', description: 'Thông tin hiển thị trên hóa đơn', icon: HiOutlineOfficeBuilding },
  { id: 'pos', label: 'POS', description: 'Thanh toán và thao tác bán hàng', icon: HiOutlineCog },
  { id: 'receipts', label: 'Hóa đơn', description: 'In ấn và lời cảm ơn', icon: HiOutlinePrinter },
  { id: 'inventory', label: 'Kho hàng', description: 'Ngưỡng tồn và bán âm kho', icon: HiOutlineCube },
  { id: 'vietqr', label: 'VietQR', description: 'Tài khoản nhận chuyển khoản', icon: HiOutlineCog },
  { id: 'permissions', label: 'Quyền thao tác', description: 'Quyền cố định theo vai trò', icon: HiOutlineShieldCheck },
  { id: 'data', label: 'Dữ liệu', description: 'Nhập và xuất cấu hình', icon: HiOutlineDatabase },
];

const permissionRows: Array<[string, boolean, boolean, boolean]> = [
  ['Dashboard tổng quan', true, true, false],
  ['Bán hàng POS', true, true, true],
  ['Thêm / sửa sản phẩm', true, true, false],
  ['Xóa sản phẩm', true, true, false],
  ['Quản lý nhân viên', true, true, false],
  ['Báo cáo doanh thu', true, true, false],
  ['Cài đặt vận hành', true, false, false],
];

const fieldClassName =
  'w-full border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

const SettingsPage = () => {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<OperationSettings>(() => normalizeOperationSettings(defaultOperationSettings));
  const [savedSettings, setSavedSettings] = useState<OperationSettings>(() => normalizeOperationSettings(defaultOperationSettings));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [savedSettings, settings]
  );

  const updateSetting = <K extends keyof OperationSettings>(key: K, value: OperationSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const applyLoadedSettings = (value: unknown, nextUpdatedAt?: string | null) => {
    const nextSettings = normalizeOperationSettings(value);
    setSettings(nextSettings);
    setSavedSettings(nextSettings);
    setUpdatedAt(nextUpdatedAt ?? null);
    setLoadError('');
  };

  useEffect(() => {
    let mounted = true;

    settingsAPI
      .getOperation()
      .then((response) => {
        if (!mounted) return;
        applyLoadedSettings(response.data.data.settings, response.data.data.updated_at);
      })
      .catch((error) => {
        if (!mounted) return;
        const message = error.response?.data?.message || 'Không tải được cài đặt từ hệ thống';
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const unsubscribe = subscribeOperationSettings((nextSettings) => {
      if (!mounted) return;
      applyLoadedSettings(nextSettings, new Date().toISOString());
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const saveSettings = async () => {
    if (saving || loading) return;

    try {
      setSaving(true);
      const normalized = normalizeOperationSettings(settings);
      const response = await settingsAPI.updateOperation(normalized);
      const saved = normalizeOperationSettings(response.data.data.settings);
      applyLoadedSettings(saved, response.data.data.updated_at);
      toast.success('Đã lưu và áp dụng cài đặt cho POS');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lưu cài đặt thất bại');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings(normalizeOperationSettings(defaultOperationSettings));
    toast.success('Đã đưa biểu mẫu về mặc định. Bấm Lưu để áp dụng.');
  };

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(normalizeOperationSettings(settings), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sora-pos-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã xuất cấu hình hiện tại');
  };

  const importSettings = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result || '{}'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('invalid-settings-file');
        }
        setSettings(normalizeOperationSettings(parsed));
        toast.success('Đã nhập cấu hình vào biểu mẫu. Bấm Lưu để áp dụng.');
      } catch {
        toast.error('File cấu hình không hợp lệ hoặc thiếu tên cửa hàng');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const statusLabel = loading ? 'Đang tải' : isDirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ';
  const statusClass = loading
    ? 'border-slate-200 bg-slate-100 text-slate-600'
    : isDirty
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div className="space-y-6 pb-24">
      <header className="sticky top-0 z-20 -mx-3 border-b border-slate-200/80 bg-slate-50/95 px-3 py-4 backdrop-blur sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">
              <span className="inline-flex items-center gap-1.5">
                <HiOutlineCog className="h-4 w-4" />
                Quản trị hệ thống
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500">Cấu hình vận hành</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Cài đặt vận hành</h1>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-500">
              Quản lý thông tin cửa hàng, POS, hóa đơn, kho và các quy tắc áp dụng cho quầy bán hàng.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
            <div className={`inline-flex items-center justify-center gap-2 border px-3 py-2 text-xs font-black ${statusClass}`}>
              {loading ? <HiOutlineRefresh className="h-4 w-4 animate-spin" /> : isDirty ? <HiOutlineExclamationCircle className="h-4 w-4" /> : <HiOutlineCheckCircle className="h-4 w-4" />}
              {statusLabel}
            </div>
            <button type="button" onClick={exportSettings} className="action-button">
              <HiOutlineDownload className="h-4 w-4" />
              Xuất
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="action-button">
              <HiOutlineUpload className="h-4 w-4" />
              Nhập
            </button>
            <button type="button" onClick={resetSettings} className="action-button" disabled={loading}>
              <HiOutlineRefresh className="h-4 w-4" />
              Mặc định
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving || loading || !isDirty}
              className="inline-flex min-h-10 items-center justify-center gap-2 bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <HiOutlineRefresh className="h-4 w-4 animate-spin" /> : <HiOutlineCheckCircle className="h-4 w-4" />}
              {saving ? 'Đang lưu...' : 'Lưu và áp dụng'}
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={importSettings} className="hidden" />
          </div>
        </div>
      </header>

      {loadError && (
        <div className="flex items-start gap-3 border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          <HiOutlineExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Không tải được cấu hình hiện tại</p>
            <p className="mt-1 font-medium">{loadError}. Bạn có thể sửa theo mặc định rồi thử lưu lại.</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid gap-4 xl:grid-cols-2" aria-live="polite" aria-busy="true">
          <LoadingPanel />
          <LoadingPanel />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <div className="sticky top-28 space-y-4">
            <nav className="border border-slate-200 bg-white p-2 shadow-sm" aria-label="Mục cài đặt">
              <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Mục cài đặt</p>
              <div className="space-y-0.5">
                {SETTINGS_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  return (
                    <a key={section.id} href={`#${section.id}`} className="group flex items-start gap-2 border-l-2 border-transparent px-3 py-2.5 text-slate-600 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-black">{section.label}</span>
                        <span className="mt-0.5 block text-[10px] font-medium leading-4 text-slate-400 group-hover:text-blue-500">{section.description}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </nav>

            <AccountCard user={user} sessionLockMinutes={settings.sessionLockMinutes} updatedAt={updatedAt} />
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Trạng thái" value={isDirty ? 'Chưa áp dụng' : 'Đã áp dụng'} tone={isDirty ? 'amber' : 'emerald'} />
            <SummaryCard label="Phương thức mặc định" value={paymentMethodLabel(settings.defaultPaymentMethod)} tone="blue" />
            <SummaryCard label="Tự khóa phiên" value={`${settings.sessionLockMinutes} phút`} tone="slate" />
          </div>

          <div className="border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
            <div className="flex items-start gap-3">
              <HiOutlineInformationCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="font-black">Cách áp dụng cấu hình</p>
                <p className="mt-1 font-medium leading-5 text-blue-800">
                  Thay đổi chỉ có hiệu lực sau khi bấm “Lưu và áp dụng”. POS, in hóa đơn và phiên đăng nhập sẽ nhận cấu hình mới ngay trong tab hiện tại.
                </p>
              </div>
            </div>
          </div>

          <SettingsPanel id="store" icon={<HiOutlineOfficeBuilding />} title="Thông tin cửa hàng" description="Dùng ở phần đầu hóa đơn và làm thông tin nhận diện của chi nhánh.">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField id="store-name" label="Tên cửa hàng" required value={settings.storeName} onChange={(value) => updateSetting('storeName', value)} placeholder="Ví dụ: SORA MART" />
              <TextField id="branch-name" label="Chi nhánh" value={settings.branchName} onChange={(value) => updateSetting('branchName', value)} placeholder="Nhập tên chi nhánh nếu có" />
              <TextField id="tax-code" label="Mã số thuế" value={settings.taxCode} onChange={(value) => updateSetting('taxCode', value)} placeholder="Nhập mã số thuế" />
              <TextField id="business-hours" label="Giờ hoạt động" value={settings.businessHours} onChange={(value) => updateSetting('businessHours', value)} placeholder="08:00 - 22:00" />
              <TextField id="store-address" className="md:col-span-2" label="Địa chỉ" value={settings.address} onChange={(value) => updateSetting('address', value)} placeholder="Nhập địa chỉ in trên hóa đơn" />
              <TextField id="hotline" label="Hotline" value={settings.hotline} onChange={(value) => updateSetting('hotline', value)} placeholder="Nhập số điện thoại cửa hàng" />
              <SelectField id="currency" label="Tiền tệ" value={settings.currency} onChange={(value) => updateSetting('currency', value)} options={[{ value: 'VND', label: 'VND - Việt Nam đồng' }, { value: 'USD', label: 'USD - Đô la Mỹ' }]} />
              <SelectField id="locale" label="Định dạng số và ngày" value={settings.locale} onChange={(value) => updateSetting('locale', value)} options={[{ value: 'vi-VN', label: 'Tiếng Việt (vi-VN)' }, { value: 'en-US', label: 'English (en-US)' }]} />
            </div>
          </SettingsPanel>

          <SettingsPanel id="pos" icon={<HiOutlineCog />} title="POS" description="Điều khiển tốc độ thao tác, cách thanh toán và quy tắc giảm giá tại quầy.">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField id="default-payment-method" label="Thanh toán mặc định" value={settings.defaultPaymentMethod} onChange={(value) => updateSetting('defaultPaymentMethod', value as OperationSettings['defaultPaymentMethod'])} options={[{ value: 'cash', label: 'Tiền mặt' }, { value: 'transfer', label: 'Chuyển khoản QR' }, { value: 'card', label: 'Thẻ ngân hàng' }]} />
              <NumberField id="product-page-size" label="Số sản phẩm mỗi trang POS" value={settings.productPageSize} onChange={(value) => updateSetting('productPageSize', value)} min={8} max={100} hint="Tải lại danh sách sản phẩm theo số lượng này." />
              <NumberField id="max-discount-percent" label="Giảm giá tối đa (%)" value={settings.maxDiscountPercent} onChange={(value) => updateSetting('maxDiscountPercent', value)} min={0} max={100} />
              <NumberField id="session-lock-minutes" label="Tự khóa phiên sau (phút)" value={settings.sessionLockMinutes} onChange={(value) => updateSetting('sessionLockMinutes', value)} min={5} max={240} hint="Tự đăng xuất khi không có thao tác." />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Toggle checked={settings.allowDiscount} label="Cho phép chiết khấu đơn hàng" hint="Áp dụng giới hạn ở trên." onChange={(checked) => updateSetting('allowDiscount', checked)} />
              <Toggle checked={settings.barcodeAutoAdd} label="Quét mã vạch tự thêm vào giỏ" onChange={(checked) => updateSetting('barcodeAutoAdd', checked)} />
              <Toggle checked={settings.confirmBeforeCheckout} label="Xác nhận trước khi thanh toán" onChange={(checked) => updateSetting('confirmBeforeCheckout', checked)} />
              <Toggle checked={settings.compactMode} label="Giao diện POS thu gọn" hint="Giảm khoảng cách để hiện nhiều sản phẩm hơn." onChange={(checked) => updateSetting('compactMode', checked)} />
            </div>
          </SettingsPanel>

          <SettingsPanel id="receipts" icon={<HiOutlinePrinter />} title="Hóa đơn và in ấn" description="Các lựa chọn bên dưới được dùng cho xem trước, in tự động và bản in nhiệt.">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField id="receipt-paper-size" label="Khổ giấy" value={settings.receiptPaperSize} onChange={(value) => updateSetting('receiptPaperSize', value as OperationSettings['receiptPaperSize'])} options={[{ value: 'k80', label: 'K80 - máy in nhiệt' }, { value: 'a5', label: 'A5 - giấy văn phòng' }]} />
              <NumberField id="receipt-copies" label="Số bản in" value={settings.receiptCopies} onChange={(value) => updateSetting('receiptCopies', value)} min={1} max={5} hint="Mỗi bản sẽ được ngắt sang một trang in riêng." />
              <TextAreaField id="receipt-footer" className="md:col-span-2" label="Lời cảm ơn cuối hóa đơn" value={settings.receiptFooter} onChange={(value) => updateSetting('receiptFooter', value)} placeholder="Nhập nội dung cuối hóa đơn" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Toggle checked={settings.autoPrintReceipt} label="Tự mở lệnh in sau thanh toán" hint="Tắt nếu muốn kiểm tra hóa đơn trước." onChange={(checked) => updateSetting('autoPrintReceipt', checked)} />
              <Toggle checked={settings.requireCustomerPhone} label="Bắt buộc nhập số điện thoại khách hàng" onChange={(checked) => updateSetting('requireCustomerPhone', checked)} />
            </div>
          </SettingsPanel>

          <SettingsPanel id="inventory" icon={<HiOutlineCube />} title="Kho hàng" description="Thiết lập mặc định cho cảnh báo tồn và kiểm soát bán hàng khi hết kho.">
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField id="default-min-stock-level" label="Ngưỡng tồn kho mặc định" value={settings.defaultMinStockLevel} onChange={(value) => updateSetting('defaultMinStockLevel', value)} min={0} max={9999} hint="Dùng khi tạo sản phẩm mới nếu chưa có ngưỡng riêng." />
              <div className="hidden md:block" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Toggle checked={settings.lowStockWarning} label="Cảnh báo khi tồn kho xuống thấp" onChange={(checked) => updateSetting('lowStockWarning', checked)} />
              <Toggle checked={settings.allowSellOutOfStock} label="Cho phép bán âm kho" hint="Chỉ nên bật khi cửa hàng có quy trình đối soát riêng." onChange={(checked) => updateSetting('allowSellOutOfStock', checked)} warning />
            </div>
          </SettingsPanel>

          <SettingsPanel id="vietqr" icon={<HiOutlineCog />} title="Chuyển khoản VietQR" description="Cần đủ ba trường để tạo mã QR tĩnh tại màn hình thanh toán.">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField id="bank-bin" label="Ngân hàng thụ hưởng" value={settings.bankBin} onChange={(value) => updateSetting('bankBin', value)} options={[{ value: '', label: '-- Chọn ngân hàng --' }, ...POPULAR_BANKS.map((bank) => ({ value: bank.bin, label: `${bank.shortName} - ${bank.name}` }))]} />
              <TextField id="bank-account-number" label="Số tài khoản thụ hưởng" value={settings.bankAccountNumber} onChange={(value) => updateSetting('bankAccountNumber', value)} placeholder="Nhập số tài khoản ngân hàng" />
              <TextField id="bank-account-name" className="md:col-span-2" label="Tên chủ tài khoản thụ hưởng" value={settings.bankAccountName} onChange={(value) => updateSetting('bankAccountName', value)} placeholder="Ví dụ: NGUYEN VAN A" />
            </div>
          </SettingsPanel>

          <SettingsPanel id="permissions" icon={<HiOutlineShieldCheck />} title="Phân quyền thao tác" description="Bảng quyền hiện tại để đối chiếu. Thay đổi vai trò được thực hiện tại mục Nhân viên.">
            <div className="overflow-x-auto border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-xs">
                <caption className="sr-only">Quyền thao tác theo vai trò</caption>
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Tính năng</th>
                    <th scope="col" className="px-4 py-3 text-center">Quản trị viên</th>
                    <th scope="col" className="px-4 py-3 text-center">Quản lý</th>
                    <th scope="col" className="px-4 py-3 text-center">Thu ngân</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {permissionRows.map(([feature, admin, manager, cashier]) => (
                    <tr key={feature} className="hover:bg-slate-50">
                      <th scope="row" className="px-4 py-3 text-left font-bold">{feature}</th>
                      <PermissionCell enabled={admin} />
                      <PermissionCell enabled={manager} />
                      <PermissionCell enabled={cashier} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SettingsPanel>

          <SettingsPanel id="data" icon={<HiOutlineDatabase />} title="Dữ liệu cấu hình" description="Sao lưu cấu hình hiện tại hoặc nạp một file JSON vào biểu mẫu đang chỉnh sửa.">
            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" onClick={exportSettings} className="secondary-button justify-center">
                <HiOutlineDownload className="h-4 w-4" />
                Xuất file JSON
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="secondary-button justify-center">
                <HiOutlineUpload className="h-4 w-4" />
                Nhập file JSON
              </button>
            </div>
            <div className="mt-4 flex items-start gap-3 border border-slate-200 bg-slate-50 p-3 text-xs font-medium leading-5 text-slate-600">
              <HiOutlineInformationCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              File nhập chỉ thay đổi biểu mẫu. Hãy kiểm tra lại và bấm “Lưu và áp dụng” để ghi lên hệ thống.
            </div>
          </SettingsPanel>
        </main>
      </div>
    </div>
  );
};

const paymentMethodLabel = (method: OperationSettings['defaultPaymentMethod']) => {
  if (method === 'transfer') return 'Chuyển khoản QR';
  if (method === 'card') return 'Thẻ ngân hàng';
  return 'Tiền mặt';
};

const LoadingPanel = () => (
  <div className="border border-slate-200 bg-white p-5 shadow-sm" aria-hidden="true">
    <div className="h-5 w-40 animate-pulse bg-slate-200" />
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div className="h-11 animate-pulse bg-slate-100" />
      <div className="h-11 animate-pulse bg-slate-100" />
      <div className="h-11 animate-pulse bg-slate-100" />
      <div className="h-11 animate-pulse bg-slate-100" />
    </div>
  </div>
);

const SummaryCard = ({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'emerald' | 'blue' | 'slate' }) => {
  const toneClass = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    slate: 'border-slate-200 bg-white text-slate-800',
  }[tone];

  return (
    <div className={`border p-4 shadow-sm ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 text-sm font-black">{value}</p>
    </div>
  );
};

const AccountCard = ({ user, sessionLockMinutes, updatedAt }: { user: ReturnType<typeof useAuthStore.getState>['user']; sessionLockMinutes: number; updatedAt: string | null }) => (
  <section className="border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
      <HiOutlineShieldCheck className="h-5 w-5 text-blue-600" />
      <h2 className="text-sm font-black text-slate-800">Tài khoản thao tác</h2>
    </div>
    <dl className="mt-4 space-y-3 text-xs">
      <InfoRow label="Họ tên" value={user?.full_name || 'Chưa có tên'} />
      <InfoRow label="Email" value={user?.email || 'Chưa có email'} />
      <InfoRow label="Vai trò" value={getRoleLabel(user?.role)} />
      <InfoRow label="Tự khóa phiên" value={`${sessionLockMinutes} phút`} />
      <InfoRow label="Cập nhật" value={updatedAt ? new Date(updatedAt).toLocaleString('vi-VN') : 'Chưa lưu'} />
    </dl>
  </section>
);

const SettingsPanel = ({ id, title, description, icon, children }: { id: string; title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-28 border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-blue-50 text-blue-600">{icon}</span>
      <div className="min-w-0">
        <h2 className="text-base font-black text-slate-900">{title}</h2>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{description}</p>
      </div>
    </div>
    <div className="mt-5">{children}</div>
  </section>
);

const TextField = ({ id, label, value, onChange, placeholder, className = '', hint, required = false }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; className?: string; hint?: string; required?: boolean }) => (
  <label className={`block space-y-1.5 ${className}`} htmlFor={id}>
    <span className="block text-xs font-black text-slate-600">
      {label}{required && <span className="ml-1 text-rose-600" aria-hidden="true">*</span>}
    </span>
    <input id={id} name={id} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={fieldClassName} />
    {hint && <span className="block text-[11px] font-medium leading-4 text-slate-400">{hint}</span>}
  </label>
);

const TextAreaField = ({ id, label, value, onChange, placeholder, className = '' }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) => (
  <label className={`block space-y-1.5 ${className}`} htmlFor={id}>
    <span className="block text-xs font-black text-slate-600">{label}</span>
    <textarea id={id} name={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${fieldClassName} min-h-24 resize-y`} />
  </label>
);

const NumberField = ({ id, label, value, onChange, min, max, hint }: { id: string; label: string; value: number; onChange: (value: number) => void; min: number; max: number; hint?: string }) => (
  <label className="block space-y-1.5" htmlFor={id}>
    <span className="block text-xs font-black text-slate-600">{label}</span>
    <input
      id={id}
      name={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      value={value}
      onChange={(event) => {
        const rawValue = event.target.value;
        const numericValue = rawValue === '' ? min : Number(rawValue);
        onChange(Number.isFinite(numericValue) ? Math.min(max, Math.max(min, Math.trunc(numericValue))) : min);
      }}
      className={fieldClassName}
    />
    {hint && <span className="block text-[11px] font-medium leading-4 text-slate-400">{hint}</span>}
  </label>
);

const SelectField = ({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) => (
  <label className="block space-y-1.5" htmlFor={id}>
    <span className="block text-xs font-black text-slate-600">{label}</span>
    <select id={id} name={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClassName}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
);

const Toggle = ({ checked, label, onChange, hint, warning = false }: { checked: boolean; label: string; onChange: (checked: boolean) => void; hint?: string; warning?: boolean }) => (
  <label className={`flex min-h-16 cursor-pointer items-center justify-between gap-4 border px-3 py-3 transition hover:border-blue-300 ${warning && checked ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
    <span className="min-w-0">
      <span className="block text-xs font-black text-slate-700">{label}</span>
      {hint && <span className="mt-1 block text-[11px] font-medium leading-4 text-slate-400">{hint}</span>}
    </span>
    <span className="relative shrink-0">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={`block h-6 w-11 border transition ${checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-slate-100'} peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2`}>
        <span className={`absolute top-1 h-4 w-4 bg-white shadow-sm transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
      <span className="sr-only">{checked ? 'Đang bật' : 'Đang tắt'}</span>
    </span>
  </label>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="font-semibold text-slate-400">{label}</dt>
    <dd className="mt-1 break-words font-black text-slate-800">{value}</dd>
  </div>
);

const PermissionCell = ({ enabled }: { enabled: boolean }) => (
  <td className={`px-4 py-3 text-center font-black ${enabled ? 'text-emerald-600' : 'text-slate-300'}`}>
    <span className="sr-only">{enabled ? 'Có quyền' : 'Không có quyền'}</span>
    <span aria-hidden="true">{enabled ? 'Có' : 'Không'}</span>
  </td>
);

export default SettingsPage;
