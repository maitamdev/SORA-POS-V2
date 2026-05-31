import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import { loginSchema, LoginFormData } from '../../validations/login.schema';
import { useAuthStore } from '../../stores/auth.store';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      toast.success('Đăng nhập thành công! 🎉');
      navigate('/', { replace: true });
    } catch (error: unknown) {
      // Shake animation khi lỗi
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      // Hiển thị lỗi
      const err = error as { response?: { data?: { message?: string } } };
      const message = err?.response?.data?.message || 'Đăng nhập thất bại';
      toast.error(message);
    }
  };

  // Demo auto-fill
  const fillDemoAccount = (role: 'admin' | 'manager' | 'cashier') => {
    const accounts = {
      admin: { email: 'admin@sorapos.com', password: 'password123' },
      manager: { email: 'manager@sorapos.com', password: 'password123' },
      cashier: { email: 'cashier@sorapos.com', password: 'password123' },
    };
    const account = accounts[role];
    setValue('email', account.email);
    setValue('password', account.password);
    toast.success(`Đã điền tài khoản ${role}`, { icon: '👤' });
  };

  return (
    <div className="login-bg min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary-500/5 blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 blur-3xl"></div>

        <div className="relative z-10 text-center max-w-md">
          {/* Logo */}
          <div className="w-20 h-20 bg-primary-600 flex items-center justify-center mx-auto mb-8 animate-float">
            <span className="text-white font-bold text-4xl">S</span>
          </div>

          <h1 className="text-5xl font-bold text-white mb-4">
            Sora <span className="text-primary-400">POS</span>
          </h1>
          <p className="text-xl text-slate-400 mb-8 leading-relaxed">
            Hệ thống quản lý bán hàng tại quầy
            <br />
            <span className="text-primary-400">tích hợp quản lý kho thông minh</span>
          </p>

          {/* Feature highlights */}
          <div className="space-y-4 text-left">
            {[
              { emoji: '🛒', text: 'Bán hàng tại quầy nhanh chóng' },
              { emoji: '📦', text: 'Quản lý kho hàng chuyên nghiệp' },
              { emoji: '⚠️', text: 'Cảnh báo tồn kho thấp tự động' },
              { emoji: '📊', text: 'Thống kê doanh thu trực quan' },
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-slate-300 animate-fadeIn"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <span className="text-2xl">{feature.emoji}</span>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className={`login-card w-full max-w-md p-8 transition-all duration-300 ${isShaking ? 'animate-shake' : ''}`}>
          {/* Header */}
          <div className="text-center mb-8">
            {/* Mobile logo */}
            <div className="lg:hidden w-14 h-14 bg-primary-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">S</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Đăng nhập</h2>
            <p className="text-slate-400 text-sm">Nhập thông tin tài khoản để tiếp tục</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <div className="relative">
                <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="example@sorapos.com"
                  className={`w-full pl-11 pr-4 py-3 bg-slate-800/50 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all ${
                    errors.email ? 'border-red-500' : 'border-slate-700'
                  }`}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <HiOutlineLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  className={`w-full pl-11 pr-12 py-3 bg-slate-800/50 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all ${
                    errors.password ? 'border-red-500' : 'border-slate-700'
                  }`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-primary-600 text-white font-semibold hover:bg-primary-700 focus:ring-4 focus:ring-primary-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin"></div>
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[#0d1424] text-slate-500">Tài khoản Demo</span>
            </div>
          </div>

          {/* Demo Account Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { role: 'admin' as const, label: 'Admin', color: 'from-blue-600 to-blue-700' },
              { role: 'manager' as const, label: 'Manager', color: 'from-emerald-600 to-emerald-700' },
              { role: 'cashier' as const, label: 'Cashier', color: 'from-amber-600 to-amber-700' },
            ].map((item) => (
              <button
                key={item.role}
                type="button"
                onClick={() => fillDemoAccount(item.role)}
                className={`py-2 text-xs font-medium text-white bg-gradient-to-r ${item.color} hover:opacity-90 transition-opacity`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-600 mt-6">
            © 2026 Sora POS — Đồ Án Cơ Sở
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
