/* ===== Card help: a small "?" in each card header opens a short "what is this / how to
 * read it" popup. Content is keyed by chart svg id (charts) or the card's h2 data-i18n
 * key (everything else). Only cards that have an entry below get a "?" button. ===== */
const HELP = {
  /* ---- Live gauges + live chart ---- */
  wind_direction: {
    uk: 'Звідки дме вітер просто зараз. Стрілка вказує напрямок (N — північ, E — схід…). Дані з флюгера на 8 секторів, оновлюються щопосту.',
    pl: 'Skąd teraz wieje wiatr. Strzałka pokazuje kierunek (N — północ, E — wschód…). Z wiatrowskazu 8-sektorowego, aktualizacja co POST.',
    en: 'Where the wind blows from right now. The arrow points to the direction (N=north, E=east…). From an 8-sector vane, updated every POST.' },
  wind_speed: {
    uk: 'Поточна швидкість вітру (км/год). Рахується з частоти імпульсів анемометра × коефіцієнт калібровки (Налаштування → Калібровка швидкості). «imp/s» — сирі імпульси за секунду.',
    pl: 'Bieżąca prędkość wiatru (km/h). Z częstotliwości impulsów anemometru × współczynnik kalibracji (Ustawienia → Kalibracja prędkości). „imp/s” — surowe impulsy/s.',
    en: 'Current wind speed (km/h). From the anemometer pulse rate × calibration factor (Settings → Speed calibration). “imp/s” = raw pulses per second.' },
  speed_last_hour: {
    uk: 'Швидкість і напрямок за останню годину. Лінія — швидкість, зелені стрілки зверху — напрямок. «Згладження» змінює усереднення (raw = кожна проба). Стрілка біля числа: 🟢 порив вгору / 🔴 спад.',
    pl: 'Prędkość i kierunek z ostatniej godziny. Linia — prędkość, zielone strzałki u góry — kierunek. „Wygładzanie” zmienia uśrednianie (raw = każda próbka).',
    en: 'Speed and direction over the last hour. Line = speed, green arrows on top = direction. “Smoothing” changes the averaging (raw = every sample).' },
  /* ---- History time-series (keyed by svg id) ---- */
  'chart-speed': {
    uk: 'Швидкість вітру за обраний період. Суцільна лінія — середня; на широких діапазонах зверху з’являється смуга поривів (макс за інтервал). Зумни до ≤2 год — побачиш кожну 2-секундну пробу (повний raw). Пунктир = простій (даних не було).',
    pl: 'Prędkość wiatru w wybranym okresie. Linia ciągła — średnia; na szerokich zakresach u góry pasmo porywów (maks.). Zoom do ≤2 h — każda próbka co 2 s. Linia przerywana = przestój.',
    en: 'Wind speed over the selected period. Solid line = mean; on wide ranges a gust band (max) appears on top. Zoom to ≤2 h to see every 2-second sample (full raw). Dashed = downtime (no data).' },
  'chart-wt': {
    uk: 'Швидкість + напрямок разом. Стрілки зверху показують напрямок у часі, лінія — швидкість. Зручно бачити, як вітер міняється.',
    pl: 'Prędkość + kierunek razem. Strzałki u góry — kierunek w czasie, linia — prędkość.',
    en: 'Speed + direction together. Arrows on top show direction over time, the line is speed.' },
  'chart-dir': {
    uk: 'Напрямок вітру в часі по 8 румбах (N…NW). Розрив лінії = штиль або немає даних.',
    pl: 'Kierunek wiatru w czasie wg 8 róż (N…NW). Przerwa = cisza lub brak danych.',
    en: 'Wind direction over time across 8 points (N…NW). A break = calm or no data.' },
  'chart-rose': {
    uk: 'Роза вітрів: звідки найчастіше дув вітер за період. Довший промінь = вітер звідти дув частіше; колір — сила.',
    pl: 'Róża wiatrów: skąd najczęściej wiał wiatr. Dłuższy promień = częściej; kolor — siła.',
    en: 'Wind rose: which direction the wind came from most. Longer spoke = more often; colour = strength.' },
  'chart-batt': {
    uk: 'Напруга акумулятора (мВ). Внизу — тренд (заряджається/розряджається мВ/год) і прогноз, скільки днів до відсічки 3300 мВ. Пунктир = простій.',
    pl: 'Napięcie akumulatora (mV). Na dole trend (ładowanie/rozładowanie mV/h) i prognoza dni do odcięcia 3300 mV. Przerywana = przestój.',
    en: 'Battery voltage (mV). Below: the trend (charging/discharging mV/h) and a forecast of days to the 3300 mV cutoff. Dashed = downtime.' },
  'chart-signal': {
    uk: 'Рівень GSM-сигналу (CSQ, 0–31 — більше краще, ~10+ норм). 99 = втрата мережі (червоним), а не «нуль сигналу».',
    pl: 'Poziom sygnału GSM (CSQ, 0–31, więcej=lepiej, ~10+ ok). 99 = utrata sieci (czerwony), nie „zero”.',
    en: 'GSM signal level (CSQ, 0–31, higher is better, ~10+ is fine). 99 = network lost (shown red), not “zero signal”.' },
  'chart-solar': {
    uk: 'Напруга сонячної панелі (мВ). Вдень росте на сонці, вночі ~0. По ній видно освітленість і чи йде зарядка.',
    pl: 'Napięcie panelu słonecznego (mV). W dzień rośnie, w nocy ~0. Pokazuje nasłonecznienie i ładowanie.',
    en: 'Solar panel voltage (mV). Rises in daylight, ~0 at night. Shows sunlight and whether it is charging.' },
  'chart-uptime': {
    uk: 'Доступність модуля по циклах: 🟢 онлайн (пост вчасно), 🟡 прострочка (спізнився, але вийшов на зв’язок), 🔴 простій (мовчав). Σ внизу = онлайн + прострочка (реально доступний час).',
    pl: 'Dostępność modułu wg cykli: 🟢 online (na czas), 🟡 spóźniony (ale się odezwał), 🔴 przestój (cisza). Σ = online + spóźniony.',
    en: 'Module availability per cycle: 🟢 online (POST on time), 🟡 overdue (late but came back), 🔴 down (silent). Σ = online + overdue (truly reachable time).' },
  /* ---- History summary cards ---- */
  summary: {
    uk: 'Зведена статистика за обраний період: макс/середня швидкість, домінантний напрямок тощо.',
    pl: 'Statystyka zbiorcza okresu: maks./średnia prędkość, dominujący kierunek itd.',
    en: 'Summary stats for the period: max/mean speed, dominant direction, etc.' },
  daily_summary: {
    uk: 'Підсумки по днях: для кожного дня — середня/макс швидкість і переважний напрямок.',
    pl: 'Podsumowania dzienne: średnia/maks. prędkość i przeważający kierunek na dzień.',
    en: 'Per-day summaries: mean/max speed and prevailing direction for each day.' },
  hourly_heat: {
    uk: 'Теплокарта: години доби × дні, колір клітинки = середня швидкість. Видно добові патерни вітру.',
    pl: 'Mapa cieplna: godziny × dni, kolor = średnia prędkość. Widać wzorce dobowe.',
    en: 'Heatmap: hours of day × days, cell colour = mean speed. Reveals daily patterns.' },
  /* ---- Settings ---- */
  data_2g: {
    uk: 'Lite-режим для слабкого 2G: рідший поллінг і менше трафіку. Вмикай, коли зв’язок поганий.',
    pl: 'Tryb Lite dla słabego 2G: rzadszy polling, mniej danych. Włącz przy słabym zasięgu.',
    en: 'Lite mode for weak 2G: slower polling, less traffic. Turn on when the link is poor.' },
  post_interval: {
    uk: 'Як часто модуль шле дані. Цикл ≈ кількість проб × усереднення × 2с + ~15с GSM. Зміна застосується на наступному POST модуля.',
    pl: 'Jak często moduł wysyła dane. Cykl ≈ próbki × uśrednianie × 2 s + ~15 s GSM. Zmiana zadziała przy następnym POST.',
    en: 'How often the module reports. Cycle ≈ samples × averaging × 2 s + ~15 s GSM. A change applies on the module’s next POST.' },
  speed_calib: {
    uk: 'Скільки км/год дає 1 імпульс/с анемометра. Підбери так, щоб дашборд показував реальну швидкість.',
    pl: 'Ile km/h daje 1 impuls/s anemometru. Dobierz tak, by dashboard pokazywał realną prędkość.',
    en: 'How many km/h one anemometer pulse/s equals. Tune it so the dashboard shows the real speed.' },
  batt_settings: {
    uk: 'Параметри батареї для прогнозу автономності (ємність, відсічка). Впливають на «днів лишилось».',
    pl: 'Parametry baterii do prognozy autonomii (pojemność, odcięcie). Wpływają na „dni pozostało”.',
    en: 'Battery parameters for the autonomy forecast (capacity, cutoff). They drive “days left”.' },
  alerts: {
    uk: 'Сповіщення в браузері: коли модуль замовк, сів акум тощо. Працюють поки відкрита вкладка.',
    pl: 'Powiadomienia w przeglądarce: cisza modułu, niski akumulator itd. Działają, gdy karta jest otwarta.',
    en: 'Browser notifications: module went silent, low battery, etc. Work while the tab is open.' },
  spush: {
    uk: 'Серверний пуш (Web Push): сповіщення навіть коли дашборд закрито. Перевірка крипто — через ?push_selftest.',
    pl: 'Push serwerowy (Web Push): powiadomienia nawet przy zamkniętym dashboardzie.',
    en: 'Server push (Web Push): notifications even when the dashboard is closed.' },
  live_mode: {
    uk: 'Live-режим: модуль шле часто (для калібровки в реальному часі). Їсть більше батареї — вмикай тимчасово.',
    pl: 'Tryb Live: moduł wysyła często (do kalibracji na żywo). Zużywa baterię — włączaj czasowo.',
    en: 'Live mode: the module reports frequently (for real-time calibration). Uses more battery — enable temporarily.' },
  local_cache: {
    uk: 'Історія кешується у твоєму браузері (OPFS/IndexedDB), тягнуться лише нові точки. «Синхронізувати» — дотягнути все; «Очистити» — стерти локально (на сервері лишається).',
    pl: 'Historia w przeglądarce (OPFS/IndexedDB), pobierane tylko nowe punkty. „Synchronizuj” — dociągnij wszystko; „Wyczyść” — usuń lokalnie.',
    en: 'History is cached in your browser (OPFS/IndexedDB); only new points are pulled. “Sync” pulls everything; “Clear” wipes it locally (server keeps its copy).' },
  export_title: {
    uk: 'Вивантаження всієї локальної історії: CSV (для Excel) або JSON. Кожен графік окремо — у PNG кнопкою на картці.',
    pl: 'Eksport całej lokalnej historii: CSV (Excel) lub JSON. Każdy wykres osobno — do PNG przyciskiem na karcie.',
    en: 'Export the whole local history: CSV (for Excel) or JSON. Each chart separately → PNG via the button on its card.' },
  /* ---- Status ---- */
  online_24h: {
    uk: 'Скільки годин за останню добу модуль реально був на зв’язку (🟢 онлайн + 🟡 прострочка, без 🔴 простою). Рахується з локального кешу за 24 год.',
    pl: 'Ile godzin w ostatniej dobie moduł był naprawdę dostępny (🟢 online + 🟡 spóźniony, bez 🔴 przestoju). Z lokalnego cache za 24 h.',
    en: 'How many hours over the last day the module was actually reachable (🟢 online + 🟡 overdue, excluding 🔴 downtime). From the local 24h cache.' },
  current_state: {
    uk: 'Що модуль робив за останнім реальним POST: скільки проб прийшло, номер циклу, батарея, сигнал. Факти з сервера, не здогадки.',
    pl: 'Co moduł zrobił przy ostatnim POST: liczba próbek, nr cyklu, bateria, sygnał. Fakty z serwera.',
    en: 'What the module did on its last real POST: samples received, cycle number, battery, signal. Facts from the server, not guesses.' },
  state_timeline: {
    uk: 'Робочий цикл модуля: збір проб → сон → прокидання GSM → відправка. Підсвічує поточний етап.',
    pl: 'Cykl pracy modułu: zbiór próbek → sen → wybudzenie GSM → wysyłka. Podświetla bieżący etap.',
    en: 'The module’s work cycle: collect samples → sleep → wake GSM → send. Highlights the current step.' },
  calib_title: {
    uk: 'Калібровка флюгера: підключись (Serial/GSM), постав флюгер фізично в напрямок, клікни сектор — зафіксує сирий байт. Так зіставляються 8 напрямків.',
    pl: 'Kalibracja wiatrowskazu: połącz (Serial/GSM), ustaw fizycznie kierunek, kliknij sektor — zapisze surowy bajt. Tak mapuje się 8 kierunków.',
    en: 'Vane calibration: connect (Serial/GSM), physically point the vane, click the sector — it captures the raw byte. This maps the 8 directions.' },
};

