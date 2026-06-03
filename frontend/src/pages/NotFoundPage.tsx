import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '2rem' }}>
        <div style={{ fontSize: '6rem', fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>404</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>
          Trang không tồn tại
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: 1.6 }}>
          Đường dẫn bạn truy cập không đúng hoặc trang đã bị di chuyển.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '0.625rem 1.5rem',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            ← Quay lại
          </button>
          <button
            onClick={() => navigate('/', { replace: true })}
            style={{
              padding: '0.625rem 1.5rem',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Về Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
