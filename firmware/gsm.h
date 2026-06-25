/**
 * gsm.h -- A7672E: HW UART + AT commands + HTTP POST
 *
 * Sleep/wake via DTR pin (GSM_DTR = PD5):
 *   AT+CSCLK=1 enables DTR control.
 *   DTR HIGH = module may sleep.
 *   DTR LOW  = module active.
 */
#ifndef GSM_H
#define GSM_H

#include "config.h"

void    gsmUartInit(void);
uint8_t gsmInitNetwork(void);
uint8_t gsmSleep(void);
uint8_t gsmWake(void);
uint8_t gsmGetCsq(void);
uint8_t gsmHttpPost(uint16_t cycle,
                    const uint8_t *vane, const uint16_t *speed,
                    uint16_t nSamples,
                    uint16_t battMv, uint16_t solarMv, uint8_t csq,
                    uint16_t *httpCode);

/* Returns liveActive flag in firmware response: 1=keep streaming, 0=exit live mode. */
uint8_t gsmGetLiveFlag(void);
void    gsmSetLiveFlag(uint8_t v);

/* Live streaming. Reuse a single HTTPINIT across many tiny POSTs.
 *   gsmHttpLiveBegin()  -- HTTPINIT + PARA URL + PARA CONTENT (call once)
 *   gsmHttpLivePost(...) -- HTTPDATA + stream 8-byte payload + HTTPACTION + HTTPREAD
 *                           parses "l=N" response, returns 0 on success
 *   gsmHttpLiveEnd()    -- HTTPTERM
 */
uint8_t gsmHttpLiveBegin(void);
uint8_t gsmHttpLivePost(uint8_t vaneOn, uint8_t vaneOff, uint16_t pulsesPerSec,
                        uint16_t battMv, uint16_t solarMv, uint8_t csq,
                        uint16_t *httpCode);
void    gsmHttpLiveEnd(void);

#endif /* GSM_H */
