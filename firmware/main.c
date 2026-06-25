/**
 * main.c -- MeteoStation ATmega328P-AU
 *
 * Non-blocking state machine. No _delay_ms() in the main loop.
 * smDelay handles pauses via tickMs() + IDLE sleep.
 *
 * Normal cycle:
 *   BOOT -> GSM_INIT -> GSM_SLEEP -> SLEEP_SAMPLE
 *        -> GSM_WAKE -> SEND_DATA -> GSM_SLEEP -> ...
 *
 * Error escalation: retry -> hard reset -> smError -> reboot.
 */
#include "config.h"
#include "dbgUart.h"
#include "gsm.h"
#include "sensor.h"
#include "power.h"

#include <avr/interrupt.h>
#include <avr/pgmspace.h>
#include <avr/wdt.h>

typedef enum {
    smBoot,
    smGsmInit,
    smGsmSleep,
    smSleepSample,
    smGsmWake,
    smSendData,
    smLiveLoop,
    smGsmHardReset,
    smError,
    smDelay,
} SmState;

static SmState  state;
static SmState  delayNext;
static uint16_t delayStart;
static uint16_t delayMs;
static uint16_t cycleCount;
static uint8_t  retryCount;

/* Inline UART emit helpers used by DEBUG_SENSOR_ONLY loop AND smLiveLoop --
 * lets COM port + GSM stream the same live data in parallel (no reflashing
 * to switch dashboard source). File-scope to avoid nested-function trampolines. */
static void emit_u16(uint16_t v) {
    char tmp[6]; uint8_t k = 0;
    if (v == 0) { dbgPutc('0'); return; }
    while (v) { tmp[k++] = '0' + (v % 10); v /= 10; }
    while (k--) dbgPutc(tmp[k]);
}
static void emit_lit(const char *p) {
    char c; while ((c = pgm_read_byte(p++))) dbgPutc(c);
}

static void setDelay(uint16_t ms, SmState next)
{
    delayStart = tickMs();
    delayMs    = ms;
    delayNext  = next;
    state      = smDelay;
}

/* Exponential backoff: base × 3^retryCount.
 * Retry 0: base (e.g. 5s), retry 1: 15s, retry 2: 45s.
 * Capped at uint16_t max (65s) to fit setDelay. */
static void handleRetry(uint16_t baseMs, SmState onRetry, SmState onFail)
{
    DBG("RETRY:"); DBGU(retryCount);
    if (++retryCount < GSM_MAX_RETRIES) {
        uint32_t delayMs = baseMs;
        for (uint8_t i = 1; i < retryCount; i++) delayMs *= 3;
        if (delayMs > 60000) delayMs = 60000;
        setDelay((uint16_t)delayMs, onRetry);
    } else {
        state = onFail;
    }
}

/* ================================================================
 * DEBUG_SENSOR_ONLY: sensor loop without GSM
 * ================================================================ */
#if DEBUG_SENSOR_ONLY

int main(void)
{
    dbgInit();
    windInit();
    powerInit();
    tickInit();
    sei();

    DBG("DBG_MODE");
    tickStart();

    /* Live calibration loop: GSM off, stream vane + pulses to COM port.
     * dbgPutsP/dbgPutU16 each auto-append \r\n, so we can't compose one line
     * from multiple calls. Inline emit char-by-char + small local helpers. */
    while (1) {
        uint8_t  vOn = 0, vOff = 0;
        uint16_t pps = 0;
        sensorLiveSample(&vOn, &vOff, &pps);
        uint16_t battMv  = measureVcc();
        uint16_t solarMv = measureSolar();

        emit_lit(PSTR("ON="));
        for (int8_t i = 7; i >= 0; i--) dbgPutc((vOn & (1 << i)) ? '1' : '0');
        emit_lit(PSTR("  OFF="));
        for (int8_t i = 7; i >= 0; i--) dbgPutc((vOff & (1 << i)) ? '1' : '0');
        emit_lit(PSTR("  dec="));   emit_u16(vOn);
        emit_lit(PSTR("  P="));     emit_u16(pps);
        emit_lit(PSTR("  B="));     emit_u16(battMv);
        emit_lit(PSTR("  S="));     emit_u16(solarMv);
        dbgPutc('\r'); dbgPutc('\n');
    }
    return 0;
}

/* ================================================================
 * Normal operation
 * ================================================================ */
#else

