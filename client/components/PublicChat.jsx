'use client';
import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, ChevronDown } from 'lucide-react';

export default function PublicChat({ lang, user, messages, onSend }) {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState('');
  const [unread, setUnread]   = useState(0);
  const chatEndRef             = useRef(null);
  const prevLenRef             = useRef(messages.length);

  // Count unread when chat is closed — update prevLen BEFORE checking open
  useEffect(() => {
    const prev = prevLenRef.current;
    prevLenRef.current = messages.length;
    if (!open && messages.length > prev) {
      setUnread(p => p + (messages.length - prev));
    }
  }, [messages.length, open]);

  // Auto-scroll on open or new messages
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [open, messages.length]);

  const send = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  const t = lang === 'th';

  return (
    <>
      {/* ── Floating panel ── */}
      {open && (
        <div
          className="fixed z-40 anim-slide-up flex flex-col shadow-2xl"
          style={{
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            right: 'max(12px, env(safe-area-inset-right, 0px))',
            width: 'min(360px, calc(100vw - 24px))',
            maxHeight: 'min(480px, calc(100dvh - 200px))',
            background: 'rgba(10,10,22,0.97)',
            border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="text-sm font-semibold text-white flex-1">
              {t ? 'แชทสาธารณะ' : 'Public Chat'}
            </span>
            <button onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition">
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-20">
                <p className="text-slate-700 text-xs text-center">
                  {t ? 'ยังไม่มีข้อความ เป็นคนแรกที่พูด!' : 'No messages yet. Say something!'}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.from._id === user?._id;
                const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {msg.from.username[0].toUpperCase()}
                    </div>
                    <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[9px] text-slate-600 mb-0.5 px-1">
                        {isMe ? (t ? 'คุณ' : 'You') : msg.from.username} · {time}
                      </span>
                      <div className={`px-2.5 py-1.5 rounded-2xl text-xs leading-relaxed break-words
                        ${isMe ? 'rounded-br-sm text-white' : 'rounded-bl-sm text-slate-200'}`}
                        style={isMe
                          ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }
                          : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t flex-shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={t ? 'พิมพ์ข้อความ...' : 'Type a message...'}
                className="input-base text-xs flex-1 py-2 px-3"
                style={{ minHeight: '36px' }}
                maxLength={200}
                enterKeyHint="send"
              />
              <button onClick={send} disabled={!input.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 flex-shrink-0"
                style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                <Send size={14} />
              </button>
            </div>
            {input.length > 0 && (
              <p className="text-[10px] text-right mt-1"
                style={{ color: input.length >= 200 ? '#f87171' : input.length > 150 ? '#94a3b8' : '#475569' }}>
                {input.length}/200
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Toggle button ── */}
      <button
        onClick={() => setOpen(p => !p)}
        className="fixed z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95"
        style={{
          bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          right: 'max(16px, env(safe-area-inset-right, 16px))',
          background: open ? 'rgba(74,222,128,0.25)' : 'rgba(10,10,22,0.95)',
          border: `1px solid ${open ? 'rgba(74,222,128,0.4)' : 'rgba(74,222,128,0.2)'}`,
          backdropFilter: 'blur(12px)',
        }}
        title={t ? 'แชทสาธารณะ' : 'Public Chat'}
      >
        {open
          ? <X size={18} className="text-green-400" />
          : <MessageSquare size={18} className="text-green-400" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  );
}
