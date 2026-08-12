import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlineLockClosed } from 'react-icons/hi';
import { authAPI } from '../../services/auth.api';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      toast.error('Liên kết khôi phục không hợp lệ');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới tối thiểu 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword({ token, newPassword });
      toast.success('Đặt lại mật khẩu thành công');
      navigate('/login', { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Liên kết đã hết hạn hoặc không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_40px_rgba(15,23,42,0.08)] sm:p-8">
        <Link to="/login" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600">
          <HiOutlineArrowLeft className="h-4 w-4" />
          Quay lại đăng nhập
        </Link>
        <div className="mt-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">SORA POS</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Đặt mật khẩu mới</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Mật khẩu mới cần tối thiểu 8 ký tự.</p>
        </div>

        {!token ? (
          <div className="mt-7 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-800">
            Liên kết khôi phục không có mã hoặc đã bị cắt. Hãy yêu cầu gửi lại email khôi phục.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Mật khẩu mới</span>
              <span className="relative block">
                <HiOutlineLockClosed className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Nhập lại mật khẩu mới</span>
              <span className="relative block">
                <HiOutlineLockClosed className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                />
              </span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
