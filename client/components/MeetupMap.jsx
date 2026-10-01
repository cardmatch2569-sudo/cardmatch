'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const THAILAND = { center: [13.2, 101.0], zoom: 5 };

// Leaflet's default marker images break under bundlers, so use a CSS pin.
const PIN_HTML = `
  <div style="position:relative;width:28px;height:28px;transform:translate(-50%,-100%)">
    <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:linear-gradient(135deg,#f43f5e,#be123c);border:2px solid #fff;
      box-shadow:0 4px 12px rgba(225,29,72,0.55)"></div>
    <div style="position:absolute;top:9px;left:9px;width:10px;height:10px;border-radius:50%;background:#fff"></div>
  </div>`;

const PIN_MIN_ZOOM = 13;

export default function MeetupMap({ value, onChange, focus, readOnly = false, height = 240 }) {
  const elRef     = useRef(null);
  const mapRef    = useRef(null);
  const markerRef = useRef(null);
  const LRef      = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const focusRef = useRef(focus);
  focusRef.current = focus;

  const placeMarker = (lat, lng) => {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      return;
    }
    const icon = L.divIcon({ html: PIN_HTML, className: '', iconSize: [0, 0] });
    markerRef.current = L.marker([lat, lng], { icon, draggable: !readOnly }).addTo(map);
    if (!readOnly) {
      markerRef.current.on('dragend', (e) => {
        const p = e.target.getLatLng();
        onChangeRef.current?.({ lat: p.lat, lng: p.lng });
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const f = focusRef.current;
      const map = L.map(elRef.current, {
        center: value ? [value.lat, value.lng] : f ? [f.lat, f.lng] : THAILAND.center,
        zoom:   value ? 16 : f ? (f.zoom ?? 11) : THAILAND.zoom,
        scrollWheelZoom: !readOnly,
        // One-finger drag on a small preview map would hijack page scrolling on phones
        dragging: !readOnly || !L.Browser.mobile,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      if (value) placeMarker(value.lat, value.lng);
      if (!readOnly) {
        map.on('click', (e) => {
          // A pin dropped at country/province zoom lands kilometres off, so zoom in first
          if (map.getZoom() < PIN_MIN_ZOOM && !markerRef.current) {
            map.setView(e.latlng, PIN_MIN_ZOOM + 2);
            return;
          }
          placeMarker(e.latlng.lat, e.latlng.lng);
          onChangeRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }
      // Map may mount inside a modal that is still sizing itself
      setTimeout(() => map.invalidateSize(), 120);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync externally-set positions (search result, GPS, clear)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const cur = markerRef.current?.getLatLng();
    if (cur && Math.abs(cur.lat - value.lat) < 1e-7 && Math.abs(cur.lng - value.lng) < 1e-7) return;
    placeMarker(value.lat, value.lng);
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  useEffect(() => {
    if (!focus || markerRef.current || !mapRef.current) return;
    mapRef.current.setView([focus.lat, focus.lng], focus.zoom ?? 11);
  }, [focus?.lat, focus?.lng, focus?.zoom]);

  return (
    <div className="rounded-xl overflow-hidden border"
      style={{ isolation: 'isolate', borderColor: 'var(--border-2, #2c2e5a)' }}>
      <div ref={elRef} style={{ height, width: '100%', background: '#1a1b2e' }} />
    </div>
  );
}
