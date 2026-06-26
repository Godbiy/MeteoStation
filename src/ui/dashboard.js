'use strict';
const DIRS = ['N','NE','E','SE','S','SW','W','NW'];
const $ = id => document.getElementById(id);
const icSvg = id => `<svg class="ic"><use href="#${id}"/></svg>`;   /* inline icon helper */
const SRV = (location.search.match(/srv=([^&]+)/)||[])[1]
         || 'https://stelnet.stelweld.com.pl/petro/MeteoStation/TestKurwa';
$('srv-link').href = SRV; $('srv-link').textContent = SRV;

/* =========== I18N =========== */
const I18N = {
  uk:{ tab_live:'Live', tab_history:'Історія', tab_settings:'Налаштування', tab_calib:'Калібровка',
       wind_direction:'Напрямок вітру', wind_speed:'Швидкість вітру', battery:'Батарея', signal:'Сигнал',
       cycle:'Цикл', updated:'Оновлено', uptime_live:'Аптайм', since_boot:'від останнього вкл.', speed_last_hour:'Швидкість за останню годину',
       speed_history:'Швидкість вітру', wind_rose:'Wind Rose', rose_meta:'% часу за напрямком',
       batt_csq:'Батарея + сигнал', battery_chart:'🔋 Батарея', signal_chart:'📶 Сигнал GSM (CSQ)', summary:'Статистика', metric:'Метрика', min:'min', avg:'avg', max:'max',
       post_interval:'📡 Інтервал POST', cur_setting:'Поточне', apply:'Застосувати',
       speed_calib:'🌀 Калібровка швидкості', speed_calib_hint:'Скільки км/год дає 1 імпульс/с анемометра. Міняє лише відображення на дашборді (прошивка шле сирі імпульси).', reset_btn:'Скинути',
       batt_settings:'🔋 Батарея', batt_settings_hint:'Специфікації пакета — для прогнозу «скільки лишилось». Лише розрахунок на дашборді (прошивка шле тільки напругу).', batt_cap:'Ємність', batt_cut:'Відсічка',
       speed_units:'Одиниці', solar_w:'Соляр-панель', per_day:'доба', tz_label:'🕓 Часовий пояс даних', tz_auto:'авто (як браузер)',
       alerts:'🔔 Сповіщення', alerts_hint:'Push-сповіщення коли вкладка відкрита. Обери які типи приходять.', alerts_on_lbl:'Увімкнути всі', alerts_perm:'Дозволити сповіщення', alert_batt_lbl:'Батарея низька <', alert_crit_lbl:'Батарея критична <', alert_wind_lbl:'Вітер >', alert_offline_lbl:'Офлайн (нема даних) >', alert_online_lbl:'Знов онлайн (відновився)', minutes:'хв', alert_batt_n:'Низька батарея', alert_crit_n:'Критична батарея', alert_wind_n:'Сильний вітер', alert_offline_n:'Станція офлайн', alert_online_n:'Станція знов онлайн', alert_solar_lbl:'Заряд / сонце (старт, стоп, повна)', alert_full_n:'Заряджено на повну', alert_full_b:'≈100% — заряд завершено', alert_soon_n:'Майже повна', alert_soon_b:'скоро перестане заряджатися', alert_chgon_n:'Пішов заряд від сонця', alert_chgoff_n:'Сонця нема', alert_chgoff_b:'заряд зупинився', chg_full:'заряджено на повну', chg_soon:'майже повна', off:'Вимк', on_btn:'Увімк', alerts_test:'Тест', alerts_test_body:'Сповіщення працюють ✅', spush:'📡 Серверний пуш (фон)', spush_hint:'Доставляє сповіщення навіть коли апку закрито. Пороги беруться з «Сповіщень» вище. По кожному пості: батарея, вітер, «знов онлайн» (офлайн — лише foreground).', spush_lbl:'На цей пристрій', spush_test:'Тест із сервера', spush_testall:'Усі типи', livepin:'📌 Live у шторці', livepin_hint:'Закріплює поточні дані у шторці, тихо оновлюється в фоні щопоста (~раз на цикл). Не дзвенить.', livepin_lbl:'📌 Live у шторці', spush_devices:'Підписані пристрої', spush_none:'нема підписок', spush_this:'цей',
       live_mode:'🔴 Live режим (для калібровки)',
       live_hint:'Прошивка стає у нон-стоп live POSTs (3с цикл). Жере батарею, тільки для калібровки.',
       start_live:'Start LIVE', stop_live:'Stop LIVE',
       live_posts:'Нон-стоп Live POSTs', cancel:'Скасувати', confirm_yes:'Так', back_online:'Знову онлайн', went_offline:'Втрачено зв\'язок',
       danger:'⚠ Danger', wipe:'Видалити всі дані на сервері', server:'Сервер',
       calib_title:'🧭 Калібровка сенсорів',
       calib_hint2:'Калібровка робиться через окрему сторінку. Підтримує Serial COM (швидко, при платі) і GSM live (з будь-де).',
       open_calib:'Відкрити Calibration UI', calib_status:'Поточна калібровка',
       calib_capture_hint:'Обери джерело → підключись → постав флюгер фізично у напрямок → клацни кнопку (зафіксує поточний байт).',
       cal_source:'Джерело', connect:'Підключити', disconnect:'Відключити',
       cal_gsm_note:'Читаємо живий снапшот із сервера (кожні 2с). Для частих оновлень увімкни LIVE у Налаштуваннях.',
       webserial_warn:'⚠ Браузер не підтримує Web Serial — потрібен Chrome або Edge (або GSM live).',
       raw_stream:'Сирий потік', raw_hint:'Сирий потік з UART (Serial) або GSM-снапшоти — для діагностики.', clear_btn:'Очистити',
       cur_byte:'Поточний байт', cal_set:'задати', cal_nodata:'нема даних', cal_streaming:'потік іде', cal_closed:'закрито',
       calib_status_hint:'Калібровочні точки зберігаються в browser localStorage. Якщо тут пусто — спочатку зайди в Calibration UI.',
       test_mode_on:'Test mode: дашборд показує згенеровані mock дані. Сервер не опитується.',
       s_ago:'с тому', m_ago:'хв тому', h_ago:'год тому', d_ago:'д тому',
       no_data:'нема даних', applied:'застосовано', kmh:'км/год', gust:'порив',
       no_data_window:'немає даних у цьому проміжку', data_left:'дані ліворуч', data_right:'дані праворуч', jump_data:'до даних',
       appearance:'🎨 Вигляд', theme:'Тема', theme_dark:'Темна', theme_sun:'Сонячна', language:'Мова', test_mode:'Тест-режим', test_toggle_btn:'Увімк. / вимк.',
       data_2g:'📶 2G / дані', lite_mode:'Lite-режим', lite_full:'Повний', lite_on:'Lite', refresh_now:'Синхронізація', refresh:'Синхронізувати', synced:'синхронізовано',
       lite_hint:'Lite: повільний поллінг (60с), без щогодинного завантаження кривої — мінімум трафіку на 2G.',
       wind_timeline:'Wind timeline · швидкість + напрямок', wt_meta:'стрілки показують напрямок',
       dir_timeline:'Напрямок вітру', dirt_meta:'8 румбів у часі', no_dir_data:'нема даних напрямку (флюгер 0xFF)',
       uptime_chart:'Доступність (uptime)', uptime_gaps:'пропусків',
       beaufort:'Beaufort scale', gust_factor:'Gust factor (1h)', dir_stability:'Стабільність (1h)',
       daily_summary:'📅 По днях', day:'День', avg_kmh:'avg km/h', max_kmh:'max km/h', dom_dir:'dom. напр.',
       hourly_heat:'🕐 Heatmap по годинах', hm_hint:'Колір = середня швидкість у цій годині дня',
       all_days:'всі дні', from:'від', to:'до', today:'сьогодні', yesterday:'вчора', last7:'7 днів',
       tab_status:'Стан', current_state:'Поточний стан модуля', next_event:'наступна подія',
       state_timeline:'Робочий цикл', state_hint:'Прошивка послідовно проходить ці стани. Поточний підсвічений.',
       pending_changes:'⏳ Pending changes', pending_hint:'Зміни (інтервал/live) застосовуються на наступному POST.',
       no_pending:'немає очікуваних змін', raw_config:'Серверний config',
       waiting_next_post:'чекаємо на наступний POST', failed_timeout:'не застосовано (timeout)',
       local_cache:'💾 Локальний кеш', clear_cache:'Очистити кеш',
       build_label:'Версія застосунку:', force_update:'↻ Оновити застосунок',
       cache_hint:'Історичні дані кешуються в браузері (last 14 days). Інкрементальна синхронізація.',
       solar:'Сонце', solar_chart:'☀ Сонячна напруга', smooth:'згладження',
       calib_reset_default:'Скинути до стандарту', calib_push:'Записати на сервер', calib_pull:'Завантажити з сервера',
       calib_pushed:'записано на сервер', calib_pulled:'завантажено з сервера', calib_reset_done:'скинуто до стандарту',
       calib_push_err:'помилка запису', calib_pull_err:'нема даних на сервері',
       calib_srv_updated:'Сервер: оновлено ', calib_srv_empty:'Сервер: калібровка не задана',
       sol_dark:'темно', sol_dim:'слабо', sol_ok:'норм', sol_bright:'яскраво',
       chg_in:'Зарядка', batt_cur:'Батарея', chg_yes:'заряджає', chg_no:'не заряджає', chg_idle:'сонця нема', bat_up:'заряджається', bat_dn:'розряджається', est_hint:'оцінка з W панелі (струму не міряємо)', balance:'баланс', reserve:'запас', per_hour:'за годину', charge_stuck:'заряд не йде!', theory:'теоретична /год', actual:'фактична /год',
       observed:'обсерв', still_running:'ще йде', configured:'налашт.', not_applied:'модуль ще не перейшов',
       live_active_note:'LIVE active — поточний нормальний інтервал діятиме ПІСЛЯ Stop LIVE',
       st_sleep_n:'GSM Sleep',    st_sleep_d:'Модуль перейшов у power-down',
       st_sample_n:'Збір даних',  st_sample_d:'Семплюємо vane + anemometer кожні 2с',
       st_wake_n:'GSM Wake',      st_wake_d:'Прокидаємо модем, чекаємо реєстрацію',
       st_post_n:'Відправка',     st_post_d:'POST бінарного payload до сервера',
       st_live_n:'LIVE streaming',st_live_d:'GSM активний, POST кожні ~3с',
       st_off_n:'Модуль мовчить', st_off_d:'POST давно не приходив — модуль офлайн / поза мережею',
       st_lpend_n:'LIVE pending', st_lpend_d:'Сервер просить LIVE — чекаємо щоб модуль увійшов на наступному звичайному POST',
       st_lexit_n:'Вихід з LIVE', st_lexit_d:'Сервер просить вийти — модуль вийде на наступному live POST',
       ret_7d:'7 днів', ret_30d:'30 днів', ret_180d:'6 міс', ret_365d:'1 рік', ret_unl:'безлімітно',
       bf_charging:'заряджається', bf_flat:'тренд нульовий, чекаємо',
       sig_label:'сигнал', sig_none:'нема даних сигналу (CSQ=99)', sig_lost:'нема сигналу (99)',
       bf_above_plat:'над плато — оцінка занижена, реально буде ×1.5–2 більше',
       bf_on_plat:'на плато — оцінка приблизна, ±50%',
       bf_exit_plat:'виходимо з плато — оцінка надійніша',
       bf_steep:'крута частина розряду — оцінка ±10%',
       bf_data:'даних', bf_too_few:'замало даних', bf_too_short:'замало часу (<30 хв)', bf_const:'константа',
       sync_pending_title:'Конфіг ще не застосовано.',
       sync_pending_body:'Налаштовано: {int}, але сервер бачить цикл {obs}. Модуль перейде на новий цикл після наступного POST (медіана оновиться за ~10 POSTів).',
       sync_ok:'Цикл синхронізовано: налаштовано {int}, фактично {obs}' },
  pl:{ tab_live:'Na żywo', tab_history:'Historia', tab_settings:'Ustawienia', tab_calib:'Kalibracja',
       wind_direction:'Kierunek wiatru', wind_speed:'Prędkość wiatru', battery:'Bateria', signal:'Sygnał',
       cycle:'Cykl', updated:'Zaktualizowano', uptime_live:'Uptime', since_boot:'od ost. włączenia', speed_last_hour:'Prędkość ostatnia godzina',
       speed_history:'Prędkość wiatru', wind_rose:'Wind Rose', rose_meta:'% czasu wg kierunku',
       batt_csq:'Bateria + sygnał', battery_chart:'🔋 Bateria', signal_chart:'📶 Sygnał GSM (CSQ)', summary:'Statystyki', metric:'Metryka', min:'min', avg:'śr', max:'max',
       post_interval:'📡 Interwał POST', cur_setting:'Bieżąca', apply:'Zastosuj',
       speed_calib:'🌀 Kalibracja prędkości', speed_calib_hint:'Ile km/h daje 1 impuls/s anemometru. Zmienia tylko wyświetlanie (firmware wysyła surowe impulsy).', reset_btn:'Reset',
       batt_settings:'🔋 Bateria', batt_settings_hint:'Specyfikacja pakietu — do prognozy „ile zostało". Tylko obliczenia (firmware wysyła samo napięcie).', batt_cap:'Pojemność', batt_cut:'Odcięcie',
       speed_units:'Jednostki', solar_w:'Panel solarny', per_day:'dzień', tz_label:'🕓 Strefa czasowa danych', tz_auto:'auto (jak przeglądarka)',
       alerts:'🔔 Powiadomienia', alerts_hint:'Push gdy karta otwarta. Wybierz które typy przychodzą.', alerts_on_lbl:'Włącz wszystkie', alerts_perm:'Zezwól na powiadomienia', alert_batt_lbl:'Bateria niska <', alert_crit_lbl:'Bateria krytyczna <', alert_wind_lbl:'Wiatr >', alert_offline_lbl:'Offline (brak danych) >', alert_online_lbl:'Znów online (wrócił)', minutes:'min', alert_batt_n:'Niska bateria', alert_crit_n:'Krytyczna bateria', alert_wind_n:'Silny wiatr', alert_offline_n:'Stacja offline', alert_online_n:'Stacja znów online', alert_solar_lbl:'Ładowanie / słońce (start, stop, pełna)', alert_full_n:'Naładowano w pełni', alert_full_b:'≈100% — ładowanie zakończone', alert_soon_n:'Prawie pełna', alert_soon_b:'wkrótce przestanie ładować', alert_chgon_n:'Ładowanie ruszyło', alert_chgoff_n:'Brak słońca', alert_chgoff_b:'ładowanie zatrzymane', chg_full:'naładowano', chg_soon:'prawie pełna', off:'Wył', on_btn:'Wł', alerts_test:'Test', alerts_test_body:'Powiadomienia działają ✅', spush:'📡 Push serwerowy (tło)', spush_hint:'Dostarcza powiadomienia nawet gdy apka zamknięta. Progi z „Powiadomień” powyżej. Przy każdym POST: bateria, wiatr, „znów online” (offline — tylko foreground).', spush_lbl:'Na to urządzenie', spush_test:'Test z serwera', spush_testall:'Wszystkie typy', livepin:'📌 Live w pasku', livepin_hint:'Przypina bieżące dane w pasku, cicho odświeża w tle przy każdym POST (~raz na cykl). Nie dzwoni.', livepin_lbl:'📌 Live w pasku', spush_devices:'Subskrybowane urządzenia', spush_none:'brak subskrypcji', spush_this:'to',
       live_mode:'🔴 Tryb live (do kalibracji)',
       live_hint:'Firmware wchodzi w ciągłe POSTy (3s cykl). Wyczerpuje baterię, tylko do kalibracji.',
       start_live:'Start LIVE', stop_live:'Stop LIVE',
       live_posts:'Non-stop Live POSTs', cancel:'Anuluj', confirm_yes:'Tak', back_online:'Znów online', went_offline:'Utracono połączenie',
       danger:'⚠ Niebezpieczne', wipe:'Usuń wszystkie dane na serwerze', server:'Serwer',
       calib_title:'🧭 Kalibracja czujników',
       calib_hint2:'Kalibracja przez osobną stronę. Wspiera Serial COM (szybko, przy płycie) i GSM live (zdalnie).',
       open_calib:'Otwórz Calibration UI', calib_status:'Bieżąca kalibracja',
       calib_capture_hint:'Wybierz źródło → połącz → ustaw vane fizycznie w kierunek → kliknij (zapisze bieżący bajt).',
       cal_source:'Źródło', connect:'Połącz', disconnect:'Rozłącz',
       cal_gsm_note:'Czytamy live snapshot z serwera (co 2s). Dla częstszych odczytów włącz LIVE w Ustawieniach.',
       webserial_warn:'⚠ Przeglądarka nie wspiera Web Serial — wymagany Chrome lub Edge (lub GSM live).',
       raw_stream:'Surowy strumień', raw_hint:'Surowy strumień z UART (Serial) lub snapshoty GSM — do diagnostyki.', clear_btn:'Wyczyść',
       cur_byte:'Bieżący bajt', cal_set:'ustaw', cal_nodata:'brak danych', cal_streaming:'strumień', cal_closed:'zamknięto',
       calib_status_hint:'Punkty zapisane w browser localStorage. Pusto — najpierw otwórz Calibration UI.',
       test_mode_on:'Tryb testowy: dashboard pokazuje wygenerowane mock dane.',
       s_ago:'s temu', m_ago:'min temu', h_ago:'godz temu', d_ago:'d temu',
       no_data:'brak danych', applied:'zastosowano', kmh:'km/h', gust:'poryw',
       no_data_window:'brak danych w tym zakresie', data_left:'dane po lewej', data_right:'dane po prawej', jump_data:'do danych',
       appearance:'🎨 Wygląd', theme:'Motyw', theme_dark:'Ciemny', theme_sun:'Słoneczny', language:'Język', test_mode:'Tryb testowy', test_toggle_btn:'Wł. / wył.',
       data_2g:'📶 2G / dane', lite_mode:'Tryb Lite', lite_full:'Pełny', lite_on:'Lite', refresh_now:'Synchronizacja', refresh:'Synchronizuj', synced:'zsynchronizowano',
       lite_hint:'Lite: wolny polling (60s), bez godzinowego pobierania wykresu — minimum danych na 2G.',
       wind_timeline:'Wind timeline · prędkość + kierunek', wt_meta:'strzałki pokazują kierunek',
       dir_timeline:'Kierunek wiatru', dirt_meta:'8 kierunków w czasie', no_dir_data:'brak danych kierunku (wiatrowskaz 0xFF)',
       uptime_chart:'Dostępność (uptime)', uptime_gaps:'przerw',
       beaufort:'Skala Beauforta', gust_factor:'Współczynnik porywu (1h)', dir_stability:'Stabilność (1h)',
       daily_summary:'📅 Wg dni', day:'Dzień', avg_kmh:'śr km/h', max_kmh:'max km/h', dom_dir:'dom. kier.',
       hourly_heat:'🕐 Heatmap godzinowa', hm_hint:'Kolor = średnia prędkość w tej godzinie',
       all_days:'wszystkie dni', from:'od', to:'do', today:'dzisiaj', yesterday:'wczoraj', last7:'7 dni',
       tab_status:'Stan', current_state:'Bieżący stan modułu', next_event:'następne zdarzenie',
       state_timeline:'Cykl pracy', state_hint:'Firmware sekwencyjnie przechodzi stany. Aktualny podświetlony.',
       pending_changes:'⏳ Oczekujące zmiany', pending_hint:'Zmiany (interwał/live) wchodzą przy następnym POST.',
       no_pending:'brak oczekujących zmian', raw_config:'Config serwera',
       waiting_next_post:'czekamy na następny POST', failed_timeout:'nie zastosowano (timeout)',
       local_cache:'💾 Cache lokalny', clear_cache:'Wyczyść cache',
       build_label:'Wersja aplikacji:', force_update:'↻ Zaktualizuj aplikację',
       cache_hint:'Dane historyczne cache w przeglądarce (14 dni). Synchronizacja przyrostowa.',
       solar:'Słońce', solar_chart:'☀ Napięcie panelu', smooth:'wygładzanie',
       calib_reset_default:'Reset do standardu', calib_push:'Zapisz na serwerze', calib_pull:'Pobierz z serwera',
       calib_pushed:'zapisano na serwerze', calib_pulled:'pobrano z serwera', calib_reset_done:'zresetowano',
       calib_push_err:'błąd zapisu', calib_pull_err:'brak danych na serwerze',
       calib_srv_updated:'Serwer: zaktualizowano ', calib_srv_empty:'Serwer: kalibracja nieustawiona',
       sol_dark:'ciemno', sol_dim:'słabo', sol_ok:'norma', sol_bright:'jasno',
       chg_in:'Ładowanie', batt_cur:'Bateria', chg_yes:'ładuje', chg_no:'nie ładuje', chg_idle:'brak słońca', bat_up:'ładuje się', bat_dn:'rozładowuje', est_hint:'szac. z W panelu (prądu nie mierzymy)', balance:'bilans', reserve:'zapas', per_hour:'na godzinę', charge_stuck:'brak ładowania!', theory:'teoret. /h', actual:'faktyczna /h',
       observed:'obs.', still_running:'jeszcze trwa', configured:'ustawione', not_applied:'moduł nie zastosował',
       live_active_note:'LIVE active — bieżący normalny interwał zacznie działać PO Stop LIVE',
       st_sleep_n:'GSM Sleep',     st_sleep_d:'Moduł wszedł w power-down',
       st_sample_n:'Zbieranie',    st_sample_d:'Sample vane + anemometer co 2s',
       st_wake_n:'GSM Wake',       st_wake_d:'Budzimy modem, czekamy na rejestrację',
       st_post_n:'Wysyłka',        st_post_d:'POST binarnego payload na serwer',
       st_live_n:'LIVE streaming', st_live_d:'GSM aktywny, POST co ~3s',
       st_off_n:'Moduł milczy',    st_off_d:'POST dawno nie przyszedł — moduł offline / poza zasięgiem',
       st_lpend_n:'LIVE pending',  st_lpend_d:'Serwer prosi LIVE — czekamy aż moduł wejdzie przy następnym POST',
       st_lexit_n:'Wyjście z LIVE',st_lexit_d:'Serwer prosi wyjść — moduł wyjdzie przy następnym live POST',
       ret_7d:'7 dni', ret_30d:'30 dni', ret_180d:'6 mies', ret_365d:'1 rok', ret_unl:'bez limitu',
       bf_charging:'ładuje się', bf_flat:'trend zerowy, czekamy',
       sig_label:'sygnał', sig_none:'brak danych sygnału (CSQ=99)', sig_lost:'brak sygnału (99)',
       bf_above_plat:'powyżej plateau — niedoszacowane, realnie ×1.5–2 więcej',
       bf_on_plat:'na plateau — przybliżone, ±50%',
       bf_exit_plat:'wychodzimy z plateau — szacunek pewniejszy',
       bf_steep:'stroma część rozładowania — szacunek ±10%',
       bf_data:'danych', bf_too_few:'za mało danych', bf_too_short:'za krótko (<30 min)', bf_const:'stała',
       sync_pending_title:'Konfiguracja jeszcze nieprzyjęta.',
       sync_pending_body:'Ustawione: {int}, ale serwer widzi cykl {obs}. Moduł przejdzie na nowy cykl po następnym POST (mediana zaktualizuje się za ~10 POSTów).',
       sync_ok:'Cykl zsynchronizowany: ustawiono {int}, faktycznie {obs}' },
  en:{ tab_live:'Live', tab_history:'History', tab_settings:'Settings', tab_calib:'Calibration',
       wind_direction:'Wind direction', wind_speed:'Wind speed', battery:'Battery', signal:'Signal',
       cycle:'Cycle', updated:'Updated', uptime_live:'Uptime', since_boot:'since last power-on', speed_last_hour:'Speed last hour',
       speed_history:'Wind speed', wind_rose:'Wind Rose', rose_meta:'% time per direction',
       batt_csq:'Battery + signal', battery_chart:'🔋 Battery', signal_chart:'📶 GSM signal (CSQ)', summary:'Stats', metric:'Metric', min:'min', avg:'avg', max:'max',
       post_interval:'📡 POST interval', cur_setting:'Current', apply:'Apply',
       speed_calib:'🌀 Speed calibration', speed_calib_hint:'How many km/h equals 1 anemometer pulse/sec. Display-only (firmware sends raw pulse counts).', reset_btn:'Reset',
       batt_settings:'🔋 Battery', batt_settings_hint:'Pack specs — for the "time left" forecast. Display/calc only (firmware reports voltage only).', batt_cap:'Capacity', batt_cut:'Cutoff',
       speed_units:'Units', solar_w:'Solar panel', per_day:'day', tz_label:'🕓 Data timezone', tz_auto:'auto (browser)',
       alerts:'🔔 Alerts', alerts_hint:'Push notifications while the tab is open. Pick which types fire.', alerts_on_lbl:'Enable all', alerts_perm:'Allow notifications', alert_batt_lbl:'Battery low <', alert_crit_lbl:'Battery critical <', alert_wind_lbl:'Wind >', alert_offline_lbl:'Offline (no data) >', alert_online_lbl:'Back online (recovered)', minutes:'min', alert_batt_n:'Low battery', alert_crit_n:'Critical battery', alert_wind_n:'High wind', alert_offline_n:'Station offline', alert_online_n:'Station back online', alert_solar_lbl:'Charge / sun (start, stop, full)', alert_full_n:'Charged full', alert_full_b:'≈100% — charging done', alert_soon_n:'Almost full', alert_soon_b:'will stop charging soon', alert_chgon_n:'Charging started', alert_chgoff_n:'No sun', alert_chgoff_b:'charging stopped', chg_full:'charged full', chg_soon:'almost full', off:'Off', on_btn:'On', alerts_test:'Test', alerts_test_body:'Notifications work ✅', spush:'📡 Server push (bg)', spush_hint:'Delivers notifications even when the app is closed. Thresholds come from Alerts above. Per POST: battery, wind, "back online" (offline is foreground-only).', spush_lbl:'This device', spush_test:'Test from server', spush_testall:'All types', livepin:'📌 Live in shade', livepin_hint:'Pins current data to the shade, silently refreshed in the background each POST (~once per cycle). No buzz.', livepin_lbl:'📌 Live in shade', spush_devices:'Subscribed devices', spush_none:'no subscriptions', spush_this:'this',
       live_mode:'🔴 Live mode (for calibration)',
       live_hint:'Firmware enters non-stop live POSTs (3s cycle). Eats battery, calibration only.',
       start_live:'Start LIVE', stop_live:'Stop LIVE',
       live_posts:'Non-stop Live POSTs', cancel:'Cancel', confirm_yes:'Yes', back_online:'Back online', went_offline:'Connection lost',
       danger:'⚠ Danger', wipe:'Wipe all server data', server:'Server',
       calib_title:'🧭 Sensor calibration',
       calib_hint2:'Calibration via a dedicated page. Supports Serial COM (fast, at the board) and GSM live (remote).',
       open_calib:'Open Calibration UI', calib_status:'Current calibration',
       calib_capture_hint:'Pick a source → connect → point the vane physically at the direction → tap (captures the current byte).',
       cal_source:'Source', connect:'Connect', disconnect:'Disconnect',
       cal_gsm_note:'Reading the live snapshot from the server (every 2s). For faster updates enable LIVE in Settings.',
       webserial_warn:'⚠ Browser does not support Web Serial — Chrome or Edge required (or use GSM live).',
       raw_stream:'Raw stream', raw_hint:'Raw stream from UART (Serial) or GSM snapshots — for diagnostics.', clear_btn:'Clear',
       cur_byte:'Current byte', cal_set:'set', cal_nodata:'no data', cal_streaming:'streaming', cal_closed:'closed',
       calib_status_hint:'Points saved in browser localStorage. Empty? Visit Calibration UI first.',
       test_mode_on:'Test mode: dashboard shows generated mock data. Server not polled.',
       s_ago:'s ago', m_ago:'min ago', h_ago:'h ago', d_ago:'d ago',
       no_data:'no data', applied:'applied', kmh:'km/h', gust:'gust',
       no_data_window:'no data in this range', data_left:'data to the left', data_right:'data to the right', jump_data:'jump to data',
       appearance:'🎨 Appearance', theme:'Theme', theme_dark:'Dark', theme_sun:'Sunlight', language:'Language', test_mode:'Test mode', test_toggle_btn:'On / off',
       data_2g:'📶 2G / data', lite_mode:'Lite mode', lite_full:'Full', lite_on:'Lite', refresh_now:'Sync', refresh:'Sync now', synced:'synced',
       lite_hint:'Lite: slow polling (60s), no hourly curve download — minimal data on 2G.',
       wind_timeline:'Wind timeline · speed + direction', wt_meta:'arrows show wind direction',
       dir_timeline:'Wind direction', dirt_meta:'8 compass points over time', no_dir_data:'no direction data (vane 0xFF)',
       uptime_chart:'Availability (uptime)', uptime_gaps:'gaps',
       beaufort:'Beaufort scale', gust_factor:'Gust factor (1h)', dir_stability:'Direction stability (1h)',
       daily_summary:'📅 Daily summary', day:'Day', avg_kmh:'avg km/h', max_kmh:'max km/h', dom_dir:'dom. dir',
       hourly_heat:'🕐 Hourly heatmap', hm_hint:'Color = average wind speed for that hour of day',
       all_days:'all days', from:'from', to:'to', today:'today', yesterday:'yesterday', last7:'7 days',
       tab_status:'Status', current_state:'Current firmware state', next_event:'next event',
       state_timeline:'Work cycle', state_hint:'Firmware steps through these states in order. Current is highlighted.',
       pending_changes:'⏳ Pending changes', pending_hint:'Changes (interval/live) apply on the next module POST.',
       no_pending:'no pending changes', raw_config:'Server config',
       waiting_next_post:'waiting for next POST', failed_timeout:'failed (timeout)',
       local_cache:'💾 Local cache', clear_cache:'Clear cache',
       build_label:'App build:', force_update:'↻ Force update',
       cache_hint:'History data is cached in browser (last 14 days). Incremental sync from server.',
       solar:'Solar', solar_chart:'☀ Solar voltage', smooth:'smoothing',
       calib_reset_default:'Reset to default', calib_push:'Push to server', calib_pull:'Pull from server',
       calib_pushed:'pushed to server', calib_pulled:'pulled from server', calib_reset_done:'reset to default',
       calib_push_err:'push failed', calib_pull_err:'no data on server',
       calib_srv_updated:'Server: updated ', calib_srv_empty:'Server: calibration not set',
       sol_dark:'dark', sol_dim:'dim', sol_ok:'ok', sol_bright:'bright',
       chg_in:'Charging', batt_cur:'Battery', chg_yes:'charging', chg_no:'not charging', chg_idle:'no sun', bat_up:'charging', bat_dn:'draining', est_hint:'est. from panel W (current not measured)', balance:'balance', reserve:'reserve', per_hour:'per hour', charge_stuck:'not charging!', theory:'theoretical /h', actual:'actual /h',
       observed:'obs', still_running:'still running', configured:'set', not_applied:"module hasn't applied yet",
       live_active_note:'LIVE active — current normal interval will take effect AFTER Stop LIVE',
       st_sleep_n:'GSM Sleep',     st_sleep_d:'Module is in power-down',
       st_sample_n:'Sampling',     st_sample_d:'Sampling vane + anemometer every 2s',
       st_wake_n:'GSM Wake',       st_wake_d:'Waking modem, waiting for registration',
       st_post_n:'Sending',        st_post_d:'POSTing binary payload to server',
       st_live_n:'LIVE streaming', st_live_d:'GSM active, POST every ~3s',
       st_off_n:'Module silent',   st_off_d:'No POST for a while — module offline / out of range',
       st_lpend_n:'LIVE pending',  st_lpend_d:'Server requests LIVE — waiting for module to enter on next regular POST',
       st_lexit_n:'Exiting LIVE',  st_lexit_d:'Server requests exit — module will leave on next live POST',
       ret_7d:'7 days', ret_30d:'30 days', ret_180d:'6 mo', ret_365d:'1 yr', ret_unl:'unlimited',
       bf_charging:'charging', bf_flat:'flat trend, waiting',
       sig_label:'signal', sig_none:'no signal data (CSQ=99)', sig_lost:'no signal (99)',
       bf_above_plat:'above plateau — underestimate, real will be ×1.5–2 more',
       bf_on_plat:'on plateau — rough estimate, ±50%',
       bf_exit_plat:'leaving plateau — estimate more reliable',
       bf_steep:'steep discharge part — estimate ±10%',
       bf_data:'of data', bf_too_few:'too few samples', bf_too_short:'too short (<30 min)', bf_const:'constant',
       sync_pending_title:"Config hasn't been applied yet.",
       sync_pending_body:'Configured: {int}, but server sees cycle {obs}. Module switches on next POST (median catches up in ~10 POSTs).',
       sync_ok:'Cycle in sync: configured {int}, actual {obs}' },
};
let LANG = localStorage.getItem('lang') || 'uk';
function t(k){ return I18N[LANG]?.[k] || I18N.en[k] || k; }
/* card-header icons by i18n key — added in markup-safe way (outside [data-i18n]) */
const HEADER_ICONS = {
  appearance:'ic-palette', data_2g:'ic-signal', post_interval:'ic-cycle', speed_calib:'ic-wind', batt_settings:'ic-battery', alerts:'ic-warn', spush:'ic-signal', live_mode:'ic-live',
  local_cache:'ic-save', danger:'ic-warn', server:'ic-globe', calib_title:'ic-calib',
  calib_status:'ic-calib', current_state:'ic-status', state_timeline:'ic-cycle',
  pending_changes:'ic-clock', network:'ic-globe', raw_config:'ic-code', summary:'ic-history',
  daily_summary:'ic-calendar', hourly_heat:'ic-grid', wind_rose:'ic-calib', solar_chart:'ic-sun',
  batt_csq:'ic-battery', battery_chart:'ic-battery', signal_chart:'ic-signal', speed_last_hour:'ic-wind', wind_timeline:'ic-wind', dir_timeline:'ic-calib', uptime_chart:'ic-clock',
};
/* strip a leading emoji (+spaces) but keep digits/letters like "2G" */
const LEAD_EMOJI = /^[\p{Extended_Pictographic}️‍\s]+/u;
function decorateHeaders(){
  for (const [key, ic] of Object.entries(HEADER_ICONS)){
    document.querySelectorAll(`[data-i18n="${key}"]`).forEach(el => {
      const h2 = el.matches('h2') ? el : el.closest('h2');
      if (!h2) return;
      el.textContent = el.textContent.replace(LEAD_EMOJI, '');   /* drop emoji from rendered text */
      if (!h2.querySelector(':scope > svg.ic')){                  /* add icon once (re-added if i18n wiped it) */
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'ic');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#' + ic);
        svg.appendChild(use);
        h2.insertBefore(svg, h2.firstChild);
      }
    });
  }
}
function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === LANG));
  document.documentElement.lang = LANG;
  decorateHeaders();
}
document.querySelectorAll('.lang-btn[data-lang]').forEach(b => b.addEventListener('click', () => {
  LANG = b.dataset.lang; localStorage.setItem('lang', LANG);
  applyI18n();
  renderAll();
  /* Also re-render dynamic widgets that hold translated text in DOM but aren't
   * marked with data-i18n (state names, banners, forecast notes). */
  if (typeof renderStatus === 'function') try { renderStatus(); } catch {}
  if (history?.length && typeof drawHistoryCharts === 'function') try { drawHistoryCharts(); } catch {}
  if (typeof spushSyncCfg === 'function') spushSyncCfg();   /* push the new language to the server too */
}));

