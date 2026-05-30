'use client';
import { useEffect, useState } from 'react';
import { X, Shuffle, Wifi, WifiOff } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function PreMatchModal({ lang, gameName, onConfirm, onCancel }) {
  const { connected } = useSocket();
  const [dots, setDots] = useState('');

  // Animated waiting dots
  useEffect(() => {
    if (connected) return;
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(id);
  }, [connected]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>

      <div className="anim-slide-up sm:anim-scale-in w-full sm:max-w-sm card overflow-hidden"
        style={{ background: 'rgba(10,10,22,0.98)', borderColor: 'rgba(124,58,237,0.3)',
          borderRadius: '20px 20px 0 0', paddingBottom: 'var(--safe-bottom, 0px)' }}>

        <div className="h-1 w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <div>
            <h2 className="font-bold text-white text-base">
              🎮 {lang === 'th' ? 'เตรียมจับคู่' : 'Ready to Match'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'th' ? `เกม: ${gameName}` : `Game: ${gameName}`}
            </p>
          </div>
          <button onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* Connection status */}
          <div className={`flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 ${
            connected ? 'bg-green-900/15 border border-green-700/30' : 'bg-yellow-900/10 border border-yellow-700/20'
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              connected ? 'bg-green-500/20' : 'bg-yellow-500/10'
            }`}>
              {connected
                ? <Wifi size={24} className="text-green-400" />
                : <WifiOff size={24} className="text-yellow-400 animate-pulse" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm ${connected ? 'text-green-300' : 'text-yellow-300'}`}>
                {connected
                  ? (lang === 'th' ? '✅ พร้อมจับคู่แล้ว!' : '✅ Ready to match!')
                  : (lang === 'th' ? `⏳ กำลังเชื่อมต่อ${dots}` : `⏳ Connecting${dots}`)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {connected
                  ? (lang === 'th' ? 'กด "จับคู่เลย!" เพื่อเริ่ม' : 'Press "Match!" to start')
                  : (lang === 'th' ? 'รอการเชื่อมต่อเซิร์ฟเวอร์...' : 'Waiting for server...')}
              </p>
            </div>
          </div>

          {/* Game & camera info */}
          <div className="p-3 rounded-xl space-y-2"
            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.12)' }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">🃏</span>
              <div>
                <p className="text-sm font-semibold text-white">{gameName}</p>
                <p className="text-[11px] text-slate-500">
                  {lang === 'th' ? 'กล้องจะเปิดอัตโนมัติเมื่อเจอคู่ต่อสู้' : 'Camera opens automatically when matched'}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-600">
              💡 {lang === 'th'
                ? 'ทดสอบกล้อง/ไมค์ได้ที่เมนู "ทดสอบ" ในแถบด้านบน'
                : 'Test camera/mic via "Setup" in the top menu'}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button onClick={onCancel} className="btn-ghost flex-1 py-3 rounded-xl text-sm">
              {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button onClick={onConfirm} disabled={!connected}
              className={`btn-primary flex-1 py-3 rounded-xl text-sm gap-2 ${!connected ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <Shuffle size={15} />
              {connected
                ? (lang === 'th' ? 'จับคู่เลย!' : 'Match!')
                : (lang === 'th' ? 'รอสักครู่...' : 'Wait...')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
