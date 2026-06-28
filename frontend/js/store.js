/* =========== Cache store (Ф0 + tier files) ===========
 * Single source of truth for history on the front. Holds ALL posts in memory (sorted
 * by ts) as the working copy; persists to an append-only NDJSON FILE in OPFS, else
 * IndexedDB (older phones). Same db* API the rest of the app calls.
 *
 * LOD TIER FILES: pre-aggregated bucket summaries (1h / 1d / 1w / 1mo) persisted as
 * bin_<tier>.ndjson, kept in sync incrementally so long-range views read a few hundred
 * ready records instead of scanning millions of raw points. (No 1m FILE — at ~82s cadence
 * a 1-minute tier ≈ raw size; finer-than-1h resolution is binned on-the-fly from a raw
 * WINDOW, which is bounded and cheap even with years of history.)
 *
 * Depends on globals: parseServerTs (utils.js), entryTs (history.js) — resolved at call time. */
const Cache = (() => {
  const FILE = 'meteo_raw.ndjson';
  const DB_NAME = 'meteo_v1', DB_STORE = 'history';
  const TIER_MS = { '1h': 3600e3, '1d': 86400e3, '1w': 604800e3, '1mo': 2592000e3 };
  let mem = [];            /* sorted-by-ts working copy */
  let tiers = { '1h': [], '1d': [], '1w': [], '1mo': [] };   /* each: sorted bucket records */
  let backend = '';        /* 'opfs' | 'idb' */
  let fh = null;           /* OPFS raw file handle */
  let idb = null;          /* IndexedDB handle (fallback) */
  let ready = null;        /* init() promise (run once) */
  let dupes = 0;

  const tsOf = e => (typeof e.ts === 'number' && e.ts > 0) ? e.ts : parseServerTs(e.timestamp ?? e.t);
  const sortDedupe = () => { const m = new Map(); for (const e of mem) if (e.ts) m.set(e.ts, e); mem = [...m.values()].sort((a, b) => a.ts - b.ts); };
  const lower = ts => { let a = 0, b = mem.length; while (a < b){ const m = (a + b) >> 1; if (mem[m].ts < ts) a = m + 1; else b = m; } return a; };

  /* ---- per-entry aggregate (pulse mean/max, batt, solar, csq, dir mode) ---- */
  function aggEntry(e){
    const arr = e.speed || e.sp;
    let sm, sx;
    if (Array.isArray(arr) && arr.length){ let s = 0, mx = 0; for (const v of arr){ s += v; if (v > mx) mx = v; } sm = s / arr.length; sx = mx; }
    else { sm = e.speed_mean ?? e.sm ?? e.s ?? 0; sx = e.speed_max ?? e.sx ?? sm; }
    const b = e.batt_mv ?? e.b ?? 0, sol = e.solar_mv ?? e.sol ?? null, c = e.csq ?? e.c ?? 0;
    let vm = e.vane_mode ?? e.vm;
    if (vm == null){ const v = (e.vane && e.vane[0]) ?? (e.va && e.va[0]); if (v != null && v !== 255){ for (let k = 0; k < 8; k++) if (!(v & (1 << k))){ vm = k; break; } } }
    return { sm, sx, b, sol, c, vm: (vm != null && vm >= 0 && vm < 8) ? vm : null };
  }
  /* aggregate mem[fromIdx..] into bucket records of size bucketMs */
  function aggregateRange(bucketMs, fromIdx){
    const map = new Map();
    for (let i = fromIdx; i < mem.length; i++){
      const e = mem[i], ts = e.ts; if (!ts) continue;
      const a = aggEntry(e), key = Math.floor(ts / bucketMs);
      let acc = map.get(key);
      if (!acc){ acc = { tsum: 0, n: 0, smsum: 0, sx: 0, bsum: 0, bn: 0, ssum: 0, sn: 0, c: 0, dirs: [0,0,0,0,0,0,0,0] }; map.set(key, acc); }
      acc.tsum += ts; acc.n++; acc.smsum += a.sm; if (a.sx > acc.sx) acc.sx = a.sx;
      if (a.b > 0){ acc.bsum += a.b; acc.bn++; }
      if (typeof a.sol === 'number'){ acc.ssum += a.sol; acc.sn++; }
      if (a.c >= 1 && a.c <= 31) acc.c = a.c; else if (a.c === 99 && !acc.c) acc.c = 99;   /* keep lost-signal 99 */
      if (a.vm != null) acc.dirs[a.vm]++;
    }
    const out = [];
    for (const acc of map.values()){
      let vm = null, mx = 0; for (let k = 0; k < 8; k++) if (acc.dirs[k] > mx){ mx = acc.dirs[k]; vm = k; }
      out.push({ t: Math.round(acc.tsum / acc.n), sm: acc.smsum / acc.n, sx: acc.sx, b: acc.bn ? Math.round(acc.bsum / acc.bn) : 0, sol: acc.sn ? Math.round(acc.ssum / acc.sn) : null, c: acc.c, vm, cn: acc.n });
    }
    out.sort((x, y) => x.t - y.t); return out;
  }
  function rebuildAllTiers(){ for (const k in TIER_MS) tiers[k] = aggregateRange(TIER_MS[k], 0); }
  /* incrementally refresh only the buckets the new tail touched */
  function updateTiers(minNewTs){
    for (const k in TIER_MS){
      const bm = TIER_MS[k], affFrom = Math.floor(minNewTs / bm) * bm;
      const kept = tiers[k].filter(r => Math.floor(r.t / bm) * bm < affFrom);
      tiers[k] = kept.concat(aggregateRange(bm, lower(affFrom)));
    }
  }
  async function persistTiers(){
    if (backend !== 'opfs') return;
    try {
      const root = await navigator.storage.getDirectory();
      for (const k in TIER_MS){
        const tfh = await root.getFileHandle('bin_' + k + '.ndjson', { create: true });
        const w = await tfh.createWritable();
        await w.write(tiers[k].length ? tiers[k].map(r => JSON.stringify(r)).join('\n') + '\n' : '');
        await w.close();
      }
    } catch {}
  }
  async function loadTiers(){
    if (backend === 'opfs'){
      let any = false;
      try {
        const root = await navigator.storage.getDirectory();
        for (const k in TIER_MS){
          try { const txt = await (await (await root.getFileHandle('bin_' + k + '.ndjson')).getFile()).text();
                tiers[k] = txt ? txt.split('\n').filter(Boolean).map(l => JSON.parse(l)) : []; if (tiers[k].length) any = true; }
          catch { tiers[k] = []; }
        }
      } catch {}
      if (!any && mem.length){ rebuildAllTiers(); await persistTiers(); }
    } else {
      rebuildAllTiers();   /* idb: tiers kept in-memory only */
    }
  }

  /* ---- OPFS raw backend ---- */
  async function opfsLoad(){
    const root = await navigator.storage.getDirectory();
    fh = await root.getFileHandle(FILE, { create: true });
    const txt = await (await fh.getFile()).text();
    mem = [];
    if (txt) for (const line of txt.split('\n')){ if (!line) continue; try { const e = JSON.parse(line); const ts = tsOf(e); if (ts){ e.ts = ts; mem.push(e); } } catch {} }
    sortDedupe();
  }
  async function opfsAppend(records){
    if (!records.length) return;
    const f = await fh.getFile();
    const w = await fh.createWritable({ keepExistingData: true });
    await w.seek(f.size);
    await w.write(records.map(e => JSON.stringify(e)).join('\n') + '\n');
    await w.close();
  }
  async function opfsRewrite(){
    const w = await fh.createWritable();
    await w.write(mem.length ? mem.map(e => JSON.stringify(e)).join('\n') + '\n' : '');
    await w.close(); dupes = 0;
  }

  /* ---- IndexedDB fallback ---- */
  function idbOpen(){ return new Promise((res, rej) => { const r = indexedDB.open(DB_NAME, 1); r.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'ts' }); }; r.onsuccess = e => res(e.target.result); r.onerror = e => rej(e.target.error); }); }
  function idbReadAll(db){ return new Promise(res => { const out = []; const rq = db.transaction(DB_STORE).objectStore(DB_STORE).openCursor(); rq.onsuccess = e => { const c = e.target.result; if (c){ out.push(c.value); c.continue(); } else res(out); }; rq.onerror = () => res([]); }); }
  async function idbPut(records){ if (!idb || !records.length) return; await new Promise((res, rej) => { const tx = idb.transaction(DB_STORE, 'readwrite'); const st = tx.objectStore(DB_STORE); for (const e of records) st.put(e); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  async function idbClear(){ if (!idb) return; await new Promise(res => { const tx = idb.transaction(DB_STORE, 'readwrite'); tx.objectStore(DB_STORE).clear(); tx.oncomplete = res; }); }

  /* ---- init ---- */
  function init(){
    if (ready) return ready;
    ready = (async () => {
      const hasOPFS = !!(navigator.storage && navigator.storage.getDirectory && self.FileSystemFileHandle && FileSystemFileHandle.prototype.createWritable);
      if (hasOPFS){
        try {
          await opfsLoad(); backend = 'opfs';
          if (!mem.length){
            try { const old = await idbOpen(); const rows = (await idbReadAll(old)).filter(e => typeof e.ts === 'number' && e.ts > 1e12); old.close && old.close();
                  if (rows.length){ mem = rows; sortDedupe(); await opfsRewrite(); } } catch {}
          }
          await loadTiers();
          return;
        } catch {}
      }
      backend = 'idb';
      idb = await idbOpen();
      mem = (await idbReadAll(idb)).filter(e => typeof e.ts === 'number' && e.ts > 1e12);
      sortDedupe();
      await loadTiers();
    })();
    return ready;
  }

  /* ---- public ops ---- */
  async function append(entries){
    await init();
    if (!entries || !entries.length) return;
    const m = new Map(mem.map(e => [e.ts, e]));
    const recs = []; let minNew = Infinity;
    for (const e of entries){
      const ts = tsOf(e); if (!(typeof ts === 'number' && ts > 0)) continue;
      const rec = Object.assign({}, e, { ts });
      if (m.has(ts)) dupes++;
      m.set(ts, rec); recs.push(rec); if (ts < minNew) minNew = ts;
    }
    mem = [...m.values()].sort((a, b) => a.ts - b.ts);
    if (backend === 'opfs'){ await opfsAppend(recs); if (dupes > 1000) await opfsRewrite(); }
    else await idbPut(recs);
    if (recs.length && isFinite(minNew)){ updateTiers(minNew); await persistTiers(); }
  }
  async function range(fromMs, toMs){ await init(); const out = []; for (let k = lower(fromMs); k < mem.length && mem[k].ts <= toMs; k++) out.push(mem[k]); return out; }
  async function newestTs(){ await init(); return mem.length ? mem[mem.length - 1].ts : 0; }
  async function oldestTs(){ await init(); return mem.length ? mem[0].ts : 0; }
  async function count(){ await init(); return mem.length; }
  async function clear(){ await init(); mem = []; dupes = 0; for (const k in TIER_MS) tiers[k] = []; if (backend === 'opfs'){ await opfsRewrite(); await persistTiers(); } else await idbClear(); }
  async function trim(retentionDays){
    await init();
    if (!retentionDays || retentionDays <= 0) return 0;
    const before = mem.length, i = lower(Date.now() - retentionDays * 86400000);
    if (i > 0){ mem = mem.slice(i); rebuildAllTiers(); if (backend === 'opfs'){ await opfsRewrite(); await persistTiers(); } else { await idbClear(); await idbPut(mem); } }
    return before - mem.length;
  }
  async function estimate(){ if (navigator.storage?.estimate){ try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } catch {} } return { used: mem.length * 150, quota: 0 }; }

  /* pick the FINEST tier whose record count over `span` stays <= ~2000; null = none coarse
   * enough is needed yet (caller bins raw on-the-fly for that window). */
  function pickTierName(span){
    const order = ['1h', '1d', '1w', '1mo'];
    for (const k of order){ if (span / TIER_MS[k] <= 2000) return k; }
    return '1mo';
  }
  function tier(name, from, to){
    const arr = tiers[name] || [];
    let a = 0, b = arr.length; while (a < b){ const m = (a + b) >> 1; if (arr[m].t < from) a = m + 1; else b = m; }
    const out = []; for (let i = a; i < arr.length && arr[i].t <= to; i++) out.push(arr[i]); return out;
  }
  function tierCounts(){ const o = {}; for (const k in TIER_MS) o[k] = tiers[k].length; return o; }

  return { init, append, range, newestTs, oldestTs, count, clear, trim, estimate, tier, pickTierName, tierCounts, get backend(){ return backend; } };
})();
