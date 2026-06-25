/**
 * gsm.c -- A7672E: HW UART, AT commands, HTTP POST
 *
 * RX is interrupt-driven: ISR accumulates bytes into respBuf.
 * CPU sleeps in IDLE between RX bytes (UART keeps running).
 * Timeouts via power.h (Timer1 millis).
 *
 * Sleep/wake via DTR pin (GSM_DTR = PD5):
 *   DTR LOW  = module active
 *   DTR HIGH = module sleeps (requires AT+CSCLK=1, set at init)
 */
#include "gsm.h"
#include "dbgUart.h"
#include "power.h"
#include "sensor.h"
#include <avr/pgmspace.h>
#include <avr/interrupt.h>
#include <avr/wdt.h>
#include <string.h>

static char respBuf[RESP_BUF_SIZE];

static const char serverUrl[] PROGMEM = SERVER_URL;

static uint8_t liveFlag = 0;   /* parsed from server response "l=N" */

/* ---- RX state ---- */
static volatile uint8_t rxIdx  = 0;
static volatile uint8_t rxGot  = 0;
static volatile uint8_t rxIdle = 0;

ISR(USART_RX_vect)
{
    char c = UDR0;
    if (rxIdx < RESP_BUF_SIZE - 1) {
        respBuf[rxIdx++] = c;
        respBuf[rxIdx]   = '\0';
    }
    rxGot  = 1;
    rxIdle = 0;
}

static void rxTick(void)
{
    if (rxGot && rxIdx > 0)
        rxIdle++;
}

/* Disable ISR and drain hardware FIFO.
 * Call before sending a command; waitFor resets the buffer. */
static void rxFlush(void)
{
    UCSR0B &= ~(1 << RXCIE0);
    while (UCSR0A & (1 << RXC0)) (void)UDR0;
}

/* Reset buffer, enable ISR, wait for response.
 * matchP=NULL  -- wait for idleMs silence (response complete)
 * matchP=PSTR  -- wait until string appears AND idleMs silence
 * Returns 1 on match within timeoutMs, 0 on timeout.
 * Supports >65s via internal chunking (tick counter is uint16). */
static uint8_t waitFor(const char *matchP, uint8_t idleMs, uint32_t timeoutMs)
{
    rxIdx = 0; rxGot = 0; rxIdle = 0; respBuf[0] = '\0';
    UCSR0B |= (1 << RXCIE0);

    uint32_t remaining = timeoutMs;
    while (remaining > 0) {
        uint16_t chunk = (remaining > 60000UL) ? 60000 : (uint16_t)remaining;
        uint16_t start = tickMs();
        while (!tickElapsed(start, chunk)) {
            wdt_reset();
            sleepIdle();
            rxTick();
            if (rxGot && rxIdle >= idleMs) {
                if (!matchP || strstr_P(respBuf, matchP)) {
                    UCSR0B &= ~(1 << RXCIE0);
                    return 1;
                }
            }
        }
        remaining -= chunk;
    }
    UCSR0B &= ~(1 << RXCIE0);
    return 0;
}

/* ---- UART TX ---- */

void gsmUartInit(void)
{
    UCSR0A |= (1 << U2X0);
    uint16_t ubrr = (F_CPU / 8 / GSM_BAUD) - 1;
    UBRR0H = ubrr >> 8;
    UBRR0L = ubrr;
    UCSR0B = (1 << RXEN0) | (1 << TXEN0);
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00); /* 8N1 */

    /* DTR LOW = module active from the start */
    DDRD  |=  (1 << GSM_DTR);
    PORTD &= ~(1 << GSM_DTR);
}

static void gsmTx(char c)
{
    while (!(UCSR0A & (1 << UDRE0)));
    UDR0 = c;
}

static void gsmPrintP(const char *pgmStr)
{
    char c;
    while ((c = pgm_read_byte(pgmStr++))) gsmTx(c);
}

