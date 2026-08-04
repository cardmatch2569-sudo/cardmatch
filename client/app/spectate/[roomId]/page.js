'use client';
import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useLiveKitViewer } from '../../../hooks/useLiveKit';
import { Eye, ArrowLeft, Users, Wifi, WifiOff } from 'lucide-react';
import PageLoader from '../../../components/PageLoader';

function VideoTrack({ track, name }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !track) return;
    track.attach(ref.current);
    return () => track.detach(ref.current);
  }, [track]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video w-full">
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
        {name}
      </div>
    </div>
  );
}

export default function SpectatePage() {
  const { roomId } = useParams();
  const router     = useRouter();
  const { user, lang } = useAuth();
  const isTh = lang !== 'en';

  const { videoTracks, connected, viewers, error } = useLiveKitViewer(roomId);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-400 mb-4 text-sm">
            {isTh ? 'กรุณาเข้าสู่ระบบเพื่อดูไลฟ์' : 'Please log in to watch the live stream'}
          </p>
          <button onClick={() => router.push('/login')} className="btn-primary text-sm px-5 py-2.5 rounded-xl">
            {isTh ? 'เข้าสู่ระบบ' : 'Log in'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400
            hover:text-white hover:bg-white/[0.07] transition-all duration-200">
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2 flex-1">
          {connected && videoTracks.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
          )}
          <h1 className="text-base font-bold text-white">
            {isTh ? 'ดูการแข่งขัน' : 'Spectate Match'}
          </h1>
        </div>

        {/* Viewer count */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-500
          border border-white/[0.06] bg-white/[0.03]">
          {connected
            ? <><Eye size={12} /><span>{viewers + 1} {isTh ? 'คนดู' : 'watching'}</span></>
            : <><WifiOff size={12} /><span>{isTh ? 'กำลังเชื่อมต่อ' : 'Connecting'}</span></>
          }
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <WifiOff size={22} className="text-red-400" />
          </div>
          <p className="text-red-400 font-semibold text-sm mb-1">
            {isTh ? 'เชื่อมต่อไม่สำเร็จ' : 'Connection failed'}
          </p>
          <p className="text-slate-500 text-xs">{error}</p>
          <button onClick={() => router.back()}
            className="btn-ghost text-sm px-5 py-2 rounded-xl mt-5">
            {isTh ? 'กลับ' : 'Go back'}
          </button>
        </div>
      ) : !connected ? (
        <div className="card p-10 text-center">
          <PageLoader />
          <p className="text-slate-500 text-sm mt-4">
            {isTh ? 'กำลังเชื่อมต่อกับการแข่งขัน...' : 'Connecting to match stream...'}
          </p>
        </div>
      ) : videoTracks.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Eye size={26} className="text-purple-400" />
          </div>
          <p className="text-white font-semibold mb-1.5">
            {isTh ? 'รอสัญญาณไลฟ์...' : 'Waiting for live stream...'}
          </p>
          <p className="text-slate-500 text-sm">
            {isTh
              ? 'ผู้เล่นยังไม่ได้เปิด LIVE หรือการแข่งขันยังไม่เริ่ม'
              : 'The player hasn\'t gone live yet, or the match hasn\'t started'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
            {isTh ? 'เชื่อมต่อแล้ว รอสัญญาณวิดีโอ' : 'Connected — waiting for video'}
          </div>
        </div>
      ) : (
        <div className={`grid gap-4 ${videoTracks.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          {videoTracks.map(({ track, participant, sid }) => (
            <VideoTrack
              key={sid}
              track={track}
              name={participant.name || participant.identity}
            />
          ))}
        </div>
      )}

      {/* Info banner */}
      <div className="mt-6 px-4 py-3 rounded-xl text-xs text-slate-600 flex items-center gap-2"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
        <Users size={12} className="flex-shrink-0" />
        <span>
          {isTh
            ? 'คุณกำลังดูในฐานะผู้ชม ไม่มีเสียงและภาพของคุณถูกส่งออก'
            : 'You are watching as a spectator. Your audio and video are not transmitted.'}
        </span>
      </div>
    </div>
  );
}
