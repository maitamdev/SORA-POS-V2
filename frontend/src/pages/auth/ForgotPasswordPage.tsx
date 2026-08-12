import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlineMail } from 'react-icons/hi';
import { authAPI } from '../../services/auth.api';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error('Vui lòng nhập email tài khoản');
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword({ email: email.trim() });
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể gửi yêu cầu. Vui lòng thử lại');
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
          <h1 className="mt-2 text-2xl font-black text-slate-900">Quên mật khẩu?</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Nhập email tài khoản. Nếu tài khoản tồn tại, hệ thống sẽ gửi liên kết đặt lại mật khẩu.
          </p>
        </div>

        {submitted ? (
          <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">
            Hãy kiểm tra hộp thư và cả mục thư rác. Liên kết khôi phục có hiệu lực trong 15 phút.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Email tài khoản</span>
              <span className="relative block">
                <HiOutlineMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@sorapos.vn"
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                />
              </span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Đang gửi...' : 'Gửi liên kết khôi phục'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
