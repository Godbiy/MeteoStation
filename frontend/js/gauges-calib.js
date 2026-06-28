/* =========== GAUGES =========== */
function buildTicks(){
  const cg = $('cticks');
  for (let a = 0; a < 360; a += 15){
    const major = (a % 45) === 0;
    const inner = major ? 78 : 84, outer = 88;
    const rad = (a - 90) * Math.PI / 180;
    const x1 = 110 + inner * Math.cos(rad), y1 = 110 + inner * Math.sin(rad);
    const x2 = 110 + outer * Math.cos(rad), y2 = 110 + outer * Math.sin(rad);
    const l = document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',x1.toFixed(1));l.setAttribute('y1',y1.toFixed(1));
    l.setAttribute('x2',x2.toFixed(1));l.setAttribute('y2',y2.toFixed(1));
    l.setAttribute('stroke', major ? '#5a6470' : '#363d47');
    l.setAttribute('stroke-width', major ? '2' : '1');
    cg.appendChild(l);
  }
  const calcg = $('cal-cticks');   /* mirror ticks into the calibration compass */
  if (calcg) cg.querySelectorAll('line').forEach(l => calcg.appendChild(l.cloneNode()));
  const sg = $('sticks');
  for (let i = 0; i <= 10; i++){
    const major = (i % 5) === 0;
    const a = -180 + (i / 10) * 180;
    const rad = a * Math.PI / 180;
    const inner = major ? 65 : 70, outer = 78;
    const x1 = 110 + inner * Math.cos(rad), y1 = 115 + inner * Math.sin(rad);
    const x2 = 110 + outer * Math.cos(rad), y2 = 115 + outer * Math.sin(rad);
    const l = document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',x1.toFixed(1));l.setAttribute('y1',y1.toFixed(1));
    l.setAttribute('x2',x2.toFixed(1));l.setAttribute('y2',y2.toFixed(1));
    l.setAttribute('stroke', major ? '#7d8590' : '#363d47');
    l.setAttribute('stroke-width', major ? '2' : '1');
    sg.appendChild(l);
  }
}
buildTicks();

function setCompass(deg){
  const a = $('arrow-grp');
  if (deg == null){ a.setAttribute('transform','rotate(0 110 110)'); a.style.opacity='0.3'; return; }
  a.setAttribute('transform', `rotate(${deg} 110 110)`); a.style.opacity = '1';
}
function setSpeedo(v){
  const mx = spdU().max;
  const c = Math.min(mx, Math.max(0, v || 0));
  const deg = -90 + (c / mx) * 180;
  $('spd-needle').setAttribute('transform', `rotate(${deg} 110 115)`);
  if (c < mx * 0.005){ $('spd-arc').setAttribute('d', 'M 30 115 L 30 115'); return; }
  const rad = ((c / mx) * 180 - 180) * Math.PI / 180;
  const ex = 110 + 80 * Math.cos(rad), ey = 115 + 80 * Math.sin(rad);
  $('spd-arc').setAttribute('d', `M 30 115 A 80 80 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`);
}
/* gauge tick labels + the KM/H caption follow the chosen unit */
function updateSpeedUnitLabels(){
  const mx = spdU().max;
  ['spd-t0','spd-t1','spd-t2','spd-t3','spd-t4'].forEach((id, i) => {
    const el = $(id); if (el) el.textContent = Math.round(mx * i / 4);
  });
  const cap = $('t-kmh-unit'); if (cap) cap.textContent = spdLbl();
}

/* Linear regression on (ts → batt_mv) over the visible window to project
 * when battery will hit BATT_CUTOFF_MV. Needs ≥6h of data and a negative slope
 * to mean anything; otherwise shows "collecting data". */
/* Battery pack settings (display/forecast only — firmware just reports voltage).
 * cutoff = empty voltage the "days left" extrapolates to; capacity for mAh est. */