/* Sunlight (high-contrast LIGHT) theme — persisted. SVG charts read CSS vars
 * directly, so they restyle live without a redraw. */
let THEME = localStorage.getItem('theme') || 'dark';
function applyTheme(){
  document.body.classList.toggle('sunlight', THEME === 'sunlight');
  const tb = document.getElementById('theme-toggle');
  if (tb) tb.innerHTML = icSvg(THEME === 'sunlight' ? 'ic-moon' : 'ic-sun');
  const tsw = document.getElementById('theme-sw'); if (tsw) tsw.checked = (THEME === 'sunlight');
  applyThemeColor();
}
function setTheme(name){ THEME = name; localStorage.setItem('theme', THEME); applyTheme(); }
applyTheme();
document.getElementById('theme-toggle')?.addEventListener('click', () => setTheme(THEME === 'sunlight' ? 'dark' : 'sunlight'));
document.getElementById('theme-sw')?.addEventListener('change', e => setTheme(e.target.checked ? 'sunlight' : 'dark'));
/* Settings test-mode switch mirrors the header toggle */
document.getElementById('test-toggle-2')?.addEventListener('change', () => document.getElementById('test-toggle')?.click());

/* ===== Lite mode (2G data saver): slow poll + no hourly curve backfill + hide charts ===== */
let LITE = localStorage.getItem('lite') === '1';
/* Wind-speed conversion factor: km/h per 1 pulse/sec (anemometer calibration).
 * Client-side display setting — the firmware sends raw pulse counts. */
let SPEED_FACTOR = parseFloat(localStorage.getItem('speed_factor')) || 2.4;

/* ---- Display units / timezone / solar / alerts (all client-side) ---- */
const SPEED_UNITS = { kmh:{mul:1, lbl:'km/h', max:100}, ms:{mul:1/3.6, lbl:'m/s', max:30}, mph:{mul:0.621371, lbl:'mph', max:60}, kn:{mul:0.539957, lbl:'kn', max:55} };
let SPEED_UNIT = localStorage.getItem('speed_unit') || 'kmh';
function spdU(){ return SPEED_UNITS[SPEED_UNIT] || SPEED_UNITS.kmh; }
function spdMul(){ return spdU().mul; }      /* km/h → display unit */
function spdLbl(){ return spdU().lbl; }

/* Server timestamps are local-time strings with no zone. By default we parse them
 * in the BROWSER's zone (fine when phone TZ == server TZ). If they differ, set an
 * explicit server offset so absolute time is correct everywhere. */
let TZ_OFFSET = localStorage.getItem('tz_offset');   /* '' = browser-local; else hours e.g. '2' */
function parseServerTs(s){
  if (typeof s === 'number') return s > 1e12 ? s : s * 1000;
  if (typeof s !== 'string') return 0;
  let iso = s.replace(' ', 'T');
  if (TZ_OFFSET && !isNaN(parseFloat(TZ_OFFSET))){
    const off = parseFloat(TZ_OFFSET), sign = off < 0 ? '-' : '+', ah = Math.abs(off);
    iso += sign + String(Math.floor(ah)).padStart(2,'0') + ':' + String(Math.round((ah % 1) * 60)).padStart(2,'0');
  }
  return new Date(iso).getTime();
}

let SOLAR_WATT = parseFloat(localStorage.getItem('solar_watt')) || 3;   /* panel W; default 3W = worst-case A4-ish 10-12V panel */
/* Solar panel state thresholds (mV at the panel node, NOT battery):
 *  < SOLAR_ZERO_MV   → no current at all, treat as 0 (CN3791 dark floor ~2.8V sits here)
 *  < SOLAR_CHARGE_MV → panel awake but below battery, module is NOT charging
 *  ≥ SOLAR_CHARGE_MV → panel above battery, CN3791 is charging */
const SOLAR_ZERO_MV   = 3300;
const SOLAR_CHARGE_MV = 4000;
const SOLAR_EFF       = 0.85;   /* CN3791 buck efficiency for the instantaneous charge-current estimate */
const BATT_FULL_MV    = 4150;   /* at/above → treat as full, charge tapers to ~0 ("charged full") */
const BATT_SOON_MV    = 4100;   /* charging above this → "almost full, will stop charging soon" */
let ALERTS_ON  = localStorage.getItem('alerts_on') === '1';
/* Per-type alert config (each independently toggleable). v = wind in display unit. */
const ALERT_DEFAULTS = { battLow:{on:true,mv:3400}, battCrit:{on:true,mv:3300}, windHigh:{on:false,v:20}, offline:{on:true,min:30}, online:{on:true}, solar:{on:true} };
let ALERTS = (() => {
  const d = JSON.parse(JSON.stringify(ALERT_DEFAULTS));
  try { const s = JSON.parse(localStorage.getItem('alerts_cfg') || '{}'); for (const k in d) Object.assign(d[k], s[k] || {}); } catch {}
  return d;
})();
function applyLite(){
  document.body.classList.toggle('lite', LITE);
  const lsw = document.getElementById('lite-sw'); if (lsw) lsw.checked = LITE;
}
function setLite(on){ LITE = !!on; localStorage.setItem('lite', LITE ? '1' : '0'); applyLite(); if (typeof startPoll === 'function') startPoll(); }
applyLite();
document.getElementById('lite-sw')?.addEventListener('change', e => setLite(e.target.checked));
/* full sync on demand: poll + force the last-hour curve backfill (even in Lite) +
 * refresh history if open. The header spinner shows automatically via fjson. */
async function syncNow(){
  const btn = $('refresh-now'); if (btn) btn.disabled = true;
  $('sync-spin')?.classList.add('on');
  try {
    if (typeof poll === 'function') await poll();
    if (typeof maybeBackfillSpeedHistory === 'function') await maybeBackfillSpeedHistory(Date.now(), true);
    if (document.querySelector('.tab.active')?.dataset.page === 'history' && typeof renderHistory === 'function') await renderHistory();
    toast('✓ ' + t('synced'));
  } catch (e){ toast('✗ ' + e.message, true); }
  finally { if (btn) btn.disabled = false; $('sync-spin')?.classList.remove('on'); }
}
$('refresh-now')?.addEventListener('click', syncNow);

/* ===== PWA: installable + offline app-shell (http/https only; skip on file://) ===== */
if (location.protocol.startsWith('http')){
  try { const ml = document.createElement('link'); ml.rel = 'manifest'; ml.href = '?manifest=1'; document.head.appendChild(ml); } catch {}
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('?sw=1').catch(() => {});
    /* A Force-update / PWA reinstall drops the push subscription (it's tied to the
     * SW registration), leaving a dead one on the server (410). If the user had
     * server push on, silently re-create a fresh subscription so it self-heals. */
    if (localStorage.getItem('spush_on') === '1'){
      swReady().then(() => { if (typeof spushReg === 'function') spushReg(); }).catch(() => {});
    }
  }
}
/* Resolve to a registration whose worker is ACTIVE — robustly. navigator
 * .serviceWorker.ready only resolves once a worker CONTROLS this page, which can
 * lag (or never happen on a hard-reloaded page). Instead register explicitly and
 * wait for the registration's own worker to reach 'activated'. Times out so the
 * UI reports instead of hanging. */
function swReady(ms = 12000){
  if (!('serviceWorker' in navigator)) return Promise.reject(new Error('no SW'));
  const work = (async () => {
    let reg = await navigator.serviceWorker.register('?sw=1').catch(() => null);
    if (!reg) reg = await navigator.serviceWorker.getRegistration();
    if (!reg) throw new Error('SW не зареєструвався');
    if (reg.active) return reg;
    const sw = reg.installing || reg.waiting;
    if (sw){
      await new Promise(res => {
        if (sw.state === 'activated') return res();
        sw.addEventListener('statechange', () => { if (sw.state === 'activated') res(); });
      });
      return reg;
    }
    return await navigator.serviceWorker.ready;
  })();
  return Promise.race([
    work,
    new Promise((_, rej) => setTimeout(() => rej(new Error('SW не активувався — перезавантаж')), ms))
  ]);
}

/* =========== TABS =========== */
const TAB_ORDER = [...document.querySelectorAll('.tab')].map(t => t.dataset.page);
const tabIndex = p => TAB_ORDER.indexOf(p);
/* Moving accent underline under the tab bar (follows swipes + slides on click). */
const tabInd = document.getElementById('tab-ind');
function tabBox(page){ const t = document.querySelector(`.tab[data-page="${page}"]`); return t ? { l: t.offsetLeft, w: t.offsetWidth } : { l: 0, w: 0 }; }
function setInd(l, w, anim){ if (!tabInd) return; tabInd.style.transition = anim ? 'transform .2s ease' : 'none'; tabInd.style.transform = `translateX(${l}px) scaleX(${w / 100})`; }
function indToActive(anim){ const a = document.querySelector('.tab.active'); if (a) setInd(a.offsetLeft, a.offsetWidth, anim); }
addEventListener('load', () => indToActive(false));
requestAnimationFrame(() => indToActive(false));
/* Synchronous, network-FREE render of a page using whatever data we already hold — fills
 * a page BEFORE it animates in (and pre-renders a swipe neighbour) so nothing pops in late. */
function renderPageSync(page){
  clearChartDims();
  if (page === 'history') drawHistoryCharts();
  else if (page === 'live') drawLiveTimeline();
  else if (page === 'status') renderStatus();
  else if (page === 'calib'){ renderCalibReadonly(); capRenderGrid(); }
}
/* Fresh-data fetch + off-tab side-effects — run AFTER the transition so they don't jank it. */
function asyncUpdate(page){
  if (page === 'history') renderHistory();               /* fetch newest + redraw */
  if (page === 'calib') capSetSource(capSrc); else capStopGsm();
  if (page === 'status') renderNetLog();
  if (page === 'settings'){ updateCacheStats(); loadDeviceList(); }
}
function switchToTab(page, anim, prerendered){
  const t = document.querySelector(`.tab[data-page="${page}"]`);
  if (!t || t.classList.contains('active')) return;
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active', 'slide-r', 'slide-l', 'no-in'));
  t.classList.add('active');
  const np = $('page-' + page);
  /* Swipe already slid the page fully into place — adding .active would re-fire pageIn
   * (opacity 0→1 = blink, translateY 5px = jerk down). Suppress it for the swipe path. */
  if (prerendered) np.classList.add('no-in');
  np.classList.add('active');
  /* Fill the page with CURRENT data BEFORE the animation → no black flash, no late pop-in.
   * (Swipe pre-renders the neighbour at gesture start, so it passes prerendered=true.) */
  if (!prerendered) renderPageSync(page);
  if (anim === 'r') np.classList.add('slide-r');
  else if (anim === 'l') np.classList.add('slide-l');
  indToActive(true);
  scrollTo(0, 0);
  /* the fresh fetch happens after the slide so it can't jank it */
  let done = false;
  const run = () => { if (done) return; done = true; np.removeEventListener('animationend', run); asyncUpdate(page); };
  np.addEventListener('animationend', run, { once: true });
  setTimeout(run, 260);
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  const cur = document.querySelector('.tab.active')?.dataset.page;
  if (t.dataset.page !== cur) haptic(10);
  if (t.dataset.page === 'history'){ histSeenTs = lastConfig?.last_timestamp || histSeenTs; setTabBadge('history', false); }
  switchToTab(t.dataset.page, tabIndex(t.dataset.page) > tabIndex(cur) ? 'r' : 'l');
}));
let histSeenTs = null, _prevPostTs = null, _wasOffline = false;   /* History-seen marker + fresh-post + connectivity tracking */
/* haptic feedback on any toggle switch flip (delegated, touch devices only) */
document.addEventListener('change', e => { if (e.target?.closest?.('.switch')) haptic(12); });

/* Swipeable pager: the page follows your finger and the neighbour slides in;
 * on release it completes past ~28% else snaps back. Ignores swipes that start
 * on charts (they pan/zoom), the tab bar or form controls, and vertical scrolls. */
(function(){
  let d = null;
  const eligible = el => !el.closest('.chart-wrap, .tabs, input, select, textarea');
  addEventListener('touchstart', e => {
    d = null;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const edge = t.clientX < 26 || t.clientX > innerWidth - 26;   /* edge swipe pages even over charts */
    if (!edge && !eligible(e.target)) return;
    d = { sx: t.clientX, sy: t.clientY, eng: false, active: document.querySelector('.page.active') };
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!d) return;
    const t = e.touches[0], dx = t.clientX - d.sx, dy = t.clientY - d.sy;
    if (!d.eng){
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)){ d = null; return; }   /* vertical scroll */
      if (Math.abs(dx) < 12) return;
      const ni = tabIndex(d.active.id.replace('page-', '')) + (dx < 0 ? 1 : -1);
      if (ni < 0 || ni >= TAB_ORDER.length){ d = null; return; }                   /* no neighbour */
      const nb = $('page-' + TAB_ORDER[ni]);
      const r = d.active.getBoundingClientRect();
      d.w = r.width || innerWidth; d.dir = dx < 0 ? 1 : -1; d.nb = nb;
      d.fromBox = tabBox(d.active.id.replace('page-', '')); d.toBox = tabBox(TAB_ORDER[ni]);
      /* Overlay the neighbour EXACTLY on the current page's box (same top/left/width) so it
       * slides in pixel-aligned — using a computed header/tab offset instead drifted the new
       * page DOWN. Height covers from there to the viewport bottom; overflow clips the rest. */
      Object.assign(nb.style, { position: 'fixed', top: r.top + 'px', left: r.left + 'px', width: d.w + 'px',
        height: Math.max(r.height, innerHeight - Math.max(0, r.top)) + 'px', overflow: 'hidden', zIndex: '30', background: 'var(--bg)', display: 'block', margin: '0', willChange: 'transform' });
      d.active.style.willChange = 'transform';
      d.eng = true;
      /* pre-render the neighbour (still off-screen) with current data so it slides in
       * already full — no black flash / cards popping in after release. */
      _forceCharts = true; renderPageSync(TAB_ORDER[ni]); _forceCharts = false;
    }
    e.preventDefault();
    const off = d.dir > 0 ? Math.max(-d.w, Math.min(0, dx)) : Math.min(d.w, Math.max(0, dx));
    d.cur = off;
    d.active.style.transform = `translateX(${off}px)`;
    d.nb.style.transform = `translateX(${d.dir > 0 ? d.w + off : -d.w + off}px)`;
    const pp = Math.min(1, Math.abs(off) / d.w);              /* indicator follows the swipe */
    setInd(d.fromBox.l + (d.toBox.l - d.fromBox.l) * pp, d.fromBox.w + (d.toBox.w - d.fromBox.w) * pp, false);
  }, { passive: false });
  addEventListener('touchend', () => {
    if (!d){ return; }
    if (!d.eng){ d = null; return; }
    const a = d.active, n = d.nb, dir = d.dir, w = d.w, past = Math.abs(d.cur || 0) > w * 0.28;
    setInd((past ? d.toBox : d.fromBox).l, (past ? d.toBox : d.fromBox).w, true);   /* settle the underline */
    a.style.transition = n.style.transition = 'transform .2s ease-out';
    a.style.transform = `translateX(${past ? (dir > 0 ? -w : w) : 0}px)`;
    n.style.transform = `translateX(${past ? 0 : (dir > 0 ? w : -w)}px)`;
    const target = past ? n.id.replace('page-', '') : null;
    d = null;
    setTimeout(() => {
      ['transform', 'transition', 'willChange'].forEach(p => a.style[p] = '');
      ['position', 'top', 'left', 'width', 'height', 'overflow', 'zIndex', 'background', 'display', 'margin', 'transform', 'transition', 'willChange'].forEach(p => n.style[p] = '');
      if (target) switchToTab(target, null, true);   /* neighbour already rendered at engage */
    }, 210);
  }, { passive: true });
})();

/* Charts use a pixel-width viewBox → re-render on resize so they refill width. */
let _resizeT;
window.addEventListener('resize', () => {
  clearTimeout(_resizeT);
  _resizeT = setTimeout(() => { clearChartDims(); drawLiveTimeline(); if (history.length) drawHistoryCharts(); indToActive(false); }, 180);
});

/* =========== STATE MACHINE INFERENCE =========== */
/* Firmware doesn't report state directly. We infer from elapsed-since-last-POST
 * and known cycle config. NORMAL mode states:
 *   0..2s after POST    → GSM_SLEEP (just slept)
 *   2..(cycle-5)s       → SAMPLE   (collecting WDT-sleep readings)
 *   last 3-5s           → WAKE+POST (GSM up, sending)
 * LIVE mode → looping POSTs every ~3s. */
/* State machine — names + descriptions are i18n keys, resolved each render. */
const NORMAL_STATES = [
  { id: 'sleep',  icon: 'ic-sleep',  nameKey: 'st_sleep_n',  descKey: 'st_sleep_d'  },
  { id: 'sample', icon: 'ic-status', nameKey: 'st_sample_n', descKey: 'st_sample_d' },
  { id: 'wake',   icon: 'ic-live',   nameKey: 'st_wake_n',   descKey: 'st_wake_d'   },
  { id: 'post',   icon: 'ic-up',     nameKey: 'st_post_n',   descKey: 'st_post_d'   },
];
const LIVE_STATES = [
  { id: 'live', icon: 'ic-live', nameKey: 'st_live_n', descKey: 'st_live_d' },
];
const OFFLINE_STATE = { id:'offline', icon:'ic-warn',  nameKey: 'st_off_n',  descKey: 'st_off_d'  };
const LIVE_PENDING  = { id:'lpend',   icon:'ic-clock', nameKey: 'st_lpend_n', descKey: 'st_lpend_d' };
const LIVE_EXITING  = { id:'lexit',   icon:'ic-clock', nameKey: 'st_lexit_n', descKey: 'st_lexit_d' };
const stN = s => t(s.nameKey) || s.id;
const stD = s => t(s.descKey) || '';

/* Track recent live timestamps to estimate the actual live cycle (HTTPS over
 * GSM can be 30-60s per POST, not the firmware's 3s setting). */
let liveTsHistory = [];
function recordLiveTs(ts){
  if (!ts) return;
  if (liveTsHistory.length && liveTsHistory[liveTsHistory.length-1] === ts) return;
  liveTsHistory.push(ts);
  if (liveTsHistory.length > 10) liveTsHistory.shift();
}
function observedLiveCycle(){
  if (liveTsHistory.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < liveTsHistory.length; i++) gaps.push(liveTsHistory[i] - liveTsHistory[i-1]);
  gaps.sort((a,b) => a-b);
  return gaps[Math.floor(gaps.length / 2)] / 1000;   /* median, in seconds */
}

/* Best-guess "true" cycle:
 *   intended = samples × avg × 2 + 15s GSM overhead (what config implies)
 *   observed = server's median gap of last few entries (lags behind config changes)
 * If they differ by >40% → config just changed, observed is stale → trust intended.
 * Otherwise observed is more accurate (accounts for real GSM jitter). */
function effectiveCycle(cfg){
  if (!cfg) return { sec: 60, source: 'fallback', pending: false };
  const intended = cfg.intended_cycle_seconds || (cfg.samples * cfg.avg * 2 + 15);
  const observed = cfg.cycle_seconds || 0;
  if (!observed) return { sec: intended, observed, intended, source: 'intended', pending: false };
  const ratio = Math.max(intended, observed) / Math.min(intended, observed);
  const pending = ratio > 1.4;       /* >40% diff = config not applied yet */
  return { sec: pending ? intended : observed, observed, intended,
           source: pending ? 'intended' : 'observed', pending };
}

function inferState(){
  if (!lastConfig) return { cur: null, pct: 0, untilNext: null, lastSec: null };
  const eff = effectiveCycle(lastConfig);
  const cycle = eff.sec;

  /* In LIVE mode, the freshest signal is `lastSnapshot.timestamp` (live POST).
   * In NORMAL mode, use config.last_timestamp from the main log. */
  let lastTs = null;
  if (lastConfig.live && lastSnapshot?.timestamp){
    lastTs = parseServerTs(lastSnapshot.timestamp);
    recordLiveTs(lastTs);
  } else if (lastConfig.last_timestamp){
    lastTs = parseServerTs(lastConfig.last_timestamp);
  }
  const sinceLast = lastTs ? (Date.now() - lastTs) / 1000 : null;
  const liveCycle = observedLiveCycle() || 60;       /* fall back to 60s when unknown */
  const expectedCycle = lastConfig.live ? liveCycle : cycle;

  /* OFFLINE detection: no POST in 2× expected cycle + 60s grace */
  if (sinceLast != null && sinceLast > expectedCycle * 2 + 60){
    return { cur: OFFLINE_STATE, states: [OFFLINE_STATE], idx: 0,
             pct: 100, untilNext: null, lastSec: sinceLast, cycleSec: expectedCycle, offline: true };
  }

  if (lastConfig.live){
    /* Server says live=1. If recent live POST (within expected cycle + grace) → streaming.
     * If too long since last live POST → "pending" (module hasn't entered live yet). */
    const liveOk = sinceLast != null && sinceLast < expectedCycle * 1.5 + 30;
    if (!liveOk){
      return { cur: LIVE_PENDING, states: [LIVE_PENDING], idx: 0,
               pct: 0, untilNext: null, lastSec: sinceLast, cycleSec: expectedCycle };
    }
    const cyclePos = sinceLast % expectedCycle;
    return { cur: LIVE_STATES[0], states: LIVE_STATES, idx: 0,
             pct: (cyclePos / expectedCycle) * 100,
             untilNext: Math.max(0, expectedCycle - cyclePos),
             lastSec: sinceLast, cycleSec: expectedCycle };
  }

  /* Normal cycle */
  if (sinceLast == null) return { cur: NORMAL_STATES[0], states: NORMAL_STATES, idx: 0, pct: 0, untilNext: null, lastSec: null };

  const cyclePos = sinceLast % cycle;
  let idx;
  if (cyclePos < 2) idx = 0;
  else if (cyclePos < cycle - 5) idx = 1;
  else if (cyclePos < cycle - 2) idx = 2;
  else idx = 3;
  return { cur: NORMAL_STATES[idx], states: NORMAL_STATES, idx,
           pct: (cyclePos / cycle) * 100,
           untilNext: Math.max(0, cycle - cyclePos),
           lastSec: sinceLast, cycleSec: cycle,
           eff };
}

/* Tint the Live + Status tab icons by what's happening: green = normal & fresh ·
 * blue(pulse) = live streaming · amber = live pending · red = offline. */
function updateTabDots(){
  const s = inferState();
  let color = '', pulse = false;
  if (s && s.cur){
    if (s.offline || s.cur.id === 'offline')      color = 'var(--err)';
    else if (s.cur.id === 'lpend')                color = 'var(--warn)';
    else if (s.cur.id === 'live'){ color = 'var(--accent)'; pulse = true; }
    else                                          color = 'var(--ok)';
  }
  ['live', 'status'].forEach(pg => {
    const ic = document.querySelector(`.tab[data-page="${pg}"] .ic`);
    if (!ic) return;
    ic.style.color = color;                  /* '' → inherit (mut / active accent) */
    ic.classList.toggle('pulse', pulse);
  });
  updateTabBadges();
}
/* Status dots on the remaining tabs:
 *  Settings — red if alerts are on but notifications can't show; amber(pulse) if a config change is pending.
 *  Calib    — green(pulse) while a capture source streams; amber if calibration is incomplete (<8 points). */
