import './style.css';
import { buildStoredRoute, type StoredRoute } from '../../src/routes/model';
import { directionLabel, formatDistance, formatKm, formatRadius, shapeLabel } from '../../src/format';
import { nextCurves } from '../../src/tracking/nextCurves';
import { announcementText } from '../../src/voice/phrases';
import { colors } from '../../src/theme';
import type { Units } from '../../src/settings';
import { curveSvg } from './curveSvg';
import sampleGpx from '../../test/fixtures/stelvio.gpx?raw';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

interface State {
  route: StoredRoute | null;
  pos: number;
  playing: boolean;
  speedKmh: number;
  minGrade: number;
  units: Units;
  driveSide: 'right' | 'left';
  showLine: boolean;
  error: string | null;
}

const state: State = { route: null, pos: 0, playing: false, speedKmh: 60, minGrade: 4, units: 'metric', driveSide: 'right', showLine: true, error: null };

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="top">
    <img src="./icon.png" alt="cornerGuider" />
    <div><h1>cornerGuider – Web-Demo</h1><p>Zeigt und sagt dir die nächste Kurve an – ohne Navigation.</p></div>
  </header>
  <main>
    <section class="card" id="left">
      <h2>Strecke</h2>
      <label class="drop" id="drop"><input id="file" type="file" accept=".gpx,application/gpx+xml,text/xml" hidden />
        <strong>GPX-Datei hierher ziehen</strong> oder klicken<br /><span class="small">Track oder Route, z. B. aus Kurviger oder Calimoto. Alles läuft in deinem Browser, es wird nichts hochgeladen.</span>
      </label>
      <div class="row" style="margin-top:10px"><button class="ghost" id="sample">Beispiel laden: Stelvio</button></div>
      <div id="msg"></div>
      <div id="summary"></div>
    </section>
    <section class="card drive" id="right">
      <h2>Fahrmodus (Vorschau)</h2>
      <div id="driveBody" class="muted">Lade eine Strecke, um die Vorschau zu sehen.</div>
    </section>
  </main>
  <footer>
    <p>cornerGuider ist in Entwicklung. Die Kurvendaten werden aus der GPX-Datei berechnet und können ungenau sein. Es gibt keine Geschwindigkeitsempfehlung; der tatsächliche Straßenverlauf hat immer Vorrang. Die eingezeichnete Fahrlinie ist ein rein geometrischer Vorschlag innerhalb der eigenen Spur.</p>
    <p>Beispielstrecke: Passo dello Stelvio aus <a href="https://github.com/gpx-rider/gpx-rider.github.io">gpx-rider</a> (MIT-Lizenz).</p>
  </footer>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- Laden ----------
function load(text: string, name: string): void {
  try {
    state.route = buildStoredRoute(text, name);
    state.pos = 0;
    state.playing = false;
    state.error = null;
  } catch (e) {
    state.route = null;
    state.error = e instanceof Error ? e.message : String(e);
  }
  renderLeft();
  renderDrive();
}

const drop = $('drop');
const fileInput = $<HTMLInputElement>('file');
fileInput.addEventListener('change', async () => {
  const f = fileInput.files?.[0];
  if (f) load(await f.text(), f.name.replace(/\.gpx$/i, ''));
});
for (const ev of ['dragover', 'dragenter']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, () => drop.classList.remove('over'));
drop.addEventListener('drop', async (e) => {
  e.preventDefault();
  const f = (e as DragEvent).dataTransfer?.files?.[0];
  if (f) load(await f.text(), f.name.replace(/\.gpx$/i, ''));
});
$('sample').addEventListener('click', () => load(sampleGpx, 'Passo dello Stelvio'));

// ---------- Linke Seite: Zusammenfassung und Tabelle ----------
function renderLeft(): void {
  const msg = $('msg');
  msg.innerHTML = state.error ? `<div class="err">${esc(state.error)}</div>` : '';
  const sum = $('summary');
  const r = state.route;
  if (!r) {
    sum.innerHTML = '';
    return;
  }
  for (const w of r.warnings) msg.innerHTML += `<div class="warn">⚠︎ ${esc(w)}</div>`;
  const u = state.units;
  const km = r.lengthM / 1000;
  const counts = [1, 2, 3, 4, 5, 6].map((g) => r.curves.filter((c) => c.grade === g).length);
  const max = Math.max(1, ...counts);
  sum.innerHTML = `
    <h3>${esc(r.name)}</h3>
    <div class="stats">
      <div class="stat"><b>${formatKm(r.lengthM, u)}</b><span class="muted small">Länge</span></div>
      <div class="stat"><b>${r.curves.length}</b><span class="muted small">Kurven</span></div>
      <div class="stat"><b>${km > 0 ? (r.curves.length / km).toFixed(1).replace('.', ',') : '–'}</b><span class="muted small">Kurven je km</span></div>
      <div class="stat"><b>${counts[0]}</b><span class="muted small">Spitzkehren</span></div>
    </div>
    <div class="hist">${counts
      .map((n, i) => `<div class="bar">${n}<i style="height:${Math.round((n / max) * 64)}px;background:${colors.grade[i]}"></i>Stufe ${i + 1}</div>`)
      .join('')}</div>
    <div class="filter"><label for="minGrade">Ansagen ab Stufe</label>
      <input id="minGrade" type="range" min="1" max="6" step="1" value="${state.minGrade}" />
      <b id="minGradeVal">${state.minGrade}</b></div>
    <div class="muted small" style="margin-bottom:6px">Leichtere Kurven (blass) würden nur genannt, wenn sie direkt auf eine angesagte folgen.</div>
    <div class="table" id="table"></div>`;
  $<HTMLInputElement>('minGrade').addEventListener('input', (e) => {
    state.minGrade = Number((e.target as HTMLInputElement).value);
    $('minGradeVal').textContent = String(state.minGrade);
    renderTable();
    renderDrive();
  });
  renderTable();
}