let BATT_CUTOFF_MV = parseInt(localStorage.getItem('batt_cutoff'))   || 3300;
let BATT_CAPACITY  = parseInt(localStorage.getItem('batt_capacity')) || 2500;   /* mAh; default 2500 = typical single 18650 */
function renderBatteryForecast(pts){
  const fc = $('batt-forecast'); if (!fc) return;
  const setHide = (note) => {
    fc.style.display = 'block';
    $('bf-days').textContent = '—'; $('bf-rate').textContent = '—';
    $('bf-note').textContent = note;
  };
  const samples = pts.filter(p => typeof p.batt === 'number' && p.batt > 0);
  if (samples.length < 30){ setHide(t('bf_too_few')); return; }
  const t0 = samples[0].ts, tN = samples[samples.length-1].ts;
  const spanH = (tN - t0) / 3600000;
  if (spanH < 0.5){ setHide(t('bf_too_short')); return; }
  /* Least-squares: y = a + b*x, where x is hours from start, y is mV */
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
  for (const p of samples){
    const x = (p.ts - t0) / 3600000;   /* hours */
    const y = p.batt;
    sx += x; sy += y; sxx += x*x; sxy += x*y; n++;
  }
  const denom = n*sxx - sx*sx;
  if (denom === 0){ setHide(t('bf_const')); return; }
  const slope = (n*sxy - sx*sy) / denom;       /* mV per hour */
  const intercept = (sy - slope*sx) / n;        /* mV at x=0 */
  const lastMv = samples[samples.length-1].batt;
  $('bf-rate').textContent = slope.toFixed(2);
  $('bf-cutoff').textContent = BATT_CUTOFF_MV;
  if (slope >= -0.1){
    /* Not draining (charging or flat) → there's no finite "days left". Show ∞
     * in green instead of a dash so the field reads as intentional, not broken. */
    fc.style.display = 'block';
    $('bf-days').textContent = '∞';
    $('bf-days').style.color = 'var(--ok)';
    $('bf-rate').textContent = slope.toFixed(2);
    $('bf-note').textContent = slope > 0.1 ? `⬆ ${t('bf_charging')} ${slope.toFixed(1)} mV/h` : t('bf_flat');
    return;
  }
  /* Hours until lastMv reaches BATT_CUTOFF_MV at current slope */
  const hoursLeft = (lastMv - BATT_CUTOFF_MV) / -slope;
  const days = hoursLeft / 24;
  fc.style.display = 'block';
  $('bf-days').textContent = days >= 1 ? days.toFixed(1) : (hoursLeft).toFixed(1) + 'h';
  $('bf-days').style.color = days < 2 ? 'var(--err)' : days < 7 ? 'var(--warn)' : 'var(--ok)';
  /* Honesty note: Li-ion plateau means linear extrap underestimates time when
   * batt is above 3.7V (plateau will keep voltage flat) and overestimates below. */
  let note;
  if (lastMv > 3800) note = t('bf_above_plat');
  else if (lastMv > 3700) note = t('bf_on_plat');
  else if (lastMv > 3500) note = t('bf_exit_plat');
  else note = t('bf_steep');
  let extra = '';
  if (BATT_CAPACITY > 0){
    const pct = battPct(lastMv).pct;
    if (pct != null) extra = ` · ≈${Math.round(BATT_CAPACITY * pct / 100)}/${BATT_CAPACITY} mAh`;
  }
  $('bf-note').textContent = `${spanH.toFixed(1)}h ${t('bf_data')} · ${note}${extra}`;
}

/* Centered moving average over a sliding window. Preserves speedMax as the
 * MAX over the window (gust visibility) and dir as the dominant dir in window. */
function movingAvg(pts, win){
  if (!pts.length || win < 2) return pts;
  const half = Math.floor(win / 2);
  const out = [];
  for (let i = 0; i < pts.length; i++){
    const lo = Math.max(0, i - half);
    const hi = Math.min(pts.length, i + half + 1);
    let sum = 0, mx = 0, dirCount = new Array(8).fill(0), batt = 0, csq = 0, n = 0;
    for (let j = lo; j < hi; j++){
      sum += pts[j].speed;
      if (pts[j].speedMax > mx) mx = pts[j].speedMax;
      if (pts[j].dir != null && pts[j].dir >= 0 && pts[j].dir < 8) dirCount[pts[j].dir]++;
      batt += pts[j].batt || 0;
      csq  += pts[j].csq  || 0;
      n++;
    }
    const domDir = dirCount.reduce((a,b,k,arr) => arr[a] >= b ? a : k, 0);
    out.push({
      ts: pts[i].ts,
      speed: sum / n,
      speedMax: mx,
      batt: batt / n,
      csq:  csq / n,
      solar: pts[i].solar,
      dir: dirCount[domDir] ? domDir : null,
    });
  }
  return out;
}