function updateTabBadges(){
  let setColor = null, setPulse = false;
  const permBad = ALERTS_ON && ('Notification' in window) && Notification.permission !== 'granted';
  const pend = Array.isArray(pending) && pending.some(p => p.status === 'waiting');
  if (permBad) setColor = 'var(--err)';
  else if (pend){ setColor = 'var(--warn)'; setPulse = true; }
  setTabBadge('settings', !!setColor, setColor, setPulse);

  const streaming = capPort || capGsmTimer;
  let calColor = null, calPulse = false;
  if (streaming){ calColor = 'var(--ok)'; calPulse = true; }
  else { try { if (Object.keys(getCalib()).length < 8) calColor = 'var(--warn)'; } catch (_) {} }
  setTabBadge('calib', !!calColor, calColor, calPulse);
}
function renderStatus(){
  const s = inferState();
  if (!s.cur){
    $('st-icon').innerHTML = icSvg('ic-status'); $('st-icon').style.color = 'var(--mut)';
    $('st-name').textContent = '—'; $('st-desc').textContent = 'чекаю на дані сервера';
    $('st-countdown').textContent = '—'; $('st-progress').style.width = '0%';
    $('st-machine').innerHTML = ''; return;
  }
  $('st-icon').innerHTML = icSvg(s.cur.icon);
  $('st-icon').style.color = s.cur.id === 'offline' ? 'var(--warn)' : 'var(--accent)';
  $('st-name').textContent = stN(s.cur);
  $('st-desc').textContent = stD(s.cur);
  $('st-countdown').textContent = s.untilNext != null ? Math.ceil(s.untilNext) + 's' : '—';
  $('st-progress').style.width = Math.min(100, s.pct).toFixed(1) + '%';
  $('st-last-post').textContent = 'last: ' + (s.lastSec != null ? fmtAgo(s.lastSec) : '—');
  $('st-next-post').textContent = 'next: ' + (s.untilNext != null ? '~' + Math.ceil(s.untilNext) + 's' : '—');

  /* state machine bubbles */
  const mc = $('st-machine'); mc.innerHTML = '';
  s.states.forEach((st, i) => {
    const div = document.createElement('div');
    div.className = 'st-step' + (i === s.idx ? ' active' : i < s.idx ? ' done' : '');
    div.innerHTML = `${icSvg(st.icon)}<span>${stN(st)}</span>`;
    mc.appendChild(div);
    if (i < s.states.length - 1){
      const a = document.createElement('span'); a.className = 'st-arrow'; a.textContent = '→'; mc.appendChild(a);
    }
  });
  if (s.states.length > 1) {
    const loop = document.createElement('span'); loop.className = 'st-arrow'; loop.textContent = '↻'; mc.appendChild(loop);
  }

  /* Cycle sync banner: warn when configured cycle ≠ actually observed cycle on server. */
  const banner = $('st-cycle-sync');
  if (banner && lastConfig){
    const eff = effectiveCycle(lastConfig);
    const intHuman = fmtSec(eff.intended);
    const obsHuman = eff.observed ? fmtSec(eff.observed) : '—';
    if (eff.pending){
      banner.style.display = 'block';
      banner.style.background = 'rgba(210,153,34,.12)';
      banner.style.border = '1px solid rgba(210,153,34,.5)';
      banner.style.color  = 'var(--warn)';
      banner.innerHTML = `⚠ <b>${t('sync_pending_title')}</b> ` +
        `${t('sync_pending_body').replace('{int}', `<b>${intHuman}</b>`).replace('{obs}', `<b>${obsHuman}</b>`)}`;
    } else if (eff.observed && lastConfig.intended_cycle_seconds){
      banner.style.display = 'block';
      banner.style.background = 'rgba(63,185,80,.08)';
      banner.style.border = '1px solid rgba(63,185,80,.3)';
      banner.style.color  = 'var(--mut)';
      banner.innerHTML = `✓ ${t('sync_ok').replace('{int}', `<b>${intHuman}</b>`).replace('{obs}', `<b>${obsHuman}</b>`)}`;
    } else {
      banner.style.display = 'none';
    }
  }

  /* raw config */
  $('st-raw-config').innerHTML = lastConfig
    ? Object.entries(lastConfig).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${v === null ? '—' : v}</span></div>`).join('')
    : '—';

  renderPending();
}

/* =========== PENDING CHANGES =========== */
let pending = [];
function trackPending(kind, target){
  /* target = expected config state, e.g. {samples:30, avg:1} or {live:1} */
  pending.push({
    kind, target,
    startedAt: Date.now(),
    status: 'waiting',
    appliedAt: null,
  });
  if (pending.length > 8) pending = pending.slice(-8);
  renderPending();
}
function checkPending(){
  if (!lastConfig) return;
  let changed = false;
  for (const p of pending){
    if (p.status !== 'waiting') continue;
    const target = p.target;
    const ok = Object.keys(target).every(k => lastConfig[k] == target[k]);
    if (ok){ p.status = 'applied'; p.appliedAt = Date.now(); changed = true; }
    else if (Date.now() - p.startedAt > 600000){ p.status = 'failed'; changed = true; }   /* 10min timeout */
  }
  if (changed) renderPending();
}
function renderPending(){
  const el = $('pending-list'); if (!el) return;
  el.innerHTML = '';
  const active = pending.filter(p => p.status === 'waiting');
  const recent = pending.filter(p => p.status !== 'waiting').slice(-3);
  const show = [...active, ...recent];
  $('pending-empty').style.display = show.length ? 'none' : 'block';
  for (const p of show){
    const row = document.createElement('div');
    row.className = 'pending-row ' + p.status;
    const icon = icSvg(p.status === 'applied' ? 'ic-check' : p.status === 'failed' ? 'ic-x' : 'ic-clock');
    const label = Object.entries(p.target).map(([k,v]) => `${k}=${v}`).join(' ');
    const ago = Math.round((Date.now() - p.startedAt) / 1000);
    const appliedAgo = p.appliedAt ? Math.round((Date.now() - p.appliedAt) / 1000) + 's ago' : '';
    const when = p.status === 'waiting'
      ? `${p.kind} → ${ago}s ago · ${t('waiting_next_post') || 'waiting for next POST'}`
      : p.status === 'applied'
      ? `${p.kind} → ${t('applied') || 'applied'} ${appliedAgo}`
      : `${p.kind} → ${t('failed_timeout') || 'failed (timeout)'}`;
    row.innerHTML = `
      <div class="icon">${icon}</div>
      <div class="body">
        <div class="what">${label}</div>
        <div class="when">${when}</div>
      </div>
      <div class="status">${p.status}</div>
    `;
    el.appendChild(row);
  }
}

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
 * to mean anything; otherwise shows "збираємо дані". */
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

/* =========== STATE =========== */
let cacheRetentionDays = +localStorage.getItem('cache_retention_days') || 30;
let lastSeenHistTs = null;   /* triggers auto-refresh of History when changes */
let lastSnapshot = null;           /* {vane, pps, batt_mv, csq, timestamp, age_sec} */
let lastConfig   = null;           /* {samples, avg, samples_max, cycle_seconds, live, last_timestamp} */
let speedHistory = [];             /* {t, kmh, dir} for sparkline + stats (last hour) */
let history      = [];             /* full entries for /history tab */
let currentRange = localStorage.getItem('range') || '1h';   /* persist so an offline reopen shows the same view */
let testMode     = false;
let testTimer    = null;
let pollTimer    = null;

/* =========== TOAST =========== */
/* type: false/'' = success (default), true/'err' = error, 'warn', 'info' */
function toast(msg, type=false){
  const cls = type === true ? 'err' : (type || '');
  const el = $('toast'); el.textContent = msg; el.className = 'toast show' + (cls ? ' ' + cls : '');
  setTimeout(() => el.classList.remove('show'), 2500);
}
/* retrigger the scale "bump" animation on an element */
function bump(el){ if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
/* ===== micro-interactions: haptics, tab badges, theme-color, count-up, trend ===== */
function prefersReduced(){ try { return matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (_) { return false; } }
/* short vibration — only on touch devices that support it (no-op on desktop) */
function haptic(ms=12){ try { if (navigator.vibrate && matchMedia('(pointer:coarse)').matches && !prefersReduced()) navigator.vibrate(ms); } catch (_) {} }
/* per-tab status dot: setTabBadge('settings', true, 'var(--err)') / (…, false) to clear */
function setTabBadge(page, on, color, pulse){
  const b = document.getElementById('badge-' + page); if (!b) return;
  if (on){ if (color) b.style.background = color; b.classList.add('on'); b.classList.toggle('pulse', !!pulse); }
  else b.classList.remove('on', 'pulse');
}
/* PWA chrome / status-bar colour follows the active theme */
function applyThemeColor(){
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', THEME === 'sunlight' ? '#e6eaef' : '#0d1117');
}
/* count-up a number element from its previous value to `to` (easeOutCubic) */
function animateNumber(el, to, fmt, dur=450){
  if (!el) return;
  fmt = fmt || (n => String(Math.round(n)));
  const from = parseFloat(el.dataset.val), target = +to;
  el.dataset.val = target;
  if (!isFinite(from) || from === target || prefersReduced()){ el.textContent = fmt(target); return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (target - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/* ▲▼ trend arrow on a .trend span, by comparing to the previous value */
function setTrend(el, val){
  if (!el) return;
  const prev = parseFloat(el.dataset.prev);
  el.dataset.prev = val;
  if (!isFinite(prev) || Math.abs(val - prev) < 1e-9){ el.className = 'trend'; el.textContent = ''; return; }
  el.className = 'trend ' + (val > prev ? 'up' : 'down');
  el.textContent = val > prev ? '▲' : '▼';
}
/* brief highlight ring when fresh data lands */
function flashNew(el){ if (!el || prefersReduced()) return; el.classList.remove('flash-new'); void el.offsetWidth; el.classList.add('flash-new'); }
/* In-app confirm — native window.confirm() is suppressed (returns false) in many
 * standalone/installed PWAs, which made "destructive" buttons silently no-op.
 * Returns a Promise<boolean>. Falls back to window.confirm if the modal is absent. */
function uiConfirm(msg){
  return new Promise(resolve => {
    const m = $('confirm-modal'), yes = $('cfm-yes'), no = $('cfm-no'), txt = $('cfm-msg');
    if (!m || !yes || !no){ resolve(window.confirm(msg)); return; }
    txt.textContent = msg;
    m.hidden = false;
    const done = v => { m.hidden = true; yes.removeEventListener('click', onYes); no.removeEventListener('click', onNo); m.removeEventListener('click', onBg); resolve(v); };
    const onYes = () => done(true), onNo = () => done(false), onBg = e => { if (e.target === m) done(false); };
    yes.addEventListener('click', onYes); no.addEventListener('click', onNo); m.addEventListener('click', onBg);
  });
}

/* =========== FETCH + NETWORK MONITOR =========== */
const netLog = [];     /* {url, ms, bytes, status, ok, at} – ring buffer of last 30 */
const NET_MAX = 30;
let busyCount = 0;
function setBusy(d){ busyCount = Math.max(0, busyCount + d); const s = $('spinner'); if (s) s.classList.toggle('on', busyCount > 0); }
async function fjson(url){
  const t0 = performance.now();
  setBusy(1);
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const txt = await r.text();
    const ms = Math.round(performance.now() - t0);
    const bytes = (txt || '').length;
    netLog.push({ url: url.replace(SRV, ''), at: Date.now(), ms, bytes, status: r.status, ok: r.ok });
    if (netLog.length > NET_MAX) netLog.shift();
    renderNetLog();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    try { return JSON.parse(txt); }
    catch (e){ throw new Error('bad JSON'); }
  } finally {
    setBusy(-1);
  }
}
function renderNetLog(){
  const el = $('netlog-body'); if (!el) return;
  if (!netLog.length){ el.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--mut)">— no requests —</td></tr>`; return; }
  const totalBytes = netLog.reduce((a, e) => a + e.bytes, 0);
  $('netlog-total').textContent = `${netLog.length} req · ${(totalBytes/1024).toFixed(1)} KB total`;
  const reversed = [...netLog].reverse().slice(0, 15);
  el.innerHTML = reversed.map(e => {
    const u = e.url.length > 40 ? e.url.slice(0, 38) + '…' : e.url;
    const status = e.ok ? `<span style="color:var(--ok)">${e.status}</span>` : `<span style="color:var(--err)">${e.status}</span>`;
    return `<tr><td style="font-family:monospace;font-size:11px">${u}</td><td>${status}</td><td>${(e.bytes/1024).toFixed(1)} KB</td><td>${e.ms}ms</td></tr>`;
  }).join('');
}

/* =========== Beaufort / Gust / Stability =========== */
const BEAUFORT = [
  [1,   'Calm',          '🌫'],  [5,   'Light air',     '🍃'],
  [11,  'Light breeze',  '🌬'],  [19,  'Gentle breeze', '🌬'],
  [28,  'Moderate',      '💨'],  [38,  'Fresh',         '💨'],
  [49,  'Strong',        '🌪'],  [61,  'Near gale',     '🌪'],
  [74,  'Gale',          '⛈'],  [88,  'Strong gale',   '⛈'],
  [102, 'Storm',         '🌀'],  [117, 'Violent storm', '🌀'],
  [999, 'Hurricane',     '🌀'],
];
function beaufortOf(v){
  const kmh = v / spdMul();   /* v is in the chosen display unit → back to km/h for the scale */
  for (let i = 0; i < BEAUFORT.length; i++){
    if (kmh < BEAUFORT[i][0]) return { num: i, label: BEAUFORT[i][1], icon: BEAUFORT[i][2] };
  }
  return { num: 12, label: 'Hurricane', icon: '🌀' };
}
function gustFactor(samples){
  /* samples = array of {speed} for last hour */
  if (samples.length < 2) return null;
  const speeds = samples.map(s => s.speed).filter(v => v > 0);
  if (!speeds.length) return null;
  const mean = speeds.reduce((a,b)=>a+b,0) / speeds.length;
  const max  = Math.max(...speeds);
  return { mean, max, factor: mean > 0 ? max / mean : 0 };
}
function dirStability(samples){
  /* count distinct dir indices, find dominant */
  const bins = new Array(8).fill(0);
  let total = 0;
  for (const s of samples){ if (s.dir != null && s.dir >= 0){ bins[s.dir]++; total++; } }
  if (!total) return null;
  const dom = bins.indexOf(Math.max(...bins));
  const domPct = bins[dom] / total;
  const active = bins.filter(b => b / total >= 0.10).length;  /* dirs with >=10% time */
  return { dom, domPct, active, total };
}

/* =========== RENDER LIVE =========== */
function fmtAgo(sec){
  if (sec == null) return '—';
  if (sec < 60) return Math.round(sec) + ' ' + t('s_ago');
  if (sec < 3600) return Math.round(sec/60) + ' ' + t('m_ago');
  if (sec < 86400) return (sec/3600).toFixed(1) + ' ' + t('h_ago');
  return (sec/86400).toFixed(1) + ' ' + t('d_ago');
}
function fmtSec(s){
  if (s < 60) return s + ' s';
  if (s < 3600) return (s/60).toFixed(s%60?1:0).replace(/\.0$/,'') + ' min';
  return (s/3600).toFixed(s%3600?1:0).replace(/\.0$/,'') + ' h';
}

/* compact duration: "2d 5h" / "5h 12m" / "12m" */
function fmtDur(sec){
  sec = Math.max(0, Math.round(sec));
  if (sec < 3600) return Math.max(1, Math.round(sec/60)) + 'm';
  if (sec < 86400){ const h = Math.floor(sec/3600), m = Math.round((sec%3600)/60); return h + 'h' + (m ? ' ' + m + 'm' : ''); }
  const d = Math.floor(sec/86400), h = Math.round((sec%86400)/3600); return d + 'd' + (h ? ' ' + h + 'h' : '');
}
/* Uptime since the module's last power-on (server detects the cycle-counter reset). */
function renderUptime(){
  const el = $('t-uptime'); if (!el) return;
  const boot = lastConfig?.boot_timestamp;
  if (!boot){ el.textContent = '—'; return; }
  const bt = parseServerTs(boot);
  el.textContent = isNaN(bt) ? '—' : fmtDur((Date.now() - bt) / 1000);
}

function renderLive(){
  renderUptime();
  checkAlerts();
  updateTabDots();
  if (!lastSnapshot){
    $('t-dir').textContent = '—'; $('t-dir-deg').textContent = '— °';
    $('t-kmh').textContent = '—'; $('t-pps').textContent = '—';
    setCompass(null); setSpeedo(0);
    if ($('t-batt-v'))   $('t-batt-v').textContent = '—';
    if ($('t-batt-pct')) $('t-batt-pct').textContent = '—%';
    if ($('t-batt-mv'))  $('t-batt-mv').textContent = '— mV';
    $('t-csq').textContent = '—';
    $('t-age').textContent = '—'; $('t-ts').textContent = '—';
    return;
  }
  const s = lastSnapshot;
  pushBattSample();                       /* keep the battery-trend buffer current for the honest charge badge */
  const SF = SPEED_FACTOR * spdMul();
  const kmh = (s.pulses_sec || 0) * SF;
  animateNumber($('t-kmh'), kmh, n => n.toFixed(1));   /* count-up on change */
  setTrend($('t-kmh-trend'), kmh);
  $('t-pps').textContent = (s.pulses_sec || 0).toFixed(1);
  setSpeedo(kmh);

  /* Prefer explicit dir field (mock + future server-decoded) over calibration lookup. */
  const dirIdx = s.dir != null ? s.dir : vaneToDir(s.vane);
  if (dirIdx != null){
    setCompass(dirIdx * 45);
    $('t-dir').textContent = DIRS[dirIdx];
    $('t-dir-deg').textContent = (dirIdx * 45) + '°';
  } else {
    setCompass(null); $('t-dir').textContent = '—'; $('t-dir-deg').textContent = 'no calib';
  }

  if (s.batt_mv != null){
    const bp = battPct(s.batt_mv);
    if ($('t-batt-v')) animateNumber($('t-batt-v'), s.batt_mv/1000, n => n.toFixed(2));
    setTrend($('t-batt-trend'), s.batt_mv);
    if ($('t-batt-pct')){
      $('t-batt-pct').textContent = bp.pct + '%';
      $('t-batt-pct').style.color = bp.pct > 40 ? 'var(--ok)' : bp.pct > 15 ? 'var(--warn)' : 'var(--err)';
    }
    if ($('t-batt-icon')) $('t-batt-icon').textContent = bp.icon;
    if ($('t-batt-mv'))   $('t-batt-mv').textContent = s.batt_mv + ' mV';
  }
  /* solar */
  if (s.solar_mv != null){
    const sV = s.solar_mv / 1000;
    $('t-solar').innerHTML = sV.toFixed(2) + '<span style="font-size:13px;color:var(--mut)"> V</span>';
    const sState = s.solar_mv < SOLAR_ZERO_MV ? 'idle' : s.solar_mv < SOLAR_CHARGE_MV ? 'off' : 'on';
    $('t-solar-sub').innerHTML = chargePhaseHtml(sState);
    $('t-solar').style.color = s.solar_mv < SOLAR_ZERO_MV ? 'var(--mut)'
                             : s.solar_mv < SOLAR_CHARGE_MV ? 'var(--warn)' : 'var(--ok)';
  }
  /* live energy estimates (from voltages — no current sensor). Big state icon + rounded value. */
  {
    const cur = liveCurrents(s);
    const r10 = n => Math.round(n / 10) * 10;                 /* round off the false precision */
    const mAh = '<span style="font-size:13px;color:var(--mut)"> mAh</span>';
    /* reserve = capacity × charge-% (a stock, in mAh) */
    if ($('t-reserve')){
      const pc = battPct(s.batt_mv).pct;
      const reserveMah = (BATT_CAPACITY > 0 && pc != null) ? Math.round(BATT_CAPACITY * pc / 100) : null;
      $('t-reserve').innerHTML = (reserveMah == null ? '—' : reserveMah) + mAh;
      $('t-reserve-ic').style.color = (pc == null) ? 'var(--mut)' : pc > 40 ? 'var(--ok)' : pc > 15 ? 'var(--warn)' : 'var(--err)';
    }
    /* per-hour = charge current sustained one hour (mA now = mAh in 1h) — a RATE */
    /* THEORETICAL charge/h — what the panel COULD give from its wattage (the old estimate). */
    if ($('t-theory')){
      const on = cur.chargeMa > 0;
      $('t-theory').innerHTML = (on ? '+' + r10(cur.chargeMa) : '0') + mAh;
      $('t-theory').style.color = on ? 'var(--ok)' : 'var(--mut)';
      const tic = $('t-theory-ic');
      tic.firstElementChild.setAttribute('href', '#' + (PHASE_IC[cur.phase] || 'ic-moon'));
      tic.style.color = on ? 'var(--ok)' : 'var(--mut)';
    }
    /* ACTUAL charge/h — derived from how the battery REALLY moved (server data, robust trend).
     * mV/h → mAh/h via ~capacity/500 (≈5 mAh per mV at 2500mAh). Flags the panel-vs-reality gap. */
    if ($('t-perhour')){
      const tr = battTrend();
      const pic = $('t-perhour-ic'), sub = $('t-perhour-sub');
      pic.style.transform = 'none';
      if (!tr || tr.spanMin < 60){
        $('t-perhour').innerHTML = '—' + mAh;
        $('t-perhour').style.color = 'var(--mut)';
        pic.firstElementChild.setAttribute('href', '#ic-status');
        pic.style.color = 'var(--mut)';
        if (sub){ sub.textContent = t('actual'); sub.style.color = ''; }
      } else {
        const factMah = Math.round(tr.mvPerH * (BATT_CAPACITY || 2500) / 500);
        const rising = factMah > 5;
        const stuck = !rising && cur.chargeMa > 0;          /* panel claims charging but it isn't */
        const col = rising ? 'var(--ok)' : stuck ? 'var(--err)' : 'var(--warn)';
        $('t-perhour').innerHTML = (factMah >= 0 ? '+' : '−') + Math.abs(factMah) + mAh;
        $('t-perhour').style.color = col;
        pic.firstElementChild.setAttribute('href', '#' + (rising ? 'ic-up' : stuck ? 'ic-warn' : 'ic-up'));
        pic.style.color = col;
        if (!rising && !stuck) pic.style.transform = 'rotate(180deg)';   /* draining (no sun) → arrow down */
        if (sub){ sub.textContent = stuck ? t('charge_stuck') : t('actual'); sub.style.color = stuck ? 'var(--err)' : ''; }
      }
    }
  }
  if (s.csq != null){
    $('t-csq').textContent = s.csq === 99 ? '—' : s.csq;
    $('t-csq-sub').textContent = s.csq === 99 ? 'unknown'
      : s.csq < 10 ? 'weak' : s.csq < 20 ? 'fair' : s.csq < 28 ? 'good' : 'excellent';
  }
  $('t-age').textContent = fmtAgo(s.age_sec);
  $('t-ts').textContent = s.timestamp || '—';

  /* Sparkline update. Use snapshot's ACTUAL timestamp (not Date.now), and
   * skip if we already have this point — otherwise normal-mode polling every 8s
   * fills the array with duplicates of the same POST for 15 min straight. */
  const now = Date.now();
  const snapTs = s.timestamp
    ? parseServerTs(s.timestamp)
    : now;
  const last = speedHistory[speedHistory.length - 1];
  if (!last || last.t !== snapTs){
    speedHistory.push({ t: snapTs, kmh, dir: dirIdx });
  }
  speedHistory = speedHistory.filter(p => p.t > now - 3600000);
  /* In NORMAL mode, also backfill from server's main log (so cold-open / first
   * minute after refresh shows the real last-hour curve, not just the 1 fresh tail). */
  maybeBackfillSpeedHistory(now);
  drawLiveTimeline();

  /* Beaufort */
  const bf = beaufortOf(kmh);
  $('t-bf').textContent = bf.icon + ' ' + bf.label;
  $('t-bf-num').textContent = 'B' + bf.num;

  /* Gust factor */
  const g = gustFactor(speedHistory.map(p => ({ speed: p.kmh })));
  if (g){
    $('t-gust').textContent = '×' + g.factor.toFixed(2);
    $('t-gust-sub').textContent = `max ${g.max.toFixed(1)} / avg ${g.mean.toFixed(1)}`;
  }
  /* Stability */
  const st = dirStability(speedHistory.map(p => ({ dir: p.dir })));
  if (st){
    const word = st.active === 1 ? '🎯 ' + DIRS[st.dom]
               : st.active <= 2 ? '↔ ' + DIRS[st.dom] + ' ±'
               : '🔄 variable';
    $('t-stab').textContent = word;
    $('t-stab-sub').textContent = `${(st.domPct*100).toFixed(0)}% ${DIRS[st.dom]}, ${st.active} dirs`;
  }
  updateLivePin();
}
/* Pinned "live" notification. Foreground (app open) it's refreshed here each
 * poll; in the BACKGROUND the server pushes the same tag on every module POST so
 * the SW updates it even when the app is closed (cadence = the post interval). */
function livePinText(s){
  const v  = ((s.pulses_sec || 0) * SPEED_FACTOR * spdMul()).toFixed(1);
  const di = s.dir != null ? s.dir : (typeof vaneToDir === 'function' ? vaneToDir(s.vane) : -1);
  const dir = (di != null && di >= 0) ? ' ' + DIRS[di] : '';
  const parts = [];
  if (s.batt_mv)  parts.push('🔋 ' + (s.batt_mv / 1000).toFixed(2) + 'V');
  if (s.solar_mv) parts.push('☀ ' + (s.solar_mv / 1000).toFixed(2) + 'V');
  if (s.csq != null && s.csq !== 99) parts.push('📶 ' + s.csq);
  return { title: `💨 ${v} ${spdLbl()}${dir}`, body: parts.join(' · ') };
}
async function updateLivePin(){
  if (!('serviceWorker' in navigator)) return;
  let reg; try { reg = await swReady(); } catch { return; }
  const on = localStorage.getItem('live_pin') === '1';
  if (!on || !lastSnapshot || !('Notification' in window) || Notification.permission !== 'granted'){
    try { (await reg.getNotifications({ tag: 'live-pin' })).forEach(n => n.close()); } catch {}
    return;
  }
  const tx = livePinText(lastSnapshot);
  reg.showNotification(tx.title, {
    body: tx.body, icon: pushIcon('wind'), badge: pushIcon('app') + '&badge=1',
    tag: 'live-pin', silent: true, renotify: false, requireInteraction: true,
    actions: [{ action: 'open', title: 'Відкрити' }], data: { url: '?ui=1' }
  });
}
/* Backfill speedHistory from server log (last 1h). Runs once per cold open,
 * then again at most every 60s. Requests keep_raw=1 and EXPLODES each POST's
 * raw sp[]/va[] arrays into per-2s sub-points, so a 15-min cycle shows a dense
 * curve across the whole cycle — not one lonely dot per POST.
 * Incremental: only fetches POSTs newer than what we already have (2G-friendly). */
let lastBackfillMs = 0;
let backfillThruTs = 0;   /* newest POST endTs already exploded into sub-points (ms) */
async function maybeBackfillSpeedHistory(now, force = false){
  if (!force){
    if (LITE) return;                                 /* 2G: skip the hourly keep_raw fetch */
    if (lastConfig?.live) return;                     /* live mode is self-feeding */
    if (now - lastBackfillMs < 60000) return;         /* throttle */
  }
  lastBackfillMs = now;
  try {
    const cutoffSec = Math.floor((now - 3600000) / 1000);
    /* baseline = last POST we fully backfilled (NOT the live snapshot point, which
     * renderLive pushed for the latest POST — using that would make us skip its
     * raw arrays and never densify). Cold open → cutoff → fetch the whole hour. */
    const since = Math.max(cutoffSec, Math.floor(backfillThruTs / 1000));
    const data = await fjson(SRV + '?since=' + since + '&compact=1&fmt=c&keep_raw=1&t=' + now);
    if (!Array.isArray(data) || !data.length){ speedHistory = speedHistory.filter(p => p.t > now - 3600000); drawLiveTimeline(); return; }
    const seen = new Set(speedHistory.map(p => p.t));
    const SF = SPEED_FACTOR * spdMul(), SAMPLE_MS = 2000;     /* kmh per pulse/sec; raw sample window */
    for (const e of data){
      const endTs = entryTs(e);
      if (!endTs) continue;
      if (endTs > backfillThruTs) backfillThruTs = endTs;
      const sp = e.speed || e.sp;
      const va = e.vane  || e.va;
      if (Array.isArray(sp) && sp.length){
        const N = sp.length;
        for (let i = 0; i < N; i++){
          const ts = endTs - (N - 1 - i) * SAMPLE_MS;   /* back-date each sample */
          if (seen.has(ts)) continue;
          const kmh = ((sp[i] || 0) / 2) * SF;
          let dir = null;
          const v = va ? va[i] : null;
          if (v != null && v !== 0xFF){ for (let k = 0; k < 8; k++){ if (!(v & (1 << k))){ dir = k; break; } } }
          speedHistory.push({ t: ts, kmh, dir });
          seen.add(ts);
        }
      } else if (!seen.has(endTs)){
        const kmh = ((e.speed_mean ?? e.sm ?? 0) / 2) * SF;
        speedHistory.push({ t: endTs, kmh, dir: e.vane_mode ?? e.vm ?? null });
        seen.add(endTs);
      }
    }
    speedHistory.sort((a,b) => a.t - b.t);
    speedHistory = speedHistory.filter(p => p.t > now - 3600000);
    drawLiveTimeline();
  } catch {}
}

function renderConfig(){
  if (typeof renderSolarNote === 'function') renderSolarNote();
  updateTabDots();
  if (!lastConfig){ $('t-cycle').textContent = '—'; $('t-cycle-cfg').textContent = '—'; return; }
  const c = lastConfig;
  const eff = effectiveCycle(c);
  /* Main number = intended cycle from config (what user set).
   * If observed lags significantly behind, prepend ⏳ to flag mismatch. */
  $('t-cycle').textContent = (eff.pending ? '⏳ ' : '') + fmtSec(eff.intended);
  const obsTag = eff.observed && !eff.pending ? ` · ${t('observed')} ${fmtSec(eff.observed)}` : '';
  const pendTag = eff.pending && eff.observed ? ` · ${t('still_running')} ${fmtSec(eff.observed)}` : '';
  $('t-cycle-cfg').textContent = `n=${c.samples} avg=${c.avg}` + (c.live ? ' · LIVE' : '') + obsTag + pendTag;
  $('dot').className = 'dot ' + (c.live ? 'live' : 'on');
  $('hdr-stat').textContent = c.live ? 'LIVE active' : (c.last_timestamp ? '· ' + c.last_timestamp : '');
  const lsw = $('live-sw');
  if (lsw){
    const p = pending.find(p => p.status === 'waiting' && 'live' in p.target);
    lsw.checked = p ? !!p.target.live : !!c.live;   /* stay on the user's choice while a live toggle is pending */
  }
  renderIntervalSelector();
}
function renderAll(){ renderLive(); renderConfig(); }

