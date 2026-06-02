import { useAuthStore } from '../../stores/auth.store';

const SettingsPage = () => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-xl sm:text-2xl font-black text-slate-800">Cài đặt</h1>
        <p className="text-xs sm:text-sm font-medium text-slate-500">Thông tin vận hành hệ thống và cấu hình cần thiết.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-sm font-black uppercase text-slate-700">Tài khoản hiện tại</h2>
          <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600">
            <p>Email: <span className="font-black text-slate-900">{user?.email}</span></p>
            <p>Họ tên: <span className="font-black text-slate-900">{user?.full_name}</span></p>
            <p>Vai trò: <span className="font-black text-slate-900">{user?.role}</span></p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-sm font-black uppercase text-slate-700">Biến môi trường cần có</h2>
          <div className="mt-4 space-y-2 rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-100">
            <p>VITE_API_URL=http://localhost:3001/api</p>
            <p>SUPABASE_URL=...</p>
            <p>SUPABASE_SERVICE_ROLE_KEY=...</p>
            <p>JWT_SECRET=...</p>
            <p>GROQ_API_KEY=... (để dùng AI Groq thật)</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
