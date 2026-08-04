import { useState, useEffect } from 'react';

export default function useCountdown(targetDate, lang) {
  const [diff, setDiff] = useState(() => targetDate ? new Date(targetDate) - Date.now() : null);
  useEffect(() => {
    if (!targetDate) return;
    const id = setInterval(() => setDiff(new Date(targetDate) - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  if (diff === null || diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const isTh = lang !== 'en';
  if (h > 24) return isTh ? `${Math.floor(h / 24)} วัน` : `${Math.floor(h / 24)}d`;
  if (h >= 2) return isTh ? `${h}ชม. ${m}น.` : `${h}h ${m}m`;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