/* =========== LIVE 1H TIMELINE (reuses drawWindTimeline from History) =========== */
let liveView = null;   /* zoom viewport for live chart */
function drawLiveTimeline(){
  /* Convert speedHistory ({t,kmh,dir}) → pts ({ts,speed,dir}) format. */
  const allPts = speedHistory.map(p => ({ ts: p.t, speed: p.kmh, speedMax: p.kmh, dir: p.dir }));
  let pts = allPts;
  /* viewport window — only used when the window is EMPTY: axis + jump-to-data links. */
  let xWin = null;
  if (liveView){
    let leftTs = null, rightTs = null;
    for (const p of allPts){
      if (p.ts < liveView.start){ if (leftTs == null || p.ts > leftTs) leftTs = p.ts; }
      else if (p.ts > liveView.end){ if (rightTs == null || p.ts < rightTs) rightTs = p.ts; }
    }
    xWin = {
      start: liveView.start, end: liveView.end,
      hasBefore: leftTs != null, hasAfter: rightTs != null, leftTs, rightTs,
      apply: (ts) => {
        const span = liveView.end - liveView.start;
        const fs = allPts[0].ts, fe = allPts[allPts.length-1].ts;
        let s = ts - span/2, e = ts + span/2;
        if (s < fs){ e += fs - s; s = fs; }
        if (e > fe){ s -= e - fe; e = fe; }
        if (s < fs) s = fs;
        liveView = { start: s, end: e };
        drawLiveTimeline();
      },
    };
    pts = allPts.filter(p => p.ts >= liveView.start && p.ts <= liveView.end);
  }
  /* Apply the global smoothing selector — prefer the live tab's own selector,
   * fall back to history's if Live is shown before History was ever opened. */
  const sel = $('smooth-sel-live') || $('smooth-sel');
  const win = sel ? +sel.value : 0;
  const meanPerPost = sel && sel.options[sel.selectedIndex]?.dataset.mean === '1';
  let smoothed = pts;
  let label = 'raw';
  if (meanPerPost && pts.length){
    /* Group into POSTs: in live mode each speedHistory point already corresponds
     * to one POST (we dedupe by snapTs in renderLive), so "per-POST" = raw here. */
    label = 'per-POST';
  } else if (win > 1){
    smoothed = movingAvg(pts, win);
    label = `MA × ${win} (${win*2}s)`;
  }
  drawWindTimeline(decimate(smoothed, RENDER_CAP), 'chart-live-wt', xWin);
  $('live-wt-meta').textContent = smoothed.length
    ? `${smoothed.length} pts · ${label} · max ${Math.max(...smoothed.map(p=>p.speed)).toFixed(1)} km/h` + (liveView ? ' · 🔍 zoomed' : '')
    : '— no data —';
}
/* (smooth-sel change handling lives in syncSmoothSelectors — see below) */

/* =========== INTERVAL SELECTOR =========== */
const INTERVAL_OPTIONS_SEC = [60, 120, 300, 600, 900, 1800, 2700, 3600, 5400, 7200];
const SAMPLE_SEC = 2;
function chooseCfg(target, smax){
  let samples = Math.max(10, Math.round(target / SAMPLE_SEC));
  let avg = 1;
  if (samples > smax){ samples = smax; avg = Math.max(1, Math.min(32, Math.round(target / (samples * SAMPLE_SEC)))); }
  return { samples, avg, actual: samples * avg * SAMPLE_SEC };
}
let lastRenderedCfgKey = null;
function renderIntervalSelector(){
  if (!lastConfig) return;
  const sel = $('iv-sel');
  const smax = lastConfig.samples_max || 450;
  /* Only rebuild options when config actually changes; preserves user selection. */
  const cfgKey = lastConfig.samples + ',' + lastConfig.avg + '|' + smax;
  if (cfgKey !== lastRenderedCfgKey){
    lastRenderedCfgKey = cfgKey;
    const prevSel = sel.value;
    sel.innerHTML = '';
    for (const sec of INTERVAL_OPTIONS_SEC){
      const c = chooseCfg(sec, smax);
      const opt = document.createElement('option');
      opt.value = c.samples + ',' + c.avg;
      const lbl = c.avg > 1 ? `n=${c.samples}, avg=${c.avg}×` : `n=${c.samples}`;
      opt.textContent = `${fmtSec(sec)}  →  ${lbl}`;
      sel.appendChild(opt);
    }
    /* Default to current effective config, unless user already had a different selection. */
    const curVal = lastConfig.samples + ',' + lastConfig.avg;
    sel.value = prevSel && Array.from(sel.options).some(o => o.value === prevSel) ? prevSel : curVal;
  }
  const cl = lastConfig.avg > 1 ? `n=${lastConfig.samples}, avg=${lastConfig.avg}×` : `n=${lastConfig.samples}`;
  const liveTag = lastConfig.live ? ` · <span style="color:var(--err)">${icSvg('ic-rec')} ${t('live_active_note')}</span>` : '';
  const eff = effectiveCycle(lastConfig);
  const cyclePart = ` (${t('configured')} ${fmtSec(eff.intended)}` +
                    (eff.observed ? `, ${t('observed')} ${fmtSec(eff.observed)}` : '') +
                    (eff.pending ? ` · <span style="color:var(--warn)">⏳ ${t('not_applied')}</span>` : '') + ')';
  $('cur-cfg').innerHTML = cl + cyclePart + liveTag;
  refreshApply();
}
function refreshApply(){
  if (!lastConfig){ $('iv-apply').disabled = true; return; }
  const cur = lastConfig.samples + ',' + lastConfig.avg;
  $('iv-apply').disabled = !$('iv-sel').value || $('iv-sel').value === cur;
}
$('iv-sel').addEventListener('change', refreshApply);
$('iv-apply').addEventListener('click', async () => {
  const [n, a] = $('iv-sel').value.split(',').map(Number);
  $('iv-stat').textContent = '…';
  try {
    const r1 = await fjson(SRV + '?set_samples=' + n + '&t=' + Date.now());
    const r2 = await fjson(SRV + '?set_avg=' + a + '&t=' + Date.now());
    $('iv-stat').textContent = `✓ saved, waiting for next POST`;
    $('iv-stat').className = 'stat ok';
    trackPending('interval', { samples: r1.samples, avg: r2.avg });
    poll();
  } catch (e){
    $('iv-stat').textContent = 'err: ' + e.message; $('iv-stat').className = 'stat err';
  }
});

/* =========== LIVE controls =========== */
$('live-sw')?.addEventListener('change', async e => {
  const v = e.target.checked ? 1 : 0;
  try { await fjson(SRV + '?set_live=' + v + '&t=' + Date.now()); $('live-stat').textContent = '✓ saved, waiting'; $('live-stat').className='stat ok'; trackPending('live', { live: v }); toast('LIVE ' + (v ? 'on' : 'off')); poll(); }
  catch (err){ $('live-stat').textContent = 'err: ' + err.message; $('live-stat').className='stat err'; e.target.checked = !e.target.checked; }   /* revert on failure */
});
async function updateCacheStats(){
  if (!$('cache-size')) return;
  const [count, est] = await Promise.all([dbCount(), dbEstimate()]);
  $('cache-pts').textContent = count;
  $('cache-size').textContent = (est.used / 1024 / 1024).toFixed(2) + ' MB';
  $('cache-quota').textContent = est.quota ? (est.quota / 1024 / 1024).toFixed(0) + ' MB' : 'unknown';
}
$('clear-cache-btn').addEventListener('click', async () => {
  if (!(await uiConfirm('Видалити кешовані історичні дані?'))) return;
  await dbClear();
  history = [];
  speedHistory = [];
  lastSeenHistTs = null;    /* allow auto-refresh to re-seed */
  /* Reset history meta so user sees the clear before next poll seeds again. */
  if ($('hi-speed-meta')) $('hi-speed-meta').textContent = '0 pts (0 cached)';
  ['chart-speed','chart-wt','chart-rose','chart-batt','chart-solar'].forEach(id => {
    const el = $(id); if (el) el.innerHTML = '';
  });
  const tb = $('stats-table')?.querySelector('tbody'); if (tb) tb.innerHTML = '';
  await updateCacheStats();
  /* Re-seed immediately from the server instead of waiting for the next poll.
   * The button lives on the Settings tab, but poll() only re-syncs History while
   * the History tab is active — so without this the cache stays empty (and "new
   * data isn't added") until the user manually opens History. */
  $('cache-stat').textContent = '✓ cleared — re-syncing…';
  $('cache-stat').className = 'stat ok';
  try {
    await renderHistory();
    await updateCacheStats();
    $('cache-stat').textContent = `✓ cleared — re-synced (${await dbCount()} cached)`;
  } catch (e){
    $('cache-stat').textContent = '✓ cleared — re-sync failed, retry on next poll';
    $('cache-stat').className = 'stat warn';
  }
  toast('cache cleared');
});

/* Show build version; if the token wasn't replaced (running un-built locally) say "dev". */
(() => { const bv = $('build-ver'); if (bv && bv.textContent.indexOf('BUILD_VER') >= 0) bv.textContent = 'dev (unbuilt)'; })();

/* Force update: nuke the service worker + all caches, then hard-reload. Gives a
 * phone a one-tap way to pull the newest deployed UI (no Ctrl+Shift+R needed). */
$('force-update-btn').addEventListener('click', async () => {
  const s = $('force-stat'); s.textContent = '…'; s.className = 'stat';
  try {
    if ('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches){
      const ks = await caches.keys();
      await Promise.all(ks.map(k => caches.delete(k)));
    }
    s.textContent = '✓ reloading…'; s.className = 'stat ok';
    setTimeout(() => location.reload(), 250);
  } catch (e){
    s.textContent = 'err: ' + e.message; s.className = 'stat err';
  }
});
$('retention-sel').value = cacheRetentionDays;
$('retention-sel').addEventListener('change', async () => {
  cacheRetentionDays = +$('retention-sel').value;
  localStorage.setItem('cache_retention_days', cacheRetentionDays);
  if (cacheRetentionDays > 0){
    const n = await dbTrim(cacheRetentionDays);
    if (n) toast(`trimmed ${n} old entries`);
  }
  await updateCacheStats();
});

/* Wind-speed calibration: km/h per 1 pulse/sec. Pure display setting. */
(function(){
  const inp = $('sf-input'), inv = $('sf-inverse'), stat = $('sf-stat');
  if (!inp) return;
  const showInv = () => { const v = parseFloat(inp.value); inv.textContent = (v > 0) ? `1 ${t('kmh')} = ${(1/v).toFixed(3)} imp/s` : '—'; };
  inp.value = SPEED_FACTOR; showInv();
  inp.addEventListener('input', showInv);
  function apply(v){
    if (!(v > 0)){ stat.textContent = 'err'; stat.className = 'stat err'; return; }
    SPEED_FACTOR = v; localStorage.setItem('speed_factor', String(v));
    inp.value = v; showInv();
    stat.textContent = '✓'; stat.className = 'stat ok';
    renderLive(); drawLiveTimeline();
    if (history.length) drawHistoryCharts();
    hmLoadedAt = 0; loadHeatmapData();        /* heatmap km/h depends on the factor */
    toast('1 imp/s = ' + v + ' km/h');
  }
  $('sf-apply').addEventListener('click', () => apply(parseFloat(inp.value)));
  $('sf-reset').addEventListener('click', () => apply(2.4));
})();

/* Battery pack: capacity (mAh) + empty-cutoff (mV) — feed the "days left" forecast. */
(function(){
  const cap = $('bs-cap'), cut = $('bs-cut'), stat = $('bs-stat');
  if (!cap) return;
  cap.value = BATT_CAPACITY || '';
  cut.value = BATT_CUTOFF_MV;
  function apply(c, v){
    if (!(v >= 2000 && v <= 4200)){ stat.textContent = 'err: 2000–4200 mV'; stat.className = 'stat err'; return; }
    BATT_CAPACITY = (c > 0) ? c : 0;
    BATT_CUTOFF_MV = v;
    SOLAR_WATT = parseFloat($('solar-w').value) || 0;   /* solar shares this card's Apply */
    localStorage.setItem('batt_capacity', String(BATT_CAPACITY));
    localStorage.setItem('batt_cutoff', String(v));
    localStorage.setItem('solar_watt', String(SOLAR_WATT));
    cap.value = BATT_CAPACITY || ''; cut.value = v;
    if ($('bf-cutoff')) $('bf-cutoff').textContent = v;
    if (typeof renderSolarNote === 'function') renderSolarNote();
    stat.textContent = '✓ ' + t('applied'); stat.className = 'stat ok';
    if (history.length) drawHistoryCharts();   /* re-run the forecast */
    toast('battery saved');
  }
  $('bs-apply').addEventListener('click', () => apply(parseInt(cap.value), parseInt(cut.value)));
  $('bs-reset').addEventListener('click', () => apply(0, 3300));
})();

/* Speed display unit (km/h / m/s / mph / kn) — data stays km/h internally; the
 * factor is baked at the conversion points, so a change rebuilds derived data. */
function setSpeedUnit(u){
  if (!SPEED_UNITS[u]) return;
  SPEED_UNIT = u; localStorage.setItem('speed_unit', u);
  _ptsKey = ''; speedHistory = [];
  updateSpeedUnitLabels();
  const wu = $('al-wind-unit'); if (wu) wu.textContent = spdLbl();
  hmLoadedAt = 0; loadHeatmapData();
  renderLive(); drawLiveTimeline();
  if (history.length) drawHistoryCharts();
}
(function(){
  const sel = $('unit-sel'); if (!sel) return;
  sel.value = SPEED_UNIT; updateSpeedUnitLabels();
  const wu = $('al-wind-unit'); if (wu) wu.textContent = spdLbl();
  sel.addEventListener('change', () => setSpeedUnit(sel.value));
})();

/* Server-timestamp timezone offset */
(function(){
  const sel = $('tz-sel'); if (!sel) return;
  sel.value = TZ_OFFSET || '';
  sel.addEventListener('change', () => {
    TZ_OFFSET = sel.value;
    if (TZ_OFFSET) localStorage.setItem('tz_offset', TZ_OFFSET); else localStorage.removeItem('tz_offset');
    _ptsKey = ''; hmLoadedAt = 0; loadHeatmapData();
    renderLive(); drawLiveTimeline();
    if (history.length) drawHistoryCharts();
    toast('TZ: ' + (TZ_OFFSET ? 'UTC' + (TZ_OFFSET >= 0 ? '+' : '') + TZ_OFFSET : 'auto'));
  });
})();

/* Rolling battery-voltage log — fed by the live poll + one seed fetch, INDEPENDENT of the
 * History tab (which may never be opened). Used to fact-check the panel's "charging" claim. */
let battLog = [];
async function seedBattLog(){
  try {
    const d = await fjson(SRV + '?range=3h&compact=1&fmt=c&t=' + Date.now());
    if (Array.isArray(d)){
      const s = [];
      for (const e of d){ const ts = entryTs(e), mv = e.batt_mv ?? e.b; if (ts && mv > 0) s.push({ t: ts, mv }); }
      s.sort((a, b) => a.t - b.t);
      if (s.length >= battLog.length) battLog = s;
    }
  } catch (_) {}
}
function pushBattSample(){
  if (!lastSnapshot || !(lastSnapshot.batt_mv > 0) || !lastSnapshot.timestamp) return;
  const ts = parseServerTs(lastSnapshot.timestamp);
  if (!ts || (battLog.length && ts <= battLog[battLog.length-1].t)) return;   /* only NEW posts */
  battLog.push({ t: ts, mv: lastSnapshot.batt_mv });
  const cut = Date.now() - 3 * 3600000;
  while (battLog.length && battLog[0].t < cut) battLog.shift();
}
/* Robust battery trend: median of the oldest third vs the newest third of the 3h buffer.
 * Median rejects the single GSM-sag spikes that wreck a plain regression on sparse data
 * (a short noisy window once read +42 mV/h while the battery was actually flat). */
function battTrend(){
  const cut = Date.now() - 3 * 3600000;
  const pts = battLog.filter(p => p.t >= cut);
  if (pts.length < 5) return null;
  const med = a => { const x = [...a].sort((p, q) => p - q); return x[(x.length - 1) >> 1]; };
  const k = Math.max(2, Math.floor(pts.length / 3));
  const older = med(pts.slice(0, k).map(p => p.mv));
  const recent = med(pts.slice(-k).map(p => p.mv));
  const spanMin = (pts[pts.length - 1].t - pts[0].t) / 60000;
  return { deltaMv: recent - older, spanMin, mvPerH: spanMin > 0 ? (recent - older) / (spanMin / 60) : 0, n: pts.length };
}

/* Live current estimates from voltages (no current sensor on the board).
 *  charge-in : panel wattage → mA, only when the panel is above the battery (CN3791 can buck)
 *  battery   : net = charge-in − modelled load (GSM duty per cycle); signed (+ charging / − draining) */
function liveCurrents(s){
  const battMv = s.batt_mv || 0;
  const solMv  = (s.solar_mv != null) ? s.solar_mv : 0;
  const vBat   = (battMv || 3700) / 1000;
  let state = 'idle';                                    /* idle (asleep) | off (not charging) | on */
  if      (solMv >= SOLAR_CHARGE_MV) state = 'on';
  else if (solMv >= SOLAR_ZERO_MV)   state = 'off';
  const full = battMv >= BATT_FULL_MV;
  const chargeMa = (state === 'on' && SOLAR_WATT > 0 && !full)   /* at full, CN3791 tapers to ~0 */
    ? Math.round(SOLAR_WATT * SOLAR_EFF / vBat * 1000) : 0;
  const cyc    = lastConfig?.cycle_seconds || 0;         /* same load model as solarEstimate() */
  const loadMa = cyc ? Math.round(Math.min(150, 150 * 60 / cyc) + 0.1) : null;
  const netMa  = (loadMa != null) ? chargeMa - loadMa : null;
  /* coarse phase for badges/notifications: full > soon > on > off > idle */
  const phase = full ? 'full'
              : (state === 'on' && battMv >= BATT_SOON_MV) ? 'soon'
              : state;
  return { state, phase, chargeMa, loadMa, netMa };
}
/* Plain label + sprite icon id for a charge phase. */
const PHASE_IC = { full:'ic-check', soon:'ic-up', on:'ic-sun', off:'ic-warn', idle:'ic-moon' };
function chargePhaseText(ph){
  return ph === 'full' ? t('chg_full') : ph === 'soon' ? t('chg_soon')
       : ph === 'on'   ? t('chg_yes')  : ph === 'off'  ? t('chg_no') : t('chg_idle');
}
/* Inline icon + label (used by the small solar tile sub-line). */
function chargePhaseHtml(ph){
  return `<svg class="ic ic-sm"><use href="#${PHASE_IC[ph] || 'ic-moon'}"/></svg> ${chargePhaseText(ph)}`;
}

/* Solar panel wattage → daily sustainability estimate */
function solarEstimate(){
  const cyc = lastConfig?.cycle_seconds || 0;
  if (!cyc) return null;
  const GSM_ACTIVE = 60, GSM_MA = 150;                              /* rough per-cycle GSM cost */
  const avgMa = Math.min(GSM_MA, GSM_MA * GSM_ACTIVE / cyc) + 0.1;
  const consMah = avgMa * 24;
  const inMah = SOLAR_WATT > 0 ? SOLAR_WATT / 3.7 * 1000 * 4 * 0.6 : 0;  /* ~4 peak-sun-h, 60% losses */
  return { consMah: Math.round(consMah), inMah: Math.round(inMah), net: Math.round(inMah - consMah) };
}
function renderSolarNote(){
  const el = $('solar-note'); if (!el) return;
  const e = solarEstimate();
  if (!e || SOLAR_WATT <= 0){ el.textContent = ''; return; }
  const peakMa = Math.round(SOLAR_WATT * SOLAR_EFF / 3.8 * 1000);   /* charge current in full sun @~3.8V */
  el.textContent = `≈ ${e.inMah} − ${e.consMah} = ${e.net >= 0 ? '+' : ''}${e.net} mAh/${t('per_day')} · ☀ ~${peakMa} mA`;
  el.style.color = e.net >= 0 ? 'var(--ok)' : 'var(--err)';
}
(function(){
  const inp = $('solar-w'); if (!inp) return;
  inp.value = SOLAR_WATT || '';                 /* applied together with the battery card */
  inp.addEventListener('input', () => { SOLAR_WATT = parseFloat(inp.value) || 0; renderSolarNote(); });
  renderSolarNote();
})();

/* Foreground push alerts (low battery / high wind) when the tab is open. */
let _alertState = {};
async function notify(title, body, icon){
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, icon: icon || (SRV + '?icon=1'), badge: SRV + '?push_icon=app&badge=1', tag: 'meteo', renotify: true };
  /* Mobile / PWA forbids `new Notification()` — must go through the service worker. */
  try {
    if ('serviceWorker' in navigator){
      const reg = await swReady();
      await reg.showNotification(title, opts);
      return;
    }
  } catch (_) {}
  try { new Notification(title, opts); } catch (_) {}
}
/* Edge-triggered: fire only when a condition first becomes true (no spam). */
function pushIcon(type){ return SRV + '?push_icon=' + type; }
function fireOnce(key, cond, title, body, icon){
  if (cond && !_alertState[key]) notify(title, body, icon);
  _alertState[key] = cond;
}
/* PWA app-icon badge: the count of currently-active problem alerts (cleared at 0). */
function updateAppBadge(n){
  try {
    if (!('setAppBadge' in navigator)) return;
    if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge();
  } catch (_) {}
}
function checkAlerts(){
  if (!ALERTS_ON){ updateAppBadge(0); return; }
  const A = ALERTS;
  if (lastSnapshot){
    const mv = lastSnapshot.batt_mv;
    if (typeof mv === 'number' && mv > 0){
      const crit = A.battCrit.on && mv < A.battCrit.mv;
      fireOnce('battCrit', crit, '🔴 ' + t('alert_crit_n'), `${mv} mV`, pushIcon('crit'));
      fireOnce('battLow', A.battLow.on && mv < A.battLow.mv && !crit, '🔋 ' + t('alert_batt_n'), `${mv} mV`, pushIcon('batt'));
    }
    if (A.windHigh.on && A.windHigh.v > 0){
      const v = (lastSnapshot.pulses_sec || 0) * SPEED_FACTOR * spdMul();
      fireOnce('windHigh', v > A.windHigh.v, '💨 ' + t('alert_wind_n'), `${v.toFixed(0)} ${spdLbl()}`, pushIcon('wind'));
    }
    /* solar / charge state — edge-triggered transitions + a charging badge on the app icon */
    if (A.solar?.on && typeof mv === 'number' && mv > 0){
      const cur = liveCurrents(lastSnapshot);
      fireOnce('chgFull', cur.phase === 'full', '🔋 ' + t('alert_full_n'), t('alert_full_b'), pushIcon('batt'));
      fireOnce('chgSoon', cur.phase === 'soon', '🔆 ' + t('alert_soon_n'), t('alert_soon_b'), pushIcon('batt'));
      /* "got / lost sun" tracks the panel only (state), so a full battery doesn't read as "no sun" */
      const hasSun = cur.state === 'on';
      if (hasSun  && _alertState.charging === false) notify('☀ ' + t('alert_chgon_n'), '', pushIcon('online'));
      if (!hasSun && _alertState.charging === true)  notify('🌙 ' + t('alert_chgoff_n'), t('alert_chgoff_b'), pushIcon('crit'));
      _alertState.charging = hasSun;
    }
  }
  /* offline / back-online from the last regular-post age */
  const lastTs = lastConfig?.last_timestamp ? parseServerTs(lastConfig.last_timestamp) : 0;
  if (lastTs && (A.offline.on || A.online.on)){
    const ageMin = (Date.now() - lastTs) / 60000;
    const off = A.offline.on && ageMin > A.offline.min;
    if (off && !_alertState.offline) notify('📡 ' + t('alert_offline_n'), `${Math.round(ageMin)} ${t('minutes')}`, pushIcon('crit'));
    if (!off && _alertState.offline && A.online.on) notify('✅ ' + t('alert_online_n'), '', pushIcon('online'));
    _alertState.offline = off;
  }
  /* app-icon badge = number of active problem alerts */
  updateAppBadge(['battCrit', 'battLow', 'windHigh', 'offline'].filter(k => _alertState[k]).length);
}
(function(){
  const sw = $('al-sw'), perm = $('al-perm'), test = $('al-test'), stat = $('al-stat'), wrap = $('al-types');
  if (!sw || !wrap) return;
  const reflect = () => { sw.checked = ALERTS_ON; };
  reflect();
  /* fill per-type checkboxes + thresholds from ALERTS */
  wrap.querySelectorAll('input[data-al]').forEach(cb => cb.checked = !!ALERTS[cb.dataset.al]?.on);
  wrap.querySelectorAll('input[data-th]').forEach(inp => {
    const c = ALERTS[inp.dataset.th]; if (c) inp.value = c.mv ?? c.v ?? c.min ?? '';
  });
  const showPerm = () => { stat.textContent = ('Notification' in window) ? Notification.permission : '—'; };
  showPerm();
  const setOn = v => { ALERTS_ON = v; localStorage.setItem('alerts_on', v ? '1' : '0'); reflect(); updateTabBadges(); };
  sw.addEventListener('change', () => setOn(sw.checked));
  perm.addEventListener('click', async () => { if ('Notification' in window){ await Notification.requestPermission(); showPerm(); updateTabBadges(); } });
  test.addEventListener('click', async () => {
    if (!('Notification' in window)){ toast('браузер не підтримує сповіщення', true); return; }
    if (Notification.permission !== 'granted'){ await Notification.requestPermission(); showPerm(); }
    if (Notification.permission === 'granted'){
      notify('🔔 ' + t('alerts_test'), t('alerts_test_body'), pushIcon('test'));
      toast(t('alerts_test') + ' ✓');
    } else {
      toast('дозвіл на сповіщення відхилено', true);
    }
  });
  $('al-apply').addEventListener('click', () => {
    wrap.querySelectorAll('input[data-al]').forEach(cb => { const c = ALERTS[cb.dataset.al]; if (c) c.on = cb.checked; });
    wrap.querySelectorAll('input[data-th]').forEach(inp => {
      const c = ALERTS[inp.dataset.th], n = parseFloat(inp.value); if (!c || isNaN(n)) return;
      if ('mv' in c) c.mv = n; else if ('v' in c) c.v = n; else if ('min' in c) c.min = n;
    });
    localStorage.setItem('alerts_cfg', JSON.stringify(ALERTS));
    _alertState = {};   /* reset so a still-true condition re-notifies after a change */
    if (typeof spushSyncCfg === 'function') spushSyncCfg();   /* push thresholds to server if subscribed */
    toast('alerts saved');
  });
})();

/* ===== Server push (Web Push / VAPID): per-device subscribe, fires when the
 * module POSTs and a battery/wind threshold (from Alerts above) is crossed. ===== */
