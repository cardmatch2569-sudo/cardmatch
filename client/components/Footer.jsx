'use client';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function Footer() {
  const { lang } = useAuth();
  const th = lang === 'th';

  return (
    <footer className="border-t border-[var(--border)] mt-16 py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
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
        {/* IP Disclaimer */}
        <p className="text-slate-700 text-[10px] text-center leading-relaxed">
          {th
            ? 'CardMatch ไม่ใช่ตัวแทน พันธมิตร หรือผู้ได้รับการรับรองจากเจ้าของสิทธิ์เกมใดๆ ชื่อเกม เครื่องหมายการค้า และลิขสิทธิ์ทั้งหมดเป็นสมบัติของเจ้าของที่เกี่ยวข้อง CardMatch ใช้ชื่อเกมเพื่ออ้างอิงประเภทการแข่งขันเท่านั้น'
            : 'CardMatch is not affiliated with, endorsed by, or a representative of any game publisher. All game names, trademarks, and copyrights are the property of their respective owners. Game names are used for reference purposes only.'}
        </p>
      </div>
    </footer>
  );
}
