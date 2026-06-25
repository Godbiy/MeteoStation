/**
 * sensor.h -- wind vane + anemometer
 */
#ifndef SENSOR_H
#define SENSOR_H

#include "config.h"

extern uint8_t  windVane[SAMPLE_COUNT];   /* direction: 8-bit PORTB snapshot  */
extern uint16_t windSpeed[SAMPLE_COUNT];  /* speed: pulse count per WDT cycle */

extern volatile uint16_t windPulses;      /* anemometer ISR counter           */

extern uint16_t sampleIdx;
extern uint8_t  samplesReady;

void windInit(void);
void takeSample(void);

void     sensorSetAvgOver(uint8_t n);          /* 1..AVG_OVER_MAX, clamped */
uint8_t  sensorGetAvgOver(void);
void     sensorSetActiveSamples(uint16_t n);   /* clamped to ACTIVE_SAMPLES_MIN..MAX */
uint16_t sensorGetActiveSamples(void);

/* Live mode quick snapshot: counts anemometer pulses for LIVE_SAMPLE_MS ms,
 * then snaps vane TWICE (MOSFET ON, then OFF) for calibration diagnostics.
 *   *vaneOnOut     -- PINB with vane MOSFET ON
 *   *vaneOffOut    -- PINB with vane MOSFET OFF (~5ms after turning off)
 *   *pulsesPerSec  -- pulse count scaled to per-second (uint16)
 */
void sensorLiveSample(uint8_t *vaneOnOut, uint8_t *vaneOffOut, uint16_t *pulsesPerSec);

#endif /* SENSOR_H */