function urlB64ToUint8Array(b){
  const pad = '='.repeat((4 - b.length % 4) % 4);
  const s = (b + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
/* Short human label for the subscriber list (e.g. "Android Chrome"). */
function deviceLabel(){
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
           : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac'
           : /Linux/.test(ua) ? 'Linux' : '?';
  const br = /Edg/.test(ua) ? 'Edge' : /OPR|Opera/.test(ua) ? 'Opera' : /Firefox/.test(ua) ? 'Firefox'
           : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '?';
  return os + ' ' + br;
}
/* sha-256 → first 12 hex, matching the server's id, to mark "this device". */
async function endpointId(ep){
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ep));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
  } catch { return ''; }
}
function spushCfg(){
  return { on: true, sf: SPEED_FACTOR, lang: LANG,                       /* server pushes in the chosen language */
    uMul: spdMul(), uLbl: spdLbl(),                                      /* so server pushes show the chosen unit */
    batt:     ALERTS.battLow.on  ? ALERTS.battLow.mv  : 0,
    battCrit: ALERTS.battCrit.on ? ALERTS.battCrit.mv : 0,
    wind:     ALERTS.windHigh.on ? (ALERTS.windHigh.v / spdMul()) : 0,   /* km/h for the server */
    online:   ALERTS.online.on,                                          /* push when a post returns after a gap */
    offlineMin: ALERTS.offline.min,                                      /* the gap length that counts as "was offline" */
    livePin:  localStorage.getItem('live_pin') === '1' };               /* background pinned live notification */
}
async function spushReg(){
  /* Verbose: report the failing step into sp-stat (no phone console available). */
  const say = m => { const s = $('sp-stat'); if (s) s.textContent = m; };
  if (testMode){ say('тест-режим'); return null; }
  if (!('serviceWorker' in navigator)){ say('нема serviceWorker'); return null; }
  if (!('PushManager' in window)){ say('нема PushManager (iOS<16.4?)'); return null; }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted'){ say('дозвіл: ' + perm); return null; }
    say('реєструю SW…');
    const reg = await swReady();
    say('беру VAPID…');
    const { key } = await fjson(SRV + '?push_pub');
    if (!key){ say('сервер не дав ключ'); return null; }
    let sub = await reg.pushManager.getSubscription();
    if (!sub){ say('підписуюсь…'); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) }); }
    say('зберігаю на сервері…');
    const r = await fetch(SRV + '?push_subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), cfg: spushCfg(), label: deviceLabel() }) });
    const j = await r.json().catch(() => ({}));
    say('✓ підписок: ' + (j.count ?? '?'));
    if (typeof loadDeviceList === 'function') loadDeviceList();
    return sub;
  } catch (e) {
    say('помилка: ' + (e && e.message ? e.message : e));
    return null;
  }
}
async function spushUnreg(){
  try {
    const reg = await swReady();
    const sub = await reg.pushManager.getSubscription();
    if (sub){ await fetch(SRV + '?push_unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  } catch {}
}
async function spushSyncCfg(){
  if (localStorage.getItem('spush_on') !== '1' || testMode) return;
  try {
    const reg = await swReady();
    const sub = await reg.pushManager.getSubscription();
    if (sub) await fetch(SRV + '?push_subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), cfg: spushCfg(), label: deviceLabel() }) });
  } catch {}
}
/* Subscribed-devices list + per-device delete. */
let _myEpId = '';
async function loadDeviceList(){
  const box = $('sp-dev-list'); if (!box) return;
  if (testMode){ box.innerHTML = `<div class="set-note">—</div>`; return; }
  try {
    try { const reg = await swReady(); const s = await reg.pushManager.getSubscription(); _myEpId = s ? await endpointId(s.endpoint) : ''; } catch { _myEpId = ''; }
    const list = await fjson(SRV + '?push_list');
    if (!Array.isArray(list) || !list.length){ box.innerHTML = `<div class="set-note" data-i18n="spush_none">${t('spush_none')}</div>`; return; }
    box.innerHTML = list.map(d => {
      const me = d.id && d.id === _myEpId;
      const name = (d.label || d.host || '?') + (me ? ' · ' + t('spush_this') : '');
      const bits = [d.on ? 'on' : 'off'];
      if (d.livePin) bits.push('📌');
      if (d.batt)    bits.push('🔋<' + d.batt);
      if (d.wind)    bits.push('💨>' + d.wind);
      if (d.since)   bits.push(d.since);
      return `<div class="dev-row${me ? ' me' : ''}"><div class="dev-meta"><div class="dev-title">${name}</div><div class="dev-sub">${bits.join(' · ')}</div></div><button class="btn sm danger dev-del" data-id="${d.id}">🗑</button></div>`;
    }).join('');
    box.querySelectorAll('.dev-del').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await fetch(SRV + '?push_remove', { method: 'POST', body: JSON.stringify({ id: b.dataset.id }) }); } catch {}
      loadDeviceList();
    }));
  } catch { box.innerHTML = `<div class="set-note">помилка</div>`; }
}
(function(){
  const sw = $('sp-sw'), stat = $('sp-stat');
  if (!sw) return;
  let on = localStorage.getItem('spush_on') === '1';
  const reflect = () => { sw.checked = on; };
  reflect();
  sw.addEventListener('change', async () => {
    stat.textContent = '…';
    if (sw.checked){
      const s = await spushReg();            /* leaves a diagnostic in sp-stat */
      if (s){ on = true; localStorage.setItem('spush_on', '1'); toast('серверний пуш увімкнено ✓'); }
      reflect();                             /* if reg failed, on stays false → switch flips back */
    } else {
      await spushUnreg();
      on = false; localStorage.setItem('spush_on', '0'); toast('серверний пуш вимкнено');
      stat.textContent = 'вимкнено'; reflect();
    }
  });
  async function runPushTest(url){
    const res = $('sp-test-res'); res.textContent = '…';
    try {
      const r = await fjson(SRV + url);
      if (!r.subs){ res.textContent = '0 підписок — спершу натисни Увімк'; return; }
      const ok = r.sent.some(s => s.code >= 200 && s.code < 300);
      const bad = r.sent.filter(s => !(s.code >= 200 && s.code < 300)).map(s => s.code);
      res.textContent = `підписок: ${r.subs} · ${r.sent.length} пуш${ok ? ' ✓ прийнято' : ''}${bad.length ? ' · ✗ ' + bad.join(',') : ''}`;
    } catch { res.textContent = 'помилка запиту'; }
  }
  $('sp-test')?.addEventListener('click', () => runPushTest('?push_test'));
  $('sp-testall')?.addEventListener('click', () => runPushTest('?push_testall'));
  $('sp-refresh')?.addEventListener('click', loadDeviceList);
})();

/* Live pin: foreground refresh here + server pushes the same tag each POST for
 * background updates (needs the server-push subscription). */
(function(){
  const sw = $('lp-sw'), stat = $('lp-stat');
  if (!sw) return;
  let on = localStorage.getItem('live_pin') === '1';
  const reflect = () => { sw.checked = on; };
  reflect();
  sw.addEventListener('change', async () => {
    if (sw.checked){
      stat.textContent = '…';
      if (!('Notification' in window)){ stat.textContent = 'браузер не підтримує'; on = false; reflect(); return; }
      if (Notification.permission !== 'granted') await Notification.requestPermission();
      if (Notification.permission !== 'granted'){ stat.textContent = 'дозвіл відхилено'; on = false; reflect(); return; }
      on = true; localStorage.setItem('live_pin', '1'); reflect();
      const sub = await spushReg();        /* subscribe + push livePin cfg for background */
      updateLivePin();                     /* show immediately (foreground) */
      stat.textContent = sub ? '✓ закріплено · фон через пуш' : '✓ foreground; увімкни Серверний пуш для фону';
    } else {
      on = false; localStorage.setItem('live_pin', '0'); reflect();
      await spushSyncCfg();                /* stop server pin pushes */
      updateLivePin();                     /* close the pin */
      stat.textContent = 'вимкнено';
    }
  });
})();

/* (Settings cache-stats / device-list and Status net-log refreshes are now driven
 * from switchToTab's deferred heavy() — running them synchronously on click used to
 * jank the slide animation.) */
/* Defer initial stats call until full script parse completes (IndexedDB block
 * is defined later — without setTimeout we'd hit a TDZ on _db).
 * Also run one-time purge of bad-key entries from v1 of cache (string keys). */
setTimeout(async () => {
  const purged = await dbPurgeBadKeys();
  if (purged) console.log(`cache: purged ${purged} legacy string-key entries`);
  const aggOnly = await dbPurgeAggregateOnly();
  if (aggOnly) console.log(`cache: purged ${aggOnly} aggregate-only entries (no raw sp[]/va[]) — will re-sync with sub-points`);
  updateCacheStats();
}, 0);

$('wipe-btn').addEventListener('click', async () => {
  if (!(await uiConfirm('Видалити всі дані на сервері?'))) return;
  $('wipe-stat').textContent = '…';
  try { await fetch(SRV + '?wipe_log=1&key=' + CALIB_KEY + '&t=' + Date.now()); $('wipe-stat').textContent='✓'; $('wipe-stat').className='stat ok'; toast('wiped'); }
  catch (e){ $('wipe-stat').textContent='err'; $('wipe-stat').className='stat err'; }
});

/* Smoothing — single global setting, mirrored on two selectors:
 *   #smooth-sel       on History tab
 *   #smooth-sel-live  on Live tab (Швидкість за останню годину)
 * Change in either → sync both, persist, redraw both charts. */
function syncSmoothSelectors(srcId){
  const src = $(srcId); if (!src) return;
  const val = src.value;
  const isMean = src.options[src.selectedIndex]?.dataset.mean === '1';
  const key = val + (isMean ? '|m' : '');
  localStorage.setItem('smooth_win', key);
  for (const id of ['smooth-sel', 'smooth-sel-live']){
    if (id === srcId) continue;
    const t = $(id); if (!t) continue;
    for (const o of t.options){
      if (o.value === val && (!!o.dataset.mean === isMean)){ o.selected = true; break; }
    }
  }
  if (history?.length) drawHistoryCharts();
  drawLiveTimeline();
}
document.addEventListener('change', e => {
  if (e.target?.id === 'smooth-sel' || e.target?.id === 'smooth-sel-live'){
    syncSmoothSelectors(e.target.id);
  }
});
/* Restore preference into both selectors at startup */
(() => {
  const s = localStorage.getItem('smooth_win');
  if (!s) return;
  const [v, m] = s.split('|');
  for (const id of ['smooth-sel', 'smooth-sel-live']){
    const sel = $(id); if (!sel) continue;
    for (const o of sel.options){
      if (o.value === v && (!!o.dataset.mean === !!m)){ o.selected = true; break; }
    }
  }
})();

$('calib-reset-default').addEventListener('click', () => {
  setCalib({ ...DEFAULT_CALIB });
  renderCalibReadonly();
  const stat = $('calib-stat');
  stat.textContent = t('calib_reset_done'); stat.className = 'stat ok';
  toast('✓ ' + t('calib_reset_done'));
});
$('calib-push').addEventListener('click', pushCalibToServer);
$('calib-pull').addEventListener('click', pullCalibFromServer);

/* =========== HISTORY =========== */
document.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-range]').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  currentRange = b.dataset.range;
  localStorage.setItem('range', currentRange);
  /* keep the "⋯ more" panel open if the chosen range lives inside it; close on a primary pick */
  const inMore = !!b.closest('#range-more');
  const more = $('range-more'), moreBtn = $('range-more-btn');
  if (more && moreBtn){ more.hidden = !inMore; moreBtn.classList.toggle('active', inMore); }
  renderHistory();
}));
/* reflect the restored range on the buttons (default markup has 1h active) */
(function(){
  const rb = document.querySelector(`[data-range="${currentRange}"]`);
  if (rb && !rb.classList.contains('active')){
    document.querySelectorAll('[data-range]').forEach(x => x.classList.remove('active'));
    rb.classList.add('active');
    if (rb.closest('#range-more')){ const more = $('range-more'), mb = $('range-more-btn'); if (more) more.hidden = false; if (mb) mb.classList.add('active'); }
  }
})();

/* ===== Incremental IndexedDB cache (2G-friendly, year-scale) =====
 * Strategy:
 *   - All entries stored in IndexedDB keyed by timestamp (ms since epoch)
 *   - localStorage too small for years (5-10MB), IndexedDB has ~50MB+ quota
 *   - On each renderHistory: fetch only ?since=<newest_ts_in_db>, merge
 *   - User-selectable retention: 7d / 30d / 1y / unlimited
 *   - Server-side gzip + ?fmt=c compact keys + auto-bin for old data */
const DB_NAME = 'meteo_v1';
const DB_STORE = 'history';
let _db = null;
function dbOpen(){
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'ts' });
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = e => rej(e.target.error);
  });
}
function entryTs(e){
  /* Support both full ("timestamp": "YYYY-MM-DD HH:MM:SS") and compact ("t"). */
  return parseServerTs(e.timestamp ?? e.t);
}
async function dbPut(entries){
  if (!entries.length) return;
  const db = await dbOpen();
  await new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const st = tx.objectStore(DB_STORE);
    for (const e of entries){
      const ts = entryTs(e);
      if (typeof ts === 'number' && ts > 0) st.put({ ...e, ts });
    }
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

/* One-time DB migration: detect entries with non-numeric ts keys (from old buggy
 * version that stored string timestamps) and purge them so we re-fetch clean. */
async function dbPurgeBadKeys(){
  const db = await dbOpen();
  return new Promise(res => {
    let n = 0;
    const tx = db.transaction(DB_STORE, 'readwrite');
    const req = tx.objectStore(DB_STORE).openCursor();
    req.onsuccess = e => {
      const c = e.target.result;
      if (!c){ res(n); return; }
      if (typeof c.key !== 'number' || c.key < 1e12){ c.delete(); n++; }
      c.continue();
    };
    tx.onerror = () => res(n);
  });
}
/* Purge cached entries from the last 7 days that lack raw sp[]/va[] arrays.
 * Those were stored before the keep_raw=1 feature — without arrays we can only
 * draw one point per 15-min POST (triangle effect). Purging forces a re-fetch
 * with arrays so chart shows per-2s sub-points. Older entries (>7d) stay since
 * they're long-range binned anyway. */
async function dbPurgeAggregateOnly(){
  const db = await dbOpen();
  const cutoff = Date.now() - 7 * 86400000;
  return new Promise(res => {
    let n = 0;
    const tx = db.transaction(DB_STORE, 'readwrite');
    const req = tx.objectStore(DB_STORE).openCursor(IDBKeyRange.lowerBound(cutoff));
    req.onsuccess = e => {
      const c = e.target.result;
      if (!c){ res(n); return; }
      const v = c.value;
      const hasArrays = (Array.isArray(v.sp) && v.sp.length) || (Array.isArray(v.speed) && v.speed.length);
      /* Skip binned entries (they have a 'bk' or 'cn' marker — we don't want to purge those). */
      const isBinned = v.bk != null || v.cn != null || v.bucket != null || v.count != null;
      if (!hasArrays && !isBinned){ c.delete(); n++; }
      c.continue();
    };
    tx.onerror = () => res(n);
  });
}

async function dbRange(fromMs, toMs){
  const db = await dbOpen();
  return new Promise((res, rej) => {
    const out = [];
    const req = db.transaction(DB_STORE).objectStore(DB_STORE).openCursor(IDBKeyRange.bound(fromMs, toMs));
    req.onsuccess = e => { const c = e.target.result; if (c){ out.push(c.value); c.continue(); } else res(out); };
    req.onerror = () => rej(req.error);
  });
}
async function dbNewestTs(){
  const db = await dbOpen();
  return new Promise(res => {
    const req = db.transaction(DB_STORE).objectStore(DB_STORE).openCursor(null, 'prev');
    req.onsuccess = e => res(e.target.result?.value?.ts || 0);
    req.onerror = () => res(0);
  });
}
async function dbOldestTs(){
  const db = await dbOpen();
  return new Promise(res => {
    const req = db.transaction(DB_STORE).objectStore(DB_STORE).openCursor(null, 'next');
    req.onsuccess = e => res(e.target.result?.value?.ts || 0);
    req.onerror = () => res(0);
  });
}
async function dbCount(){
  const db = await dbOpen();
  return new Promise(res => {
    const req = db.transaction(DB_STORE).objectStore(DB_STORE).count();
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(0);
  });
}
async function dbTrim(retentionDays){
  if (!retentionDays || retentionDays <= 0) return 0;
  const cutoff = Date.now() - retentionDays * 86400000;
  const db = await dbOpen();
  return new Promise(res => {
    let n = 0;
    const tx = db.transaction(DB_STORE, 'readwrite');
    const req = tx.objectStore(DB_STORE).openCursor(IDBKeyRange.upperBound(cutoff));
    req.onsuccess = e => { const c = e.target.result; if (c){ c.delete(); n++; c.continue(); } };
    tx.oncomplete = () => res(n);
  });
}
async function dbClear(){
  const db = await dbOpen();
  return new Promise(res => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).clear();
    tx.oncomplete = res;
  });
}
async function dbEstimate(){
  /* StorageManager quota estimate (Chrome/Edge). Fallback: rough count×~100B */
  if (navigator.storage?.estimate){
    try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; }
    catch {}
  }
  const n = await dbCount();
  return { used: n * 100, quota: 0 };
}

function autoBinSec(range){
  /* For longer ranges, ask the server to aggregate so we don't ship millions
   * of points over 2G. 1y @ 1h bin = 8760 pts ≈ 1MB JSON ≈ 200KB gzipped. */
  switch (range){
    case '24h': return 60;
    case '7d':  return 300;
    case '30d': return 1800;
    case '90d': return 3600;
    case '365d':return 3600;
    default:    return 0;
  }
}
function rangeSec(r){
  const m = /^(\d+)\s*([mhd])$/.exec(r);
  if (!m) return 3600;
  const n = +m[1], u = m[2];
  return u === 'm' ? n*60 : u === 'h' ? n*3600 : n*86400;
}

async function renderHistory(){
  if (testMode){
    history = genMockHistory(currentRange);
    drawHistoryCharts();
    return;
  }
  /* shimmer the chart frames on the very first (cold) load while we fetch */
  if ($('chart-speed') && !$('chart-speed').hasChildNodes())
    ['chart-speed', 'chart-rose', 'chart-batt'].forEach(id => $(id)?.classList.add('skeleton'));
  try {
    const nowMs = Date.now();
    const cutoffMs = nowMs - rangeSec(currentRange) * 1000;
    const newestMs = await dbNewestTs();
    const newestEpoch = Math.floor(newestMs / 1000);
    const bin = autoBinSec(currentRange);
    /* For short ranges keep raw vane[]/speed[] arrays so we can explode each
     * POST into per-2s sub-points (real fine-grained resolution, not just
     * aggregates). Long ranges use server-side binning which strips arrays anyway. */
    const keepRaw = !bin;

    const oldestMs = await dbOldestTs();
    /* Backfill needed when the cache doesn't reach back to the requested window —
     * i.e. cold start (empty DB) OR the user widened the range to before the
     * oldest cached entry. Without this the chart could only ever show the last
     * 24h after a cache clear, never older data (e.g. last weekend). */
    const tolMs = 2 * 60 * 60 * 1000;   /* 2h slack so we don't refetch on tiny gaps */
    const needBackfill = newestEpoch === 0 || cutoffMs < oldestMs - tolMs;
    const binParam = bin ? '&bin=' + bin : '';
    const rawParam = keepRaw ? '&keep_raw=1' : '';

    const fetched = [];
    let netNote = '';
    /* Forward: pull anything newer than what we have (cheap, runs every poll). */
    if (newestEpoch > 0){
      const url = SRV + '?since=' + newestEpoch + '&compact=1&fmt=c' + binParam + rawParam + '&t=' + nowMs;
      try {
        const data = await fjson(url);
        if (Array.isArray(data)){ fetched.push(...data); netNote = `+${data.length} new`; }
      } catch (e){ netNote = 'offline · using cache'; }
    }
    /* Backward: seed / backfill the whole requested range from the server. The
     * server's ?range is "last N from now", so it covers cutoff..now including
     * the older part; dbPut dedupes by ts so overlap with the forward fetch is fine. */
    if (needBackfill){
      const url = SRV + '?range=' + encodeURIComponent(currentRange) + '&compact=1&fmt=c' + binParam + rawParam + '&t=' + nowMs;
      try {
        const d = await fjson(url);
        if (Array.isArray(d)){ fetched.push(...d); netNote = (newestEpoch === 0 ? 'seed ' : 'backfill ') + d.length; }
      } catch (e){ if (!netNote) netNote = 'offline'; }
    }
    await dbPut(fetched);
    await dbTrim(cacheRetentionDays);

    /* Pull only the range we need from DB */
    history = await dbRange(cutoffMs, nowMs);
    drawHistoryCharts();
    loadHeatmapData();   /* heatmap uses its own wider 7d hourly data (throttled) */

    const est = await dbEstimate();
    const usedKB = (est.used / 1024).toFixed(0);
    const total = await dbCount();
    /* Count exploded sub-points so the meta reflects what's actually plotted.
     * (entries × samples-per-entry, with fallback to entry count for aggregates). */
    let subPts = 0;
    for (const e of history){
      const arr = e.speed || e.sp;
      subPts += (Array.isArray(arr) && arr.length) ? arr.length : 1;
    }
    const ptsLbl = subPts > history.length
      ? `${subPts} pts (${history.length} POSTs, ${total} cached)`
      : `${history.length} pts (${total} cached)`;
    $('hi-speed-meta').textContent = `${ptsLbl} · ${usedKB}KB · ${netNote}`;
    updateCacheStats();
  } catch (e){
    $('chart-speed').innerHTML = `<text x="300" y="90" text-anchor="middle" fill="var(--err)" font-size="12">err: ${e.message}</text>`;
  }
}

/* Explode history into per-2s sub-points, cached. Rebuilt only when `history`
 * actually changes (length or end-points) — so pan/pinch reuse it instead of
 * re-exploding thousands of entries every frame. Big win on dense data. */
let _ptsCache = null, _ptsKey = '';
function buildHistoryPts(){
  const n = history.length;
  const key = n ? n + '|' + entryTs(history[0]) + '|' + entryTs(history[n-1]) : '0';
  if (_ptsCache && _ptsKey === key) return _ptsCache;
  const SF = SPEED_FACTOR * spdMul(), SAMPLE_MS = 2000;
  const pts = [];
  for (const e of history){
    const endTs = entryTs(e);
    if (!endTs) continue;
    const speedArr = e.speed || e.sp;
    const vaneArr  = e.vane  || e.va;
    const batt  = e.batt_mv ?? e.b ?? 0;
    const solar = e.solar_mv ?? e.sol ?? null;
    const csq   = e.csq ?? e.c ?? 0;
    if (Array.isArray(speedArr) && speedArr.length){
      const N = speedArr.length;
      for (let i = 0; i < N; i++){
        const subTs = endTs - (N - 1 - i) * SAMPLE_MS;
        const kmh = ((speedArr[i] || 0) / 2) * SF;
        let dirIdx = null;
        const v = vaneArr ? vaneArr[i] : null;
        if (v != null && v !== 0xFF){
          for (let k = 0; k < 8; k++){ if (!(v & (1 << k))){ dirIdx = k; break; } }
        }
        pts.push({ ts: subTs, speed: kmh, speedMax: kmh, batt, solar, csq, dir: dirIdx, sub: true });
      }
    } else {
      const sm = e.speed_mean ?? e.sm ?? e.s ?? 0;
      const sx = e.speed_max  ?? e.sx ?? sm;
      pts.push({ ts: endTs, speed: (sm/2)*SF, speedMax: (sx/2)*SF, batt, solar, csq, dir: e.vane_mode ?? e.vm ?? null });
    }
  }
  pts.sort((a,b) => a.ts - b.ts);
  _ptsCache = pts; _ptsKey = key;
  return pts;
}

let _forceCharts = false;   /* when true, drawHistoryCharts ignores the on-screen gate (pre-render) */
function drawHistoryCharts(windowOnly = false){
  ['chart-speed', 'chart-rose', 'chart-batt'].forEach(id => document.getElementById(id)?.classList.remove('skeleton'));   /* drop the cold-load shimmer */
  if (!history.length){
    noData($('chart-speed'), 600, 180);
    $('chart-batt').innerHTML  = '';
    $('chart-rose').innerHTML  = '';
    $('stats-table').querySelector('tbody').innerHTML = '';
    return;
  }
  /* normalize. If the entry has raw `speed[]`/`vane[]` arrays (short ranges,
   * keep_raw=1), EXPLODE into per-2s sub-points across the cycle window.
   * Otherwise fall back to the single aggregate point. */
  const SF = SPEED_FACTOR * spdMul();       /* km/h per pulse/sec — matches renderLive */
  const pts = buildHistoryPts();
  const vis = getVisible(pts);   /* full visible set — used by the wind rose / stats */
  /* Bounded working set for the LINE charts + smoothing. Decimating BEFORE the
   * moving-average keeps it O(cap·win) instead of O(allPoints·win) — the main
   * cost when zoomed out over thousands of dense live points. */
  const visLine = decimate(vis, RENDER_CAP * 2);
  /* GLOBAL smoothing — applied once, reused by speed / wind timeline / battery /
   * solar. Aggregate charts (rose, daily, heatmap, stats) keep using raw `vis`. */
  const sel = $('smooth-sel');
  const win = sel ? +sel.value : 0;
  const meanPerPost = sel && sel.options[sel.selectedIndex]?.dataset.mean === '1';
  let smoothed = visLine;
  if (meanPerPost){
    /* Collapse each POST's sub-points back to one aggregate point */
    const tmp = [];
    const visStart = vis[0]?.ts ?? 0;
    const visEnd   = vis[vis.length-1]?.ts ?? Date.now();
    for (const e of history){
      const endTs = entryTs(e);
      if (!endTs || endTs < visStart || endTs > visEnd) continue;
      const arr = e.speed || e.sp;
      const sm = arr && arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : (e.sm ?? e.speed_mean ?? 0);
      const sx = arr && arr.length ? Math.max(...arr) : (e.sx ?? e.speed_max ?? sm);
      tmp.push({
        ts: endTs,
        speed:    (sm / 2) * SF,
        speedMax: (sx / 2) * SF,
        batt: e.b ?? e.batt_mv, solar: e.sol ?? e.solar_mv, csq: e.c ?? e.csq,
        dir:  e.vm ?? e.vane_mode,
      });
    }
    smoothed = tmp;
  } else if (win > 1){
    smoothed = movingAvg(visLine, win);
  }
  if ($('smooth-info')){
    const label = meanPerPost ? 'per-POST'
                : win > 1 ? `MA × ${win} (${win*2}s window)`
                : 'raw';
    $('smooth-info').textContent = `${smoothed.length} pts · ${label}`;
  }
  /* viewport window: only used when the window is EMPTY (zoomed into a gap) — shows
   * the time axis + "no data here" + clickable jump links to the nearest data. */
  let xWin = null;
  if (chartView){
    let leftTs = null, rightTs = null;
    for (const p of pts){
      if (p.ts < chartView.start){ if (leftTs == null || p.ts > leftTs) leftTs = p.ts; }
      else if (p.ts > chartView.end){ if (rightTs == null || p.ts < rightTs) rightTs = p.ts; }
    }
    xWin = {
      start: chartView.start, end: chartView.end,
      hasBefore: leftTs != null, hasAfter: rightTs != null, leftTs, rightTs,
      apply: (ts) => {                 /* recenter window on `ts`, keep span, clamp to data */
        const span = chartView.end - chartView.start;
        const fs = pts[0].ts, fe = pts[pts.length-1].ts;
        let s = ts - span/2, e = ts + span/2;
        if (s < fs){ e += fs - s; s = fs; }
        if (e > fe){ s -= e - fe; e = fe; }
        if (s < fs) s = fs;
        chartView = { start: s, end: e };
        drawHistoryCharts();
      },
    };
  }
  /* Decimate to a render cap — line/timeline charts only (aggregate charts like
   * the wind rose keep the full `vis` for correct stats). This is the main lag fix. */
  const DRAW_CAP = RENDER_CAP;
  const smoothedD = decimate(smoothed, DRAW_CAP);
  const visD = decimate(vis, DRAW_CAP);
  /* Only (re)draw charts whose card is on/near screen. During a pan you watch ONE
   * chart while the others are scrolled away — painting all of them every frame was
   * the bulk of the cost. A scroll listener redraws charts as they come into view.
   * Read ALL visibility rects up front (batched) so the getBoundingClientRect reads
   * don't interleave with the innerHTML writes below → no per-chart reflow thrash. */
  const ih = innerHeight, seen = {};
  for (const id of ['chart-speed','chart-wt','chart-dir','chart-batt','chart-signal','chart-solar','chart-uptime','chart-rose']){
    const el = $(id), r = el && el.getBoundingClientRect();
    seen[id] = !!r && r.bottom > -60 && r.top < ih + 60;
  }
  const see = id => _forceCharts || seen[id];   /* _forceCharts = pre-render an off-screen page (swipe neighbour) */
  /* RAW = no gust band: show the actual samples/spikes (you literally spun it).
   * The gust band (window max) only makes sense once smoothing is on. */
  const isRaw = !meanPerPost && !(win > 1);
  if (see('chart-speed')) drawLineChart('chart-speed', smoothedD, 'speed', isRaw ? null : 'speedMax', '#58a6ff', false, xWin);
  if (see('chart-wt'))    drawWindTimeline(smoothedD, 'chart-wt', xWin, isRaw);
  if (see('chart-dir'))   drawDirTimeline(visD, 'chart-dir', xWin);
  /* Battery and GSM signal are now two separate single-line charts (split out of
   * the old dual-axis chart so each is a light render). */
  if (see('chart-batt')) drawLineChart('chart-batt', smoothedD, 'batt', null, '#3fb950', true, xWin);
  if (see('chart-signal')){
    /* raw per-point CSQ from the VISIBLE window (not smoothed, so 99s aren't
     * averaged into the line). From `vis` (sorted) — no full-history scan. */
    const csqPts = [], lostPts = [];
    for (const p of vis){
      if (p.csq >= 1 && p.csq <= 31) csqPts.push({ ts: p.ts, csq: p.csq });
      else if (p.csq === 99) lostPts.push({ ts: p.ts });   /* modem "signal unknown" */
    }
    drawSignal('chart-signal', decimate(csqPts, DRAW_CAP), xWin, decimate(lostPts, DRAW_CAP));
  }
  if (see('chart-solar')){
    const hasSolar = smoothed.some(p => p.solar != null);
    if (hasSolar) drawLineChart('chart-solar', smoothedD.map(p => ({ ts: p.ts, solar: (p.solar != null && p.solar >= SOLAR_ZERO_MV) ? p.solar : 0 })), 'solar', null, '#f0883e', false, xWin);
    else if (xWin) drawEmptyWindow($('chart-solar'), chartW($('chart-solar'), 600), 140, xWin);
    else $('chart-solar').innerHTML = `<text x="${chartW($('chart-solar'),600)/2}" y="70" text-anchor="middle" fill="var(--mut)" font-size="12">no solar data (firmware v04+ required)</text>`;
  }
  if (see('chart-uptime')) drawUptime('chart-uptime', xWin);
  if (see('chart-rose')) drawWindRose(vis);   /* window-dependent (uses vis) */
  drawStats(vis);
  updateZoomChrome();
  /* Daily summary, hourly heatmap and the battery forecast aggregate the WHOLE
   * history and don't depend on the zoom window — so skip them during pan/pinch
   * (windowOnly) where they'd be pure wasted work over every point. */
  if (!windowOnly){
    drawDaily(pts);
    drawHeatmap(pts);
    renderBatteryForecast(pts);
    $('hi-speed-meta').textContent = `${pts.length} pts`;
  }
}

/* Pick a "nice" time-tick step for a given range. Returns step (ms) + formatter. */
/* Pick a "nice" tick step based on the visible span (not the selected range).
 * Aims for ~6-8 ticks across the chart. Formatter adapts to step granularity. */
function timeTickConfigForSpan(spanMs){
  const NICE = [
    1000, 2000, 5000, 10000, 15000, 30000,                                 /* s */
    60000, 2*60000, 5*60000, 10*60000, 15*60000, 30*60000,                 /* min */
    3600000, 2*3600000, 3*3600000, 6*3600000, 12*3600000,                  /* h */
    86400000, 2*86400000, 7*86400000, 14*86400000, 30*86400000,            /* day+ */
  ];
  const target = spanMs / 7;
  const step = NICE.find(s => s >= target) || NICE[NICE.length-1];

  const hms = d => pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds());
  const hm  = d => pad2(d.getHours())+':'+pad2(d.getMinutes());
  const md  = d => (d.getMonth()+1)+'/'+d.getDate();
  const mdhm= d => md(d)+' '+hm(d);
  let fmt;
  if (step < 60000)        fmt = hms;
  else if (step < 3600000) fmt = hm;
  else if (step < 86400000)fmt = spanMs > 86400000 ? mdhm : hm;
  else                     fmt = md;
  return { step, fmt };
}
function pad2(n){ return n < 10 ? '0' + n : '' + n; }