static void txU16(uint16_t v)
{
    char tmp[6];
    uint8_t n = 0;
    if (v == 0) { gsmTx('0'); return; }
    while (v) { tmp[n++] = '0' + (v % 10); v /= 10; }
    while (n--) gsmTx(tmp[n]);
}

/* CRC-8 Dallas/Maxim: reflected poly 0x8C, init 0x00, no final XOR */
static uint8_t crc8Update(uint8_t crc, uint8_t b)
{
    crc ^= b;
    for (uint8_t i = 0; i < 8; i++)
        crc = (crc & 1) ? (crc >> 1) ^ 0x8C : (crc >> 1);
    return crc;
}

/* Send AT command from PROGMEM, wait for "OK".
 * DBG2P before TX: soft-UART cli() must not block incoming RX echo. */
static uint8_t gsmAt(const char *cmdP, uint32_t timeoutMs)
{
    rxFlush();
    DBG2P(cmdP);
    gsmPrintP(cmdP);
    gsmPrintP(PSTR("\r\n"));
    if (!waitFor(PSTR("OK"), 10, timeoutMs))
        return 1;
    DBG2S(respBuf);
    return 0;
}

/* Poll AT+CREG? until registered (1=home, 5=roaming). 0 = registered, 1 = timeout.
 * Shared by init and wake — a long sleep can drop the registration. */
static uint8_t gsmWaitRegistered(void)
{
    for (uint8_t i = 0; i < GSM_CREG_POLL_MAX; i++) {
        rxFlush();
        gsmPrintP(PSTR("AT+CREG?\r\n"));
        if (waitFor(NULL, GSM_RX_IDLE_MS, GSM_AT_TIMEOUT)) {
            DBG2S(respBuf);
            char *p = strstr(respBuf, "+CREG:");
            if (p && (p = strchr(p, ',')) && (p[1] == '1' || p[1] == '5'))
                return 0;
        }
        uint16_t d = tickMs();
        while (!tickElapsed(d, DELAY_CREG_POLL_MS)) sleepIdle();
    }
    return 1;
}

/* ---- Network init ---- */

uint8_t gsmInitNetwork(void)
{
    DBG("GSM:INIT");

    if (gsmAt(PSTR("AT"), GSM_AT_TIMEOUT))
        return 1;

    /* Force RF on (might be CFUN=4 from previous session NV) */
    gsmAt(PSTR("AT+CFUN=1"), 10000);

    /* Force auto operator selection -- triggers cell search */
    gsmAt(PSTR("AT+COPS=0"), 10000);

    /* Log signal quality so we can diagnose poor reception */
    rxFlush();
    gsmPrintP(PSTR("AT+CSQ\r\n"));
    if (waitFor(PSTR("+CSQ:"), 10, GSM_AT_TIMEOUT)) {
        DBG2S(respBuf);
    }

    /* Enable DTR sleep control, keep DTR LOW (module active) */
    gsmAt(PSTR("AT+CSCLK=1"), GSM_AT_TIMEOUT);
    DDRD  |=  (1 << GSM_DTR);
    PORTD &= ~(1 << GSM_DTR);

    if (gsmWaitRegistered())
        return 1;
    DBG("CREG:OK");
    gsmAt(PSTR("AT+CGDCONT=1,\"IP\",\"internet\""), GSM_AT_TIMEOUT);

    /* AT+NETOPEN: OK = success, "already" in response = already open */
    rxFlush();
    gsmPrintP(PSTR("AT+NETOPEN\r\n"));
    if (!waitFor(NULL, GSM_RX_IDLE_MS, GSM_NETOPEN_TIMEOUT))
        return 1;
    DBG2S(respBuf);
    if (!strstr(respBuf, "OK") && !strstr(respBuf, "lready"))
        return 1;

    DBG("GSM:OK");
    return 0;
}

/* ---- Sleep / Wake ---- */