/* Li-ion 4.2→3.3V discharge curve approximation. Returns {pct: 0..100, icon}.
 * Curve points (mV → %): 4200→100, 4100→90, 4000→80, 3900→60, 3800→40, 3700→20, 3600→10, 3300→0. */
function battPct(mv){
  if (mv == null) return { pct: null, icon: '🔋' };
  const C = [[4200,100],[4100,90],[4000,80],[3900,60],[3800,40],[3700,20],[3600,10],[3300,0]];
  if (mv >= C[0][0]) return iconFor(100);
  if (mv <= C[C.length-1][0]) return iconFor(0);
  for (let i = 0; i < C.length-1; i++){
    const [v1,p1] = C[i], [v2,p2] = C[i+1];
    if (mv <= v1 && mv >= v2){
      const pct = Math.round(p2 + (mv - v2) * (p1 - p2) / (v1 - v2));
      return iconFor(pct);
    }
  }
  return iconFor(0);
  function iconFor(pct){
    const icon = pct > 80 ? '🔋' : pct > 50 ? '🔋' : pct > 25 ? '🪫' : pct > 10 ? '🪫' : '⚠';
    return { pct, icon };
  }
}

/* =========== CALIB =========== */
/* Standard reference calibration measured on the assembled vane (2026-06).
 * Used as default when localStorage is empty AND as the "reset" target. */
const DEFAULT_CALIB = { N:66, NE:194, E:160, SE:40, S:24, SW:17, W:21, NW:5 };

