import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import { loginSchema, LoginFormData } from '../../validations/login.schema';
import { useAuthStore } from '../../stores/auth.store';

/* ═══════════════════════════════════════════════════
   Color palette — extracted from Sora POS logo
   ═══════════════════════════════════════════════════
   Navy Dark:    #0c1a3a  (backgrounds)
   Navy Mid:     #142244  (surfaces/cards)
   Navy Border:  #1e3460  (borders)
   Blue Primary: #1b4d8e  (brand primary)
   Blue Bright:  #3b8fd4  (accents/links)
   Blue Sky:     #6bbce8  (highlights)
   Orange:       #e85a3a  (alerts/CTAs)
   Text Light:   #dce4f0  (primary text)
   Text Muted:   #7a8eae  (secondary text)
   ═══════════════════════════════════════════════════ */

const C = {
  bgDeep: '#091530',
  bgSurface: '#0d1c38',
  cardBg: '#111f40',
  cardBorder: '#1a3058',
  inputBg: '#0e1a36',
  inputBorder: '#1e3460',
  inputFocus: '#3b8fd4',
  navyPrimary: '#1b4d8e',
  blueBright: '#3b8fd4',
  blueSky: '#6bbce8',
  blueGlow: 'rgba(59,143,212,0.15)',
  orange: '#e85a3a',
  orangeGlow: 'rgba(232,90,58,0.15)',
  textPrimary: '#dce4f0',
  textSecondary: '#7a8eae',
  textMuted: '#4a5f80',
  errorRed: '#ff6b6b',
  white: '#ffffff',
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [focusField, setFocusField] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
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
      toast.error(err?.response?.data?.message || 'Đăng nhập thất bại');
    }
  };

  const inputStyle = (field: string, hasError: boolean) => ({
    backgroundColor: C.inputBg,
    border: `1.5px solid ${
      hasError ? C.errorRed : focusField === field ? C.blueBright : C.inputBorder
    }`,
    borderRadius: '0px',
    color: C.textPrimary,
    padding: '13px 16px',
    fontSize: '14px',
    lineHeight: '20px',
    boxShadow:
      focusField === field
        ? `0 0 0 3px ${C.blueGlow}, 0 1px 3px rgba(0,0,0,0.2)`
        : hasError
        ? `0 0 0 3px rgba(255,107,107,0.06)`
        : '0 1px 3px rgba(0,0,0,0.15)',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  });

  return (
    <div
      className="flex min-h-screen antialiased"
      style={{ fontFamily: "'Montserrat', Arial, sans-serif", backgroundColor: C.bgDeep }}
    >
      {/* ════════════════════════════════════════════════ */}
      {/* LEFT PANEL — Hero                               */}
      {/* ════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden"
        style={{ backgroundColor: '#050d22', borderRight: `1px solid ${C.cardBorder}` }}
      >
        {/* Brand visual */}
        <div
          className="absolute inset-0 bg-no-repeat opacity-85"
          style={{
            backgroundImage: `url('/assets/image.png')`,
            backgroundSize: 'contain',
            backgroundPosition: 'right center',
          }}
        />
        {/* Gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(135deg, rgba(9,21,48,0.94) 0%, rgba(9,21,48,0.55) 40%, transparent 70%),
              linear-gradient(to top, rgba(9,21,48,0.97) 0%, transparent 40%)
            `,
          }}
        />

        {/* Version badge */}
        <div className="absolute top-8 left-8 z-10">
          <div
            className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest"
            style={{
              backgroundColor: 'rgba(27,77,142,0.2)',
              color: C.blueBright,
              border: `1px solid rgba(59,143,212,0.25)`,
            }}
          >
            v2.0
          </div>
        </div>

        {/* Hero content */}
        <div className="absolute inset-0 flex flex-col justify-center items-start pl-12 pr-20 z-10">
          <div className="space-y-6 max-w-lg">
            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {['POS', 'Inventory', 'Alerts'].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded text-[11px] font-semibold"
                  style={{
                    backgroundColor: 'rgba(107,188,232,0.08)',
                    color: C.blueSky,
                    border: '1px solid rgba(107,188,232,0.15)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            <h2
              className="text-[38px] leading-[46px] font-extrabold tracking-tight"
              style={{ color: C.textPrimary }}
            >
              Sora POS
              <br />
              <span style={{ color: C.orange }}>Quản lý</span>{' '}
              <span style={{ color: C.blueSky }}>bán hàng.</span>
            </h2>

            <p className="text-[15px] leading-7 max-w-md" style={{ color: C.textSecondary }}>
              Quản lý bán hàng tại quầy, kiểm soát tồn kho thời gian thực, cảnh báo sắp hết hàng
              — tất cả trong một hệ thống.
            </p>

            {/* Modules */}
            <div className="flex flex-wrap gap-3 pt-4">
              {[
                { label: 'Bán hàng tại quầy', color: C.blueSky },
                { label: 'Quản lý tồn kho', color: C.blueBright },
                { label: 'Báo cáo vận hành', color: C.orange },
              ].map((item) => (
                <span
                  key={item.label}
                  className="rounded border px-3 py-2 text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    color: item.color,
                    borderColor: 'rgba(107,188,232,0.18)',
                    backgroundColor: 'rgba(107,188,232,0.06)',
                  }}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 left-8 z-10">
          <p className="text-[11px] font-medium" style={{ color: C.textMuted }}>
            Powered by Sora Technologies
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/* RIGHT PANEL — Login Form                        */}
      {/* ════════════════════════════════════════════════ */}
      <div
        className="w-full lg:w-[45%] flex flex-col justify-center items-center relative overflow-hidden px-6 sm:px-10"
        style={{ backgroundColor: C.bgSurface }}
      >
        {/* Ambient orbs */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(27,77,142,0.08) 0%, transparent 70%)`,
            top: '-150px',
            right: '-100px',
            animation: 'orbFloat1 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(232,90,58,0.04) 0%, transparent 70%)`,
            bottom: '-100px',
            left: '-80px',
            animation: 'orbFloat2 10s ease-in-out infinite',
          }}
        />
        <div className="absolute inset-0 grid-pattern" />

        {/* ──── Login Card ──── */}
        <div
          className={`w-full max-w-[400px] flex flex-col relative z-10 ${
            isShaking ? 'animate-shake' : ''
          }`}
          style={{
            backgroundColor: C.cardBg,
            border: `1px solid ${C.cardBorder}`,
            borderRadius: '0px',
            padding: '36px',
            boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 1px rgba(59,143,212,0.1)`,
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-2">
            <img src="/assets/logo.png" alt="Sora POS" className="w-28 h-28 object-contain" />
          </div>
          <p className="text-[13px] mb-7 text-center" style={{ color: C.textSecondary }}>
            Đăng nhập để bắt đầu phiên làm việc
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ backgroundColor: C.cardBorder }} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ color: C.textMuted }}
            >
              Xác thực tài khoản
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: C.cardBorder }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="login-email"
                className="text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{ color: C.textSecondary }}
              >
                Mã đăng nhập / Email
              </label>
              <input
                {...register('email')}
                id="login-email"
                type="text"
                inputMode="text"
                placeholder="Nhập mã đăng nhập hoặc email"
                autoComplete="username"
                onFocus={() => setFocusField('email')}
                onBlur={() => setFocusField(null)}
                className="w-full outline-none"
                style={inputStyle('email', !!errors.email)}
              />
              {errors.email && (
                <p className="text-[11px] font-semibold" style={{ color: C.errorRed }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="login-password"
                className="text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{ color: C.textSecondary }}
              >
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu bảo mật"
                  autoComplete="current-password"
                  onFocus={() => setFocusField('password')}
                  onBlur={() => setFocusField(null)}
                  className="w-full outline-none pr-12"
                  style={inputStyle('password', !!errors.password)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded transition-all duration-200"
                  style={{ color: C.textMuted }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = C.blueSky;
                    e.currentTarget.style.backgroundColor = 'rgba(107,188,232,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = C.textMuted;
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <HiOutlineEyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <HiOutlineEye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] font-semibold" style={{ color: C.errorRed }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  className="w-[18px] h-[18px] rounded-sm cursor-pointer appearance-none"
                  style={{
                    backgroundColor: C.inputBg,
                    border: `1.5px solid ${C.inputBorder}`,
                    accentColor: C.blueBright,
                  }}
                />
                <span
                  className="text-[13px] font-medium transition-colors"
                  style={{ color: C.textSecondary }}
                >
                  Ghi nhớ đăng nhập
                </span>
              </label>
              <a
                href="#recover"
                className="text-[12px] font-semibold transition-all duration-200"
                style={{ color: C.blueBright }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = C.blueSky;
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = C.blueBright;
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Quên mật khẩu?
              </a>
            </div>

            {/* Submit — Navy-to-Blue gradient matching logo */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 font-bold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] mt-1"
              style={{
                background: isLoading
                  ? C.navyPrimary
                  : `linear-gradient(135deg, ${C.navyPrimary} 0%, ${C.blueBright} 100%)`,
                color: C.white,
                padding: '14px 20px',
                borderRadius: '0px',
                border: 'none',
                fontSize: '14px',
                letterSpacing: '0.02em',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: `0 4px 20px rgba(27,77,142,0.35), 0 1px 3px rgba(0,0,0,0.3)`,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${C.blueBright} 0%, ${C.blueSky} 100%)`;
                  e.currentTarget.style.boxShadow = `0 6px 30px rgba(59,143,212,0.4)`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${C.navyPrimary} 0%, ${C.blueBright} 100%)`;
                e.currentTarget.style.boxShadow = `0 4px 20px rgba(27,77,142,0.35), 0 1px 3px rgba(0,0,0,0.3)`;
              }}
            >
              {isLoading ? (
                <>
                  <div
                    className="w-5 h-5 rounded-full animate-spin"
                    style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                  />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-[18px] h-[18px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                  </svg>
                  <span>Đăng nhập</span>
                </>
              )}
            </button>
          </form>

          {/* Status bar */}
          <div
            className="flex items-center justify-between mt-7 pt-5"
            style={{ borderTop: `1px solid ${C.cardBorder}` }}
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#22c55e' }}
                />
                <div
                  className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-40"
                  style={{ backgroundColor: '#22c55e' }}
                />
              </div>
              <span className="text-[11px] font-medium" style={{ color: C.textMuted }}>
                Hệ thống hoạt động
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: C.orange }}
              />
              <span
                className="text-[10px] font-mono font-medium"
                style={{ color: C.textMuted }}
              >
                v2.0.0
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-5 w-full text-center">
          <p className="text-[11px] font-medium" style={{ color: C.textMuted }}>
            © 2026 Sora POS
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