/* Consistent empty-chart placeholder (centered muted text) so every empty card looks the same. */
function noData(svg, W, H, msg){
  svg.innerHTML = `<text x="${(W/2).toFixed(0)}" y="${(H/2).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="12" opacity=".75">${msg || t('no_data')}</text>`;
  svg.__ctx = { pts: [] }; if (svg.__hideTip) svg.__hideTip();
}
function drawLineChart(svgId, pts, key, keyMax, color, dual=false, win=null){
  const svg = $(svgId);
  const H = chartH(svg, +svg.getAttribute('viewBox').split(' ')[3] || 180);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 10, BOT = 26, LEFT = 32, RIGHT = 8;   /* margins (BOT taller for x labels) */
  if (!pts.length){ if (win) drawEmptyWindow(svg, W, H, win); else noData(svg, W, H); svg.__ctx = { pts: [] }; svg.__hideTip && svg.__hideTip(); return; }
  /* when data exists, fit the x-axis to the DATA extent (no empty edge padding);
   * internal gaps still show as gaps between points. `win` is only for empty views. */
  const xMin = pts[0].ts, xMax = pts[pts.length-1].ts;
  const ys = pts.map(p => p[key]);
  const rawMax = Math.max(1, ...ys, ...(keyMax ? pts.map(p => p[keyMax]) : []));
  const yMax = dual ? rawMax : niceCeil(rawMax);
  const yMin = dual ? Math.min(...ys, 3000) : 0;
  const uid = 'lg-' + svgId;
  const hasMax = keyMax && pts.some(p => (p[keyMax] ?? p[key]) > p[key] + 0.05);
  const sx = ts => ((ts - xMin) / (xMax - xMin || 1)) * (W - LEFT - RIGHT) + LEFT;
  const sy = v  => H - BOT - ((Math.min(v, yMax) - yMin) / (yMax - yMin || 1)) * (H - TOP - BOT);

  /* break line + area across big time gaps (outages / sparse live tail) so we don't
   * draw a misleading straight diagonal across missing time (the "прямий прикол"). */
  const dts = []; for (let i = 1; i < pts.length; i++) dts.push(pts[i].ts - pts[i-1].ts);
  dts.sort((a, b) => a - b);
  const medDt = dts[dts.length >> 1] || 0;
  const gapMax = Math.max(5 * 60 * 1000, medDt * 4);
  let area = '', line = '', maxLine = '', bridge = '', segOpen = false, lastX = null, prevX = null, prevY = null;
  pts.forEach((p, i) => {
    const x = sx(p.ts).toFixed(1), y = sy(p[key]).toFixed(1);
    const isGap = i > 0 && (p.ts - pts[i-1].ts) > gapMax;
    if (i === 0 || isGap){
      if (isGap) bridge += `M${prevX} ${prevY} L${x} ${y} `;   /* dashed connector across the gap (we don't have data here) */
      if (segOpen) area += `L${lastX} ${H-BOT} Z `;            /* close previous filled segment to baseline */
      line += 'M' + x + ' ' + y + ' ';
      area += `M${x} ${H-BOT} L${x} ${y} `;
      segOpen = true;
    } else {
      line += 'L' + x + ' ' + y + ' ';
      area += 'L' + x + ' ' + y + ' ';
    }
    if (keyMax) maxLine += ((i === 0 || isGap) ? 'M' : 'L') + x + ' ' + sy(p[keyMax]).toFixed(1) + ' ';
    lastX = x; prevX = x; prevY = y;
  });
  if (segOpen) area += `L${lastX} ${H-BOT} Z`;

  /* gust ribbon between line and max line */
  let band = '';
  if (hasMax){
    let top = '', bot = '';
    pts.forEach((p, i) => { top += (i ? 'L' : 'M') + sx(p.ts).toFixed(1) + ' ' + sy(p[keyMax]).toFixed(1) + ' '; });
    for (let i = pts.length - 1; i >= 0; i--) bot += 'L' + sx(pts[i].ts).toFixed(1) + ' ' + sy(pts[i][key]).toFixed(1) + ' ';
    band = top + bot + 'Z';
  }

  /* y-axis grid + labels */
  let grid = '';
  for (let i = 0; i < 4; i++){
    const v = yMin + (i / 3) * (yMax - yMin);
    const y = sy(v);
    grid += `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W-RIGHT}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3" opacity=".35"/>`;
    grid += `<text x="${LEFT-4}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="var(--mut)" font-size="9">${v.toFixed(dual?0:0)}</text>`;
  }
  /* x-axis time ticks — based on VISIBLE span, not the range button */
  const { step, fmt } = timeTickConfigForSpan(xMax - xMin || 1);
  let xticks = '';
  const tickStart = Math.ceil(xMin / step) * step;
  for (let tk = tickStart; tk <= xMax; tk += step){
    const x = sx(tk).toFixed(1);
    xticks += `<line x1="${x}" y1="${H-BOT}" x2="${x}" y2="${H-BOT+3}" stroke="var(--mut)" stroke-width="1"/>`;
    xticks += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${H-BOT}" stroke="var(--line)" stroke-dasharray="1 4" opacity=".25"/>`;
    xticks += `<text x="${x}" y="${H-BOT+14}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`;
  }
  /* axes */
  const axes = `<line x1="${LEFT}" y1="${H-BOT}" x2="${W-RIGHT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>
                <line x1="${LEFT}" y1="${TOP}" x2="${LEFT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>`;

  /* flat semi-transparent area fill instead of a linearGradient — a gradient
   * paint over the whole chart body is expensive on mobile GPUs and was a fixed
   * per-frame cost (independent of point count). Flat fill looks ~the same. */
  svg.innerHTML = `
    ${grid}
    ${xticks}
    ${axes}
    ${hasMax ? `<path d="${band}" fill="${color}" opacity=".13"/>` : ''}
    <path d="${area}" fill="${color}" opacity=".13"/>
    ${bridge ? `<path d="${bridge}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="2 3" opacity=".4"/>` : ''}
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${hasMax ? `<path d="${maxLine}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="3 3" opacity=".55"/>` : ''}
  `;
  svg.__ctx = { pts, xMin, xMax, yMin, yMax, key, keyMax, LEFT, RIGHT, TOP, BOT, W, H, tipKind: key === 'solar' ? 'solar' : key === 'batt' ? 'batt' : 'wind' };
  if (svg.__refreshTip) svg.__refreshTip();
}

/* Battery (left axis, mV) + GSM signal CSQ (right axis, 0–31) on one chart.
 * CSQ 99 ("unknown") is filtered out by the caller, so the signal line breaks
 * into segments across gaps instead of dropping to zero. */
function drawBattSignal(svgId, battPts, csqPts, win=null, lostPts=[]){
  const svg = $(svgId);
  const H = chartH(svg, +svg.getAttribute('viewBox').split(' ')[3] || 140);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 12, BOT = 26, LEFT = 34, RIGHT = 24;
  if (!battPts.length){ if (win) drawEmptyWindow(svg, W, H, win); else noData(svg, W, H); svg.__ctx = { pts: [] }; svg.__hideTip && svg.__hideTip(); return; }
  const xMin = battPts[0].ts, xMax = battPts[battPts.length-1].ts;   /* fit to data; win only for empty views */
  const bv = battPts.map(p => p.batt).filter(v => typeof v === 'number' && v > 0);
  const bHi = Math.max(...bv, 3300), bLo = Math.min(...bv, 3300);
  const yMaxB = Math.ceil(bHi/100)*100, yMinB = Math.min(3000, Math.floor(bLo/100)*100);
  const CSQ_MAX = 31;
  const BATT_COL = '#3fb950', SIG_COL = '#58d3ff';
  const sx  = ts => ((ts - xMin) / (xMax - xMin || 1)) * (W - LEFT - RIGHT) + LEFT;
  const syB = v  => H - BOT - ((v - yMinB) / (yMaxB - yMinB || 1)) * (H - TOP - BOT);
  const syC = v  => H - BOT - (v / CSQ_MAX) * (H - TOP - BOT);

  /* battery area + line */
  let area = '', line = '';
  battPts.forEach((p, i) => {
    const x = sx(p.ts).toFixed(1), y = syB(p.batt).toFixed(1);
    line += (i ? 'L' : 'M') + x + ' ' + y + ' ';
    if (i === 0) area = `M${x} ${H-BOT}L${x} ${y} `; else area += 'L' + x + ' ' + y + ' ';
  });
  area += `L${sx(battPts[battPts.length-1].ts).toFixed(1)} ${H-BOT} Z`;

  /* signal line — break at gaps wider than 3× median spacing (min 30 min) */
  let sig = '', dots = '';
  if (csqPts.length){
    const gaps = [];
    for (let i = 1; i < csqPts.length; i++) gaps.push(csqPts[i].ts - csqPts[i-1].ts);
    gaps.sort((a, b) => a - b);
    const med = gaps.length ? gaps[Math.floor(gaps.length/2)] : 0;
    const gapMax = Math.max(30*60*1000, med*3);
    csqPts.forEach((p, i) => {
      const x = sx(p.ts), y = syC(p.csq);
      const brk = i === 0 || (p.ts - csqPts[i-1].ts) > gapMax;
      sig += (brk ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      /* per-point CSQ dots removed — the line conveys it and hundreds of <circle>
       * nodes were a real paint cost on the battery chart. */
    });
  }

  /* csq=99 ("signal unknown") — red ticks along the bottom so a lost-signal
   * stretch is visible instead of just a blank gap in the blue line. */
  let lost = '';
  for (const p of lostPts){
    const x = sx(p.ts);
    if (x < LEFT || x > W - RIGHT) continue;
    lost += `<line x1="${x.toFixed(1)}" y1="${(H-BOT-5).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(H-BOT).toFixed(1)}" stroke="#f85149" stroke-width="1.4" opacity=".8"/>`;
  }

  /* left axis (batt mV) grid + labels */
  let grid = '';
  for (let i = 0; i < 4; i++){
    const y = (H - BOT) - (i/3)*(H - TOP - BOT);
    const v = yMinB + (i/3)*(yMaxB - yMinB);
    grid += `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W-RIGHT}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3" opacity=".4"/>`;
    grid += `<text x="${LEFT-3}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="${BATT_COL}" font-size="9">${v.toFixed(0)}</text>`;
  }
  /* right axis (CSQ 0..31) labels */
  let rax = '';
  [0,10,20,31].forEach(v => {
    rax += `<text x="${W-RIGHT+3}" y="${(syC(v)+3).toFixed(1)}" text-anchor="start" fill="${SIG_COL}" font-size="9">${v}</text>`;
  });
  /* x time ticks */
  const { step, fmt } = timeTickConfigForSpan(xMax - xMin || 1);
  let xticks = '';
  const tickStart = Math.ceil(xMin/step)*step;
  for (let tk = tickStart; tk <= xMax; tk += step){
    const x = sx(tk).toFixed(1);
    xticks += `<line x1="${x}" y1="${H-BOT}" x2="${x}" y2="${H-BOT+3}" stroke="var(--mut)" stroke-width="1"/>`;
    xticks += `<text x="${x}" y="${H-BOT+14}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`;
  }
  const axes = `<line x1="${LEFT}" y1="${H-BOT}" x2="${W-RIGHT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>
                <line x1="${LEFT}" y1="${TOP}" x2="${LEFT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>
                <line x1="${W-RIGHT}" y1="${TOP}" x2="${W-RIGHT}" y2="${H-BOT}" stroke="${SIG_COL}" stroke-width="1" opacity=".35"/>`;
  /* inline legend (top-left) */
  const sigTxt = csqPts.length ? `${t('sig_label')} (CSQ)` : t('sig_none');
  const lostLeg = lostPts.length ? `<line x1="${LEFT+2}" y1="${TOP-5}" x2="${LEFT+2}" y2="${TOP-1}" stroke="#f85149" stroke-width="1.4"/><text x="${LEFT+7}" y="${TOP-3}" fill="var(--mut)">${t('sig_lost')}</text>` : '';
  const legend = `<g font-size="9">
      <rect x="${LEFT+2}" y="${TOP-7}" width="9" height="3" fill="${BATT_COL}"/>
      <text x="${LEFT+14}" y="${TOP-3}" fill="var(--mut)">mV</text>
      <rect x="${LEFT+38}" y="${TOP-7}" width="9" height="3" fill="${SIG_COL}"/>
      <text x="${LEFT+50}" y="${TOP-3}" fill="var(--mut)">${sigTxt}</text>
      <g transform="translate(${LEFT+100} 0)">${lostLeg}</g>
    </g>`;

  svg.innerHTML = `
    ${grid}${xticks}${axes}${rax}
    <path d="${area}" fill="${BATT_COL}" opacity=".15"/>
    <path d="${line}" fill="none" stroke="${BATT_COL}" stroke-width="1.5"/>
    ${sig ? `<path d="${sig}" fill="none" stroke="${SIG_COL}" stroke-width="1.3" opacity=".9"/>` : ''}
    ${dots}${lost}
    ${legend}
  `;
  svg.__ctx = { pts: battPts, csqPts, xMin, xMax, yMinB, yMaxB, LEFT, RIGHT, TOP, BOT, W, H, tipKind: 'battsig' };
  if (svg.__refreshTip) svg.__refreshTip();
}

/* GSM signal CSQ (0..31) as its OWN single-axis chart — split out of the old
 * dual-axis battery chart so each is a light single-line render. csqPts already
 * has 99s filtered out (gaps); lostPts marks where signal was unknown (99). */
