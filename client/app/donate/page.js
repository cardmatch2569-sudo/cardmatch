'use client';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import translations from '../../lib/translations';
import { Heart, Coffee, Zap, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

export default function DonatePage() {
  const { lang } = useAuth();
  const t = translations[lang];
  const [accepted, setAccepted] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(true);

  const disclaimerItems = [
    t.donateDisclaimer1,
    t.donateDisclaimer2,
    t.donateDisclaimer3,
    t.donateDisclaimer4,
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-600/10 border border-pink-500/20 mb-4">
            <Heart size={28} className="text-pink-400" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t.donateTitle}</h1>
          <p className="text-slate-400 text-sm leading-relaxed">{t.donateSubtitle}</p>
        </div>

        {/* Free badge */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border border-green-500/20 bg-green-500/5">
          <Zap size={16} className="text-green-400 flex-shrink-0" />
          <div>
            <p className="text-green-300 text-sm font-semibold">{t.donateFree}</p>
            <p className="text-slate-500 text-xs mt-0.5">{t.donateFreeDesc}</p>
          </div>
        </div>

        {/* Disclaimer box */}
        <div className={`rounded-2xl border mb-4 overflow-hidden transition-all ${accepted ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
          {/* Disclaimer header — clickable to collapse */}
          <button
            onClick={() => setDisclaimerOpen(p => !p)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left"
          >
            {accepted
              ? <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
              : <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
            }
            <span className={`text-sm font-semibold flex-1 ${accepted ? 'text-green-300' : 'text-yellow-300'}`}>
              {t.donateDisclaimerTitle}
            </span>
            {disclaimerOpen
              ? <ChevronUp size={14} className="text-slate-500 flex-shrink-0" />
              : <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
            }
          </button>

          {disclaimerOpen && (
            <div className="px-4 pb-4">
              <ul className="space-y-2 mb-4">
                {disclaimerItems.map((item, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-400 leading-relaxed">
                    <span className="text-slate-600 flex-shrink-0 mt-0.5">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Checkbox accept */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={e => setAccepted(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                    ${accepted
                      ? 'bg-green-500 border-green-500'
                      : 'border-slate-600 bg-transparent group-hover:border-yellow-500'}`}>
                    {accepted && (
                      <svg viewBox="0 0 12 10" width="10" height="10" fill="none">
                        <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className={`text-xs leading-relaxed transition-colors ${accepted ? 'text-green-300' : 'text-slate-400 group-hover:text-slate-300'}`}>
                  {t.donateDisclaimer5}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* QR Card — hidden until disclaimer is accepted */}
        {!accepted && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-center">
            <div className="py-6 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                <span className="text-2xl">🔒</span>
              </div>
              <p className="text-slate-500 text-sm">{lang === 'th' ? 'กรุณายอมรับข้อตกลงด้านบนเพื่อดู QR Code' : 'Accept the terms above to reveal QR Code'}</p>
            </div>
          </div>
        )}
        {accepted && (
        <div className="rounded-2xl border border-white/[0.08] bg-[var(--card)] p-5 mb-6 text-center anim-scale-in">
          <p className="text-slate-300 text-sm mb-1">{t.donateDesc1}</p>
          <p className="text-slate-500 text-xs mb-5">{t.donateDesc2}</p>

          <div className="flex justify-center mb-4">
            <div className="rounded-xl overflow-hidden shadow-lg shadow-black/40 w-full max-w-[260px]">
              <img
                src="/qr-donate.jpg"
                alt="PromptPay QR Code - นายจักรรินทร์ ขาวงาม"
                className="block w-full h-auto"
                onError={e => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextSibling.style.display = 'flex';
                }}
              />
              <div className="hidden items-center justify-center bg-slate-800/60 text-slate-500 text-xs py-16 flex-col gap-2">
                <span className="text-2xl">📷</span>
                <span>วางไฟล์ qr-donate.jpg ใน public/</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 font-medium">นายจักรรินทร์ ขาวงาม</p>
          <p className="text-xs text-slate-600 mt-0.5">PromptPay · กรุงไทย</p>
        </div>
        )}

        {/* Thank you */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Coffee size={14} className="text-amber-400" />
            <span>{t.donateThanks}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