uint8_t gsmSleep(void)
{
    DBG("GSM:SLP");

    /* Flight mode: RF off, keeps SIM context for fast re-attach on wake.
     * Drops modem current from ~30 mA to ~5-7 mA (per datasheet + measurement). */
    gsmAt(PSTR("AT+CFUN=4"), 8000);

    /* Enable DTR sleep control every time (context may be lost after reset) */
    gsmAt(PSTR("AT+CSCLK=1"), GSM_AT_TIMEOUT);

    /* DTR HIGH -> module sleeps */
    DDRD  |=  (1 << GSM_DTR);
    PORTD |=  (1 << GSM_DTR);

    uint16_t d = tickMs();
    while (!tickElapsed(d, 1000)) sleepIdle();

    /* Verify: sleeping module will not respond to AT within GSM_SLEEP_VERIFY_MS */
    rxFlush();
    gsmPrintP(PSTR("AT\r\n"));
    if (waitFor(PSTR("OK"), 10, GSM_SLEEP_VERIFY_MS)) {
        DBG("SLP_FAIL");
        return 1;
    }

    DBG("GSM:ZZZ");
    return 0;
}

uint8_t gsmWake(void)
{
    DBG("GSM:WAKE");

    /* Assert DTR LOW -- with CSCLK=1 still active, keep it LOW until CSCLK=0 confirmed */
    DDRD  |=  (1 << GSM_DTR);
    PORTD &= ~(1 << GSM_DTR);

    uint16_t d = tickMs();
    while (!tickElapsed(d, 1000)) sleepIdle();

    for (uint8_t i = 0; i < 3; i++) {
        if (!gsmAt(PSTR("AT"), GSM_AT_TIMEOUT)) {
            /* Disable slow-clock mode -- DTR now has no effect on sleep */
            gsmAt(PSTR("AT+CSCLK=0"), GSM_AT_TIMEOUT);

            /* RF back on (was AT+CFUN=4 during sleep). Modem re-attaches. */
            gsmAt(PSTR("AT+CFUN=1"), 10000);

            /* Force auto operator selection -- triggers cell search after CFUN cycle */
            gsmAt(PSTR("AT+COPS=0"), 10000);

            /* A long sleep can drop registration (+CGEV: ME DETACH); wait for it
             * before HTTP, else the POST hits an unregistered modem and fails. */
            if (gsmWaitRegistered()) { DBG("WAKE_CREG:FAIL"); return 1; }
            DBG("WAKE_CREG:OK");
            DBG("GSM:AWAKE");
            return 0;
        }
        d = tickMs();
        while (!tickElapsed(d, 500)) sleepIdle();
    }

    return 1;
}

/* ---- Signal quality ---- */

uint8_t gsmGetCsq(void)
{
    rxFlush();
    gsmPrintP(PSTR("AT+CSQ\r\n"));
    if (!waitFor(PSTR("+CSQ:"), 10, GSM_AT_TIMEOUT))
        return 99;

    char *p = strstr(respBuf, "+CSQ:");
    if (!p) return 99;
    p += 5;
    while (*p == ' ') p++;
    uint8_t csq = 0;
    while (*p >= '0' && *p <= '9')
        csq = csq * 10 + (*p++ - '0');
    return csq;
}

/* ---- HTTP POST ---- */