function drawSignal(svgId, csqPts, win = null, lostPts = []){
  const svg = $(svgId); if (!svg) return;
  const H = chartH(svg, +svg.getAttribute('viewBox').split(' ')[3] || 120);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 12, BOT = 26, LEFT = 28, RIGHT = 8, CSQ_MAX = 31, SIG_COL = '#58d3ff';
  if (!csqPts.length && !lostPts.length){
    if (win) drawEmptyWindow(svg, W, H, win);
    else noData(svg, W, H, t('sig_none'));
    svg.__ctx = { pts: [] }; svg.__hideTip && svg.__hideTip(); return;
  }
  /* one continuous line: cyan where the signal was read, RED (dropped to 0) where the
   * modem returned 99 = couldn't read signal. Lines, not dots. Break across big gaps. */
  const merged = [];
  for (const p of csqPts)  merged.push({ ts: p.ts, v: p.csq, lost: false });
  for (const p of lostPts) merged.push({ ts: p.ts, v: 0,     lost: true  });
  merged.sort((a, b) => a.ts - b.ts);
  const xMin = merged[0].ts, xMax = merged[merged.length-1].ts;
  const sx = ts => ((ts - xMin) / (xMax - xMin || 1)) * (W - LEFT - RIGHT) + LEFT;
  const sy = v  => H - BOT - (v / CSQ_MAX) * (H - TOP - BOT);
  const gg = []; for (let i = 1; i < merged.length; i++) gg.push(merged[i].ts - merged[i-1].ts);
  gg.sort((a, b) => a - b);
  const gapMax = Math.max(30*60*1000, (gg[gg.length >> 1] || 0) * 4);
  let sig = '', lost = '';
  for (let i = 1; i < merged.length; i++){
    const a = merged[i-1], b = merged[i];
    if (b.ts - a.ts > gapMax){
      /* data gap = module offline = no signal: red line dips to 0 and runs along it */
      lost += `M${sx(a.ts).toFixed(1)} ${sy(a.v).toFixed(1)} L${sx(a.ts).toFixed(1)} ${sy(0).toFixed(1)} `
            + `L${sx(b.ts).toFixed(1)} ${sy(0).toFixed(1)} L${sx(b.ts).toFixed(1)} ${sy(b.v).toFixed(1)} `;
      continue;
    }
    const seg = `M${sx(a.ts).toFixed(1)} ${sy(a.v).toFixed(1)} L${sx(b.ts).toFixed(1)} ${sy(b.v).toFixed(1)} `;
    if (a.lost || b.lost) lost += seg; else sig += seg;
  }
  let grid = '';
  [0, 10, 20, 31].forEach(v => {
    const y = sy(v);
    grid += `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W-RIGHT}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3" opacity=".35"/>`;
    grid += `<text x="${LEFT-3}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="${SIG_COL}" font-size="9">${v}</text>`;
  });
  const { step, fmt } = timeTickConfigForSpan(xMax - xMin || 1);
  let xticks = ''; const tk0 = Math.ceil(xMin / step) * step;
  for (let tk = tk0; tk <= xMax; tk += step){ const x = sx(tk).toFixed(1); xticks += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${H-BOT}" stroke="var(--line)" stroke-dasharray="1 4" opacity=".25"/><text x="${x}" y="${(H-BOT+14).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`; }
  const lostLeg = lostPts.length ? `<line x1="${LEFT+2}" y1="${TOP-5}" x2="${LEFT+2}" y2="${TOP-1}" stroke="#f85149" stroke-width="1.4"/><text x="${LEFT+7}" y="${TOP-3}" fill="var(--mut)" font-size="9">${t('sig_lost')}</text>` : '';
  svg.innerHTML = `${grid}${xticks}` +
    (lost ? `<path d="${lost}" fill="none" stroke="#f85149" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` : '') +
    (sig  ? `<path d="${sig}" fill="none" stroke="${SIG_COL}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` : '') +
    lostLeg;
  svg.__ctx = { pts: csqPts.map(p => ({ ts: p.ts, csq: p.csq })), xMin, xMax, yMin: 0, yMax: CSQ_MAX, LEFT, RIGHT, TOP, BOT, W, H, tipKind: 'signal' };
  if (svg.__refreshTip) svg.__refreshTip();
}

/* Speed (km/h) zone color — green/amber/red by Beaufort-ish thresholds. */
function speedColor(kmh){
  return kmh < 20 ? '#3fb950' : kmh < 38 ? '#d29922' : '#f85149';
}
/* Round an axis max up to a clean value so gridline labels are tidy. */
function niceCeil(v){
  if (v <= 5)  return 5;
  if (v <= 10) return Math.ceil(v/2)*2;
  if (v <= 30) return Math.ceil(v/5)*5;
  if (v <= 60) return Math.ceil(v/10)*10;
  return Math.ceil(v/20)*20;
}
/* Live render width of a chart in px → used as the viewBox width so the drawing
 * fills the container 1:1 at any screen size (no letterboxing, no distortion).
 * Falls back to 600 when the chart is in a hidden tab (width 0). */
/* Cache each chart's pixel box. getBoundingClientRect() is a READ that forces a
 * synchronous reflow of the prior innerHTML WRITE — doing it per chart per frame
 * was layout-thrashing (5 reflows/frame). The CSS box only changes on resize /
 * fullscreen / tab-switch, so cache it and clear it there (see clearChartDims). */
let _dimCache = new WeakMap();
function clearChartDims(){ _dimCache = new WeakMap(); }
function chartDims(svg){
  let d = _dimCache.get(svg);
  if (!d){ const r = svg.getBoundingClientRect(); d = { w: r.width, h: r.height }; _dimCache.set(svg, d); }
  return d;
}
function chartW(svg, fb){ const w = chartDims(svg).w; return w > 80 ? Math.round(w) : (fb || 600); }
/* Only in fullscreen: use the real rendered height so the chart fills the screen
 * (viewBox becomes W×realH → 1:1, crisp, no aspect-locked strip). Normal mode
 * returns the fallback (original viewBox height) → dashboard unchanged. */
function chartH(svg, fb){ if (svg.closest('.card.fs')){ const h = chartDims(svg).h; if (h > 80) return Math.round(h); } return fb; }

/* Empty viewport: scrolled/zoomed into a gap with no data. Keep the time axis so
 * the user still sees WHERE they are, say there's no data here, and point an arrow
 * toward where the nearest data actually is (win.hasBefore / win.hasAfter). */
function drawEmptyWindow(svg, W, H, win){
  const LEFT = 32, RIGHT = 8, BOT = 26, TOP = 10;
  const span = win.end - win.start || 1;
  const sx = ts => ((ts - win.start) / span) * (W - LEFT - RIGHT) + LEFT;
  const { step, fmt } = timeTickConfigForSpan(span);
  let xticks = '';
  for (let tk = Math.ceil(win.start / step) * step; tk <= win.end; tk += step){
    const x = sx(tk).toFixed(1);
    xticks += `<line x1="${x}" y1="${H-BOT}" x2="${x}" y2="${H-BOT+3}" stroke="var(--mut)" stroke-width="1"/>`;
    xticks += `<text x="${x}" y="${H-BOT+14}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`;
  }
  const axis = `<line x1="${LEFT}" y1="${H-BOT}" x2="${W-RIGHT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>`;
  /* clickable jump links — tap to recenter the viewport on the nearest data */
  const cy = H / 2;
  const canL = win.hasBefore && win.leftTs != null && win.apply;
  const canR = win.hasAfter  && win.rightTs != null && win.apply;
  let links = '';
  if (canL) links += `<text class="jump-link" data-side="L" x="${LEFT+6}" y="${(cy+18).toFixed(0)}" fill="var(--accent)" font-size="12" style="cursor:pointer">← ${t('data_left')}</text>`;
  if (canR) links += `<text class="jump-link" data-side="R" x="${W-RIGHT-6}" y="${(cy+18).toFixed(0)}" text-anchor="end" fill="var(--accent)" font-size="12" style="cursor:pointer">${t('data_right')} →</text>`;
  svg.innerHTML = `${xticks}${axis}
    <text x="${W/2}" y="${(cy-2).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="13">📭 ${t('no_data_window')}</text>
    ${links}`;
  svg.querySelectorAll('.jump-link').forEach(el => {
    const fire = ev => { ev.stopPropagation(); ev.preventDefault(); win.apply(el.getAttribute('data-side') === 'L' ? win.leftTs : win.rightTs); };
    el.addEventListener('click', fire);
    el.addEventListener('touchend', fire);
  });
}

/* Dedicated wind-direction timeline: one colored dot per reading at its compass
 * level (N at top … NW at bottom), time on X. Direction is cyclic so dots (no
 * connecting line) read cleanest. Empty when the vane reports 0xFF (no dir). */
function drawDirTimeline(pts, svgId = 'chart-dir', win = null){
  const svg = $(svgId); if (!svg) return;
  const H = chartH(svg, +svg.getAttribute('viewBox').split(' ')[3] || 170);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 12, BOT = 26, LEFT = 36, RIGHT = 8;
  if (!pts.length){ if (win) drawEmptyWindow(svg, W, H, win); else noData(svg, W, H); svg.__ctx = { pts: [] }; return; }
  const dirPts = pts.filter(p => p.dir != null && p.dir >= 0 && p.dir < 8);
  const xMin = pts[0].ts, xMax = pts[pts.length-1].ts;
  const sx = ts => ((ts - xMin) / (xMax - xMin || 1)) * (W - LEFT - RIGHT) + LEFT;
  const yLvl = d => TOP + (d / 7) * (H - TOP - BOT);   /* N(0) top … NW(7) bottom */
  /* compass-level gridlines + labels */
  let grid = '';
  for (let i = 0; i < 8; i++){
    const y = yLvl(i);
    grid += `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W-RIGHT}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3" opacity=".3"/>`;
    grid += `<text x="${LEFT-5}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="var(--mut)" font-size="9">${DIRS[i]}</text>`;
  }
  /* x time ticks (same config as the other charts) */
  const { step, fmt } = timeTickConfigForSpan(xMax - xMin || 1);
  let xticks = '';
  const tickStart = Math.ceil(xMin / step) * step;
  for (let tk = tickStart; tk <= xMax; tk += step){
    const x = sx(tk).toFixed(1);
    xticks += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${H-BOT}" stroke="var(--line)" stroke-dasharray="1 4" opacity=".25"/>`;
    xticks += `<text x="${x}" y="${(H-BOT+14).toFixed(1)}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`;
  }
  if (!dirPts.length){
    svg.innerHTML = grid + xticks + `<text x="${(W/2).toFixed(1)}" y="${(H/2).toFixed(1)}" text-anchor="middle" fill="var(--mut)" font-size="11">${t('no_dir_data')}</text>`;
    svg.__ctx = { pts: [] }; return;
  }
  /* bucket into ~90 time slots, take the dominant (mode) direction per slot — turns
   * thousands of overlapping dots into a clean readable trajectory. */
  const NB = Math.min(90, dirPts.length);
  const slot = (xMax - xMin) / NB || 1;
  const buckets = new Array(NB);
  for (const p of dirPts){
    let bi = Math.floor((p.ts - xMin) / slot); if (bi < 0) bi = 0; if (bi >= NB) bi = NB - 1;
    (buckets[bi] || (buckets[bi] = [])).push(p.dir);
  }
  const reduced = [];
  for (let i = 0; i < NB; i++){
    const b = buckets[i]; if (!b) continue;
    const cnt = {}; let best = b[0], bc = 0;
    for (const d of b){ cnt[d] = (cnt[d] || 0) + 1; if (cnt[d] > bc){ bc = cnt[d]; best = d; } }
    reduced.push({ ts: xMin + (i + 0.5) * slot, dir: best });
  }
  /* step-line trajectory; break on the N↔NW seam (>4 levels) or a big time gap */
  const gapMax = slot * 3;
  let pathD = '', bridge = '', prev = null;
  for (const p of reduced){
    const x = sx(p.ts), y = yLvl(p.dir);
    if (prev && Math.abs(p.dir - prev.dir) <= 4 && (p.ts - prev.ts) <= gapMax){
      pathD += `L${x.toFixed(1)} ${yLvl(prev.dir).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)} `;
    } else {
      if (prev && (p.ts - prev.ts) > gapMax)        /* time gap → dashed bridge (no data here) */
        bridge += `M${sx(prev.ts).toFixed(1)} ${yLvl(prev.dir).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)} `;
      pathD += `M${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    prev = p;
  }
  let dots = '';
  for (const p of reduced){
    dots += `<circle cx="${sx(p.ts).toFixed(1)}" cy="${yLvl(p.dir).toFixed(1)}" r="2.6" fill="hsl(${p.dir*45} 78% 60%)" stroke="var(--bg)" stroke-width=".6"/>`;
  }
  svg.innerHTML = grid + xticks
    + (bridge ? `<path d="${bridge}" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 3" opacity=".35"/>` : '')
    + `<path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round" opacity=".55"/>` + dots;
  svg.__ctx = { pts: [] };
}

/* Data availability / uptime: green bands where the module was posting, gaps
 * where it went silent (downtime). Based on POST timestamps in the visible
 * window; a gap wider than 2.5× the median cycle (min 5 min) counts as offline. */
function drawUptime(svgId = 'chart-uptime', win = null){
  const svg = $(svgId); if (!svg) return;
  const H = chartH(svg, +svg.getAttribute('viewBox').split(' ')[3] || 70);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 8, BOT = 20, LEFT = 6, RIGHT = 6;
  const meta = $('uptime-meta');
  const lo = chartView ? chartView.start : -Infinity, hi = chartView ? chartView.end : Infinity;
  /* EVERY data point counts (live + normal) — any point means the module was on
   * and reporting. A gap with no points = it was off. Like the speed chart, by
   * point coverage. ts = windowed points (for the bands); allReg = ALL regular
   * posts (for a zoom-STABLE cadence estimate — windowed medians jumped around). */
  const ts = [], allReg = [];
  for (const e of history){
    const tt = entryTs(e); if (!tt) continue;
    if (!e.live) allReg.push(tt);
    if (tt >= lo && tt <= hi) ts.push(tt);
  }
  ts.sort((a, b) => a - b);
  if (ts.length < 2){ svg.innerHTML = `<text x="${(W/2).toFixed(0)}" y="${(H/2).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="11">${t('no_data')}</text>`; if (meta) meta.textContent = ''; svg.__ctx = { pts: [] }; return; }
  /* x-axis spans the SELECTED window (now − range … now), NOT just the data extent —
   * so time before the station booted (or after it went silent) shows as an empty grey
   * gap instead of full green. */
  const nowMs = Date.now();
  let xMin, xMax;
  if (chartView){ xMin = chartView.start; xMax = chartView.end; }
  else { xMax = nowMs; xMin = nowMs - rangeSec(currentRange) * 1000; }
  const span = xMax - xMin || 1;
  /* Offline threshold from the WHOLE history's regular cadence (stable across zoom).
   * 95th-percentile gap × 3, floor 45 min. */
  allReg.sort((a, b) => a - b);
  let cyc = 0;
  if (allReg.length >= 2){ const g = allReg.slice(1).map((v, i) => v - allReg[i]).sort((a, b) => a - b); cyc = g[Math.floor(g.length * 0.95)] || g[g.length-1]; }
  const thr = Math.max(45 * 60000, cyc * 3);
  const sx = v => ((v - xMin) / span) * (W - LEFT - RIGHT) + LEFT;
  const cx = v => Math.max(LEFT, Math.min(W - RIGHT, sx(v)));
  const BY = TOP, BH = H - TOP - BOT;
  const rect = (a, b, col, op) => { const x0 = cx(a), x1 = cx(b); return (x1 - x0 < 0.4) ? '' : `<rect x="${x0.toFixed(1)}" y="${BY}" width="${(x1-x0).toFixed(1)}" height="${BH}" fill="${col}" opacity="${op}"/>`; };
  let segs = '', online = 0, gaps = 0, segStart = ts[0];
  for (let i = 1; i < ts.length; i++){
    if (ts[i] - ts[i-1] > thr){
      segs += rect(segStart, ts[i-1], '#3fb950', .65);
      segs += rect(ts[i-1], ts[i], '#f85149', .55);          /* real outage = red */
      online += ts[i-1] - segStart; gaps++; segStart = ts[i];
    }
  }
  segs += rect(segStart, ts[ts.length-1], '#3fb950', .65);
  online += ts[ts.length-1] - segStart;
  if (xMax - ts[ts.length-1] > thr) segs += rect(ts[ts.length-1], xMax, '#f85149', .55);   /* silent up to now */
  const pct = Math.round(online / span * 100);
  const { step, fmt } = timeTickConfigForSpan(span);
  let xticks = ''; const tk0 = Math.ceil(xMin / step) * step;
  for (let tk = tk0; tk <= xMax; tk += step){ const x = sx(tk).toFixed(1); xticks += `<line x1="${x}" y1="${H-BOT}" x2="${x}" y2="${H-BOT+3}" stroke="var(--mut)"/><text x="${x}" y="${(H-BOT+13).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`; }
  const track = `<rect x="${LEFT}" y="${BY}" width="${(W-LEFT-RIGHT).toFixed(1)}" height="${BH}" rx="3" fill="var(--line)" opacity=".3"/>`;
  svg.innerHTML = track + segs + xticks;
  if (meta){
    const oh = online / 3600000;
    const dur = oh >= 1 ? oh.toFixed(1) + ' h' : Math.round(online / 60000) + ' min';
    meta.textContent = `${pct}% · ${dur} online · ${gaps} ${t('uptime_gaps')}`;
  }
  svg.__ctx = { pts: [] };
}

/* Wind timeline: speed line + gust band + direction arrows.
 * Units: km/h. pts = [{ts, speed, speedMax, dir(0..7|null)}]. */
function drawWindTimeline(pts, svgId = 'chart-wt', win = null, noGust = false){
  const svg = $(svgId); const H = chartH(svg, 220);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 34, BOT = 26, LEFT = 32, RIGHT = 8;   /* TOP lane holds dir arrows */
  if (!pts.length){ if (win) drawEmptyWindow(svg, W, H, win); else svg.innerHTML = `<text x="${W/2}" y="110" text-anchor="middle" fill="var(--mut)" font-size="12">${t('no_data')}</text>`; svg.__ctx = { pts: [] }; svg.__hideTip && svg.__hideTip(); return; }
  const xMin = pts[0].ts, xMax = pts[pts.length-1].ts;   /* fit to data; win only for empty views */
  const hasGust = !noGust && pts.some(p => (p.speedMax ?? p.speed) > p.speed + 0.05);
  const yMax = niceCeil(Math.max(5, ...pts.map(p => Math.max(p.speed, p.speedMax ?? 0))));
  const sx = ts => ((ts - xMin) / (xMax - xMin || 1)) * (W - LEFT - RIGHT) + LEFT;
  const sy = v  => H - BOT - (Math.min(v, yMax) / yMax) * (H - TOP - BOT);
  const uid = 'wg-' + svgId;

  /* faint intensity zones: amber >=20 km/h, red >=38 km/h */
  let zones = '';
  [[20,'#d29922',.05],[38,'#f85149',.06]].forEach(([thr,col,op]) => {
    if (yMax > thr){
      const yT = sy(yMax), yB = sy(thr);
      zones += `<rect x="${LEFT}" y="${yT.toFixed(1)}" width="${(W-LEFT-RIGHT).toFixed(1)}" height="${(yB-yT).toFixed(1)}" fill="${col}" opacity="${op}"/>`;
    }
  });

  /* speed area (gradient) + line */
  let area = '', line = '';
  pts.forEach((p, i) => {
    const x = sx(p.ts).toFixed(1), y = sy(p.speed).toFixed(1);
    line += (i ? 'L' : 'M') + x + ' ' + y + ' ';
    area += (i ? 'L' : `M${x} ${H-BOT}L`) + x + ' ' + y + ' ';
  });
  area += `L${sx(pts[pts.length-1].ts).toFixed(1)} ${H-BOT} Z`;

  /* gust band: ribbon between speed and gust (speedMax), only if any gust */
  let gust = '', gustLine = '';
  if (hasGust){
    let top = '', bot = '';
    pts.forEach((p, i) => {
      const x = sx(p.ts).toFixed(1);
      top += (i ? 'L' : 'M') + x + ' ' + sy(p.speedMax ?? p.speed).toFixed(1) + ' ';
      gustLine += (i ? 'L' : 'M') + x + ' ' + sy(p.speedMax ?? p.speed).toFixed(1) + ' ';
    });
    for (let i = pts.length - 1; i >= 0; i--){
      bot += 'L' + sx(pts[i].ts).toFixed(1) + ' ' + sy(pts[i].speed).toFixed(1) + ' ';
    }
    gust = top + bot + 'Z';
  }

  /* y grid + labels */
  let grid = '';
  for (let i = 0; i < 4; i++){
    const v = (i / 3) * yMax;
    const y = sy(v);
    grid += `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W-RIGHT}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3" opacity=".35"/>`;
    grid += `<text x="${LEFT-4}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="var(--mut)" font-size="9">${v.toFixed(0)}</text>`;
  }

  /* x time ticks — based on VISIBLE span */
  const { step, fmt } = timeTickConfigForSpan(xMax - xMin || 1);
  let xticks = '';
  const tickStart = Math.ceil(xMin / step) * step;
  for (let ts = tickStart; ts <= xMax; ts += step){
    const x = sx(ts).toFixed(1);
    xticks += `<line x1="${x}" y1="${H-BOT}" x2="${x}" y2="${H-BOT+3}" stroke="var(--mut)" stroke-width="1"/>`;
    xticks += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${H-BOT}" stroke="var(--line)" stroke-dasharray="1 4" opacity=".25"/>`;
    xticks += `<text x="${x}" y="${H-BOT+14}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(ts))}</text>`;
  }

  /* direction arrows — evenly spaced across time, nearest data point per slot.
   * Arrow points the way the wind blows (FROM dir → rotate by dir*45 + 180). */
  const arrowN = Math.min(10, Math.max(4, pts.length));
  const slotMs = (xMax - xMin) / arrowN;   /* skip arrows over empty stretches */
  let arrows = '';
  let pi = 0;
  for (let k = 0; k < arrowN; k++){
    const frac = arrowN === 1 ? 0.5 : k / (arrowN - 1);
    const targetTs = xMin + frac * (xMax - xMin);
    while (pi + 1 < pts.length && Math.abs(pts[pi+1].ts - targetTs) <= Math.abs(pts[pi].ts - targetTs)) pi++;
    const p = pts[pi];
    if (p.dir == null || p.dir < 0) continue;
    if (Math.abs(p.ts - targetTs) > slotMs) continue;   /* no real data near this slot */
    const x = sx(targetTs).toFixed(1);
    arrows += `<g transform="translate(${x} 14) rotate(${p.dir * 45})">
                 <polygon points="0,-7 -3.5,5 0,2.5 3.5,5" fill="${speedColor(p.speed)}"/>
               </g>`;
  }

  /* latest value marker + label */
  const last = pts[pts.length-1];
  const lx = sx(last.ts), ly = sy(last.speed);
  const labRight = lx > W - 70;
  const dot = `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.2" fill="var(--accent)" stroke="var(--bg)" stroke-width="1.5"/>
    <text x="${(labRight ? lx-7 : lx+7).toFixed(1)}" y="${Math.max(TOP+10, ly-7).toFixed(1)}" text-anchor="${labRight?'end':'start'}" fill="var(--fg)" font-size="11" font-weight="700">${last.speed.toFixed(1)}<tspan fill="var(--mut)" font-weight="400"> ${spdLbl()}</tspan></text>`;

  const axes = `<line x1="${LEFT}" y1="${H-BOT}" x2="${W-RIGHT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>
                <line x1="${LEFT}" y1="${TOP}" x2="${LEFT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>
                <line x1="${LEFT}" y1="${(TOP-6).toFixed(1)}" x2="${W-RIGHT}" y2="${(TOP-6).toFixed(1)}" stroke="var(--line)" stroke-dasharray="1 3" opacity=".4"/>`;

  svg.innerHTML = `
    ${zones}
    ${grid}
    ${xticks}
    ${axes}
    ${hasGust ? `<path d="${gust}" fill="#79c0ff" opacity=".12"/>` : ''}
    <path d="${area}" fill="var(--accent)" opacity=".14"/>
    ${hasGust ? `<path d="${gustLine}" fill="none" stroke="#79c0ff" stroke-width="1" stroke-dasharray="3 2" opacity=".7"/>` : ''}
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${arrows}
    ${dot}
  `;
  svg.__ctx = { pts, xMin, xMax, yMin: 0, yMax, LEFT, RIGHT, TOP, BOT, W, H, tipKind: 'wind' };
  if (svg.__refreshTip) svg.__refreshTip();
}

function drawWindRose(pts){
  /* bin pts by direction (0..7); count entries */
  const bins = new Array(8).fill(0);
  let total = 0;
  for (const p of pts){
    if (p.dir != null && p.dir >= 0 && p.dir < 8){ bins[p.dir]++; total++; }
  }
  const svg = $('chart-rose');
  if (!total){ svg.innerHTML = `<text x="110" y="110" text-anchor="middle" fill="var(--mut)" font-size="11">${t('no_data')}</text>`; return; }
  const maxBin = Math.max(...bins);
  let elems = `<circle cx="110" cy="110" r="100" fill="none" stroke="var(--line)"/>
               <circle cx="110" cy="110" r="66"  fill="none" stroke="var(--line)" stroke-dasharray="2 3" opacity=".5"/>
               <circle cx="110" cy="110" r="33"  fill="none" stroke="var(--line)" stroke-dasharray="2 3" opacity=".5"/>
               <text x="110" y="10"  text-anchor="middle" fill="var(--err)" font-size="11" font-weight="700">N</text>
               <text x="110" y="216" text-anchor="middle" fill="var(--mut)" font-size="10">S</text>
               <text x="6"   y="114" text-anchor="middle" fill="var(--mut)" font-size="10">W</text>
               <text x="214" y="114" text-anchor="middle" fill="var(--mut)" font-size="10">E</text>`;
  for (let i = 0; i < 8; i++){
    const pct = bins[i] / total;
    const r = pct * 100 * (maxBin / total) / (maxBin / total); /* scale */
    const radius = (bins[i] / maxBin) * 95;
    /* draw sector: 45° wedge centered at i*45° */
    const a1 = (i * 45 - 22.5 - 90) * Math.PI / 180;
    const a2 = (i * 45 + 22.5 - 90) * Math.PI / 180;
    const x1 = 110 + radius * Math.cos(a1), y1 = 110 + radius * Math.sin(a1);
    const x2 = 110 + radius * Math.cos(a2), y2 = 110 + radius * Math.sin(a2);
    elems += `<path d="M 110 110 L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="var(--accent)" opacity="${(0.3 + pct * 0.7).toFixed(2)}"/>`;
    /* percentage label */
    if (pct > 0.02){
      const labelR = radius + 12;
      const la = (i * 45 - 90) * Math.PI / 180;
      const lx = 110 + labelR * Math.cos(la), ly = 110 + labelR * Math.sin(la);
      elems += `<text x="${lx.toFixed(1)}" y="${(ly+3).toFixed(1)}" text-anchor="middle" fill="var(--accent)" font-size="9" font-weight="700">${(pct*100).toFixed(0)}%</text>`;
    }
  }
  svg.innerHTML = elems;
}

function drawDaily(pts){
  const days = {};
  for (const p of pts){
    const d = new Date(p.ts);
    const key = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
    if (!days[key]) days[key] = { speeds: [], dirs: new Array(8).fill(0), dirTotal: 0 };
    days[key].speeds.push(p.speed);
    if (p.dir != null && p.dir >= 0){ days[key].dirs[p.dir]++; days[key].dirTotal++; }
  }
  const tb = $('daily-table').querySelector('tbody'); tb.innerHTML = '';
  const keys = Object.keys(days).sort().reverse();
  for (const k of keys){
    const d = days[k];
    const avg = d.speeds.reduce((a,b)=>a+b,0) / d.speeds.length;
    const max = Math.max(...d.speeds);
    const dom = d.dirTotal ? DIRS[d.dirs.indexOf(Math.max(...d.dirs))] : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k}</td><td>${avg.toFixed(1)}</td><td>${max.toFixed(1)}</td><td>${dom}</td>`;
    tb.appendChild(tr);
  }
  if (!keys.length) tb.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--mut)">${t('no_data')}</td></tr>`;
}

let hmSelectedDay = 'all';
let hmDaysData = {};   /* cached */
/* The heatmap shows long-term patterns, so it loads its OWN hourly-binned data
 * over the last 7 days — independent of the charts' (often 1h) zoom range, which
 * otherwise left every hour but the current one black. */
let hmPts = null, hmLoadedAt = 0;
async function loadHeatmapData(){
  if (testMode) { hmPts = null; return; }
  if (Date.now() - hmLoadedAt < 5 * 60000) return;   /* refresh at most every 5 min */
  hmLoadedAt = Date.now();
  try {
    const SF = SPEED_FACTOR * spdMul();
    const d = await fjson(SRV + '?range=7d&bin=3600&compact=1&fmt=c&t=' + Date.now());
    if (Array.isArray(d)){
      hmPts = d.map(e => {
        const sm = e.sm ?? e.speed_mean ?? e.s ?? 0;
        return { ts: entryTs(e), speed: (sm / 2) * SF };
      }).filter(p => p.ts);
      if (document.querySelector('.tab.active')?.dataset.page === 'history') drawHistoryCharts();
    }
  } catch { hmLoadedAt = 0; }   /* allow retry on failure */
}
function drawHeatmap(pts){
  const svg = $('chart-hm');
  hmDaysData = {};
  for (const p of (hmPts && hmPts.length ? hmPts : pts)){
    const d = new Date(p.ts);
    const dayKey = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
    const hr = d.getHours();
    if (!hmDaysData[dayKey]) hmDaysData[dayKey] = new Array(24).fill(null).map(() => []);
    hmDaysData[dayKey][hr].push(p.speed);
  }
  const dayKeys = Object.keys(hmDaysData).sort();
  /* day picker = native <input type="date"> + ‹ › navigation + all-days button */
  const dateInput = $('hm-date');
  const allBtn = $('hm-all');
  const modeLbl = $('hm-mode');
  if (dayKeys.length){
    dateInput.min = dayKeys[0];
    dateInput.max = dayKeys[dayKeys.length - 1];
    /* default to last day if no selection yet */
    if (hmSelectedDay === 'all' || !dayKeys.includes(hmSelectedDay)){
      if (hmSelectedDay !== 'all') hmSelectedDay = dayKeys[dayKeys.length - 1];
    }
  }
  if (hmSelectedDay === 'all'){
    dateInput.value = dayKeys.length ? dayKeys[dayKeys.length - 1] : '';
    modeLbl.textContent = 'matrix view';
    allBtn.classList.add('active');
    $('hm-prev').disabled = $('hm-next').disabled = true;
  } else {
    dateInput.value = hmSelectedDay;
    modeLbl.textContent = 'single day';
    allBtn.classList.remove('active');
    const idx = dayKeys.indexOf(hmSelectedDay);
    $('hm-prev').disabled = idx <= 0;
    $('hm-next').disabled = idx < 0 || idx >= dayKeys.length - 1;
  }
  /* Wire only once. Use a property to track binding. */
  if (!dateInput._bound){
    dateInput._bound = true;
    dateInput.addEventListener('change', () => {
      if (dateInput.value){ hmSelectedDay = dateInput.value; drawHistoryCharts(); }
    });
    allBtn.addEventListener('click', () => { hmSelectedDay = 'all'; drawHistoryCharts(); });
    $('hm-prev').addEventListener('click', () => {
      const ks = Object.keys(hmDaysData).sort();
      const i = ks.indexOf(hmSelectedDay);
      if (i > 0){ hmSelectedDay = ks[i-1]; drawHistoryCharts(); }
    });
    $('hm-next').addEventListener('click', () => {
      const ks = Object.keys(hmDaysData).sort();
      const i = ks.indexOf(hmSelectedDay);
      if (i >= 0 && i < ks.length - 1){ hmSelectedDay = ks[i+1]; drawHistoryCharts(); }
    });
    $('hm-today')?.addEventListener('click', () => {
      const ks = Object.keys(hmDaysData).sort();
      if (ks.length){ hmSelectedDay = ks[ks.length-1]; drawHistoryCharts(); }   /* jump to the latest day */
    });
  }
  const H = 180;
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  if (!dayKeys.length){ svg.innerHTML = `<text x="${W/2}" y="90" text-anchor="middle" fill="var(--mut)" font-size="12">${t('no_data')}</text>`; return; }

  /* compute global max for stable color scale */
  let maxV = 1;
  for (const k of dayKeys) for (const cell of hmDaysData[k]) if (cell.length){
    const a = cell.reduce((x,y)=>x+y,0)/cell.length; if (a > maxV) maxV = a;
  }
  const colorOf = avg => {
    const norm = Math.min(1, avg / maxV);
    const r2 = norm < 0.5 ? Math.round(63 + norm * 2 * (210 - 63)) : 248;
    const g2 = norm < 0.5 ? Math.round(185 + norm * 2 * (153 - 185)) : Math.round(153 - (norm - 0.5) * 2 * (153 - 81));
    const b2 = norm < 0.5 ? Math.round(80  + norm * 2 * (34 - 80))  : Math.round(34  - (norm - 0.5) * 2 * (34 - 73));
    return `rgb(${r2},${g2},${b2})`;
  };

  let svgContent = '';
  if (hmSelectedDay === 'all'){
    /* MULTI-DAY view (heatmap matrix) */
    const labelW = 50, labelH = 16;
    const cellW = (W - labelW) / 24;
    const cellH = Math.min(24, (H - labelH) / dayKeys.length);
    for (let h = 0; h < 24; h += 3){
      svgContent += `<text x="${labelW + h*cellW + cellW/2}" y="11" text-anchor="middle" fill="var(--mut)" font-size="9">${pad2(h)}</text>`;
    }
    for (let r = 0; r < dayKeys.length; r++){
      const k = dayKeys[r];
      svgContent += `<text x="${labelW-3}" y="${labelH + r*cellH + cellH/2 + 3}" text-anchor="end" fill="var(--mut)" font-size="9">${k.slice(5)}</text>`;
      for (let h = 0; h < 24; h++){
        const cell = hmDaysData[k][h];
        if (!cell.length){
          svgContent += `<rect x="${labelW + h*cellW}" y="${labelH + r*cellH}" width="${cellW-1}" height="${cellH-1}" fill="var(--panel2)"/>`;
        } else {
          const avg = cell.reduce((a,b)=>a+b,0)/cell.length;
          svgContent += `<rect x="${labelW + h*cellW}" y="${labelH + r*cellH}" width="${cellW-1}" height="${cellH-1}" fill="${colorOf(avg)}">
                           <title>${k} ${pad2(h)}:00 — avg ${avg.toFixed(1)} km/h</title></rect>`;
        }
      }
    }
  } else {
    /* SINGLE-DAY view (big bar chart per hour) */
    const day = hmDaysData[hmSelectedDay];
    if (!day){ svg.innerHTML = `<text x="300" y="90" text-anchor="middle" fill="var(--mut)" font-size="12">${t('no_data')}</text>`; return; }
    const labelH = 18, botH = 18;
    const cellW = (W - 20) / 24;
    const innerH = H - labelH - botH;
    /* title */
    svgContent += `<text x="${W/2}" y="13" text-anchor="middle" fill="var(--fg)" font-size="12" font-weight="600">${hmSelectedDay}</text>`;
    for (let h = 0; h < 24; h++){
      const cell = day[h];
      const x = 10 + h * cellW;
      svgContent += `<text x="${x + cellW/2}" y="${H-4}" text-anchor="middle" fill="var(--mut)" font-size="9">${pad2(h)}</text>`;
      if (!cell.length){
        svgContent += `<rect x="${x}" y="${labelH}" width="${cellW-1}" height="${innerH}" fill="var(--panel2)" opacity=".4"/>`;
        continue;
      }
      const avg = cell.reduce((a,b)=>a+b,0)/cell.length;
      const max = Math.max(...cell);
      const min = Math.min(...cell);
      /* min 3px so an hour that HAS data but is calm (avg 0) still shows a colored
       * sliver — distinct from a no-data hour (dim, handled above). */
      const barH = Math.max(3, (avg / maxV) * innerH);
      const maxBarH = Math.max(barH, (max / maxV) * innerH);
      const yBottom = labelH + innerH;
      /* gust max shadow */
      svgContent += `<rect x="${x}" y="${yBottom - maxBarH}" width="${cellW-1}" height="${maxBarH}" fill="${colorOf(max)}" opacity=".25"/>`;
      /* avg bar */
      svgContent += `<rect x="${x}" y="${yBottom - barH}" width="${cellW-1}" height="${barH}" fill="${colorOf(avg)}">
                       <title>${pad2(h)}:00 — avg ${avg.toFixed(1)} max ${max.toFixed(1)} min ${min.toFixed(1)} km/h</title></rect>`;
      /* value text on top */
      if (cellW > 18){
        svgContent += `<text x="${x + cellW/2}" y="${Math.max(yBottom - barH - 2, labelH + 8)}" text-anchor="middle" fill="var(--fg)" font-size="8" font-weight="600">${avg.toFixed(0)}</text>`;
      }
    }
  }
  svg.innerHTML = svgContent;
}

function drawStats(pts){
  const tb = $('stats-table').querySelector('tbody'); tb.innerHTML = '';
  const stats = (vals) => {
    if (!vals.length) return { min: '—', avg: '—', max: '—' };
    const min = Math.min(...vals), max = Math.max(...vals);
    const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
    return { min: min.toFixed(1), avg: avg.toFixed(1), max: max.toFixed(1) };
  };
  for (const [label, s] of [
    ['Wind (raw)',  stats(pts.map(p => p.speed))],
    ['Battery (V)', stats(pts.map(p => p.batt / 1000))],
    ['CSQ',         stats(pts.map(p => p.csq).filter(c => c !== 99))],
  ]){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${label}</td><td>${s.min}</td><td>${s.avg}</td><td>${s.max}</td>`;
    tb.appendChild(tr);
  }
}

/* =========== POLLING =========== */
async function poll(){
  if (testMode) return;
  try {
    lastConfig = await fjson(SRV + '?config=1&t=' + Date.now());
    renderConfig();
    if (lastConfig.live){
      const live = await fjson(SRV + '?live_now=1&t=' + Date.now());
      if (live.ok) lastSnapshot = live;
    } else {
      /* fetch latest few entries from main log (a few so we can fall back to the
       * last VALID csq/solar — the newest regular post often reports csq=99). */
      try {
        const tail = await fjson(SRV + '?limit=6&t=' + Date.now());
        if (Array.isArray(tail) && tail.length){
          const e = tail[tail.length - 1];
          const ts = typeof e.timestamp === 'string' ? parseServerTs(e.timestamp) : Date.now();
          let csq = null, solar = null;
          for (let i = tail.length - 1; i >= 0; i--){
            if (csq == null && tail[i].csq >= 1 && tail[i].csq <= 31) csq = tail[i].csq;
            if (solar == null && tail[i].solar_mv != null) solar = tail[i].solar_mv;
          }
          lastSnapshot = {
            vane: e.vane_mode != null ? Math.pow(2, e.vane_mode) ^ 0xFF : 0,
            pulses_sec: (e.speed_mean ?? 0) / 2,  /* approx — main mode reports 2s avg */
            batt_mv: e.batt_mv, csq: csq ?? e.csq, solar_mv: solar ?? e.solar_mv,
            cycle: e.cycle, timestamp: e.timestamp, age_sec: Math.floor((Date.now() - ts) / 1000),
          };
        }
      } catch {}
    }
    renderLive();
    checkPending();
    /* fresh-POST cues: ring the live card + dot the History tab when a new post lands */
    const postTs = lastConfig?.last_timestamp;
    if (postTs && postTs !== _prevPostTs){
      if (_prevPostTs){
        const active = document.querySelector('.tab.active')?.dataset.page;
        if (active === 'live') flashNew(document.querySelector('#page-live .live-top'));
        if (active !== 'history' && postTs !== histSeenTs) setTabBadge('history', true, 'var(--accent)');
      }
      _prevPostTs = postTs;
    }
    if (_wasOffline){ _wasOffline = false; $('dot').className = 'dot ' + (lastConfig?.live ? 'live' : 'on'); toast(t('back_online'), 'info'); }
    if (document.querySelector('.tab.active')?.dataset.page === 'status') renderStatus();
    /* Auto-refresh History if visible and there's new data since last fetch */
    if (document.querySelector('.tab.active')?.dataset.page === 'history'){
      const newest = lastConfig?.last_timestamp;
      if (newest && newest !== lastSeenHistTs){
        /* Advance the marker only after a successful render — if the sync fails
         * (transient network, empty re-seed) the next poll retries instead of
         * waiting for a brand-new post to change last_timestamp. */
        try { await renderHistory(); lastSeenHistTs = newest; }
        catch { /* keep lastSeenHistTs so we retry next poll */ }
      }
    }
  } catch (e){
    $('hdr-stat').textContent = 'offline (' + e.message + ')';
    $('dot').className = 'dot warn';
    if (!_wasOffline){ _wasOffline = true; toast(t('went_offline'), 'warn'); }
  }
}
/* Live countdown 1s tick for status tab */
setInterval(() => {
  if (document.querySelector('.tab.active')?.dataset.page === 'status') renderStatus();
}, 1000);
let pollMs = 5000;
function pollInterval(){ return LITE ? 60000 : (lastConfig?.live ? 2000 : 8000); }
function startPoll(){
  stopPoll();
  poll();
  pollMs = pollInterval();
  pollTimer = setInterval(() => {
    poll();
    /* Re-arm if live state or lite mode changed the desired cadence */
    const want = pollInterval();
    if (want !== pollMs){ startPoll(); }
  }, pollMs);
}
function stopPoll(){ if (pollTimer){ clearInterval(pollTimer); pollTimer = null; } }

/* =========== TEST MODE =========== */
let tickIdx = 0;
function mockTick(){
  tickIdx++;
  const t = tickIdx;
  /* sinusoidal speed 0-25 km/h with gusts */
  const baseSpd = 8 + 6 * Math.sin(t / 12) + 3 * Math.sin(t / 3.5);
  const gust = (Math.random() < 0.1 ? Math.random() * 15 : 0);
  const kmh = Math.max(0, baseSpd + gust);
  const pps = kmh / 2.4;
  /* drifting direction */
  const dir = (3 + 2 * Math.sin(t / 20) + Math.random() * 0.7) % 8;
  const dirIdx = Math.floor(dir);
  /* fake vane byte: use one-hot pattern for selected dir, plus some noise */
  const vane = 0xFF ^ (1 << dirIdx);
  const batt = 4100 - Math.floor(t * 0.5) + Math.floor(Math.random() * 30 - 15);
  const csq = 25 + Math.floor(Math.random() * 5);
  lastSnapshot = {
    vane, dir: dirIdx, pulses_sec: pps, batt_mv: batt, csq,
    timestamp: new Date().toISOString().replace('T',' ').slice(0,19),
    age_sec: 0,
  };
  lastConfig = {
    samples: 30, avg: 1, samples_max: 450, live: 1,
    cycle_seconds: 60, last_timestamp: lastSnapshot.timestamp,
  };
  renderLive(); renderConfig();
}
function genMockHistory(range){
  const map = { '1h': [60, 60], '6h': [360, 60], '24h': [1440, 120], '7d': [10080, 600], '30d': [43200, 1800] };
  const [minutes, stepSec] = map[range] || [60, 60];
  const now = Date.now();
  const out = [];
  for (let i = 0; i < minutes * 60 / stepSec; i++){
    const ts = now - (minutes * 60 - i * stepSec) * 1000;
    const tt = i / 20;
    const speed = Math.max(0, 6 + 4 * Math.sin(tt) + 2 * Math.sin(tt * 3) + Math.random() * 3);
    out.push({
      timestamp: new Date(ts).toISOString().replace('T',' ').slice(0,19),
      speed_mean: +speed.toFixed(1),
      speed_max:  +(speed + Math.random() * 4).toFixed(1),
      batt_mv: 4100 - Math.floor(i * 0.4),
      csq: 22 + Math.floor(Math.random() * 6),
      vane_mode: Math.floor(((3 + 2 * Math.sin(tt / 2)) + Math.random() * 0.8) % 8),
    });
  }
  return out;
}

$('test-toggle').addEventListener('click', () => {
  testMode = !testMode;
  $('test-banner').classList.toggle('on', testMode);
  $('test-toggle').classList.toggle('active', testMode);
  $('test-toggle').textContent = testMode ? '🧪 Test ON' : '🧪 Test';
  { const t2 = $('test-toggle-2'); if (t2) t2.checked = testMode; }   /* settings switch reflects the on/off state */
  if (testMode){
    stopPoll();
    tickIdx = 0;
    /* Pre-fill speedHistory with realistic past timestamps so live timeline
     * shows real curve, not 60 points stacked at "now". */
    const now = Date.now();
    speedHistory = [];
    for (let i = 0; i < 60; i++){
      const ti = i;
      const baseSpd = 8 + 6 * Math.sin(ti / 12) + 3 * Math.sin(ti / 3.5);
      const gust = (Math.random() < 0.1 ? Math.random() * 15 : 0);
      const kmh = Math.max(0, baseSpd + gust);
      const dir = Math.floor((3 + 2 * Math.sin(ti / 20) + Math.random() * 0.7) % 8);
      speedHistory.push({ t: now - (60 - i) * 60000, kmh, dir });
    }
    tickIdx = 60;
    mockTick();
    testTimer = setInterval(mockTick, 2000);
    if (document.querySelector('.tab.active').dataset.page === 'history') renderHistory();
    toast('Test mode ON');
  } else {
    if (testTimer){ clearInterval(testTimer); testTimer = null; }
    speedHistory = [];
    lastSnapshot = null;
    lastConfig = null;
    renderLive();
    startPoll();
    toast('Test mode OFF');
  }
});

/* =========== TIME-VIEWPORT ZOOM (shared across speed/timeline/batt) =========== */
/* Holds {start, end} as ts in ms, or null = full range. */
let chartView = null;

function getVisible(pts){
  if (!chartView || !pts.length) return pts;
  /* pts is sorted by ts → binary-search the window bounds instead of scanning the
   * whole (possibly tens-of-thousands) array on every pan/redraw frame. */
  const { start, end } = chartView;
  let lo = 0, hi = pts.length;
  while (lo < hi){ const m = (lo + hi) >> 1; if (pts[m].ts < start) lo = m + 1; else hi = m; }
  const i0 = lo;
  hi = pts.length;
  while (lo < hi){ const m = (lo + hi) >> 1; if (pts[m].ts <= end) lo = m + 1; else hi = m; }
  return pts.slice(i0, lo);
}

/* Render cap ≈ screen width: you can't resolve more points than pixels, and on a
 * phone ~400 nodes paint far cheaper than 1100. Recomputed on resize. */
let RENDER_CAP = 700;
function computeRenderCap(){ RENDER_CAP = Math.min(900, Math.max(350, Math.round((window.innerWidth || 400) * 1.1))); }
computeRenderCap();
window.addEventListener('resize', computeRenderCap);

/* Cap how many points are actually rendered. SVG with thousands of nodes is the
 * main source of mobile chart lag, and the eye can't resolve more than ~1-2
 * points per pixel anyway. Uniform stride; always keeps the first + last point. */
function decimate(pts, maxN){
  const n = pts.length;
  if (n <= maxN) return pts;
  const out = new Array(maxN);
  const step = (n - 1) / (maxN - 1);
  for (let i = 0; i < maxN; i++) out[i] = pts[Math.round(i * step)];
  return out;
}

/* Coalesce rapid redraws (pan/pinch fire many touchmoves per frame) into one
 * draw per animation frame — keeps gestures smooth on dense data. */
let _histRAF = null;
function scheduleHistoryDraw(){
  if (_histRAF) return;
  _histRAF = requestAnimationFrame(() => { _histRAF = null; drawHistoryCharts(true); });
}
/* Charts off-screen during a redraw are skipped (see `see()` in drawHistoryCharts);
 * redraw them as the user scrolls so they're fresh when they enter the viewport. */
let _scrollRAF = null;
window.addEventListener('scroll', () => {
  if (_scrollRAF) return;
  _scrollRAF = requestAnimationFrame(() => {
    _scrollRAF = null;
    if (history.length && document.querySelector('.tab.active')?.dataset.page === 'history') drawHistoryCharts(true);
  });
}, { passive: true });

function updateZoomChrome(){
  /* Show floating reset button + per-chart info if zoomed */
  document.querySelectorAll('.zoom-info').forEach(el => el.remove());
  const reset = $('zoom-reset-all');
  if (!chartView){
    reset.classList.remove('show');
    return;
  }
  reset.classList.add('show');
  const fmt = ts => {
    const d = new Date(ts);
    return pad2(d.getMonth()+1) + '/' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  const span = Math.max(1, (chartView.end - chartView.start) / 1000);
  const spanStr = span < 60 ? Math.round(span)+'s' : span < 3600 ? Math.round(span/60)+'m' : (span/3600).toFixed(1)+'h';
  reset.textContent = `⊙ reset zoom · ${fmt(chartView.start)} → ${fmt(chartView.end)} (${spanStr})`;
  /* badge on each chart */
  ['chart-speed','chart-wt','chart-batt'].forEach(id => {
    const wrap = document.querySelector(`.chart-wrap[data-chart="${id}"]`);
    if (!wrap) return;
    const info = document.createElement('div');
    info.className = 'zoom-info show';
    info.textContent = '🔍 ' + spanStr;
    wrap.appendChild(info);
  });
}

/* Inertial page-scroll for vertical 1-finger swipes over a chart. touch-action
 * is none (so JS can own pinch), which means we drive the page scroll ourselves;
 * this decay loop gives it native-feeling momentum after the finger lifts. */
let _flingRAF = null;
function cancelFling(){ if (_flingRAF){ cancelAnimationFrame(_flingRAF); _flingRAF = null; } }
function flingScroll(vel){            /* vel = px to scroll on the first frame */
  cancelFling();
  const step = () => {
    if (Math.abs(vel) < 0.4){ _flingRAF = null; return; }
    window.scrollBy(0, vel);
    vel *= 0.93;
    _flingRAF = requestAnimationFrame(step);
  };
  _flingRAF = requestAnimationFrame(step);
}

/* Bind viewport-zoom controls to a chart SVG. All shared, so any chart drives them. */
function bindChartZoom(svg, chartId){
  /* Wrap */
  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  wrap.dataset.chart = chartId;
  svg.parentNode.insertBefore(wrap, svg);
  wrap.appendChild(svg);

  function fullSpan(){
    if (!history.length) return null;
    const ts = history.map(entryTs).filter(t => t > 0).sort((a,b)=>a-b);
    return ts.length ? { start: ts[0], end: ts[ts.length-1] } : null;
  }
  function curView(){
    return chartView || fullSpan() || { start: 0, end: 1 };
  }
  function pxToTs(px){
    /* svg layout in user coords: 600 wide. Get fraction from pixel within wrap. */
    const r = wrap.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (px - r.left) / r.width));
    const v = curView();
    return v.start + frac * (v.end - v.start);
  }
  function applyView(start, end){
    const full = fullSpan(); if (!full) return;
    const fullSpanMs = full.end - full.start;
    /* Total exploded sample count across all cached entries — each POST with
     * raw sp[] adds N points (2s spacing), each aggregate adds 1. Used to set
     * a reasonable zoom-in floor that doesn't refuse to zoom when most of the
     * fullSpan is filled by a few POSTs that explode into many sub-points. */
    let subCount = 0;
    for (const e of history){
      const a = e.speed || e.sp;
      subCount += (Array.isArray(a) && a.length) ? a.length : 1;
    }
    const sampleGap = subCount > 1 ? fullSpanMs / (subCount - 1) : fullSpanMs;
    const minSpan = Math.max(10 * 1000, sampleGap * 5);   /* show ≥5 samples, hard floor 10s */

    if (end - start < minSpan){
      const mid = (start + end) / 2;
      start = mid - minSpan / 2;
      end   = mid + minSpan / 2;
    }
    if (start < full.start){ end += full.start - start; start = full.start; }
    if (end   > full.end)  { start -= end - full.end;   end   = full.end; }
    if (start < full.start) start = full.start;
    if (end - start >= fullSpanMs - 1000){
      chartView = null;
    } else {
      chartView = { start, end };
    }
    scheduleHistoryDraw();   /* coalesce per-frame during pan/pinch */
  }
  function zoomAt(cx, factor){
    const v = curView();
    const centerTs = pxToTs(cx);
    const newWidth = (v.end - v.start) * factor;
    applyView(centerTs - (centerTs - v.start) * factor, centerTs + (v.end - centerTs) * factor);
  }

  /* Wheel zoom */
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(e.clientX, e.deltaY < 0 ? 0.75 : 1.33);
  }, { passive: false });

  /* Mouse pan */
  let dragging = false, lx = 0;
  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.fs-btn,.zoom-reset-all')) return;
    dragging = true; lx = e.clientX;
    wrap.classList.add('dragging'); e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx; lx = e.clientX;
    const v = curView();
    const r = wrap.getBoundingClientRect();
    const dts = -dx / r.width * (v.end - v.start);
    applyView(v.start + dts, v.end + dts);
  });
  window.addEventListener('mouseup', () => { dragging = false; wrap.classList.remove('dragging'); });

  /* Touch: 1-finger = pan (only when horizontal intent), 2-fingers = pinch.
   * IMPORTANT: don't preventDefault on touchstart — that blocks native page
   * scroll when user just wanted to swipe past the chart. Decide intent on
   * first touchmove: if |dx| > |dy| → pan (preventDefault), else let scroll. */
  let touches = {}, pinchStartDist = 0, pinchStartSpan = 0, pinchCenter = 0;
  let touchOrigin = null, panMode = null, vVel = 0;   /* panMode: 'h' pan, 'v' scroll, null unknown */
  wrap.addEventListener('touchstart', e => {
    if (e.target.closest('.fs-btn,.zoom-reset-all')) return;
    cancelFling();                              /* tap stops any inertial scroll */
    for (const t of e.changedTouches) touches[t.identifier] = { x: t.clientX, y: t.clientY };
    const ks = Object.keys(touches);
    if (ks.length === 1){
      const t0 = Object.values(touches)[0];
      touchOrigin = { x: t0.x, y: t0.y };
      panMode = null; vVel = 0;
    }
    if (ks.length === 2){
      const [a, b] = Object.values(touches);
      pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const v = curView();
      pinchStartSpan = v.end - v.start;
      pinchCenter = pxToTs((a.x + b.x) / 2);
      panMode = 'h';   /* 2-finger always = pinch zoom */
      e.preventDefault();
    }
  }, { passive: false });
  wrap.addEventListener('touchmove', e => {
    const ks = Object.keys(touches);
    if (ks.length === 1 && touchOrigin){
      const t = e.changedTouches[0];
      if (!touches[t.identifier]) return;
      const prev = touches[t.identifier];
      touches[t.identifier] = { x: t.clientX, y: t.clientY };
      if (panMode === null){
        /* Lock direction once movement exceeds threshold */
        const dx = Math.abs(t.clientX - touchOrigin.x);
        const dy = Math.abs(t.clientY - touchOrigin.y);
        if (dx < 6 && dy < 6) return;
        panMode = dx > dy ? 'h' : 'v';
      }
      if (panMode === 'v') return;   /* vertical → let the browser scroll natively (touch-action:pan-y) */
      const dx = t.clientX - prev.x;
      const v = curView();
      const r = wrap.getBoundingClientRect();
      const dts = -dx / r.width * (v.end - v.start);
      applyView(v.start + dts, v.end + dts);
      e.preventDefault();
    }
    if (ks.length === 2){
      /* Update touch positions FIRST, then read fresh values */
      for (const t of e.changedTouches) if (touches[t.identifier]) touches[t.identifier] = { x: t.clientX, y: t.clientY };
      const vals = Object.values(touches);
      if (vals.length < 2){ e.preventDefault(); return; }   /* need both fingers */
      const [a, b] = vals;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 1){ e.preventDefault(); return; }           /* guard div-by-~0 → NaN/huge span */
      const newSpan = pinchStartSpan * (pinchStartDist / dist);
      const r = wrap.getBoundingClientRect();
      const cxFrac = ((a.x + b.x) / 2 - r.left) / r.width;
      const ns = pinchCenter - cxFrac * newSpan, ne = pinchCenter + (1 - cxFrac) * newSpan;
      if (isFinite(ns) && isFinite(ne) && ne > ns) applyView(ns, ne);   /* never push NaN into the view */
      e.preventDefault();
    }
  }, { passive: false });
  /* Rebuild `touches` from the AUTHORITATIVE active-touch list (e.touches), and
   * also listen for touchcancel. Previously a missed touchcancel (the browser
   * fires it whenever it steals a gesture — common on mobile) left stale finger
   * ids behind, so every later gesture looked like a 2-finger pinch → zoom stuck,
   * scroll + left/right pan broken. Resetting from e.touches fixes that. */
  function onTouchEnd(e){
    const live = {};
    for (const t of e.touches) live[t.identifier] = touches[t.identifier] || { x: t.clientX, y: t.clientY };
    touches = live;
    if (!e.touches.length){ touchOrigin = null; panMode = null; }
  }
  wrap.addEventListener('touchend', onTouchEnd);
  wrap.addEventListener('touchcancel', onTouchEnd);

  wrap.addEventListener('dblclick', () => { chartView = null; drawHistoryCharts(); });
}

/* Same as bindChartZoom but for the live timeline — uses `liveView` state. */
function bindLiveChartZoom(svg){
  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  svg.parentNode.insertBefore(wrap, svg);
  wrap.appendChild(svg);

  function fullSpan(){
    if (!speedHistory.length) return null;
    const ts = speedHistory.map(p => p.t);
    return { start: Math.min(...ts), end: Math.max(...ts) };
  }
  function curView(){ return liveView || fullSpan() || { start: 0, end: 1 }; }
  function pxToTs(px){
    const r = wrap.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (px - r.left) / r.width));
    const v = curView(); return v.start + frac * (v.end - v.start);
  }
  function applyView(start, end){
    const full = fullSpan(); if (!full) return;
    const minSpan = 10 * 1000;  /* 10s min for live */
    if (end - start < minSpan){ const m = (start + end) / 2; start = m - minSpan/2; end = m + minSpan/2; }
    if (start < full.start){ end += full.start - start; start = full.start; }
    if (end > full.end){ start -= end - full.end; end = full.end; }
    if (start < full.start) start = full.start;
    if (end - start >= full.end - full.start - 1000) liveView = null;
    else liveView = { start, end };
    drawLiveTimeline();
  }
  function zoomAt(cx, factor){
    const v = curView();
    const centerTs = pxToTs(cx);
    applyView(centerTs - (centerTs - v.start) * factor, centerTs + (v.end - centerTs) * factor);
  }
  wrap.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.deltaY < 0 ? 0.75 : 1.33); }, { passive: false });

  let dragging = false, lx = 0;
  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.fs-btn,.zoom-reset-all')) return;
    dragging = true; lx = e.clientX; wrap.classList.add('dragging'); e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx; lx = e.clientX;
    const v = curView(); const r = wrap.getBoundingClientRect();
    const dts = -dx / r.width * (v.end - v.start);
    applyView(v.start + dts, v.end + dts);
  });
  window.addEventListener('mouseup', () => { dragging = false; wrap.classList.remove('dragging'); });

  let touches = {}, pinchStartDist = 0, pinchStartSpan = 0, pinchCenter = 0;
  let touchOrigin = null, panMode = null, vVel = 0;
  wrap.addEventListener('touchstart', e => {
    if (e.target.closest('.fs-btn,.zoom-reset-all')) return;
    cancelFling();
    for (const t of e.changedTouches) touches[t.identifier] = { x: t.clientX, y: t.clientY };
    const ks = Object.keys(touches);
    if (ks.length === 1){
      const t0 = Object.values(touches)[0];
      touchOrigin = { x: t0.x, y: t0.y };
      panMode = null; vVel = 0;
    }
    if (ks.length === 2){
      const [a,b] = Object.values(touches);
      pinchStartDist = Math.hypot(a.x-b.x, a.y-b.y) || 1;
      const v = curView(); pinchStartSpan = v.end - v.start;
      pinchCenter = pxToTs((a.x + b.x) / 2);
      panMode = 'h';
      e.preventDefault();
    }
  }, { passive: false });
  wrap.addEventListener('touchmove', e => {
    const ks = Object.keys(touches);
    if (ks.length === 1 && touchOrigin){
      const t = e.changedTouches[0];
      if (!touches[t.identifier]) return;
      const prev = touches[t.identifier];
      touches[t.identifier] = { x: t.clientX, y: t.clientY };
      if (panMode === null){
        const dx = Math.abs(t.clientX - touchOrigin.x);
        const dy = Math.abs(t.clientY - touchOrigin.y);
        if (dx < 6 && dy < 6) return;
        panMode = dx > dy ? 'h' : 'v';
      }
      if (panMode === 'v') return;   /* vertical → native browser scroll (touch-action:pan-y) */
      const dx = t.clientX - prev.x; const v = curView();
      const r = wrap.getBoundingClientRect();
      const dts = -dx / r.width * (v.end - v.start);
      applyView(v.start + dts, v.end + dts);
      e.preventDefault();
    }
    if (ks.length === 2){
      for (const t of e.changedTouches) if (touches[t.identifier]) touches[t.identifier] = { x: t.clientX, y: t.clientY };
      const vals = Object.values(touches);
      if (vals.length < 2){ e.preventDefault(); return; }
      const [a,b] = vals;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 1){ e.preventDefault(); return; }
      const newSpan = pinchStartSpan * (pinchStartDist / dist);
      const r = wrap.getBoundingClientRect();
      const cxFrac = ((a.x + b.x) / 2 - r.left) / r.width;
      const ns = pinchCenter - cxFrac * newSpan, ne = pinchCenter + (1 - cxFrac) * newSpan;
      if (isFinite(ns) && isFinite(ne) && ne > ns) applyView(ns, ne);
      e.preventDefault();
    }
  }, { passive: false });
  function onTouchEnd(e){   /* see bindChartZoom: rebuild from e.touches + handle touchcancel */
    const live = {};
    for (const t of e.touches) live[t.identifier] = touches[t.identifier] || { x: t.clientX, y: t.clientY };
    touches = live;
    if (!e.touches.length){ touchOrigin = null; panMode = null; }
  }
  wrap.addEventListener('touchend', onTouchEnd);
  wrap.addEventListener('touchcancel', onTouchEnd);
  wrap.addEventListener('dblclick', () => { liveView = null; drawLiveTimeline(); });
}

/* =========== CHART TOOLTIP (scrub / tap a point → exact data + date) =========== */
/* Reads svg.__ctx stashed by drawWindTimeline / drawLineChart. Desktop = hover,
 * mobile = tap (the zoom layer only reacts to drags, so a still tap is free).
 * Pure client-side — costs zero extra bytes (good for 2G). */
function attachChartTooltip(svg){
  const wrap = svg.closest('.chart-wrap') || svg.parentNode;
  const ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ov.setAttribute('class', 'xhair-svg');
  ov.setAttribute('viewBox', svg.getAttribute('viewBox'));   /* match transform exactly */
  wrap.appendChild(ov);
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  wrap.appendChild(tip);
  let pinTs = null;

  const NS = 'http://www.w3.org/2000/svg';
  function nearest(c, ts){
    let best = c.pts[0], bd = Infinity;
    for (const p of c.pts){ const d = Math.abs(p.ts - ts); if (d < bd){ bd = d; best = p; } }
    return best;
  }
  function showAtTs(ts){
    const c = svg.__ctx;
    if (!c || !c.pts || !c.pts.length){ hide(); return; }
    ov.setAttribute('viewBox', svg.getAttribute('viewBox'));   /* W is dynamic per draw */
    const p = nearest(c, ts);
    pinTs = p.ts;
    const innerW = c.W - c.LEFT - c.RIGHT, innerH = c.H - c.TOP - c.BOT;
    const X  = c.LEFT + (p.ts - c.xMin) / (c.xMax - c.xMin || 1) * innerW;
    const syOf = (v, mn, mx) => c.H - c.BOT - ((Math.min(v, mx) - mn) / (mx - mn || 1)) * innerH;
    const DOT  = (y, col) => `<circle cx="${X.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${col}" stroke="var(--bg)" stroke-width="1.5"/>`;
    const RING = (y, col) => `<circle cx="${X.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="none" stroke="${col}" stroke-width="1.5"/>`;

    let dots = '', lines = '';
    const kind = c.tipKind || 'wind';
    if (kind === 'wind'){
      const gv = p.speedMax ?? p.speed, hasG = gv > p.speed + 0.05;
      if (hasG) dots += RING(syOf(gv, 0, c.yMax), '#79c0ff');
      dots += DOT(syOf(p.speed, 0, c.yMax), 'var(--accent)');
      const bf = beaufortOf(p.speed);
      lines += `<div><b>${p.speed.toFixed(1)}</b> ${spdLbl()} · ${bf.icon} ${bf.label}</div>`;
      if (hasG)                        lines += `<div style="color:#79c0ff">${t('gust')} ${gv.toFixed(1)} ${spdLbl()}</div>`;
      if (p.dir != null && p.dir >= 0) lines += `<div>${DIRS[p.dir]} · ${p.dir*45}°</div>`;
    } else if (kind === 'solar'){
      const v = p.solar ?? 0;
      dots += DOT(syOf(v, c.yMin, c.yMax), '#f0883e');
      lines += `<div>☀ <b style="color:#f0883e">${v.toFixed(0)}</b> mV</div>`;
    } else if (kind === 'batt'){
      const bv = p.batt;
      if (typeof bv === 'number' && bv > 0){
        dots += DOT(syOf(bv, c.yMin, c.yMax), '#3fb950');
        const bp = battPct(bv).pct;
        lines += `<div>🔋 <b style="color:#3fb950">${bv.toFixed(0)}</b> mV${bp != null ? ' · ' + bp + '%' : ''}</div>`;
      }
    } else if (kind === 'signal'){
      const cv = p.csq;
      if (typeof cv === 'number' && cv >= 1 && cv <= 31){
        dots += DOT(syOf(cv, 0, c.yMax), '#58d3ff');
        lines += `<div style="color:#58d3ff">📶 CSQ ${cv} · ${(-113 + 2*cv)} dBm</div>`;
      }
    } else if (kind === 'battsig'){
      const bv = p.batt;
      if (typeof bv === 'number' && bv > 0){
        dots += DOT(syOf(bv, c.yMinB, c.yMaxB), '#3fb950');
        const bp = battPct(bv).pct;
        lines += `<div>🔋 <b style="color:#3fb950">${bv.toFixed(0)}</b> mV${bp != null ? ' · ' + bp + '%' : ''}</div>`;
      }
      /* CSQ line is built separately (unsmoothed, 99 filtered) — match by nearest ts */
      let cqp = null, bd = Infinity;
      for (const q of (c.csqPts || [])){ const dd = Math.abs(q.ts - p.ts); if (dd < bd){ bd = dd; cqp = q; } }
      if (cqp && cqp.csq >= 1 && cqp.csq <= 31){
        dots += DOT(syOf(cqp.csq, 0, 31), '#58d3ff');
        lines += `<div style="color:#58d3ff">📶 CSQ ${cqp.csq} · ${(-113 + 2*cqp.csq)} dBm</div>`;
      }
    }
    ov.innerHTML = `<line x1="${X.toFixed(1)}" y1="${c.TOP}" x2="${X.toFixed(1)}" y2="${c.H-c.BOT}" stroke="var(--accent)" stroke-width="1" opacity=".75"/>` + dots;

    const d = new Date(p.ts);
    const date = pad2(d.getDate()) + '.' + pad2(d.getMonth()+1) + '.' + d.getFullYear();
    const time = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    tip.innerHTML = `<div class="tt-date">${date} · ${time}</div>` + (lines || `<div class="tt-date">${t('no_data')}</div>`);

    const rb = svg.getBoundingClientRect(), wb = wrap.getBoundingClientRect();
    const pxX = (rb.left - wb.left) + (X / c.W) * rb.width;
    /* clamp by the tip's real half-width (it's centered via translateX(-50%)) so it
     * never spills past the card edge — a spilled tip widened the page on mobile. */
    const half = tip.offsetWidth / 2 + 4;
    tip.style.left = Math.max(half, Math.min(wb.width - half, pxX)).toFixed(0) + 'px';
    tip.classList.add('show');
  }
  function showAtClientX(clientX, toggle){
    const c = svg.__ctx;
    if (!c || !c.pts || !c.pts.length){ hide(); return; }
    const rb = svg.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rb.left) / rb.width));
    const xUser = frac * c.W;
    const ts = c.xMin + (xUser - c.LEFT) / (c.W - c.LEFT - c.RIGHT) * (c.xMax - c.xMin);
    if (toggle && pinTs != null && tip.classList.contains('show') && nearest(c, ts).ts === pinTs){ hide(); return; }
    showAtTs(ts);
  }
  function hide(){ pinTs = null; ov.innerHTML = ''; tip.classList.remove('show'); }

  svg.__hideTip = hide;
  svg.__refreshTip = () => { if (pinTs != null) showAtTs(pinTs); };

  /* desktop hover. Touch devices fire a SYNTHETIC mousemove right after every
   * touch (incl. after a pan) — that used to pop a tooltip on the chart body
   * once the finger lifted, which felt broken. Ignore mousemoves that land just
   * after a touch (and any with a pressed button = a drag). */
  let lastTouch = 0;
  wrap.addEventListener('mousemove', e => {
    if (e.buttons) return;
    if (Date.now() - lastTouch < 700) return;   /* suppress synthetic-after-touch */
    showAtClientX(e.clientX, false);
  });
  wrap.addEventListener('mouseleave', e => { if (Date.now() - lastTouch < 700) return; hide(); });

  /* mobile tap (no pan): track start, fire only on a still, short touch */
  let t0 = null, x0 = 0, y0 = 0;
  wrap.addEventListener('touchstart', e => {
    lastTouch = Date.now();
    if (e.touches.length !== 1){ t0 = null; return; }
    t0 = e.timeStamp; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  wrap.addEventListener('touchend', e => {
    lastTouch = Date.now();
    if (t0 == null) return;
    const ch = e.changedTouches[0];
    if (!ch){ t0 = null; return; }
    const moved = Math.abs(ch.clientX - x0) > 8 || Math.abs(ch.clientY - y0) > 8;
    if (!moved && (e.timeStamp - t0) < 500) showAtClientX(ch.clientX, true);
    t0 = null;
  }, { passive: true });
}

/* =========== FULLSCREEN =========== */
function makeFullscreenable(el){
  if (el.querySelector('.fs-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'fs-btn';
  btn.innerHTML = icSvg('ic-expand');
  btn.title = 'Fullscreen';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const cur = document.querySelector('.card.fs, .gauge-card.fs');
    if (cur && cur !== el){ cur.classList.remove('fs'); cur.querySelector('.fs-btn').innerHTML = icSvg('ic-expand'); }
    el.classList.toggle('fs');
    btn.innerHTML = el.classList.contains('fs') ? icSvg('ic-x') : icSvg('ic-expand');
    document.body.classList.toggle('has-fs', !!document.querySelector('.card.fs, .gauge-card.fs'));
    /* On enter/exit fullscreen, redraw so charts reflow to the new width */
    clearChartDims();
    drawLiveTimeline();
    if (history.length) drawHistoryCharts();
  });
  el.appendChild(btn);
}
document.querySelectorAll('.card, .gauge-card').forEach(makeFullscreenable);
/* ESC to exit fullscreen */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){
    const cur = document.querySelector('.card.fs, .gauge-card.fs');
    if (cur){ cur.classList.remove('fs'); cur.querySelector('.fs-btn').innerHTML = icSvg('ic-expand'); document.body.classList.remove('has-fs'); clearChartDims(); if (history.length) drawHistoryCharts(); }
  }
});