function renderTable(): void {
  const r = state.route;
  const t = document.getElementById('table');
  if (!r || !t) return;
  const cur = nextCurves(r.curves, state.pos, 1)[0]?.curve.index;
  t.innerHTML = r.curves
    .map((c) => {
      const shape = shapeLabel(c.shape);
      return `<div class="crow${c.grade > state.minGrade ? ' light' : ''}${c.index === cur ? ' sel' : ''}" data-i="${c.index}">
        <div class="gdot" style="border-color:${colors.grade[c.grade - 1]};color:${colors.grade[c.grade - 1]}">${c.grade}</div>
        <div class="main"><b>${directionLabel(c.direction)} ${c.grade}${shape ? ` · ${shape}` : ''}</b>
          <span class="muted small">${formatRadius(c.minRadius, state.units)} · ${Math.round(c.totalAngle)}°${c.followsPrevious ? ' · Folge' : ''}</span></div>
        <div class="d">${formatDistance(c.startDist, state.units)}</div></div>`;
    })
    .join('');
  // aktuelle Kurve in der Tabelle sichtbar halten (nur die Tabelle scrollen, nicht die Seite)
  const sel = t.querySelector<HTMLElement>('.sel');
  if (sel) t.scrollTop = Math.max(0, sel.offsetTop - t.clientHeight / 2);
  t.querySelectorAll<HTMLElement>('.crow').forEach((el) =>
    el.addEventListener('click', () => {
      const c = r.curves[Number(el.dataset.i)]!;
      state.pos = Math.max(0, c.startDist - 120);
      renderDrive();
      renderTable();
    }),
  );
}

// ---------- Rechte Seite: Fahrmodus-Vorschau ----------
let driveBuilt = false;
function buildDrive(): void {
  $('driveBody').className = '';
  $('driveBody').innerHTML = `
    <div class="headline" id="headline"></div>
    <div class="gfx" id="gfx"></div>
    <div class="next" id="next"></div>
    <div class="say" id="say"></div>
    <div class="controls">
      <div class="row">
        <button id="play">▶ Abspielen</button>
        <select id="speed" aria-label="Geschwindigkeit">
          ${[30, 60, 90, 120].map((v) => `<option value="${v}"${v === state.speedKmh ? ' selected' : ''}>${v} km/h</option>`).join('')}
        </select>
        <select id="side" aria-label="Verkehr"><option value="right">Rechtsverkehr</option><option value="left">Linksverkehr</option></select>
        <select id="units" aria-label="Einheiten"><option value="metric">km · m</option><option value="imperial">mi · ft</option></select>
        <label class="small"><input type="checkbox" id="line" checked /> Fahrlinie</label>
      </div>
      <input id="slider" type="range" min="0" step="5" value="0" aria-label="Position auf der Strecke" />
      <div class="outline" id="outline"></div>
    </div>`;
  $('play').addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.playing && state.route && state.pos >= state.route.lengthM - 10) state.pos = 0;
    last = 0;
    renderDrive();
    if (state.playing) requestAnimationFrame(tick);
  });
  $<HTMLSelectElement>('speed').addEventListener('change', (e) => (state.speedKmh = Number((e.target as HTMLSelectElement).value)));
  $<HTMLSelectElement>('side').addEventListener('change', (e) => { state.driveSide = (e.target as HTMLSelectElement).value as 'right' | 'left'; renderDrive(); });
  $<HTMLSelectElement>('units').addEventListener('change', (e) => { state.units = (e.target as HTMLSelectElement).value as Units; renderLeft(); renderDrive(); });
  $<HTMLInputElement>('line').addEventListener('change', (e) => { state.showLine = (e.target as HTMLInputElement).checked; renderDrive(); });
  $<HTMLInputElement>('slider').addEventListener('input', (e) => {
    state.pos = Number((e.target as HTMLInputElement).value);
    renderDrive();
    renderTable();
  });
  driveBuilt = true;
}

