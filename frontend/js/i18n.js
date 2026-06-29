'use strict';
const DIRS = ['N','NE','E','SE','S','SW','W','NW'];
const $ = id => document.getElementById(id);
const icSvg = id => `<svg class="ic"><use href="#${id}"/></svg>`;   /* inline icon helper */
/* API base: ?srv= override, else same-origin (the endpoint that served this dashboard). */
const SRV = (m => m ? decodeURIComponent(m[1]) : (location.origin + location.pathname))
            ((location.search.match(/srv=([^&]+)/)||null));
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
       alerts:'🔔 Сповіщення', alerts_hint:'Які серверні пуші приходять і за якими порогами. Доставку на цей пристрій увімкни нижче у «Серверний пуш».', alert_batt_lbl:'Батарея низька <', alert_crit_lbl:'Батарея критична <', alert_wind_lbl:'Вітер >', alert_offline_lbl:'Офлайн (нема даних) >', alert_online_lbl:'Знов онлайн (відновився)', minutes:'хв', alert_solar_lbl:'Заряд / сонце (старт, стоп, повна)', chg_full:'заряджено на повну', chg_soon:'майже повна', off:'Вимк', on_btn:'Увімк', spush:'📡 Серверний пуш (фон)', spush_hint:'Доставляє сповіщення навіть коли апку закрито. Пороги беруться з «Сповіщень» вище. По кожному пості: батарея, вітер. Офлайн/Live-пуші йдуть через фонового вартового (нижче) або зовнішній крон.',wd_lbl:'🛰️ Фоновий вартовий',wd_start:'Увімкнути',wd_hint:'Тримає серверний цикл живим, щоб офлайн/Live-пуші йшли навіть без відкритого дашборду. Для повної надійності додай зовнішній крон (cron-job.org → ?tick=1).',wd_running:'працює',wd_stopped:'спить',wd_lasttick:'тік', spush_lbl:'На цей пристрій', spush_test:'Тест із сервера', spush_testall:'Усі типи', livepin:'📌 Live у шторці', livepin_hint:'Закріплює поточні дані у шторці, тихо оновлюється в фоні щопоста (~раз на цикл). Не дзвенить.', livepin_lbl:'📌 Live у шторці', spush_devices:'Підписані пристрої', spush_none:'нема підписок', spush_this:'цей',
       live_mode:'🔴 Live режим (для калібровки)',
       live_hint:'Прошивка стає у нон-стоп live POSTs (3с цикл). Жере батарею, тільки для калібровки.',
       start_live:'Start LIVE', stop_live:'Stop LIVE',
       live_posts:'Нон-стоп Live POSTs', cancel:'Скасувати', confirm_yes:'Так', back_online:'Знову онлайн', went_offline:'Втрачено зв\'язок', haptics:'📳 Вібрація',
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
       no_data:'нема даних', offline_nodata:'офлайн · нема показів', applied:'застосовано', kmh:'км/год', gust:'порив',
       no_data_window:'немає даних у цьому проміжку', data_left:'дані ліворуч', data_right:'дані праворуч', jump_data:'до даних',
       appearance:'🎨 Вигляд', theme:'Тема', theme_dark:'Темна', theme_sun:'Сонячна', language:'Мова', test_mode:'Тест-режим', test_toggle_btn:'Увімк. / вимк.',
       data_2g:'📶 2G / дані', lite_mode:'Lite-режим', lite_full:'Повний', lite_on:'Lite', refresh_now:'Синхронізація', refresh:'Синхронізувати', synced:'синхронізовано',
       lite_hint:'Lite: повільний поллінг (60с), без щогодинного завантаження кривої — мінімум трафіку на 2G.',
       wind_timeline:'Wind timeline · швидкість + напрямок', wt_meta:'стрілки показують напрямок',
       dir_timeline:'Напрямок вітру', dirt_meta:'8 румбів у часі', no_dir_data:'напрямок невідомий',
       uptime_chart:'Доступність (uptime)', uptime_gaps:'пропусків',
       uptime_online:'онлайн', uptime_overdue:'прострочено', uptime_down:'простій', uptime_missed:'пропущених циклів',
       beaufort:'Beaufort scale', gust_factor:'Gust factor (1h)', dir_stability:'Стабільність (1h)',
       daily_summary:'📅 По днях', day:'День', avg_kmh:'avg km/h', max_kmh:'max km/h', dom_dir:'dom. напр.',
       hourly_heat:'🕐 Heatmap по годинах', hm_hint:'Колір = середня швидкість у цій годині дня',
       all_days:'всі дні', from:'від', to:'до', today:'сьогодні', yesterday:'вчора', last7:'7 днів',
       tab_status:'Стан', current_state:'Поточний стан модуля', next_event:'наступна подія',
       state_timeline:'Робочий цикл', state_hint:'Прошивка послідовно проходить ці стани. Поточний підсвічений.',
       pending_changes:'⏳ Pending changes', pending_hint:'Зміни (інтервал/live) застосовуються на наступному POST.',
       no_pending:'немає очікуваних змін', raw_config:'Серверний config',
       waiting_next_post:'чекаємо на наступний POST', failed_timeout:'не застосовано (timeout)',
       local_cache:'💾 Локальний кеш', clear_cache:'Очистити кеш', retention:'Зберігати', network:'🌐 Мережа · останні запити',
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
       sync_title:'Синхронізація кешу', sync_check:'Перевірка сервера', sync_download:'Завантаження', sync_write:'Запис у кеш', sync_trim:'Очищення', sync_done:'Готово', sync_close:'Закрити', sync_btn:'⟳ Синхронізувати кеш', sync_pts:'точок у кеші',
       export_title:'⤓ Експорт даних', export_hint:'Вивантажити всю локальну історію. Графіки — у PNG кнопкою на картці.', export_csv:'⤓ CSV', export_json:'⤓ JSON', export_done:'Експортовано', export_empty:'Немає даних для експорту',
       online_24h:'Онлайн за 24 год',
       
       st_sample_lbl:'проба', st_est:'оцінка', st_recv:'прийнято', st_cycle_lbl:'цикл', st_bytes:'байтів',
       st_health_ok:'вчасно', st_health_late:'запізнення', st_health_missed:'пропуск',
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
       sync_ok:'Цикл синхронізовано: налаштовано {int}, фактично {obs}',st_switch_n:'Переключаємося',st_switch_d:'Застосовуємо новий цикл — модуль перейде з наступним POST',sync_switch_title:'Переключаємося.',sync_switch_body:'Новий цикл {int} застосується після наступного POST (~{eta}).',
       pick_both_dates:'обери обидві дати', end_after_start:'кінець має бути після початку',
       confirm_clear_cache:'Видалити кешовані історичні дані?', confirm_wipe_server:'Видалити всі дані на сервері?',
       spush_enabled:'серверний пуш увімкнено ✓', spush_disabled:'серверний пуш вимкнено', disabled:'вимкнено',
       error_word:'помилка', request_error:'помилка запиту', no_subs_enable:'0 підписок — спершу натисни Увімк',
       subs_word:'підписок', push_word:'пуш', accepted_word:'прийнято',
       browser_unsupported:'браузер не підтримує', perm_denied:'дозвіл відхилено',
       livepin_ok_bg:'✓ закріплено · фон через пуш', livepin_ok_fg:'✓ foreground; увімкни Серверний пуш для фону',
       alerts_saved:'збережено ✓', open:'Відкрити', waiting_server_data:'чекаю на дані сервера' },
  pl:{ tab_live:'Na żywo', tab_history:'Historia', tab_settings:'Ustawienia', tab_calib:'Kalibracja',
       wind_direction:'Kierunek wiatru', wind_speed:'Prędkość wiatru', battery:'Bateria', signal:'Sygnał',
       cycle:'Cykl', updated:'Zaktualizowano', uptime_live:'Uptime', since_boot:'od ost. włączenia', speed_last_hour:'Prędkość ostatnia godzina',
       speed_history:'Prędkość wiatru', wind_rose:'Wind Rose', rose_meta:'% czasu wg kierunku',
       batt_csq:'Bateria + sygnał', battery_chart:'🔋 Bateria', signal_chart:'📶 Sygnał GSM (CSQ)', summary:'Statystyki', metric:'Metryka', min:'min', avg:'śr', max:'max',
       post_interval:'📡 Interwał POST', cur_setting:'Bieżąca', apply:'Zastosuj',
       speed_calib:'🌀 Kalibracja prędkości', speed_calib_hint:'Ile km/h daje 1 impuls/s anemometru. Zmienia tylko wyświetlanie (firmware wysyła surowe impulsy).', reset_btn:'Reset',
       batt_settings:'🔋 Bateria', batt_settings_hint:'Specyfikacja pakietu — do prognozy „ile zostało". Tylko obliczenia (firmware wysyła samo napięcie).', batt_cap:'Pojemność', batt_cut:'Odcięcie',
       speed_units:'Jednostki', solar_w:'Panel solarny', per_day:'dzień', tz_label:'🕓 Strefa czasowa danych', tz_auto:'auto (jak przeglądarka)',
       alerts:'🔔 Powiadomienia', alerts_hint:'Które pushe serwerowe przychodzą i z jakimi progami. Dostarczanie na to urządzenie włącz niżej w „Push serwerowy”.', alert_batt_lbl:'Bateria niska <', alert_crit_lbl:'Bateria krytyczna <', alert_wind_lbl:'Wiatr >', alert_offline_lbl:'Offline (brak danych) >', alert_online_lbl:'Znów online (wrócił)', minutes:'min', alert_solar_lbl:'Ładowanie / słońce (start, stop, pełna)', chg_full:'naładowano', chg_soon:'prawie pełna', off:'Wył', on_btn:'Wł', spush:'📡 Push serwerowy (tło)', spush_hint:'Dostarcza powiadomienia nawet gdy apka zamknięta. Progi z „Powiadomień” powyżej. Przy każdym POST: bateria, wiatr. Offline/Live przez strażnika w tle (poniżej) lub zewnętrzny cron.',wd_lbl:'🛰️ Strażnik w tle',wd_start:'Włącz',wd_hint:'Utrzymuje serwerowy cykl przy życiu, by push offline/Live działał bez otwartego dashboardu. Dla pełnej niezawodności dodaj zewnętrzny cron (cron-job.org → ?tick=1).',wd_running:'działa',wd_stopped:'śpi',wd_lasttick:'tik', spush_lbl:'Na to urządzenie', spush_test:'Test z serwera', spush_testall:'Wszystkie typy', livepin:'📌 Live w pasku', livepin_hint:'Przypina bieżące dane w pasku, cicho odświeża w tle przy każdym POST (~raz na cykl). Nie dzwoni.', livepin_lbl:'📌 Live w pasku', spush_devices:'Subskrybowane urządzenia', spush_none:'brak subskrypcji', spush_this:'to',
       live_mode:'🔴 Tryb live (do kalibracji)',
       live_hint:'Firmware wchodzi w ciągłe POSTy (3s cykl). Wyczerpuje baterię, tylko do kalibracji.',
       start_live:'Start LIVE', stop_live:'Stop LIVE',
       live_posts:'Non-stop Live POSTs', cancel:'Anuluj', confirm_yes:'Tak', back_online:'Znów online', went_offline:'Utracono połączenie', haptics:'📳 Wibracja',
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
       no_data:'brak danych', offline_nodata:'offline · brak odczytów', applied:'zastosowano', kmh:'km/h', gust:'poryw',
       no_data_window:'brak danych w tym zakresie', data_left:'dane po lewej', data_right:'dane po prawej', jump_data:'do danych',
       appearance:'🎨 Wygląd', theme:'Motyw', theme_dark:'Ciemny', theme_sun:'Słoneczny', language:'Język', test_mode:'Tryb testowy', test_toggle_btn:'Wł. / wył.',
       data_2g:'📶 2G / dane', lite_mode:'Tryb Lite', lite_full:'Pełny', lite_on:'Lite', refresh_now:'Synchronizacja', refresh:'Synchronizuj', synced:'zsynchronizowano',
       lite_hint:'Lite: wolny polling (60s), bez godzinowego pobierania wykresu — minimum danych na 2G.',
       wind_timeline:'Wind timeline · prędkość + kierunek', wt_meta:'strzałki pokazują kierunek',
       dir_timeline:'Kierunek wiatru', dirt_meta:'8 kierunków w czasie', no_dir_data:'kierunek nieznany',
       uptime_chart:'Dostępność (uptime)', uptime_gaps:'przerw',
       uptime_online:'online', uptime_overdue:'spóźnione', uptime_down:'przestój', uptime_missed:'pominiętych cykli',
       beaufort:'Skala Beauforta', gust_factor:'Współczynnik porywu (1h)', dir_stability:'Stabilność (1h)',
       daily_summary:'📅 Wg dni', day:'Dzień', avg_kmh:'śr km/h', max_kmh:'max km/h', dom_dir:'dom. kier.',
       hourly_heat:'🕐 Heatmap godzinowa', hm_hint:'Kolor = średnia prędkość w tej godzinie',
       all_days:'wszystkie dni', from:'od', to:'do', today:'dzisiaj', yesterday:'wczoraj', last7:'7 dni',
       tab_status:'Stan', current_state:'Bieżący stan modułu', next_event:'następne zdarzenie',
       state_timeline:'Cykl pracy', state_hint:'Firmware sekwencyjnie przechodzi stany. Aktualny podświetlony.',
       pending_changes:'⏳ Oczekujące zmiany', pending_hint:'Zmiany (interwał/live) wchodzą przy następnym POST.',
       no_pending:'brak oczekujących zmian', raw_config:'Config serwera',
       waiting_next_post:'czekamy na następny POST', failed_timeout:'nie zastosowano (timeout)',
       local_cache:'💾 Cache lokalny', clear_cache:'Wyczyść cache', retention:'Przechowywać', network:'🌐 Sieć · ostatnie żądania',
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
       sync_title:'Synchronizacja cache', sync_check:'Sprawdzanie serwera', sync_download:'Pobieranie', sync_write:'Zapis do cache', sync_trim:'Czyszczenie', sync_done:'Gotowe', sync_close:'Zamknij', sync_btn:'⟳ Synchronizuj cache', sync_pts:'punktów w cache',
       export_title:'⤓ Eksport danych', export_hint:'Pobierz całą lokalną historię. Wykresy — do PNG przyciskiem na karcie.', export_csv:'⤓ CSV', export_json:'⤓ JSON', export_done:'Wyeksportowano', export_empty:'Brak danych do eksportu',
       online_24h:'Online w 24 h',
       
       st_sample_lbl:'próbka', st_est:'szac.', st_recv:'odebrano', st_cycle_lbl:'cykl', st_bytes:'bajtów',
       st_health_ok:'na czas', st_health_late:'opóźnienie', st_health_missed:'pominięto',
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
       sync_ok:'Cykl zsynchronizowany: ustawiono {int}, faktycznie {obs}',st_switch_n:'Przełączamy',st_switch_d:'Stosujemy nowy cykl — moduł przejdzie przy następnym POST',sync_switch_title:'Przełączanie.',sync_switch_body:'Nowy cykl {int} zacznie działać po następnym POST (~{eta}).',
       pick_both_dates:'wybierz obie daty', end_after_start:'koniec musi być po początku',
       confirm_clear_cache:'Usunąć zbuforowane dane historyczne?', confirm_wipe_server:'Usunąć wszystkie dane na serwerze?',
       spush_enabled:'push serwerowy włączony ✓', spush_disabled:'push serwerowy wyłączony', disabled:'wyłączono',
       error_word:'błąd', request_error:'błąd zapytania', no_subs_enable:'0 subskrypcji — najpierw kliknij Wł',
       subs_word:'subskrypcji', push_word:'push', accepted_word:'przyjęto',
       browser_unsupported:'przeglądarka nie wspiera', perm_denied:'odmowa uprawnień',
       livepin_ok_bg:'✓ przypięto · tło przez push', livepin_ok_fg:'✓ foreground; włącz Push serwerowy dla tła',
       alerts_saved:'zapisano ✓', open:'Otwórz', waiting_server_data:'czekam na dane serwera' },
  en:{ tab_live:'Live', tab_history:'History', tab_settings:'Settings', tab_calib:'Calibration',
       wind_direction:'Wind direction', wind_speed:'Wind speed', battery:'Battery', signal:'Signal',
       cycle:'Cycle', updated:'Updated', uptime_live:'Uptime', since_boot:'since last power-on', speed_last_hour:'Speed last hour',
       speed_history:'Wind speed', wind_rose:'Wind Rose', rose_meta:'% time per direction',
       batt_csq:'Battery + signal', battery_chart:'🔋 Battery', signal_chart:'📶 GSM signal (CSQ)', summary:'Stats', metric:'Metric', min:'min', avg:'avg', max:'max',
       post_interval:'📡 POST interval', cur_setting:'Current', apply:'Apply',
       speed_calib:'🌀 Speed calibration', speed_calib_hint:'How many km/h equals 1 anemometer pulse/sec. Display-only (firmware sends raw pulse counts).', reset_btn:'Reset',
       batt_settings:'🔋 Battery', batt_settings_hint:'Pack specs — for the "time left" forecast. Display/calc only (firmware reports voltage only).', batt_cap:'Capacity', batt_cut:'Cutoff',
       speed_units:'Units', solar_w:'Solar panel', per_day:'day', tz_label:'🕓 Data timezone', tz_auto:'auto (browser)',
       alerts:'🔔 Alerts', alerts_hint:'Which server pushes you get and at what thresholds. Enable delivery to this device below in "Server push".', alert_batt_lbl:'Battery low <', alert_crit_lbl:'Battery critical <', alert_wind_lbl:'Wind >', alert_offline_lbl:'Offline (no data) >', alert_online_lbl:'Back online (recovered)', minutes:'min', alert_solar_lbl:'Charge / sun (start, stop, full)', chg_full:'charged full', chg_soon:'almost full', off:'Off', on_btn:'On', spush:'📡 Server push (bg)', spush_hint:'Delivers notifications even when the app is closed. Thresholds come from Alerts above. Per POST: battery, wind. Offline/Live pushes run via the background watchdog (below) or an external cron.',wd_lbl:'🛰️ Background watchdog',wd_start:'Enable',wd_hint:'Keeps the server-side loop alive so offline/Live pushes fire even with no dashboard open. For full reliability add an external cron (cron-job.org → ?tick=1).',wd_running:'running',wd_stopped:'idle',wd_lasttick:'tick', spush_lbl:'This device', spush_test:'Test from server', spush_testall:'All types', livepin:'📌 Live in shade', livepin_hint:'Pins current data to the shade, silently refreshed in the background each POST (~once per cycle). No buzz.', livepin_lbl:'📌 Live in shade', spush_devices:'Subscribed devices', spush_none:'no subscriptions', spush_this:'this',
       live_mode:'🔴 Live mode (for calibration)',
       live_hint:'Firmware enters non-stop live POSTs (3s cycle). Eats battery, calibration only.',
       start_live:'Start LIVE', stop_live:'Stop LIVE',
       live_posts:'Non-stop Live POSTs', cancel:'Cancel', confirm_yes:'Yes', back_online:'Back online', went_offline:'Connection lost', haptics:'📳 Vibration',
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
       no_data:'no data', offline_nodata:'offline · no readings', applied:'applied', kmh:'km/h', gust:'gust',
       no_data_window:'no data in this range', data_left:'data to the left', data_right:'data to the right', jump_data:'jump to data',
       appearance:'🎨 Appearance', theme:'Theme', theme_dark:'Dark', theme_sun:'Sunlight', language:'Language', test_mode:'Test mode', test_toggle_btn:'On / off',
       data_2g:'📶 2G / data', lite_mode:'Lite mode', lite_full:'Full', lite_on:'Lite', refresh_now:'Sync', refresh:'Sync now', synced:'synced',
       lite_hint:'Lite: slow polling (60s), no hourly curve download — minimal data on 2G.',
       wind_timeline:'Wind timeline · speed + direction', wt_meta:'arrows show wind direction',
       dir_timeline:'Wind direction', dirt_meta:'8 compass points over time', no_dir_data:'direction unknown',
       uptime_chart:'Availability (uptime)', uptime_gaps:'gaps',
       uptime_online:'online', uptime_overdue:'overdue', uptime_down:'down', uptime_missed:'missed cycles',
       beaufort:'Beaufort scale', gust_factor:'Gust factor (1h)', dir_stability:'Direction stability (1h)',
       daily_summary:'📅 Daily summary', day:'Day', avg_kmh:'avg km/h', max_kmh:'max km/h', dom_dir:'dom. dir',
       hourly_heat:'🕐 Hourly heatmap', hm_hint:'Color = average wind speed for that hour of day',
       all_days:'all days', from:'from', to:'to', today:'today', yesterday:'yesterday', last7:'7 days',
       tab_status:'Status', current_state:'Current firmware state', next_event:'next event',
       state_timeline:'Work cycle', state_hint:'Firmware steps through these states in order. Current is highlighted.',
       pending_changes:'⏳ Pending changes', pending_hint:'Changes (interval/live) apply on the next module POST.',
       no_pending:'no pending changes', raw_config:'Server config',
       waiting_next_post:'waiting for next POST', failed_timeout:'failed (timeout)',
       local_cache:'💾 Local cache', clear_cache:'Clear cache', retention:'Retention', network:'🌐 Network · last requests',
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
       sync_title:'Cache sync', sync_check:'Checking server', sync_download:'Downloading', sync_write:'Writing to cache', sync_trim:'Trimming', sync_done:'Done', sync_close:'Close', sync_btn:'⟳ Sync cache', sync_pts:'pts cached',
       export_title:'⤓ Export data', export_hint:'Download the full local history. Charts → PNG via the button on each card.', export_csv:'⤓ CSV', export_json:'⤓ JSON', export_done:'Exported', export_empty:'No data to export',
       online_24h:'Online in last 24h',
       
       st_sample_lbl:'sample', st_est:'est.', st_recv:'received', st_cycle_lbl:'cycle', st_bytes:'bytes',
       st_health_ok:'on time', st_health_late:'late', st_health_missed:'missed',
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
       sync_ok:'Cycle in sync: configured {int}, actual {obs}',st_switch_n:'Switching',st_switch_d:'Applying the new cycle — module switches on next POST',sync_switch_title:'Switching.',sync_switch_body:'New cycle {int} applies after the next POST (~{eta}).',
       pick_both_dates:'pick both dates', end_after_start:'end must be after start',
       confirm_clear_cache:'Delete cached history data?', confirm_wipe_server:'Wipe all data on the server?',
       spush_enabled:'server push enabled ✓', spush_disabled:'server push disabled', disabled:'disabled',
       error_word:'error', request_error:'request error', no_subs_enable:'0 subscriptions — press Enable first',
       subs_word:'subscriptions', push_word:'push', accepted_word:'accepted',
       browser_unsupported:'browser unsupported', perm_denied:'permission denied',
       livepin_ok_bg:'✓ pinned · background via push', livepin_ok_fg:'✓ foreground; enable Server push for background',
       alerts_saved:'saved ✓', open:'Open', waiting_server_data:'waiting for server data' },
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
  /* applyI18n overwrites textContent of [data-i18n] headers — that WIPES any help "?"
   * we added (for h2s with the attr directly on them). Re-add after every i18n pass. */
  if (typeof injectHelp === 'function') injectHelp();
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
/* Vibration on/off (this element's own handler runs before the delegated buzz,
 * so switching OFF won't itself buzz). */
let HAPTICS_ON = localStorage.getItem('haptics') !== '0';   /* default on */
(() => { const hsw = document.getElementById('haptics-sw'); if (!hsw) return;
  hsw.checked = HAPTICS_ON;
  hsw.addEventListener('change', () => { HAPTICS_ON = hsw.checked; localStorage.setItem('haptics', HAPTICS_ON ? '1' : '0'); });
})();
/* Settings test-mode switch mirrors the header toggle */
document.getElementById('test-toggle-2')?.addEventListener('change', () => document.getElementById('test-toggle')?.click());

