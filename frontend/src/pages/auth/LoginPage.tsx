import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { HiOutlineEye, HiOutlineEyeOff, HiOutlineMail, HiOutlineLockClosed } from 'react-icons/hi';
import { loginSchema, LoginFormData } from '../../validations/login.schema';
import { useAuthStore } from '../../stores/auth.store';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [focusField, setFocusField] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      toast.success('Đăng nhập thành công!');
      navigate('/', { replace: true });
    } catch (error: unknown) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại!');
    }
  };

  const triggerDemo = async () => {
    setValue('email', 'demo@sora-pos.com');
    setValue('password', 'demo123');
    try {
      await login('demo@sora-pos.com', 'demo123');
      toast.success('Đăng nhập với tài khoản Demo thành công!');
      navigate('/', { replace: true });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Đăng nhập Demo thất bại');
    }
  };

  return (
    <div className="sora-modern-ui flex min-h-screen w-full bg-slate-50 antialiased overflow-hidden font-sans">
      {/* LEFT COLUMN - Green Warehouse visual */}
      <div 
        className="hidden lg:block lg:w-[55%] relative overflow-hidden"
        style={{
          backgroundImage: `url('/assets/sora_pos_green_warehouse_left.png')`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'left center',
        }}
      />

      {/* RIGHT COLUMN - Curve Split & Interactive Login Form Card */}
      <div 
        className="w-full lg:w-[45%] flex flex-col justify-center items-center relative px-6 sm:px-12 bg-white"
      >
        {/* Soft abstract green/white curves matching the background design on the right */}
        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none hidden lg:block" />

        {/* Rounded Modern Login Card */}
        <div 
          className={`w-full max-w-[420px] bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-2xl shadow-emerald-950/5 flex flex-col ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
          {/* SORA-POS Badge Header inside Card */}
          <div className="flex flex-col items-center mb-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md border border-slate-100 p-2.5 mb-2.5">
              <img src="/assets/logo.png" alt="SORA-POS Logo" className="h-full w-full object-contain" />
            </div>
            <h1 className="font-extrabold text-xl tracking-tight text-slate-800">SORA-POS</h1>
            <h2 className="text-lg font-bold text-slate-900 mt-1">Chào mừng trở lại</h2>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Đăng nhập để tiếp tục quản lý bán hàng hiệu quả</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* Email/Login ID Input */}
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-[11px] font-bold text-slate-600 tracking-wide">
                Mã đăng nhập / Email
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <HiOutlineMail className="h-4.5 w-4.5" />
                </span>
                <input
                  {...register('email')}
                  id="email"
                  type="text"
                  placeholder="nhanvien@sorapos.vn"
                  autoComplete="username"
                  onFocus={() => setFocusField('email')}
                  onBlur={() => setFocusField(null)}
                  className={`w-full bg-slate-50/50 pl-10 pr-4 py-2.5 rounded-xl border text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 ${
                    errors.email
                      ? 'border-red-300 bg-red-50/10 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                      : focusField === 'email'
                      ? 'border-emerald-500 bg-white ring-4 ring-emerald-100/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-[10px] font-bold text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[11px] font-bold text-slate-600 tracking-wide">
                  Mật khẩu
                </label>
                <a
                  href="#recover"
                  className="text-[10px] font-bold text-emerald-600 transition-colors duration-200 hover:text-emerald-700 hover:underline"
                >
                  Quên mật khẩu?
                </a>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <HiOutlineLockClosed className="h-4.5 w-4.5" />
                </span>
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  onFocus={() => setFocusField('password')}
                  onBlur={() => setFocusField(null)}
                  className={`w-full bg-slate-50/50 pl-10 pr-10 py-2.5 rounded-xl border text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 ${
                    errors.password
                      ? 'border-red-300 bg-red-50/10 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                      : focusField === 'password'
                      ? 'border-emerald-500 bg-white ring-4 ring-emerald-100/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:bg-slate-100/80 hover:text-slate-600 transition-all duration-200"
                >
                  {showPassword ? (
                    <HiOutlineEyeOff className="h-4 w-4" />
                  ) : (
                    <HiOutlineEye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-[10px] font-bold text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me Toggle */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer accent-emerald-600"
                />
                <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-700 transition-colors duration-200">
                  Ghi nhớ đăng nhập
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 px-4 text-sm font-extrabold text-white shadow-md shadow-emerald-600/20 transition-all duration-200 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-700/25 active:scale-[0.985] disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">hoặc</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* QR Code / Demo Login Action Button */}
          <button
            type="button"
            onClick={triggerDemo}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-600/20 bg-white py-3 px-4 text-xs font-bold text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-50/50 hover:border-emerald-600/35 active:scale-[0.985]"
          >
            <svg 
              width={18} 
              height={18} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-emerald-600 shrink-0"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M7 7h.01M17 7h.01M17 17h.01M7 17h.01" />
            </svg>
            <span>Đăng nhập bằng mã QR (Dùng Demo)</span>
          </button>

          {/* Bottom Card Footer */}
          <div className="flex items-center justify-center gap-1.5 mt-8 pt-5 border-t border-slate-100 text-slate-400 text-xs">
            <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="font-bold text-slate-500">Kết nối an toàn & bảo mật dữ liệu</span>
          </div>
        </div>

        {/* Footer info under card */}
        <div className="absolute bottom-5 text-center text-slate-400 text-xs font-bold">
          © 2026 SORA-POS
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