function helpFor(key){ const h = HELP[key]; return h ? (h[LANG] || h.uk || h.en) : null; }

function showHelp(key, title){
  const body = helpFor(key); if (!body) return;
  let ov = document.getElementById('help-modal');
  if (!ov){
    ov = document.createElement('div'); ov.id = 'help-modal'; ov.className = 'help-ov'; ov.hidden = true;
    ov.innerHTML = '<div class="help-box"><div class="help-hd"><b id="help-ttl"></b>' +
      '<button class="help-x" type="button" aria-label="close">✕</button></div>' +
      '<div class="help-bd" id="help-bd"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.help-x')) ov.hidden = true; });
  }
  ov.querySelector('#help-ttl').textContent = title || '';
  ov.querySelector('#help-bd').textContent = body;
  ov.hidden = false;
}

/* put a "?" in every card header that has a HELP entry */
function injectHelp(){
  document.querySelectorAll('.card > h2, .gauge-card > .ttl').forEach(hdr => {
    const card = hdr.closest('.card, .gauge-card');
    if (!card || card.querySelector('.help-btn')) return;
    const di = hdr.getAttribute('data-i18n') || hdr.querySelector('[data-i18n]')?.getAttribute('data-i18n');
    let key = card.querySelector('svg[id^="chart-"]')?.id;
    if (!key || !HELP[key]) key = (di && HELP[di]) ? di : null;
    if (!key || !HELP[key]) return;
    const b = document.createElement('button');
    b.className = 'help-btn'; b.type = 'button'; b.textContent = '?'; b.title = '?'; b.setAttribute('aria-label', 'help');
    /* live in the top-right tool cluster, just left of export (if present) + fullscreen.
     * As a card child (not inside h2) it also survives applyI18n's textContent rewrite. */
    b.style.right = card.querySelector('.dl-btn') ? '76px' : '42px';
    b.addEventListener('click', e => { e.stopPropagation(); showHelp(key, di ? t(di) : ''); });
    card.appendChild(b);
  });
}
injectHelp();
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ const m = document.getElementById('help-modal'); if (m && !m.hidden) m.hidden = true; }
});