uint8_t gsmHttpPost(uint16_t cycle,
                    const uint8_t *vane, const uint16_t *speed,
                    uint16_t nSamples,
                    uint16_t battMv, uint16_t solarMv, uint8_t csq,
                    uint16_t *httpCode)
{
    DBG("HTTP:POST");
    *httpCode = 0;

    gsmAt(PSTR("AT+HTTPTERM"), 3000);

    if (gsmAt(PSTR("AT+HTTPINIT"), GSM_AT_TIMEOUT))
        return 1;

    rxFlush();
    gsmPrintP(PSTR("AT+HTTPPARA=\"URL\",\""));
    gsmPrintP(serverUrl);
    gsmPrintP(PSTR("\"\r\n"));
    if (!waitFor(NULL, GSM_RX_IDLE_MS, GSM_AT_TIMEOUT) || !strstr(respBuf, "OK"))
        goto http_fail;

    if (gsmAt(PSTR("AT+HTTPPARA=\"CONTENT\",\"application/octet-stream\""), GSM_AT_TIMEOUT))
        goto http_fail;

    rxFlush();
    gsmPrintP(PSTR("AT+HTTPDATA="));
    txU16(11 + 3 * nSamples);   /* v0x04: header now 11 bytes (added solar_mv) */
    gsmPrintP(PSTR(",10000\r\n"));
    if (!waitFor(PSTR("DOWNLOAD"), 10, 5000))
        goto http_fail;

    /* v0x04 payload: ver(1) cycle(2) N(2) batt(2) solar(2) csq(1) vane[N] speed[2N] crc(1) */
    {
        uint8_t crc = 0;
        #define TX_CRC(b) do { uint8_t _b=(b); gsmTx(_b); crc=crc8Update(crc,_b); } while(0)

        TX_CRC(PAYLOAD_VERSION);
        TX_CRC(cycle & 0xFF);     TX_CRC(cycle >> 8);
        TX_CRC(nSamples & 0xFF);  TX_CRC(nSamples >> 8);
        TX_CRC(battMv & 0xFF);    TX_CRC(battMv >> 8);
        TX_CRC(solarMv & 0xFF);   TX_CRC(solarMv >> 8);
        TX_CRC(csq);
        for (uint16_t i = 0; i < nSamples; i++) TX_CRC(vane[i]);
        for (uint16_t i = 0; i < nSamples; i++) {
            TX_CRC(speed[i] & 0xFF);
            TX_CRC(speed[i] >> 8);
        }
        gsmTx(crc);

        #undef TX_CRC
    }

    /* Wait for OK after binary upload, then send HTTPACTION */
    waitFor(NULL, GSM_RX_IDLE_MS, GSM_AT_TIMEOUT);

    rxFlush();
    gsmPrintP(PSTR("AT+HTTPACTION=1\r\n"));
    if (!waitFor(PSTR("+HTTPACTION:"), 10, GSM_HTTP_TIMEOUT))
        goto http_fail;

    {
        char *p = strstr(respBuf, "+HTTPACTION:");
        if (p) {
            p = strchr(p, ',');
            if (p++) {
                uint16_t code = 0;
                while (*p >= '0' && *p <= '9')
                    code = code * 10 + (*p++ - '0');
                *httpCode = code;
            }
        }
    }

    DBG("HTTP:"); DBGU(*httpCode);

    /* Read response body to look for server config: "ok avg=N n=N" */
    if (*httpCode == 200) {
        rxFlush();
        gsmPrintP(PSTR("AT+HTTPREAD=0,64\r\n"));
        if (waitFor(NULL, GSM_RX_IDLE_MS, 3000)) {
            DBG2S(respBuf);
            char *p = strstr(respBuf, "avg=");
            if (p) {
                uint8_t n = 0;
                p += 4;
                while (*p >= '0' && *p <= '9')
                    n = n * 10 + (*p++ - '0');
                if (n >= 1) {
                    sensorSetAvgOver(n);
                    DBG("AVG:"); DBGU(n);
                }
            }
            p = strstr(respBuf, "n=");
            if (p) {
                uint16_t s = 0;
                p += 2;
                while (*p >= '0' && *p <= '9')
                    s = s * 10 + (*p++ - '0');
                if (s >= ACTIVE_SAMPLES_MIN) {
                    sensorSetActiveSamples(s);
                    DBG("N:"); DBGU(s);
                }
            }
            p = strstr(respBuf, "l=");
            if (p) {
                p += 2;
                liveFlag = (*p == '1') ? 1 : 0;
                DBG("LIVE:"); DBGU(liveFlag);
            }
        }
    }

    gsmAt(PSTR("AT+HTTPTERM"), 3000);
    return (*httpCode == 200) ? 0 : 1;

http_fail:
    gsmAt(PSTR("AT+HTTPTERM"), 3000);
    return 1;
}

