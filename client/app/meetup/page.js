'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import PageLoader from '../../components/PageLoader';
import {
  MapPin, Calendar, Users, Plus, X, Heart,
  Trash2, Info, ChevronDown, Search,
} from 'lucide-react';

// ── Province list (77 จังหวัด) ─────────────────────────────────────────────
const PROVINCES = [
  { th: 'กระบี่', en: 'Krabi' },
  { th: 'กรุงเทพมหานคร', en: 'Bangkok' },
  { th: 'กาญจนบุรี', en: 'Kanchanaburi' },
  { th: 'กาฬสินธุ์', en: 'Kalasin' },
  { th: 'กำแพงเพชร', en: 'Kamphaeng Phet' },
  { th: 'ขอนแก่น', en: 'Khon Kaen' },
  { th: 'จันทบุรี', en: 'Chanthaburi' },
  { th: 'ฉะเชิงเทรา', en: 'Chachoengsao' },
  { th: 'ชลบุรี', en: 'Chonburi' },
  { th: 'ชัยนาท', en: 'Chai Nat' },
  { th: 'ชัยภูมิ', en: 'Chaiyaphum' },
  { th: 'ชุมพร', en: 'Chumphon' },
  { th: 'เชียงราย', en: 'Chiang Rai' },
  { th: 'เชียงใหม่', en: 'Chiang Mai' },
  { th: 'ตรัง', en: 'Trang' },
  { th: 'ตราด', en: 'Trat' },
  { th: 'ตาก', en: 'Tak' },
  { th: 'นครนายก', en: 'Nakhon Nayok' },
  { th: 'นครปฐม', en: 'Nakhon Pathom' },
  { th: 'นครพนม', en: 'Nakhon Phanom' },
  { th: 'นครราชสีมา', en: 'Nakhon Ratchasima' },
  { th: 'นครศรีธรรมราช', en: 'Nakhon Si Thammarat' },
  { th: 'นครสวรรค์', en: 'Nakhon Sawan' },
  { th: 'นนทบุรี', en: 'Nonthaburi' },
  { th: 'นราธิวาส', en: 'Narathiwat' },
  { th: 'น่าน', en: 'Nan' },
  { th: 'บึงกาฬ', en: 'Bueng Kan' },
  { th: 'บุรีรัมย์', en: 'Buri Ram' },
  { th: 'ปทุมธานี', en: 'Pathum Thani' },
  { th: 'ประจวบคีรีขันธ์', en: 'Prachuap Khiri Khan' },
  { th: 'ปราจีนบุรี', en: 'Prachin Buri' },
  { th: 'ปัตตานี', en: 'Pattani' },
  { th: 'พระนครศรีอยุธยา', en: 'Phra Nakhon Si Ayutthaya' },
  { th: 'พะเยา', en: 'Phayao' },
  { th: 'พังงา', en: 'Phang Nga' },
  { th: 'พัทลุง', en: 'Phatthalung' },
  { th: 'พิจิตร', en: 'Phichit' },
  { th: 'พิษณุโลก', en: 'Phitsanulok' },
  { th: 'เพชรบุรี', en: 'Phetchaburi' },
  { th: 'เพชรบูรณ์', en: 'Phetchabun' },
  { th: 'แพร่', en: 'Phrae' },
  { th: 'ภูเก็ต', en: 'Phuket' },
  { th: 'มหาสารคาม', en: 'Maha Sarakham' },
  { th: 'มุกดาหาร', en: 'Mukdahan' },
  { th: 'แม่ฮ่องสอน', en: 'Mae Hong Son' },
  { th: 'ยโสธร', en: 'Yasothon' },
  { th: 'ยะลา', en: 'Yala' },
  { th: 'ร้อยเอ็ด', en: 'Roi Et' },
  { th: 'ระนอง', en: 'Ranong' },
  { th: 'ระยอง', en: 'Rayong' },
  { th: 'ราชบุรี', en: 'Ratchaburi' },
  { th: 'ลพบุรี', en: 'Lopburi' },
  { th: 'ลำปาง', en: 'Lampang' },
  { th: 'ลำพูน', en: 'Lamphun' },
  { th: 'เลย', en: 'Loei' },
  { th: 'ศรีสะเกษ', en: 'Si Sa Ket' },
  { th: 'สกลนคร', en: 'Sakon Nakhon' },
  { th: 'สงขลา', en: 'Songkhla' },
  { th: 'สตูล', en: 'Satun' },
  { th: 'สมุทรปราการ', en: 'Samut Prakan' },
  { th: 'สมุทรสงคราม', en: 'Samut Songkhram' },
  { th: 'สมุทรสาคร', en: 'Samut Sakhon' },
  { th: 'สระแก้ว', en: 'Sa Kaeo' },
  { th: 'สระบุรี', en: 'Saraburi' },
  { th: 'สิงห์บุรี', en: 'Sing Buri' },
  { th: 'สุโขทัย', en: 'Sukhothai' },
  { th: 'สุพรรณบุรี', en: 'Suphan Buri' },
  { th: 'สุราษฎร์ธานี', en: 'Surat Thani' },
  { th: 'สุรินทร์', en: 'Surin' },
  { th: 'หนองคาย', en: 'Nong Khai' },
  { th: 'หนองบัวลำภู', en: 'Nong Bua Lam Phu' },
  { th: 'อ่างทอง', en: 'Ang Thong' },
  { th: 'อำนาจเจริญ', en: 'Amnat Charoen' },
  { th: 'อุดรธานี', en: 'Udon Thani' },
  { th: 'อุตรดิตถ์', en: 'Uttaradit' },
  { th: 'อุทัยธานี', en: 'Uthai Thani' },
  { th: 'อุบลราชธานี', en: 'Ubon Ratchathani' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function getRank(elo) {
  if (elo >= 1700) return { label: 'Diamond', color: '#22d3ee' };
  if (elo >= 1500) return { label: 'Platinum', color: '#e2e8f0' };
  if (elo >= 1300) return { label: 'Gold',     color: '#f59e0b' };
  if (elo >= 1100) return { label: 'Silver',   color: '#94a3b8' };
  return               { label: 'Bronze',   color: '#cd7f32' };
}

function formatBE(iso, lang) {
  const d = new Date(iso);
  if (lang === 'th') {
    const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const be = d.getFullYear() + 543;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${thMonths[d.getMonth()]} ${be}  ${hh}:${mm} น.`;
  }
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso, lang) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (lang === 'th') {
    if (m < 1)  return 'เมื่อกี้';
    if (m < 60) return `${m} นาทีที่แล้ว`;
    if (h < 24) return `${h} ชม. ที่แล้ว`;
    return `${day} วันที่แล้ว`;
  }
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${day}d ago`;
}

// ── Province dropdown ──────────────────────────────────────────────────────
function ProvinceSelect({ value, onChange, lang, placeholder, className = '' }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const ref                 = useRef(null);
  const inputRef            = useRef(null);

  const filtered = PROVINCES.filter(p =>
    p.th.includes(query) || p.en.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    setTimeout(() => inputRef.current?.focus(), 50);
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input-base w-full flex items-center justify-between gap-2 text-left"
        style={{ cursor: 'pointer' }}>
        <span className={value ? 'text-white' : 'text-slate-500'}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} className={`flex-shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border overflow-hidden"
          style={{ background: 'var(--card-2, #181930)', borderColor: 'var(--border-2, #2c2e5a)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <div className="p-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 px-2">
              <Search size={12} className="text-slate-500 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={lang === 'th' ? 'ค้นหาจังหวัด...' : 'Search province...'}
                className="bg-transparent w-full text-sm text-white placeholder-slate-600 outline-none"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-500 hover:bg-white/[0.05] hover:text-white transition-colors">
                {placeholder}
              </button>
            )}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-600">ไม่พบจังหวัด</p>
            )}
            {filtered.map(p => (
              <button
                key={p.th}
                type="button"
                onClick={() => { onChange(p.th); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between
                  ${value === p.th ? 'text-purple-300 bg-purple-600/[0.12]' : 'text-slate-200 hover:bg-white/[0.05] hover:text-white'}`}>
                <span>{p.th}</span>
                <span className="text-slate-600 text-xs">{p.en}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Post card ──────────────────────────────────────────────────────────────
function PostCard({ post, user, lang, onInterest, onDelete }) {
  const rank  = getRank(post.host.elo);
  const isOwn = user?._id === post.host.id;

  return (
    <div className="card card-hover relative overflow-hidden" style={{ padding: '0' }}>
      <div className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: 'linear-gradient(180deg, #e11d48 0%, #be123c 100%)' }} />

      <div className="p-4 pl-5">
        {/* Host row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-violet-600
              flex items-center justify-center text-xs font-bold flex-shrink-0 uppercase">
              {post.host.username[0]}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-white">{post.host.username}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ color: rank.color, background: `${rank.color}22`, border: `1px solid ${rank.color}44` }}>
                  {rank.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {post.host.wins}W {post.host.losses}L
                {post.host.hostedCount > 0 && <> · {lang === 'th' ? `โฮสต์ ${post.host.hostedCount} ครั้ง` : `${post.host.hostedCount}× host`}</>}
              </p>
            </div>
          </div>
          {isOwn && (
            <button onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600
                hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200">
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Date + location */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={13} className="text-purple-400 flex-shrink-0" />
            <span className="text-white font-medium">{formatBE(post.scheduledAt, lang)}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <MapPin size={13} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <span className="text-slate-300">
              <span className="text-slate-400 text-xs mr-1">{post.province}</span>
              {post.locationName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users size={13} className="text-green-400 flex-shrink-0" />
            <span className="text-slate-400">
              {lang === 'th'
                ? `หาผู้เล่นเพิ่ม ${post.playersNeeded} คน`
                : `Looking for ${post.playersNeeded} player${post.playersNeeded !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* Note */}
        {post.note && (
          <p className="text-slate-500 text-xs mb-3 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {post.note}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[11px] text-slate-600">{timeAgo(post.createdAt, lang)}</span>

          {!isOwn && (
            <button
              onClick={onInterest}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border
                ${post.iAmInterested
                  ? 'bg-rose-500/[0.15] text-rose-400 border-rose-500/25 hover:bg-rose-500/20'
                  : 'text-slate-400 border-white/[0.07] hover:border-rose-500/25 hover:text-rose-400'}`}>
              <Heart size={11} fill={post.iAmInterested ? 'currentColor' : 'none'} />
              {post.iAmInterested
                ? (lang === 'th' ? 'สนใจแล้ว' : 'Interested')
                : (lang === 'th' ? 'สนใจร่วมด้วย' : 'Join')}
              {post.interestCount > 0 && (
                <span className="opacity-60">{post.interestCount}</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MeetupPage() {
  const { user, lang } = useAuth();
  const router = useRouter();

  const [posts,        setPosts]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterProvince, setFilterProvince] = useState('');
  const [filterPeriod,   setFilterPeriod]   = useState('all');
  const [showCreate,   setShowCreate]   = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [form,         setForm]         = useState({
    province: '', locationName: '', date: '', time: '', playersNeeded: '1', note: '',
  });
  const [formError, setFormError] = useState('');
  const [toast,     setToast]     = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterProvince)           p.set('province', filterProvince);
      if (filterPeriod !== 'all')   p.set('period', filterPeriod);
      const data = await api.get(`/api/meetup?${p}`);
      setPosts(data.posts || []);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProvince, filterPeriod]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.province || !form.locationName || !form.date || !form.time) {
      setFormError(lang === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill all required fields');
      return;
    }
    const scheduledAt = `${form.date}T${form.time}:00`;
    if (new Date(scheduledAt) <= new Date()) {
      setFormError(lang === 'th' ? 'วันเวลาต้องเป็นอนาคต' : 'Date/time must be in the future');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/meetup', {
        province:      form.province,
        locationName:  form.locationName,
        scheduledAt,
        playersNeeded: parseInt(form.playersNeeded),
        note:          form.note,
      });
      setShowCreate(false);
      setForm({ province: '', locationName: '', date: '', time: '', playersNeeded: '1', note: '' });
      showToast(lang === 'th' ? 'โพสต์นัดเล่นแล้ว!' : 'Meetup posted!');
      fetchPosts();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleInterest = async (postId) => {
    if (!user) { router.push('/login'); return; }
    const orig = posts.find(p => p.id === postId);
    if (!orig) return;
    setPosts(ps => ps.map(p => p.id === postId ? {
      ...p,
      iAmInterested: !p.iAmInterested,
      interestCount: p.iAmInterested ? p.interestCount - 1 : p.interestCount + 1,
    } : p));
    try {
      await api.post(`/api/meetup/${postId}/interest`, {});
    } catch (e) {
      setPosts(ps => ps.map(p => p.id === postId ? orig : p));
      showToast(e.message, 'error');
    }
  };

  const deletePost = async (postId) => {
    try {
      await api.delete(`/api/meetup/${postId}`);
      setPosts(ps => ps.filter(p => p.id !== postId));
      showToast(lang === 'th' ? 'ลบโพสต์แล้ว' : 'Post deleted');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const periodOptions = [
    { value: 'all',       label: lang === 'th' ? 'ทั้งหมด'      : 'All' },
    { value: 'today',     label: lang === 'th' ? '24 ชม.'        : '24 h' },
    { value: 'week',      label: lang === 'th' ? '7 วัน'         : '7 days' },
    { value: 'next_week', label: lang === 'th' ? 'สัปดาห์หน้า'  : 'Next week' },
  ];

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div style={{ minHeight: 'calc(var(--vh, 100vh) - var(--navbar-h, 4rem))', paddingTop: 'var(--navbar-h, 4rem)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-3"
            style={{ background: 'rgba(225,29,72,0.12)', color: '#fb7185', border: '1px solid rgba(225,29,72,0.22)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Battle of Talingchan
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-1.5">
            กระดานนัดเล่น
          </h1>
          <p className="text-slate-400 text-sm">
            {lang === 'th'
              ? 'หาผู้เล่นในพื้นที่ · นัดเวลา-สถานที่ · เจอกันแบบตัวต่อตัว'
              : 'Find local players · Schedule a meetup · Play face-to-face'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
          <ProvinceSelect
            value={filterProvince}
            onChange={setFilterProvince}
            lang={lang}
            placeholder={lang === 'th' ? 'ทุกจังหวัด' : 'All provinces'}
            className="sm:w-52 flex-shrink-0"
          />
          <div className="flex gap-1.5 flex-wrap">
            {periodOptions.map(({ value, label }) => (
              <button key={value}
                onClick={() => setFilterPeriod(value)}
                className={`px-3 h-10 rounded-xl text-sm font-medium transition-all duration-200 border whitespace-nowrap
                  ${filterPeriod === value
                    ? 'bg-purple-600/[0.20] text-purple-300 border-purple-500/30'
                    : 'text-slate-400 border-white/[0.07] hover:border-white/[0.15] hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Create / login prompt */}
        <div className="mb-5">
          {user ? (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2">
              <Plus size={16} />
              {lang === 'th' ? 'โพสต์นัดเล่น' : 'Post Meetup'}
            </button>
          ) : (
            <div className="card flex items-center gap-3 px-4 py-3 text-sm text-slate-400"
              style={{ borderColor: 'rgba(139,92,246,0.15)' }}>
              <Info size={14} className="flex-shrink-0 text-purple-400" />
              {lang === 'th' ? (
                <span>
                  ต้องการโพสต์?{' '}
                  <button onClick={() => router.push('/login')}
                    className="text-purple-400 hover:text-purple-300 underline underline-offset-2">
                    เข้าสู่ระบบ
                  </button>{' '}
                  ก่อน · ดูโพสต์ไม่ต้องล็อกอิน
                </span>
              ) : (
                <span>
                  Want to post?{' '}
                  <button onClick={() => router.push('/login')}
                    className="text-purple-400 hover:text-purple-300 underline underline-offset-2">
                    Log in
                  </button>{' '}
                  first · browsing is free
                </span>
              )}
            </div>
          )}
        </div>

        {/* Post list */}
        {loading ? (
          <PageLoader />
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <MapPin size={36} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">
              {lang === 'th' ? 'ยังไม่มีนัดเล่น' : 'No meetups yet'}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {lang === 'th'
                ? 'เป็นคนแรกที่โพสต์นัดเล่นในจังหวัดของคุณ'
                : 'Be the first to post a meetup in your province'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                user={user}
                lang={lang}
                onInterest={() => toggleInterest(post.id)}
                onDelete={() => deletePost(post.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowCreate(false)}>
          <div
            className="card w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold text-white">
                {lang === 'th' ? 'โพสต์นัดเล่น' : 'Post Meetup'}
              </h2>
              <button onClick={() => setShowCreate(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg
                  text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all duration-200">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  {lang === 'th' ? 'จังหวัด *' : 'Province *'}
                </label>
                <ProvinceSelect
                  value={form.province}
                  onChange={v => setForm(f => ({ ...f, province: v }))}
                  lang={lang}
                  placeholder={lang === 'th' ? 'เลือกจังหวัด' : 'Select province'}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  {lang === 'th' ? 'ชื่อสถานที่ *' : 'Location *'}
                </label>
                <input
                  className="input-base w-full"
                  placeholder={lang === 'th' ? 'เช่น ร้านเกม XYZ, บ้านตลิ่งชัน' : 'e.g. XYZ Game Shop'}
                  value={form.locationName}
                  onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))}
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">
                    {lang === 'th' ? 'วันที่ *' : 'Date *'}
                  </label>
                  <input
                    type="date"
                    className="input-base w-full"
                    value={form.date}
                    min={todayStr}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">
                    {lang === 'th' ? 'เวลา *' : 'Time *'}
                  </label>
                  <input
                    type="time"
                    className="input-base w-full"
                    value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  {lang === 'th' ? 'ต้องการผู้เล่นเพิ่ม' : 'Players needed'}
                </label>
                <select
                  className="input-base w-full"
                  value={form.playersNeeded}
                  onChange={e => setForm(f => ({ ...f, playersNeeded: e.target.value }))}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <option key={n} value={n}>{n} {lang === 'th' ? 'คน' : `player${n !== 1 ? 's' : ''}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  {lang === 'th' ? 'โน้ต (ไม่บังคับ)' : 'Note (optional)'}
                </label>
                <textarea
                  className="input-base w-full resize-none"
                  rows={2}
                  placeholder={lang === 'th'
                    ? 'รายละเอียดเพิ่มเติม เช่น ระดับผู้เล่น เด็คที่ใช้'
                    : 'Extra details: skill level, deck, etc.'}
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  maxLength={200}
                />
                <p className="text-right text-[11px] text-slate-600 mt-0.5">{form.note.length}/200</p>
              </div>

              {formError && (
                <p className="text-red-400 text-sm">{formError}</p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={creating}>
                {creating
                  ? (lang === 'th' ? 'กำลังโพสต์...' : 'Posting...')
                  : (lang === 'th' ? 'โพสต์นัดเล่น' : 'Post Meetup')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-medium
          shadow-2xl pointer-events-none
          ${toast.type === 'error' ? 'bg-red-600/90 text-white' : 'bg-purple-600/90 text-white'}`}
          style={{ backdropFilter: 'blur(12px)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
