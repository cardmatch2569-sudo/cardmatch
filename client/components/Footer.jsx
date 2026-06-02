'use client';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function Footer() {
  const { lang } = useAuth();
  const th = lang === 'th';

  return (
    <footer className="border-t border-[var(--border)] mt-16 py-6 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-slate-600 text-xs">
          © 2026 CardMatch · {th ? 'บริการฟรี ไม่มีโฆษณา' : 'Free service, no ads'}
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <Link href="/privacy" className="hover:text-slate-400 transition">
            {th ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
          </Link>
          <span className="opacity-30">·</span>
          <Link href="/terms" className="hover:text-slate-400 transition">
            {th ? 'ข้อกำหนดการใช้งาน' : 'Terms of Service'}
          </Link>
          <span className="opacity-30">·</span>
          <Link href="/donate" className="hover:text-pink-400 transition text-pink-600">
            {th ? '💗 สนับสนุน' : '💗 Support'}
          </Link>
        </div>
      </div>
    </footer>
  );
}
