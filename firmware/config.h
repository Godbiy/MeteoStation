/**
 * config.h -- MeteoStation ATmega328P-AU global config
 *
 * Fuses (low-power, BOD off):
 *   Low: 0x62  -- internal RC 8 MHz, CKDIV8 -> 1 MHz
 *   High: 0xD9
 *   Ext:  0xFF -- BOD disabled (~25 uA saved in sleep)
 */
#ifndef CONFIG_H
#define CONFIG_H

#define F_CPU 1000000UL  /* 8 MHz RC / 8 (CKDIV8) */

#include <avr/io.h>
#include <stdint.h>

/* Pin assignments -- do not change without updating PCB */
#define PIN_DBG_TX      PC1   /* soft UART TX for debug          */
#define PIN_VANE_ON     PD3   /* MOSFET -- vane power            */
#define PIN_WIND_SPEED  PD4   /* anemometer pulse input (PCINT20)*/
#define GSM_DTR         PD5   /* GSM DTR -- sleep/wake control   */

/* UART */
#define GSM_BAUD        9600
#define DBG_BAUD        4800
#define DBG_BIT_US      (1000000UL / DBG_BAUD)

/* Mode flags */
#define FAST_TEST_MODE    0   /* 1 = 10 samples ~33s test, 0 = 450 samples ~15 min production */
#define DEBUG_SENSOR_ONLY 0   /* 1 = sensor-only loop, skip GSM */
#define DEBUG_LEVEL       2   /* 0=off, 1=errors/states, 2=full trace */

/* Buffers */
#define RESP_BUF_SIZE   200

#if FAST_TEST_MODE
  #define SAMPLE_COUNT  10    /* fixed test count */
#else
  #define SAMPLE_COUNT  450   /* MAX storage; runtime activeSamples (<=this) controls actual cycle */
#endif
#define ACTIVE_SAMPLES_DEFAULT  30    /* runtime default at boot: 30*2s = 1min cycle */
#define ACTIVE_SAMPLES_MIN      10
#define ACTIVE_SAMPLES_MAX      SAMPLE_COUNT

/* Average AVG_OVER raw reads (2s each) into one stored sample.
 * Runtime-tunable via server response "avg=N" (1..32).
 * Total cycle = SAMPLE_COUNT * AVG_OVER * 2s.
 *   AVG_OVER=1: SAMPLE_COUNT*2s (default, no averaging)
 *   AVG_OVER=2: 2x longer cycle, same RAM
 *   AVG_OVER=32 max */
#define AVG_OVER_DEFAULT      1
#define AVG_OVER_MAX          32

/* Timing */
#define WDT_PER_SAMPLE        1     /* WDT cycles (2s each) per raw read */

/* GSM timeouts (ms) -- tuned for poor signal / 2G fallback */
#define GSM_AT_TIMEOUT        10000  /* was 5000 */
#define GSM_NETOPEN_TIMEOUT   30000  /* was 15000 -- TCP init on slow link */
#define GSM_HTTP_TIMEOUT      90000  /* was 30000 -- HTTP roundtrip on 2G can be 30-60s */
#define GSM_RX_IDLE_MS        50
#define GSM_SLEEP_VERIFY_MS   2000
#define GSM_CREG_POLL_MAX     90     /* x2s = 180s -- cell scan on 2G is slow */
#define GSM_MAX_RETRIES       3

/* State machine delays (ms) -- exponential backoff per retryCount: 5s/15s/45s */
#define DELAY_RETRY_MS        5000   /* base; main.c multiplies for backoff */
#define DELAY_INIT_RETRY_MS   10000
#define DELAY_HRST_MS         3000
#define DELAY_CREG_POLL_MS    2000

/* Server endpoint (HTTPS — A7672E handles TLS via AT+HTTPSSL). */
#define SERVER_URL  "https://stelnet.stelweld.com.pl/petro/MeteoStation/TestKurwa"

/* Payload */
#define PAYLOAD_VERSION       0x04  /* v0x04: adds solar_mv (uint16 LE) after batt_mv */
#define PAYLOAD_VERSION_LIVE  0x11  /* v0x11: adds solar_mv after batt_mv (was 0x10) */

/* Live mode: GSM stays awake, posts current sensor snapshot every LIVE_INTERVAL_MS.
 * Exits when server response contains "l=0". */
#define LIVE_INTERVAL_MS      3000
#define LIVE_SAMPLE_MS        1000  /* count anemometer pulses for this long */
/* A single failed live POST re-inits the HTTP session and retries in place; live
 * mode only drops out (-> normal cycle) after this many CONSECUTIVE failures.
 * Stops one network blip / voltage sag from costing a whole cycle of live data. */
#define LIVE_MAX_FAILS        5

#endif /* CONFIG_H */