int main(void)
{
    state = smBoot;

    while (1) {
        switch (state) {

        case smBoot:
            dbgInit();
            gsmUartInit();
            windInit();
            powerInit();
            tickInit();
            sei();
            {
                uint8_t mcusr = MCUSR;
                MCUSR = 0;
                DBG("BOOT:"); DBGU(mcusr);
            }
            cycleCount = 0;
            retryCount = 0;
            wdtSystemEnable();
            tickStart();
            state = smGsmInit;
            break;

        case smGsmInit:
            if (!gsmInitNetwork()) {
                retryCount = 0;
                /* Boot directly into live mode for calibration.
                 * Operator turns it off via dashboard (server sends l=0). */
                gsmSetLiveFlag(1);
                state = smLiveLoop;
            } else {
                DBG("INIT_FAIL");
                handleRetry(DELAY_INIT_RETRY_MS, smGsmInit, smError);
            }
            break;

        case smGsmSleep:
            if (gsmSleep())
                DBG("SLP_WARN");
            retryCount = 0;
            tickStop();
            state = smSleepSample;
            break;

        case smSleepSample:
            DBG("SM:SMPL");
            sampleIdx    = 0;
            samplesReady = 0;
            cli(); windPulses = 0; sei();
            wdtSystemDisable();
            {
                uint16_t maxWdt = sensorGetActiveSamples() * sensorGetAvgOver() * WDT_PER_SAMPLE + 20;
                uint16_t wdtTotal = 0;
                while (!samplesReady && wdtTotal < maxWdt) {
                    sleepWdt();
                    takeSample();
                    wdtTotal += WDT_PER_SAMPLE;
                }
            }
            wdtSystemEnable();
            DBG("DATA_RDY:"); DBGU(sampleIdx);
            tickStart();
            state = smGsmWake;
            break;

        case smGsmWake:
            if (!gsmWake())
                state = smSendData;
            else
                handleRetry(DELAY_RETRY_MS, smGsmWake, smGsmHardReset);
            break;

        case smGsmHardReset:
            DBG("GSM:HRST");
            retryCount = 0;
            gsmUartInit();
            setDelay(DELAY_HRST_MS, smGsmInit);
            break;

        case smSendData: {
            uint16_t battMv  = measureVcc();
            uint16_t solarMv = measureSolar();
            uint8_t  csq     = gsmGetCsq();
            DBG("BATT:"); DBGU(battMv);
            DBG("SOL:");  DBGU(solarMv);
            DBG("CSQ:");  DBGU(csq);
            uint16_t httpCode = 0;
            uint8_t  err = gsmHttpPost(cycleCount,
                                       windVane, windSpeed,
                                       sampleIdx, battMv, solarMv, csq,
                                       &httpCode);
            DBG("HTTP:"); DBGU(httpCode);
            if (!err) {
                cycleCount++;
                retryCount = 0;
                /* Server told us to enter live calibration mode -- don't sleep. */
                state = gsmGetLiveFlag() ? smLiveLoop : smGsmSleep;
            } else {
                DBG("POST_FAIL");
                handleRetry(DELAY_RETRY_MS, smSendData, smGsmHardReset);
            }
            break;
        }

        case smLiveLoop: {
            DBG("SM:LIVE");
            if (gsmHttpLiveBegin()) {
                DBG("LIVE_INIT_FAIL");
                gsmHttpLiveEnd();
                state = smGsmSleep;
                break;
            }
            uint8_t liveFails = 0;
            while (gsmGetLiveFlag()) {
                wdt_reset();
                uint8_t  vOn  = 0, vOff = 0;
                uint16_t pps  = 0;
                sensorLiveSample(&vOn, &vOff, &pps);
                uint16_t battMv  = measureVcc();
                uint16_t solarMv = measureSolar();
                uint8_t  csq     = gsmGetCsq();
                uint16_t code    = 0;
                if (gsmHttpLivePost(vOn, vOff, pps, battMv, solarMv, csq, &code)) {
                    DBG("LIVE_POST_FAIL");
                    /* Don't drop live on one hiccup (TX timeout / network blip /
                     * voltage sag) -- re-init the HTTP session and retry in place.
                     * Only give up (-> normal cycle) after LIVE_MAX_FAILS in a row. */
                    if (++liveFails >= LIVE_MAX_FAILS) { DBG("LIVE_GIVEUP"); break; }
                    gsmHttpLiveEnd();
                    if (gsmHttpLiveBegin()) { DBG("LIVE_REINIT_FAIL"); break; }
                    continue;
                }
                liveFails = 0;
                emit_lit(PSTR("ON="));
                for (int8_t i = 7; i >= 0; i--) dbgPutc((vOn & (1 << i)) ? '1' : '0');
                emit_lit(PSTR("  OFF="));
                for (int8_t i = 7; i >= 0; i--) dbgPutc((vOff & (1 << i)) ? '1' : '0');
                emit_lit(PSTR("  dec="));   emit_u16(vOn);
                emit_lit(PSTR("  P="));     emit_u16(pps);
                emit_lit(PSTR("  B="));     emit_u16(battMv);
                emit_lit(PSTR("  S="));     emit_u16(solarMv);
                emit_lit(PSTR("  Sr="));    emit_u16(measureSolarRaw());
                emit_lit(PSTR("  C="));     emit_u16(csq);
                dbgPutc('\r'); dbgPutc('\n');
                /* Inter-post pacing. LIVE_SAMPLE_MS already consumed sample window;
                 * add the remainder up to LIVE_INTERVAL_MS as IDLE sleep. */
                if (LIVE_INTERVAL_MS > LIVE_SAMPLE_MS) {
                    uint16_t s = tickMs();
                    while (!tickElapsed(s, LIVE_INTERVAL_MS - LIVE_SAMPLE_MS)) {
                        wdt_reset();
                        sleepIdle();
                    }
                }
            }
            gsmHttpLiveEnd();
            DBG("LIVE_EXIT");
            state = smGsmSleep;
            break;
        }

        case smError:
            DBG("SM:ERR");
            gsmSleep();
            tickStop();
            state = smBoot;
            break;

        case smDelay:
            if (tickElapsed(delayStart, delayMs))
                state = delayNext;
            else
                sleepIdle();
            break;

        default:
            state = smBoot;
            break;
        }
    }

    return 0;
}

#endif /* DEBUG_SENSOR_ONLY */