function getCalib(){
  try {
    const j = JSON.parse(localStorage.getItem('vane_calib') || 'null');
    if (j && Object.keys(j).length) return j;
  } catch {}
  return { ...DEFAULT_CALIB };
}
function setCalib(c){ localStorage.setItem('vane_calib', JSON.stringify(c)); }
function vaneToDir(b){
  const c = getCalib();
  if (!Object.keys(c).length) return null;
  let best = null, bestH = 99;
  for (let i = 0; i < 8; i++){
    if (c[DIRS[i]] == null) continue;
    let x = (b ^ c[DIRS[i]]) & 0xFF, h = 0; while (x){ h += x & 1; x >>= 1; }
    if (h < bestH){ bestH = h; best = i; }
  }
  return best;
}
function renderCalibReadonly(){
  const c = getCalib(); const tb = $('calib-readonly'); tb.innerHTML = '';
  for (let i = 0; i < 8; i++){
    const v = c[DIRS[i]];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${DIRS[i]} · ${i*45}°</td><td style="color:${v!=null?'var(--ok)':'var(--mut)'}">${v!=null?v:'—'}</td>`;
    tb.appendChild(tr);
  }
  refreshServerCalibMeta();
}

const CALIB_KEY = '__EDIT_KEY__';

async function pushCalibToServer(){
  const c = getCalib();
  const stat = $('calib-stat');
  stat.textContent = '…'; stat.className = 'stat';
  try {
    const r = await fetch(SRV + '?save_calib=1&key=' + CALIB_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || 'http ' + r.status);
    stat.textContent = t('calib_pushed'); stat.className = 'stat ok';
    refreshServerCalibMeta();
    toast('✓ ' + t('calib_pushed'));
  } catch (e){
    stat.textContent = t('calib_push_err') + ': ' + e.message; stat.className = 'stat err';
  }
}

async function pullCalibFromServer(){
  const stat = $('calib-stat');
  stat.textContent = '…'; stat.className = 'stat';
  try {
    const r = await fetch(SRV + '?calib=1&t=' + Date.now());
    const j = await r.json();
    if (!j.calib || !Object.keys(j.calib).length){
      stat.textContent = t('calib_pull_err'); stat.className = 'stat warn';
      return;
    }
    setCalib(j.calib);
    renderCalibReadonly();
    stat.textContent = t('calib_pulled') + (j.updated ? ' (' + j.updated + ')' : '');
    stat.className = 'stat ok';
    toast('✓ ' + t('calib_pulled'));
  } catch (e){
    stat.textContent = t('calib_pull_err') + ': ' + e.message; stat.className = 'stat err';
  }
}

async function refreshServerCalibMeta(){
  const meta = $('calib-srv-meta'); if (!meta) return;
  try {
    const r = await fetch(SRV + '?calib=1&t=' + Date.now());
    const j = await r.json();
    if (j.updated) meta.textContent = t('calib_srv_updated') + j.updated;
    else           meta.textContent = t('calib_srv_empty');
  } catch { meta.textContent = ''; }
}

/* =========== CALIBRATION LIVE CAPTURE (Serial COM + GSM) ===========
 * Ported from serial.html, wired into the dashboard's own calib storage
 * (getCalib/setCalib) + readonly table — one page, no separate UI. */
let capPort = null, capReader = null, capKeep = false, capLineBuf = '';
let capByte = null, capSrc = 'serial', capGsmTimer = null;
let capRawLines = [], capRxCount = 0, capRxT0 = 0, capLastGsmTs = null;
const CAP_RAW_MAX = 200;
/* Append a line to the calibration Raw-stream log (newest first, capped). */
function capLogRaw(line){
  capRawLines.unshift(line);
  if (capRawLines.length > CAP_RAW_MAX) capRawLines.length = CAP_RAW_MAX;
  const r = $('cap-raw'); if (r) r.textContent = capRawLines.join('\n');
  capRxCount++;
  const rs = $('cap-rawstat');
  if (rs){ if (!capRxT0) capRxT0 = Date.now(); rs.textContent = `· ${capRxCount} ln / ${((Date.now()-capRxT0)/1000).toFixed(0)}s`; }
}

function capRenderByte(){
  $('cap-byte').textContent = capByte == null ? '—' : `${capByte} (${capByte.toString(2).padStart(8,'0')})`;
  const el = $('cap-bits'); el.innerHTML = '';
  for (let i = 7; i >= 0; i--){
    const d = document.createElement('div');
    if (capByte == null){ d.className = 'bit'; }
    else { const bit = (capByte >> i) & 1; d.className = 'bit ' + (bit ? 'on' : 'zero'); }  /* 0 = reed closed */
    d.textContent = i; el.appendChild(d);
  }
  setCalCompass(capByte == null ? null : vaneToDir(capByte));   /* show decoded direction */
}
/* point the calibration compass at the direction decoded from the live byte */
function setCalCompass(dir){
  const a = $('cal-arrow'); if (!a) return;
  if (dir == null){ a.setAttribute('transform', 'rotate(0 110 110)'); a.style.opacity = '.25'; if ($('cal-dir')) $('cal-dir').textContent = '—'; return; }
  a.setAttribute('transform', `rotate(${dir * 45} 110 110)`); a.style.opacity = '1';
  if ($('cal-dir')) $('cal-dir').textContent = `${DIRS[dir]} · ${dir * 45}°`;
}
function capRenderGrid(){
  const c = getCalib(); const el = $('cap-grid'); if (!el) return;
  el.innerHTML = ''; let n = 0;
  for (let i = 0; i < 8; i++){
    const dir = DIRS[i], cur = c[dir]; if (cur != null) n++;
    const b = document.createElement('button');
    b.className = 'cbtn' + (cur != null ? ' set' : '');
    b.innerHTML = `<div class="d">${dir}</div><div class="b">${cur != null ? 'byte=' + cur : t('cal_set')}</div>`;
    b.onclick = () => {
      if (capByte == null){ const s = $('cap-stat'); s.textContent = '⚠ ' + t('cal_nodata'); s.className = 'stat err'; return; }
      const cc = getCalib(); cc[dir] = capByte; setCalib(cc);
      const s = $('cap-stat'); s.textContent = `✓ ${dir} = ${capByte}`; s.className = 'stat ok';
      haptic(15); capRenderGrid(); renderCalibReadonly(); updateTabBadges();
    };
    el.appendChild(b);
  }
  const p = $('cap-progress'); if (p) p.textContent = `${n}/8`;
}
function capParseLine(line){
  capLogRaw(line);
  const m = line.match(/ON=([01]{8})/);   /* firmware debug: ON=bbbbbbbb OFF=… dec=… P=… */
  if (m){ capByte = parseInt(m[1], 2); capRenderByte(); }
}
async function capConnect(){
  try {
    capPort = await navigator.serial.requestPort();
    await capPort.open({ baudRate: +$('cap-baud').value || 4800 });
    $('cap-connect').disabled = true; $('cap-disconnect').disabled = false;
    $('cap-stat').textContent = '✓ ' + t('cal_streaming'); $('cap-stat').className = 'stat ok';
    capKeep = true; capReadLoop(); updateTabBadges();
  } catch (e){ $('cap-stat').textContent = '✗ ' + e.message; $('cap-stat').className = 'stat err'; }
}
async function capReadLoop(){
  capReader = capPort.readable.getReader(); const dec = new TextDecoder();
  try {
    while (capKeep){
      const { value, done } = await capReader.read();
      if (done) break; if (!value) continue;
      capLineBuf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = capLineBuf.indexOf('\n')) !== -1){
        const line = capLineBuf.slice(0, idx).replace(/\r$/, '');
        capLineBuf = capLineBuf.slice(idx + 1);
        if (line) capParseLine(line);
      }
      if (capLineBuf.length > 4096) capLineBuf = capLineBuf.slice(-2048);
    }
  } catch (e){ $('cap-stat').textContent = '✗ ' + e.message; $('cap-stat').className = 'stat err'; }
  finally { try { capReader.releaseLock(); } catch {} }
}
async function capDisconnect(){
  capKeep = false;
  try { await capReader?.cancel(); } catch {}
  try { await capPort?.close(); } catch {}
  capPort = null; capReader = null;
  $('cap-connect').disabled = false; $('cap-disconnect').disabled = true;
  $('cap-stat').textContent = t('cal_closed'); $('cap-stat').className = 'stat';
  updateTabBadges();
}
async function capGsmPoll(){
  try {
    const j = await fjson(SRV + '?live_now=1&t=' + Date.now());
    if (j && j.ok){ capByte = (j.vane_on ?? j.vane ?? null); capRenderByte();
      if (j.timestamp !== capLastGsmTs){ capLastGsmTs = j.timestamp;   /* only log a genuinely new snapshot, not the same one every 2s */
        capLogRaw(`[GSM] ${j.timestamp||'?'} vane=${j.vane_on ?? j.vane} pps=${j.pulses_sec} batt=${j.batt_mv}mV csq=${j.csq} age=${j.age_sec}s`); } }
  } catch {}
}
function capStopGsm(){ if (capGsmTimer){ clearInterval(capGsmTimer); capGsmTimer = null; } }
function capSetSource(src){
  capSrc = src;
  document.querySelectorAll('[data-capsrc]').forEach(b => b.classList.toggle('active', b.dataset.capsrc === src));
  $('cap-serial').style.display = src === 'serial' ? '' : 'none';
  $('cap-gsm').style.display    = src === 'gsm' ? '' : 'none';
  capStopGsm();
  if (src === 'gsm'){ capGsmPoll(); capGsmTimer = setInterval(capGsmPoll, 2000); }
  updateTabBadges();
}
if (!('serial' in navigator)){ $('cap-warn').style.display = 'block'; $('cap-connect').disabled = true; }
$('cap-connect').addEventListener('click', capConnect);
$('cap-disconnect').addEventListener('click', capDisconnect);
document.querySelectorAll('[data-capsrc]').forEach(b => b.addEventListener('click', () => capSetSource(b.dataset.capsrc)));
$('cap-raw-clear')?.addEventListener('click', () => { capRawLines = []; capRxCount = 0; capRxT0 = 0; $('cap-raw').textContent = '— cleared —'; if ($('cap-rawstat')) $('cap-rawstat').textContent = ''; });
capRenderByte();