/* =========== BOOT =========== */
applyI18n();
updateTabBadges();   /* reflect calib-incomplete / settings-attention on load, before first poll */

/* Bind viewport-zoom on time-axis charts (shared chartView) */
['chart-speed','chart-wt','chart-dir','chart-batt','chart-signal','chart-solar','chart-uptime'].forEach(id => {
  const svg = $(id); if (svg) bindChartZoom(svg, id);
});

/* Live timeline gets its own viewport (`liveView`) — independent from history. */
bindLiveChartZoom($('chart-live-wt'));

/* Tap/hover a point → exact reading + date. */
['chart-live-wt','chart-wt','chart-speed','chart-batt','chart-signal','chart-solar'].forEach(id => {
  const svg = $(id); if (svg) attachChartTooltip(svg);
});

/* Reset zoom button (floating) */
$('zoom-reset-all').addEventListener('click', () => { chartView = null; drawHistoryCharts(); });

/* When user changes range — reset zoom (else stale viewport) */
document.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => { chartView = null; }));

/* Custom date-range picker (from..to). Fetches 30d and clamps via chartView. */
$('r-apply').addEventListener('click', async () => {
  const fromV = $('r-from').value, toV = $('r-to').value;
  if (!fromV || !toV){ toast('обери обидві дати', true); return; }
  const fromTs = new Date(fromV + 'T00:00:00').getTime();
  const toTs   = new Date(toV   + 'T23:59:59').getTime();
  if (toTs <= fromTs){ toast('кінець має бути після початку', true); return; }
  /* Pick smallest preset that covers the span */
  const spanH = (toTs - fromTs) / 3600000;
  const preset = spanH <= 1 ? '1h' : spanH <= 6 ? '6h' : spanH <= 24 ? '24h' : spanH <= 168 ? '7d' : '30d';
  currentRange = preset;
  document.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('active', b.dataset.range === preset));
  await renderHistory();
  chartView = { start: fromTs, end: toTs };
  drawHistoryCharts();
});
/* date presets: today / yesterday / last 7 days */
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  const iso = d => d.toISOString().slice(0,10);
  const now = new Date();
  let from, to;
  if (b.dataset.preset === 'today'){ from = to = iso(now); }
  else if (b.dataset.preset === 'yesterday'){ const y = new Date(now); y.setDate(y.getDate()-1); from = to = iso(y); }
  else { const s = new Date(now); s.setDate(s.getDate()-6); from = iso(s); to = iso(now); }
  $('r-from').value = from; $('r-to').value = to;
  $('r-apply').click();
}));
/* ⋯ toggles the advanced filter panel (secondary ranges + custom dates) */
$('range-more-btn').addEventListener('click', () => {
  const more = $('range-more');
  more.hidden = !more.hidden;
  $('range-more-btn').classList.toggle('active', !more.hidden);
});

renderLive();
startPoll();
seedBattLog();   /* bootstrap the battery-trend buffer for the honest charge badge */

/* ===== Remember tab + scroll across reloads (don't dump back to Live) ===== */
(function(){
  const NAV_KEY = 'nav_state';
  function saveNav(){
    try {
      const tab = document.querySelector('.tab.active')?.dataset.page || 'live';
      localStorage.setItem(NAV_KEY, JSON.stringify({ tab, scroll: Math.round(window.scrollY) }));
    } catch {}
  }
  addEventListener('pagehide', saveNav);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNav(); });
  let _navT; addEventListener('scroll', () => { clearTimeout(_navT); _navT = setTimeout(saveNav, 400); }, { passive: true });

  let st; try { st = JSON.parse(localStorage.getItem(NAV_KEY) || 'null'); } catch {}
  if (!st) return;
  if (st.tab && st.tab !== 'live' && typeof switchToTab === 'function') switchToTab(st.tab);
  if (st.scroll > 0){
    /* content (charts) renders over a few hundred ms → re-apply until the height settles */
    let tries = 0;
    const restore = () => {
      window.scrollTo(0, st.scroll);
      if (++tries < 10 && Math.abs(window.scrollY - st.scroll) > 4) setTimeout(restore, 120);
    };
    setTimeout(restore, 150);
  }
})();