uint8_t gsmGetLiveFlag(void)        { return liveFlag; }
void    gsmSetLiveFlag(uint8_t v)   { liveFlag = v ? 1 : 0; }

/* ---- Live streaming HTTP ---- */

uint8_t gsmHttpLiveBegin(void)
{
    gsmAt(PSTR("AT+HTTPTERM"), 3000);
    if (gsmAt(PSTR("AT+HTTPINIT"), GSM_AT_TIMEOUT))
        return 1;

    rxFlush();
    gsmPrintP(PSTR("AT+HTTPPARA=\"URL\",\""));
    gsmPrintP(serverUrl);
    gsmPrintP(PSTR("\"\r\n"));
    if (!waitFor(NULL, GSM_RX_IDLE_MS, GSM_AT_TIMEOUT) || !strstr(respBuf, "OK"))
        return 1;

    if (gsmAt(PSTR("AT+HTTPPARA=\"CONTENT\",\"application/octet-stream\""), GSM_AT_TIMEOUT))
        return 1;
    return 0;
}

void gsmHttpLiveEnd(void)
{
    gsmAt(PSTR("AT+HTTPTERM"), 3000);
}

uint8_t gsmHttpLivePost(uint8_t vaneOn, uint8_t vaneOff, uint16_t pulsesPerSec,
                        uint16_t battMv, uint16_t solarMv, uint8_t csq,
                        uint16_t *httpCode)
{
    *httpCode = 0;

    rxFlush();
    gsmPrintP(PSTR("AT+HTTPDATA=11,5000\r\n"));
    if (!waitFor(PSTR("DOWNLOAD"), 10, 5000))
        return 1;

    /* Stream 11-byte live payload + CRC-8 Dallas/Maxim.
     * v(0x11), vaneOn(1), vaneOff(1), pulses(2), batt(2), solar(2), csq(1), crc(1) = 11 bytes. */
    {
        uint8_t crc = 0;
        #define TX_CRC(b) do { uint8_t _b=(b); gsmTx(_b); crc=crc8Update(crc,_b); } while(0)
        TX_CRC(PAYLOAD_VERSION_LIVE);
        TX_CRC(vaneOn);
        TX_CRC(vaneOff);
        TX_CRC(pulsesPerSec & 0xFF); TX_CRC(pulsesPerSec >> 8);
        TX_CRC(battMv & 0xFF);       TX_CRC(battMv >> 8);
        TX_CRC(solarMv & 0xFF);      TX_CRC(solarMv >> 8);
        TX_CRC(csq);
        gsmTx(crc);
        #undef TX_CRC
    }
    waitFor(NULL, GSM_RX_IDLE_MS, GSM_AT_TIMEOUT);

    rxFlush();
    gsmPrintP(PSTR("AT+HTTPACTION=1\r\n"));
    if (!waitFor(PSTR("+HTTPACTION:"), 10, 30000))
        return 1;

    char *p = strstr(respBuf, "+HTTPACTION:");
    if (p && (p = strchr(p, ','))) {
        uint16_t code = 0; p++;
        while (*p >= '0' && *p <= '9') code = code * 10 + (*p++ - '0');
        *httpCode = code;
    }
    if (*httpCode != 200) return 1;

    /* Parse "ok l=N" response */
    rxFlush();
    gsmPrintP(PSTR("AT+HTTPREAD=0,16\r\n"));
    if (waitFor(NULL, GSM_RX_IDLE_MS, 3000)) {
        char *q = strstr(respBuf, "l=");
        if (q) {
            q += 2;
            liveFlag = (*q == '1') ? 1 : 0;
        }
    }
    return 0;
}
