'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import { UserPlus, UserCheck, UserX, Swords, Search, Trophy, CheckCircle, XCircle } from 'lucide-react';

function EloBar({ elo }) {
  const pct = Math.min(100, Math.round(((elo - 100) / 1900) * 100));
  const color = elo >= 1600 ? '#818cf8' : elo >= 1400 ? '#fbbf24' : elo >= 1200 ? '#94a3b8' : '#b45309';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{elo}</span>
    </div>
  );
}

export default function FriendsPage() {
  const { user, loading, lang } = useAuth();
  const { getSocket, safeEmit } = useSocket();
  const router = useRouter();

  const [friends,  setFriends]  = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab]           = useState('friends'); // 'friends' | 'requests'
  const [search,   setSearch]   = useState('');
  const [results,  setResults]  = useState([]);
  const [searching, setSearching] = useState(false);
  const [toast,    setToast]    = useState(null);
  const [busy,     setBusy]     = useState({}); // { [userId]: true }

  const th = lang === 'th';

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadFriends  = useCallback(() => api.get('/api/friends').then(d => setFriends(d.friends || [])).catch(() => {}), []);
  const loadRequests = useCallback(() => api.get('/api/friends/requests').then(d => setRequests(d.requests || [])).catch(() => {}), []);

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return; }
    if (!user) return;
    loadFriends();
    loadRequests();
  }, [user, loading]);

  // Real-time friend events
  useEffect(() => {
    if (!user) return;
    const socket = getSocket?.();
    if (!socket) return;
    const onReq = ({ fromUsername }) => {
      loadRequests();
      showToast(th ? `${fromUsername} ส่งคำขอเป็นเพื่อน` : `${fromUsername} sent you a friend request`, 'info');
    };
    const onAcc = ({ byUsername }) => {
      loadFriends();
      showToast(th ? `${byUsername} ยอมรับคำขอเพื่อนแล้ว` : `${byUsername} accepted your friend request`);
    };
    socket.on('friend_request_received', onReq);
    socket.on('friend_request_accepted', onAcc);
    return () => { socket.off('friend_request_received', onReq); socket.off('friend_request_accepted', onAcc); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Search with debounce
  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { users } = await api.get(`/api/users/search?q=${encodeURIComponent(search.trim())}`);
        setResults(users);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const sendRequest = async (targetId, username) => {
    setBusy(b => ({ ...b, [targetId]: true }));
    try {
      await api.post(`/api/friends/request/${targetId}`, {});
      showToast(th ? `ส่งคำขอเพื่อนถึง ${username} แล้ว` : `Friend request sent to ${username}`);
    } catch (e) {
      showToast(e.message || (th ? 'เกิดข้อผิดพลาด' : 'Error'), 'error');
    } finally { setBusy(b => ({ ...b, [targetId]: false })); }
  };

  const acceptRequest = async (fromId) => {
    setBusy(b => ({ ...b, [fromId]: true }));
    try {
      await api.post(`/api/friends/accept/${fromId}`, {});
      setRequests(r => r.filter(x => x.from_id !== fromId));
      loadFriends();
      showToast(th ? 'ยอมรับคำขอเพื่อนแล้ว' : 'Friend request accepted');
    } catch { showToast(th ? 'เกิดข้อผิดพลาด' : 'Error', 'error'); }
    finally { setBusy(b => ({ ...b, [fromId]: false })); }
  };

  const declineRequest = async (fromId) => {
    setBusy(b => ({ ...b, [fromId]: true }));
    try {
      await api.delete(`/api/friends/${fromId}`);
      setRequests(r => r.filter(x => x.from_id !== fromId));
    } catch {} finally { setBusy(b => ({ ...b, [fromId]: false })); }
  };

  const removeFriend = async (friendId, username) => {
    if (!confirm(th ? `ลบ ${username} ออกจากรายชื่อเพื่อน?` : `Remove ${username} from friends?`)) return;
    setBusy(b => ({ ...b, [friendId]: true }));
    try {
      await api.delete(`/api/friends/${friendId}`);
      setFriends(f => f.filter(x => x._id !== friendId));
      showToast(th ? 'ลบเพื่อนแล้ว' : 'Friend removed');
    } catch {} finally { setBusy(b => ({ ...b, [friendId]: false })); }
  };

  if (loading) return null;

  return (
    <main className="min-h-screen pt-[var(--navbar-h,4rem)]" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)' }}>
            <UserPlus size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{th ? 'เพื่อน' : 'Friends'}</h1>
            <p className="text-xs text-slate-500">{friends.length} {th ? 'เพื่อน' : 'friends'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'var(--bg-2)' }}>
          {[
            { key: 'friends',  label: th ? `เพื่อน (${friends.length})` : `Friends (${friends.length})` },
            { key: 'requests', label: th ? `คำขอ (${requests.length})` : `Requests (${requests.length})` },
            { key: 'add',      label: th ? 'เพิ่มเพื่อน' : 'Add Friend' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${tab === key ? 'bg-blue-600/20 text-blue-300' : 'text-slate-500 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* FRIENDS TAB */}
        {tab === 'friends' && (
          <div className="space-y-2">
            {friends.length === 0 ? (
              <div className="text-center py-16">
                <UserPlus size={40} className="text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">{th ? 'ยังไม่มีเพื่อน — ค้นหาและเพิ่มเพื่อนได้ที่แท็บ "เพิ่มเพื่อน"' : 'No friends yet — find players in the "Add Friend" tab'}</p>
              </div>
            ) : friends.map(f => (
              <div key={f._id} className="card p-4 flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
                    {f.username[0].toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-3)] ${f.isOnline ? 'bg-green-400' : 'bg-slate-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm truncate">{f.username}</span>
                    <span className="text-[10px] text-slate-600">{f.isOnline ? (th ? 'ออนไลน์' : 'Online') : (th ? 'ออฟไลน์' : 'Offline')}</span>
                  </div>
                  <EloBar elo={f.elo} />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] text-slate-600">{f.stats.wins}W {f.stats.losses}L</span>
                  <button onClick={() => removeFriend(f._id, f.username)} disabled={busy[f._id]}
                    className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                    <UserX size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === 'requests' && (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle size={40} className="text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">{th ? 'ไม่มีคำขอเพื่อนที่รอดำเนินการ' : 'No pending friend requests'}</p>
              </div>
            ) : requests.map(r => (
              <div key={r.from_id} className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                  {r.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{r.username}</p>
                  <p className="text-xs text-slate-500">ELO {r.elo || 1000}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => acceptRequest(r.from_id)} disabled={busy[r.from_id]}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-40">
                    <CheckCircle size={13} />{th ? 'ยอมรับ' : 'Accept'}
                  </button>
                  <button onClick={() => declineRequest(r.from_id)} disabled={busy[r.from_id]}
                    className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADD FRIEND TAB */}
        {tab === 'add' && (
          <div>
            <div className="relative mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={th ? 'ค้นหาชื่อผู้เล่น...' : 'Search players...'}
                className="input-base pl-9 text-sm w-full" />
            </div>
            {searching && <p className="text-center text-xs text-slate-500 py-4">{th ? 'กำลังค้นหา...' : 'Searching...'}</p>}
            <div className="space-y-2">
              {results.filter(r => r._id !== user?._id).map(p => {
                const isFriend = friends.some(f => f._id === p._id);
                return (
                  <div key={p._id} className="card p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                      {p.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{p.username}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <Trophy size={9} className="text-emerald-400" />
                        ELO {p.elo || 1000}
                        <span>·</span>
                        {p.stats?.wins || 0}W {p.stats?.losses || 0}L
                      </div>
                    </div>
                    {isFriend ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <UserCheck size={13} />{th ? 'เพื่อนแล้ว' : 'Friends'}
                      </span>
                    ) : (
                      <button onClick={() => sendRequest(p._id, p.username)} disabled={busy[p._id]}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-400 hover:bg-blue-500/10 transition disabled:opacity-40">
                        <UserPlus size={13} />{th ? 'เพิ่มเพื่อน' : 'Add'}
                      </button>
                    )}
                  </div>
                );
              })}
              {!searching && search.trim().length >= 2 && results.length === 0 && (
                <p className="text-center text-xs text-slate-500 py-4">{th ? 'ไม่พบผู้เล่น' : 'No players found'}</p>
              )}
              {search.trim().length < 2 && !searching && (
                <p className="text-center text-xs text-slate-600 py-6">{th ? 'พิมพ์ชื่ออย่างน้อย 2 ตัวอักษรเพื่อค้นหา' : 'Type at least 2 characters to search'}</p>
              )}
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl anim-fade-up"
            style={{
              background: toast.type === 'error' ? 'rgba(239,68,68,0.9)' : toast.type === 'info' ? 'rgba(59,130,246,0.9)' : 'rgba(16,185,129,0.9)',
              backdropFilter: 'blur(12px)', color: 'white',
            }}>
            {toast.msg}
          </div>
        )}
      </div>
    </main>
  );
}
