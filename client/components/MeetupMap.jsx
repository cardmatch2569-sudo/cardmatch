'use client';
import { useEffect, useRef, useState } from 'react';
import { Satellite, Map as MapIcon, LocateFixed } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import 'leaflet/dist/leaflet.css';

const THAILAND = { center: [13.2, 101.0], zoom: 5 };
const PIN_MIN_ZOOM = 13;
const LAYER_KEY = 'cg_map_layer';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const ESRI_ATTR = 'Imagery &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics';
const OSM_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

// Satellite + road/place labels; OSM for the densest shop/landmark data
const buildLayers = (L) => ({
  sat: L.layerGroup([
    // Rural Thailand often lacks z19 imagery: upscale z18 instead of showing grey "no data" tiles
    L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: ESRI_ATTR }),
    L.tileLayer(ESRI + 'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, opacity: 0.85 }),
    L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18 }),
  ]),
  map: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: OSM_ATTR }),
});

// Leaflet's default marker images break under bundlers, so use a CSS pin.
const PIN_HTML = `
  <div class="cm-pin">
    <span class="cm-pin-pulse"></span>
    <div class="cm-pin-head"><div class="cm-pin-dot"></div></div>
  </div>`;

const readLayer = () => {
  try { return localStorage.getItem(LAYER_KEY) === 'map' ? 'map' : 'sat'; } catch { return 'sat'; }
};

export default function MeetupMap({ value, onChange, focus, readOnly = false, height = 240 }) {
  const { lang } = useAuth();
  const th = lang === 'th';
  const elRef     = useRef(null);
  const mapRef    = useRef(null);
  const markerRef = useRef(null);
  const LRef      = useRef(null);
  const layersRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const [layer, setLayer] = useState('sat');

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
        zoom:   value ? 17 : f ? (f.zoom ?? 11) : THAILAND.zoom,
        scrollWheelZoom: !readOnly,
        // One-finger drag on a small preview map would hijack page scrolling on phones
        dragging: !readOnly || !L.Browser.mobile,
        attributionControl: true,
      });
      map.attributionControl.setPrefix(false);
      layersRef.current = buildLayers(L);
      const initial = readLayer();
      layersRef.current[initial].addTo(map);
      setLayer(initial);
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

  const switchLayer = (next) => {
    const map = mapRef.current, layers = layersRef.current;
    if (!map || !layers || next === layer) return;
    map.removeLayer(layers[layer]);
    layers[next].addTo(map);
    setLayer(next);
    try { localStorage.setItem(LAYER_KEY, next); } catch {}
  };

  const recenter = () => {
    if (value) mapRef.current?.setView([value.lat, value.lng], 17);
  };

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
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 17));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  useEffect(() => {
    if (!focus || markerRef.current || !mapRef.current) return;
    mapRef.current.setView([focus.lat, focus.lng], focus.zoom ?? 11);
  }, [focus?.lat, focus?.lng, focus?.zoom]);

  const tab = (key, Icon, label) => (
    <button type="button" onClick={() => switchLayer(key)} aria-pressed={layer === key}
      className={`flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all duration-200
        ${layer === key ? 'bg-purple-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}>
      <Icon size={12} />{label}
    </button>
  );

  return (
    <div className="cm-map relative rounded-xl overflow-hidden border"
      style={{ isolation: 'isolate', borderColor: 'var(--border-2, #2c2e5a)' }}>
      <div ref={elRef} style={{ height, width: '100%', background: '#11131f' }} />

      <div className="absolute top-2 right-2 z-[1000] flex gap-0.5 p-0.5 rounded-xl"
        style={{ background: 'rgba(12,13,28,0.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {tab('sat', Satellite, th ? 'ดาวเทียม' : 'Satellite')}
        {tab('map', MapIcon, th ? 'แผนที่' : 'Map')}
      </div>

      {value && (
        <button type="button" onClick={recenter}
          aria-label={th ? 'กลับไปที่หมุด' : 'Back to pin'}
          className="absolute bottom-6 right-2 z-[1000] w-8 h-8 flex items-center justify-center rounded-lg
            text-slate-200 hover:text-white transition-colors"
          style={{ background: 'rgba(12,13,28,0.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <LocateFixed size={15} />
        </button>
      )}
    </div>
  );
}
