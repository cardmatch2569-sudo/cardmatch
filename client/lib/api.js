const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000';
const TIMEOUT_MS = 30000; // 30-second timeout (email sending can be slow on first connect)

const getToken = () =>
  typeof window !== 'undefined'
    ? (sessionStorage.getItem('cg_token') || localStorage.getItem('cg_token'))
    : null;

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

const request = async (method, path, body) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: headers(),
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    clearTimeout(timer);

    // Guard: server may return HTML on 404/500 — don't try to JSON-parse it
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      if (!res.ok) throw new Error(
        res.status >= 500
          ? 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง'
          : 'เกิดข้อผิดพลาด กรุณาลองใหม่'
      );
      return {};
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('หมดเวลาเชื่อมต่อ กรุณาตรวจสอบอินเทอร์เน็ต');
    throw err;
  }
};

export const api = {
  post:   (path, body) => request('POST',   path, body),
  get:    (path)       => request('GET',    path),
  put:    (path, body) => request('PUT',    path, body),
  delete: (path, body) => request('DELETE', path, body),
};
