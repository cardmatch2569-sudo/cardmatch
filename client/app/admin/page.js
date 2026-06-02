'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Shield, Users, Gamepad2, Radio, Plus, Pencil, Trash2, X, Save,
  ToggleLeft, ToggleRight, Search, RefreshCw, Crown, UserX,
  Activity, Clock, CheckCircle, XCircle, Loader2,
} from 'lucide-react';

const TABS = ['overview', 'users', 'games', 'rooms'];
const EMPTY_GAME = { name: '', nameTh: '', description: '', descriptionTh: '', imageUrl: '', color: '#7c3aed', isActive: true };

export default function AdminPage() {
  const { user, loading: authLoading, lang, isAdminMode, toggleViewMode } = useAuth();
  const router = useRouter();

  const [tab,       setTab]       = useState('overview');
  const [annText,   setAnnText]   = useState('');
  const [annActive, setAnnActive] = useState(null);
  const [annSaving, setAnnSaving] = useState(false);
  const [stats,     setStats]     = useState(null);
  const [users,     setUsers]     = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage,  setUserPage]  = useState(1);
  const [userSearch,setUserSearch]= useState('');
  const [games,     setGames]     = useState([]);
  const [rooms,     setRooms]     = useState([]);
  const [online,    setOnline]    = useState([]);
  const [modal,     setModal]     = useState(null);
  const [form,      setForm]      = useState(EMPTY_GAME);
  const [editId,    setEditId]    = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState('');
  const [tableLoading, setTableLoading] = useState(false);
  // Delete user
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError,    setDeleteError]    = useState('');
  const [deleting,       setDeleting]       = useState(false);

  // Bug fix: debounce ref for user search
  const searchTimer = useRef(null);

  // Bug fix: check loading before redirecting
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!user.isAdmin) { router.push('/lobby'); }
  }, [authLoading, user, router]);

  const loadStats  = useCallback(async () => { try { const d = await api.get('/api/admin/stats');  setStats(d); } catch {} }, []);
  const loadAnnouncement = useCallback(async () => { try { const { announcement } = await api.get('/api/admin/announcement'); setAnnActive(announcement); if (announcement?.text) setAnnText(announcement.text); } catch {} }, []);
  const saveAnnouncement = async () => { if (!annText.trim()) return; setAnnSaving(true); try { const { announcement } = await api.post('/api/admin/announcement', { text: annText }); setAnnActive(announcement); } catch {} setAnnSaving(false); };
  const clearAnnouncement = async () => { try { await api.delete('/api/admin/announcement'); setAnnActive(null); setAnnText(''); } catch {} };
  const loadUsers  = useCallback(async (page = 1, search = '') => {
    setTableLoading(true);
    try {
      const d = await api.get(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}&limit=15`);
      setUsers(d.users); setUserTotal(d.total); setUserPage(page);
    } catch {} finally { setTableLoading(false); }
  }, []);
  const loadGames  = useCallback(async () => { try { const { games } = await api.get('/api/games/all'); setGames(games); } catch {} }, []);
  const loadRooms  = useCallback(async () => { try { const { rooms }  = await api.get('/api/admin/rooms');  setRooms(rooms); } catch {} }, []);
  const loadOnline = useCallback(async () => { try { const { online } = await api.get('/api/admin/online'); setOnline(online); } catch {} }, []);

  useEffect(() => { if (user?.isAdmin) { loadStats(); loadOnline(); loadAnnouncement(); } }, [user, loadStats, loadOnline, loadAnnouncement]);
  useEffect(() => { if (tab === 'users')    loadUsers(1, ''); },   [tab, loadUsers]);
  useEffect(() => { if (tab === 'games')    loadGames(); },         [tab, loadGames]);
  useEffect(() => { if (tab === 'rooms')    loadRooms(); },         [tab, loadRooms]);
  useEffect(() => { if (tab === 'overview') { loadStats(); loadOnline(); } }, [tab, loadStats, loadOnline]);

  // Bug fix: debounced user search
  const handleUserSearch = (q) => {
    setUserSearch(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadUsers(1, q), 350);
  };

  const handleToggleAdmin = async (id, name) => {
    const confirmMsg = lang === 'th'
      ? `เปลี่ยนสิทธิ์ของ "${name}"?`
      : `Toggle admin for "${name}"?`;
    if (!confirm(confirmMsg)) return;
    try {
      const { isAdmin } = await api.put(`/api/admin/users/${id}/role`, {});
      setUsers(p => p.map(u => u._id === id ? { ...u, isAdmin } : u));
      loadStats();
    } catch (err) { alert(err.message); }
  };

  const openAdd  = () => { setForm(EMPTY_GAME); setEditId(null); setFormError(''); setModal('game'); };
  const openEdit = (g) => {
    setForm({ name: g.name, nameTh: g.nameTh, description: g.description || '', descriptionTh: g.descriptionTh || '', imageUrl: g.imageUrl || '', color: g.color || '#7c3aed', isActive: g.isActive });
    setEditId(g._id); setFormError(''); setModal('game');
  };
  const handleSaveGame = async () => {
    if (!form.name || !form.nameTh) {
      setFormError(lang === 'th' ? 'กรุณากรอกชื่อทั้ง 2 ภาษา' : 'Both names required');
      return;
    }
    setSaving(true);
    try {
      if (modal === 'game' && !editId) await api.post('/api/games', form);
      else await api.put(`/api/games/${editId}`, form);
      await loadGames(); setModal(null);
    } catch (err) { setFormError(err.message); }
    finally { setSaving(false); }
  };
  const handleDeleteGame = async (id, name) => {
    const msg = lang === 'th' ? `ลบเกม "${name}"?` : `Delete "${name}"?`;
    if (!confirm(msg)) return;
    try { await api.delete(`/api/games/${id}`); await loadGames(); } catch {}
  };

  const openDeleteUser = (u) => {
    setDeleteTarget(u);
    setDeletePassword('');
    setDeleteError('');
    setModal('delete-user');
  };

  const handleDeleteUser = async () => {
    if (!deletePassword || !deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/api/admin/users/${deleteTarget._id}`, { password: deletePassword });
      setUsers(p => p.filter(u => u._id !== deleteTarget._id));
      setUserTotal(p => p - 1);
      loadStats();
      setModal(null);
      setDeleteTarget(null);
      setDeletePassword('');
    } catch (err) {
      setDeleteError(err.message || (lang === 'th' ? 'รหัสผ่านไม่ถูกต้อง' : 'Wrong password'));
    } finally { setDeleting(false); }
  };

  const closeDeleteModal = () => { setModal(null); setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); };

  if (authLoading || !user?.isAdmin) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-600/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  // Short labels for mobile, full for desktop
  const tabLabels = {
    overview: <><span className="hidden sm:inline">📊 </span><span className="sm:hidden">📊</span><span className="hidden sm:inline">{lang === 'th' ? 'ภาพรวม' : 'Overview'}</span></>,
    users:    <><span className="hidden sm:inline">👥 </span><span className="sm:hidden">👥</span><span className="hidden sm:inline">{lang === 'th' ? 'ผู้ใช้' : 'Users'}</span></>,
    games:    <><span className="hidden sm:inline">🃏 </span><span className="sm:hidden">🃏</span><span className="hidden sm:inline">{lang === 'th' ? 'เกม' : 'Games'}</span></>,
    rooms:    <><span className="hidden sm:inline">🎮 </span><span className="sm:hidden">🎮</span><span className="hidden sm:inline">{lang === 'th' ? 'ห้อง' : 'Rooms'}</span></>,
  };

  const statCards = stats ? [
    { label: lang === 'th' ? 'ผู้ใช้ทั้งหมด' : 'Total Users',   value: stats.totalUsers,  icon: <Users size={18} />,    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.2)' },
    { label: lang === 'th' ? 'ออนไลน์ตอนนี้' : 'Online Now',    value: stats.onlineUsers, icon: <Radio size={18} />,    color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.2)' },
    { label: lang === 'th' ? 'ห้องทั้งหมด'  : 'Total Rooms',    value: stats.totalRooms,  icon: <Gamepad2 size={18} />, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
    { label: lang === 'th' ? 'ห้องกำลังเล่น' : 'Active Rooms',  value: stats.activeRooms, icon: <Activity size={18} />, color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.2)' },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── Delete User modal ───────────────────────────────── */}
      {modal === 'delete-user' && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(14px)' }}>
          <div className="anim-scale-in card w-full max-w-sm p-6"
            style={{ background: 'rgba(15,10,20,0.99)', borderColor: 'rgba(239,68,68,0.35)' }}>
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent mb-6" />

            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-lg font-bold text-white mb-1">
                {lang === 'th' ? 'ลบผู้ใช้ออกจากระบบ?' : 'Delete User?'}
              </h2>
              <p className="text-sm text-slate-400 mb-1">
                {lang === 'th' ? 'ผู้ใช้' : 'User'}{' '}
                <span className="text-red-400 font-bold">"{deleteTarget.username}"</span>
                {' '}{lang === 'th' ? 'จะถูกลบออกถาวร ไม่สามารถกู้คืนได้' : 'will be permanently deleted'}
              </p>
              <p className="text-xs text-slate-600">
                {lang === 'th' ? 'รวมข้อมูลทั้งหมด: โปรไฟล์ สถิติ และประวัติการแข่ง' : 'Includes all data: profile, stats, match history'}
              </p>
            </div>

            <div className="mb-5">
              <label className="text-xs text-slate-400 block mb-2 font-medium">
                {lang === 'th' ? '🔐 ยืนยันด้วยรหัสผ่าน Admin ของคุณ' : '🔐 Confirm with your Admin password'}
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                onKeyDown={e => e.key === 'Enter' && deletePassword && handleDeleteUser()}
                placeholder={lang === 'th' ? 'รหัสผ่านของคุณ' : 'Your password'}
                className="input-base text-sm"
                autoFocus
              />
              {deleteError && (
                <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                  <span>⚠</span> {deleteError}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={closeDeleteModal}
                className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button onClick={handleDeleteUser}
                disabled={!deletePassword || deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(239,68,68,0.85)', color: 'white' }}>
                {deleting
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {lang === 'th' ? 'กำลังลบ...' : 'Deleting...'}</span>
                  : (lang === 'th' ? '🗑 ลบถาวร' : '🗑 Delete permanently')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game modal */}
      {modal === 'game' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="anim-scale-in card w-full max-w-md max-h-[90vh] overflow-y-auto"
            style={{ background: 'rgba(15,15,30,0.98)', borderColor: 'rgba(124,58,237,0.25)' }}>
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">{editId ? (lang === 'th' ? 'แก้ไขเกม' : 'Edit Game') : (lang === 'th' ? 'เพิ่มเกม' : 'Add Game')}</h2>
                <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition"><X size={15} /></button>
              </div>
              {formError && <div className="badge badge-red w-full justify-center py-2 rounded-lg text-xs mb-4">{formError}</div>}
              <div className="space-y-3">
                {[
                  { key: 'name',          label: lang === 'th' ? 'ชื่อเกม (EN)' : 'Game Name (EN)' },
                  { key: 'nameTh',        label: lang === 'th' ? 'ชื่อเกม (TH)' : 'Game Name (TH)' },
                  { key: 'description',   label: lang === 'th' ? 'คำอธิบาย (EN)' : 'Description (EN)' },
                  { key: 'descriptionTh', label: lang === 'th' ? 'คำอธิบาย (TH)' : 'Description (TH)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-slate-500 block mb-1.5 font-medium">{label}</label>
                    <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="input-base text-sm" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-slate-500 block mb-1.5 font-medium">{lang === 'th' ? 'สีธีม' : 'Color'}</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer p-0.5"
                      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }} />
                    <div className="flex-1 flex items-center gap-2 input-base text-sm font-mono text-slate-400">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: form.color }} />
                      {form.color}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl border transition"
                  style={{ background: form.isActive ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)', borderColor: form.isActive ? 'rgba(74,222,128,0.2)' : 'var(--border)' }}>
                  <span className="text-sm text-slate-300">{lang === 'th' ? 'เปิดใช้งาน' : 'Active'}</span>
                  {form.isActive ? <ToggleRight size={22} className="text-green-400" /> : <ToggleLeft size={22} className="text-slate-600" />}
                </button>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setModal(null)} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">{lang === 'th' ? 'ยกเลิก' : 'Cancel'}</button>
                <button onClick={handleSaveGame} disabled={saving} className="btn-primary flex-1 py-2.5 rounded-xl text-sm gap-1.5">
                  <Save size={14} /> {saving ? '...' : (lang === 'th' ? 'บันทึก' : 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <Shield size={18} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-white leading-tight">Admin</h1>
            <p className="text-slate-600 text-[11px]">CardMatch</p>
          </div>
        </div>
        <button onClick={toggleViewMode}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border flex-shrink-0"
          style={{ background: 'rgba(124,58,237,0.1)', borderColor: 'rgba(124,58,237,0.25)', color: '#a78bfa' }}>
          👤 <span className="hidden sm:inline">{lang === 'th' ? 'ดูเป็นผู้ใช้' : 'Preview'}</span>
          <span className="sm:hidden">{lang === 'th' ? 'ผู้ใช้' : 'User'}</span>
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
          {statCards.map(({ label, value, icon, color, bg, border }) => (
            <div key={label} className="card p-5" style={{ borderColor: border }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: bg, color }}>{icon}</div>
                <span className="text-3xl font-black text-white">{value}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Announcement ────────────────────────────────────────── */}
      <div className="card p-4 md:p-5 mb-5" style={{ borderColor: annActive ? 'rgba(251,191,36,0.3)' : 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📢</span>
          <h3 className="font-bold text-white text-sm">{lang === 'th' ? 'ประชาสัมพันธ์' : 'Announcement'}</h3>
          {annActive && <span className="badge badge-yellow text-[10px]">{lang === 'th' ? 'กำลังแสดง' : 'Live'}</span>}
        </div>
        {annActive && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs text-yellow-300 overflow-hidden"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <span className="font-medium">{lang === 'th' ? 'ข้อความปัจจุบัน: ' : 'Current: '}</span>{annActive.text}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={annText}
            onChange={e => setAnnText(e.target.value.slice(0, 200))}
            onKeyDown={e => e.key === 'Enter' && saveAnnouncement()}
            placeholder={lang === 'th' ? 'พิมพ์ข้อความประชาสัมพันธ์ (สูงสุด 200 ตัวอักษร)' : 'Type announcement (max 200 chars)'}
            className="input-base text-sm flex-1 py-2"
          />
          <button onClick={saveAnnouncement} disabled={!annText.trim() || annSaving}
            className="btn-primary px-4 py-2 rounded-xl text-sm flex-shrink-0 disabled:opacity-40">
            {annSaving ? '...' : (lang === 'th' ? 'ส่ง' : 'Send')}
          </button>
          {annActive && (
            <button onClick={clearAnnouncement}
              className="px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 transition"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              {lang === 'th' ? 'ลบ' : 'Clear'}
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-700 mt-1.5 text-right">{annText.length}/200</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all text-center whitespace-nowrap px-2
              ${tab === t ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            style={tab === t ? { background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.2)' } : {}}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2"><Radio size={15} className="text-green-400" />{lang === 'th' ? 'ออนไลน์ตอนนี้' : 'Online Now'}</h3>
              <button onClick={loadOnline} className="text-slate-600 hover:text-slate-400 transition"><RefreshCw size={13} /></button>
            </div>
            {online.length === 0
              ? <p className="text-slate-700 text-sm text-center py-4">{lang === 'th' ? 'ไม่มีผู้ใช้ออนไลน์' : 'No users online'}</p>
              : <div className="space-y-2 max-h-52 overflow-y-auto">
                  {online.map(u => (
                    <div key={u.userId} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {u.username[0].toUpperCase()}
                      </div>
                      <span className="text-slate-300">{u.username}</span>
                    </div>
                  ))}
                </div>}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2"><Activity size={15} className="text-purple-400" />{lang === 'th' ? 'ห้องล่าสุด' : 'Recent Rooms'}</h3>
              <button onClick={loadRooms} className="text-slate-600 hover:text-slate-400 transition"><RefreshCw size={13} /></button>
            </div>
            {rooms.length === 0
              ? <p className="text-slate-700 text-sm text-center py-4">{lang === 'th' ? 'ยังไม่มีห้อง' : 'No rooms'}</p>
              : <div className="space-y-2 max-h-52 overflow-y-auto">
                  {rooms.slice(0, 8).map(r => (
                    <div key={r.RoomId} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.GameColor || '#7c3aed' }} />
                      <span className="text-slate-500 font-mono">{r.RoomId.slice(0, 8)}</span>
                      <span className="text-slate-400 flex-1 truncate">{lang === 'th' ? r.GameNameTh : r.GameName}</span>
                      <span className={`badge text-[10px] ${r.Status === 'active' ? 'badge-green' : 'badge-red'}`}>{r.Status}</span>
                    </div>
                  ))}
                </div>}
          </div>

          <div className="card p-5 md:col-span-2">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Activity size={15} className="text-blue-400" />{lang === 'th' ? 'สถานะระบบ' : 'System Status'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'API Server', status: true },
                { label: 'SQL Server', status: true },
                { label: 'Socket.IO',  status: true },
                { label: 'Google OAuth', status: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE' },
              ].map(({ label, status }) => (
                <div key={label} className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: status ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${status ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                  {status ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" /> : <XCircle size={14} className="text-red-400 flex-shrink-0" />}
                  <span className="text-xs font-medium" style={{ color: status ? '#4ade80' : '#f87171' }}>{label}</span>
                </div>
              ))}
            </div>
            {stats?.pendingOTPs > 0 && (
              <div className="mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
                style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                <Clock size={12} />
                {lang === 'th' ? `OTP รอยืนยัน: ${stats.pendingOTPs} รหัส` : `Pending OTPs: ${stats.pendingOTPs}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── USERS ────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={userSearch}
                onChange={e => handleUserSearch(e.target.value)}
                placeholder={lang === 'th' ? 'ค้นหา username หรือ email...' : 'Search username or email...'}
                className="input-base text-sm pl-9"
              />
            </div>
            <div className="text-xs text-slate-600 flex-shrink-0">
              {lang === 'th' ? `รวม ${userTotal} คน` : `${userTotal} total`}
            </div>
          </div>

          <div className="card overflow-hidden table-wrap">
            {tableLoading
              ? <div className="flex justify-center py-12"><Loader2 size={24} className="text-slate-600 animate-spin" /></div>
              : <table className="w-full text-sm" style={{ minWidth: '500px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      {[lang === 'th' ? 'ผู้ใช้' : 'User', 'Email', 'Status', lang === 'th' ? 'เกม' : 'Games', lang === 'th' ? 'สิทธิ์' : 'Role', ''].map((h, i) => (
                        <th key={i} className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id} className="border-b border-[var(--border)]/40 hover:bg-white/[0.01] transition group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {u.username[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1">
                                {u.username}
                                {u.hasGoogle && <span className="text-[10px] text-blue-400">G</span>}
                              </div>
                              <div className="text-xs text-slate-600">{new Date(u.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell max-w-[180px] truncate">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${u.isOnline ? 'text-green-400' : 'text-slate-600'}`}
                            style={u.isOnline ? { background: 'rgba(74,222,128,0.1)' } : {}}>
                            {u.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
                            {u.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{u.stats.totalGames}</td>
                        <td className="px-4 py-3">
                          {u.isAdmin
                            ? <span className="badge badge-yellow text-[10px]"><Crown size={9} /> Admin</span>
                            : <span className="text-xs text-slate-600">{lang === 'th' ? 'ผู้ใช้' : 'User'}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {u._id !== user._id && (
                            <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition">
                              <button onClick={() => handleToggleAdmin(u._id, u.username)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition"
                                style={{ background: u.isAdmin ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)', color: u.isAdmin ? '#f87171' : '#fbbf24', border: `1px solid ${u.isAdmin ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)'}` }}>
                                {u.isAdmin ? <UserX size={11} /> : <Crown size={11} />}
                                <span className="hidden sm:inline">{u.isAdmin ? (lang === 'th' ? 'ถอด' : 'Remove') : (lang === 'th' ? 'ตั้ง Admin' : 'Admin')}</span>
                              </button>
                              <button onClick={() => openDeleteUser(u)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition"
                                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                                <Trash2 size={11} />
                                <span className="hidden sm:inline">{lang === 'th' ? 'ลบ' : 'Del'}</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
          </div>

          {userTotal > 15 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <button onClick={() => loadUsers(userPage - 1, userSearch)} disabled={userPage === 1}
                className="btn-ghost px-4 py-2 rounded-lg text-xs disabled:opacity-30">
                ← {lang === 'th' ? 'ก่อนหน้า' : 'Prev'}
              </button>
              <span className="text-slate-600">
                {lang === 'th' ? `หน้า ${userPage} / ${Math.ceil(userTotal / 15)}` : `Page ${userPage} / ${Math.ceil(userTotal / 15)}`}
              </span>
              <button onClick={() => loadUsers(userPage + 1, userSearch)} disabled={userPage >= Math.ceil(userTotal / 15)}
                className="btn-ghost px-4 py-2 rounded-lg text-xs disabled:opacity-30">
                {lang === 'th' ? 'ถัดไป' : 'Next'} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── GAMES ────────────────────────────────────────────── */}
      {tab === 'games' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={openAdd} className="btn-primary text-sm gap-1.5 px-4 py-2.5 rounded-xl">
              <Plus size={15} /> {lang === 'th' ? 'เพิ่มเกม' : 'Add Game'}
            </button>
          </div>
          <div className="card overflow-hidden table-wrap">
            {games.length === 0
              ? <div className="text-center py-12 text-slate-600"><div className="text-4xl mb-3">🃏</div><p>{lang === 'th' ? 'ยังไม่มีเกม' : 'No games'}</p></div>
              : <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{lang === 'th' ? 'เกม' : 'Game'}</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">{lang === 'th' ? 'ชื่อไทย' : 'Thai'}</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                      <th className="px-4 py-3.5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map(g => (
                      <tr key={g._id} className="border-b border-[var(--border)]/40 hover:bg-white/[0.01] transition group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${g.color}15`, border: `1px solid ${g.color}30` }}>
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                            </div>
                            <span className="font-semibold text-white text-sm leading-tight">{g.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell max-w-[140px]">
                          <span className="line-clamp-2">{g.nameTh}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge text-[10px] ${g.isActive ? 'badge-green' : 'badge-red'}`}>
                            {g.isActive ? (lang === 'th' ? 'เปิด' : 'On') : (lang === 'th' ? 'ปิด' : 'Off')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition">
                            <button onClick={() => openEdit(g)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition active:scale-95" title={lang === 'th' ? 'แก้ไข' : 'Edit'}><Pencil size={14} /></button>
                            <button onClick={() => handleDeleteGame(g._id, g.name)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition active:scale-95" title={lang === 'th' ? 'ลบ' : 'Delete'}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
          </div>
        </div>
      )}

      {/* ── ROOMS ────────────────────────────────────────────── */}
      {tab === 'rooms' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={loadRooms} className="btn-ghost text-sm gap-1.5 px-3 py-2 rounded-lg">
              <RefreshCw size={14} /> {lang === 'th' ? 'รีเฟรช' : 'Refresh'}
            </button>
          </div>
          <div className="card overflow-hidden table-wrap">
            {rooms.length === 0
              ? <div className="text-center py-12 text-slate-600"><div className="text-4xl mb-3">🎮</div><p>{lang === 'th' ? 'ยังไม่มีห้อง' : 'No rooms'}</p></div>
              : <table className="w-full text-sm" style={{ minWidth: '500px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      {['Room ID', lang === 'th' ? 'เกม' : 'Game', lang === 'th' ? 'สถานะ' : 'Status', lang === 'th' ? 'เวลา' : 'Time'].map((h, i) => (
                        <th key={i} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map(r => (
                      <tr key={r.RoomId} className="border-b border-[var(--border)]/40 hover:bg-white/[0.01] transition">
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{r.RoomId.slice(0, 12)}...</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: r.GameColor || '#7c3aed' }} />
                            <span className="text-slate-300">{lang === 'th' ? r.GameNameTh : r.GameName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`badge text-xs ${r.Status === 'active' ? 'badge-green' : r.Status === 'waiting' ? 'badge-yellow' : 'badge-red'}`}>{r.Status}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs">
                          {new Date(r.CreatedAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
          </div>
        </div>
      )}
    </div>
  );
}