function outlineSvg(r: StoredRoute, pos: number): string {
  const W = 520, H = 150, pad = 10;
  const pts = r.path;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const sc = Math.min((W - 2 * pad) / Math.max(1, maxX - minX), (H - 2 * pad) / Math.max(1, maxY - minY));
  const ox = (W - (maxX - minX) * sc) / 2, oy = (H - (maxY - minY) * sc) / 2;
  const tx = (p: { x: number; y: number }) => `${(ox + (p.x - minX) * sc).toFixed(1)},${(H - oy - (p.y - minY) * sc).toFixed(1)}`;
  const step = Math.max(1, Math.floor(pts.length / 500));
  const line = pts.filter((_, i) => i % step === 0).map(tx).join(' ');
  const here = pts[Math.min(pts.length - 1, Math.round(pos / 5))]!;
  const dots = r.curves.filter((c) => c.grade <= 2).map((c) => { const [x, y] = tx(c.startXY).split(','); return `<circle cx="${x}" cy="${y}" r="2.5" fill="${colors.grade[c.grade - 1]}"/>`; }).join('');
  const [hx, hy] = tx(here).split(',');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Streckenverlauf"><polyline points="${line}" fill="none" stroke="#3a4046" stroke-width="2.5" stroke-linejoin="round"/>${dots}<circle cx="${hx}" cy="${hy}" r="6" fill="#00e5ff" stroke="#000" stroke-width="2"/></svg>`;
}

function renderDrive(): void {
  const r = state.route;
  if (!r) {
    driveBuilt = false;
    $('driveBody').className = 'muted';
    $('driveBody').textContent = 'Lade eine Strecke, um die Vorschau zu sehen.';
    return;
  }
  if (!driveBuilt) buildDrive();
  const u = state.units;
  const up = nextCurves(r.curves, state.pos, 5);
  const first = up[0];
  $('play').textContent = state.playing ? '⏸ Pause' : '▶ Abspielen';
  const slider = $<HTMLInputElement>('slider');
  slider.max = String(Math.round(r.lengthM));
  slider.value = String(Math.round(state.pos));
  $<HTMLSelectElement>('side').value = state.driveSide;
  $<HTMLSelectElement>('units').value = state.units;

  $('headline').textContent = first
    ? `${first.inside ? 'Jetzt' : `In ${formatDistance(Math.round(first.distanceTo / 10) * 10, u)}`}: ${directionLabel(first.curve.direction)} ${first.curve.grade}`
    : 'Keine Kurven mehr';
  $('gfx').innerHTML = first
    ? curveSvg(first.curve, 420, 340, { progressM: state.pos - first.curve.startDist, driveSide: state.driveSide, showLine: state.showLine })
    : '<div style="height:340px"></div>';
  $('next').innerHTML = up
    .slice(1, 4)
    .map((x) => `<div><span class="g" style="color:${colors.grade[x.curve.grade - 1]}">${x.curve.grade}</span>${directionLabel(x.curve.direction)}<span class="dist">in ${formatDistance(Math.round(x.distanceTo / 10) * 10, u)}</span></div>`)
    .join('');

  // Welche Ansage käme als Nächstes? (gleiche Regel wie in der App: leichte Kurven nur als Folge)
  const say = $('say');
  const target = first?.inside ? up[1] : first; // in einer Kurve zählt die nächste, nicht die aktuelle
  const targetIdx = target ? up.indexOf(target) : -1;
  if (!target) say.textContent = '';
  else if (target.curve.grade > state.minGrade && !target.curve.followsPrevious) {
    say.innerHTML = `<b>Keine Ansage</b> für ${directionLabel(target.curve.direction)} ${target.curve.grade}: Stufe ${target.curve.grade} ist leichter als Stufe ${state.minGrade}.`;
  } else {
    const followUps: typeof up = [];
    for (let i = targetIdx + 1; i < up.length && up[i]!.curve.followsPrevious && followUps.length < 2; i++) followUps.push(up[i]!);
    say.innerHTML = `<b>${first?.inside ? 'Nächste Ansage' : 'Ansage'}:</b> „${esc(announcementText(target.curve, target.distanceTo, followUps.map((x) => x.curve), { language: 'de', style: 'long', shape: true, units: u }))}“`;
  }
  $('outline').innerHTML = outlineSvg(r, state.pos);
}

// ---------- Abspielen ----------
let last = 0;
function tick(ts: number): void {
  if (!state.playing || !state.route) return;
  if (last) {
    state.pos = Math.min(state.route.lengthM, state.pos + ((state.speedKmh / 3.6) * (ts - last)) / 1000);
    if (state.pos >= state.route.lengthM) state.playing = false;
    renderDrive();
    if (Math.floor(ts / 400) !== Math.floor((ts - 16) / 400)) renderTable();
  }
  last = ts;
  if (state.playing) requestAnimationFrame(tick);
}

renderLeft();
renderDrive();

// ?sample lädt die Beispielstrecke gleich (praktisch zum Einbetten und für Screenshots); ?pos=<m> setzt die Position
const params = new URLSearchParams(location.search);
if (params.has('sample')) {
  load(sampleGpx, 'Passo dello Stelvio');
  const p = Number(params.get('pos'));
  if (state.route && Number.isFinite(p) && p > 0) {
    state.pos = Math.min(state.route.lengthM, p);
    renderDrive();
    renderTable();
  }
}
