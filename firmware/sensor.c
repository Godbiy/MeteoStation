/**
 * sensor.c -- wind vane (direction) + anemometer (speed)
 *
 * Vane:  8 digital bits from PB0-PB7 via MOSFET on PD3.
 * Speed: PCINT20 (PD4) counts rising edges during sleep.
 */
#include "sensor.h"
#include <avr/interrupt.h>
#include <util/delay.h>

uint8_t  windVane[SAMPLE_COUNT];
uint16_t windSpeed[SAMPLE_COUNT];

volatile uint16_t windPulses = 0;
uint16_t sampleIdx   = 0;
uint8_t samplesReady = 0;

static uint8_t  avgOver        = AVG_OVER_DEFAULT;
static uint16_t activeSamples  = ACTIVE_SAMPLES_DEFAULT;

void sensorSetAvgOver(uint8_t n)
{
    if (n < 1) n = 1;
    if (n > AVG_OVER_MAX) n = AVG_OVER_MAX;
    avgOver = n;
}
uint8_t sensorGetAvgOver(void) { return avgOver; }

void sensorSetActiveSamples(uint16_t n)
{
    if (n < ACTIVE_SAMPLES_MIN) n = ACTIVE_SAMPLES_MIN;
    if (n > ACTIVE_SAMPLES_MAX) n = ACTIVE_SAMPLES_MAX;
    activeSamples = n;
}
uint16_t sensorGetActiveSamples(void) { return activeSamples; }

ISR(PCINT2_vect)
{
    if (PIND & (1 << PIN_WIND_SPEED))
        windPulses++;
}

void windInit(void)
{
    /* Vane MOSFET -- output, off by default */
    DDRD  |=  (1 << PIN_VANE_ON);
    PORTD &= ~(1 << PIN_VANE_ON);

    /* Vane data -- PB0-PB7 inputs, NO internal pull-up.
     * Board has external 1MΩ pull-up to VCC on each PB pin (per PCB netlist).
     * Vane topology: MOSFET on PD3 pulls common rail (B10B pin 10) to GND;
     * a closed reed shorts a PB pin to that common, so closed = bit 0.
     * Diagnostic in sensorLiveSample reads PINB twice (MOSFET ON vs OFF) to
     * verify the MOSFET actually drives the bits. */
    DDRB  = 0;
    PORTB = 0;

    /* Anemometer -- input with pull-up */
    DDRD  &= ~(1 << PIN_WIND_SPEED);
    PORTD |=  (1 << PIN_WIND_SPEED);

    /* Enable PCINT20 (PD4) */
    PCICR  |= (1 << PCIE2);
    PCMSK2 |= (1 << PCINT20);
}

void sensorLiveSample(uint8_t *vaneOnOut, uint8_t *vaneOffOut, uint16_t *pulsesPerSec)
{
    /* Reset pulse counter, count for LIVE_SAMPLE_MS while MOSFET ON, snap vane,
     * turn MOSFET off, wait, snap again. Diagnostic to see if MOSFET affects bits. */
    cli(); windPulses = 0; sei();

    PORTD |= (1 << PIN_VANE_ON);
    _delay_ms(LIVE_SAMPLE_MS);
    *vaneOnOut = PINB;
    PORTD &= ~(1 << PIN_VANE_ON);
    _delay_ms(20);
    *vaneOffOut = PINB;

    cli();
    uint16_t p = windPulses;
    windPulses = 0;
    sei();

    *pulsesPerSec = (uint16_t)((uint32_t)p * 1000UL / LIVE_SAMPLE_MS);
}

void takeSample(void)
{
    static uint32_t accSpeed = 0;   /* sum of raw pulse counts in AVG_OVER window */
    static uint8_t  accCount = 0;   /* how many raws collected so far */
    static uint8_t  lastVane = 0;   /* latest vane reading -- direction is instantaneous */

    if (sampleIdx >= activeSamples)
        return;

    /* Speed: snapshot pulse count accumulated during sleep */
    cli();
    uint16_t rawSpeed = windPulses;
    windPulses = 0;
    sei();

    /* Vane: power MOSFET, wait for stabilization, read PORTB, power off */
    PORTD |= (1 << PIN_VANE_ON);
    _delay_ms(10);
    lastVane = PINB;
    PORTD &= ~(1 << PIN_VANE_ON);

    accSpeed += rawSpeed;
    accCount++;

    if (accCount >= avgOver) {
        windSpeed[sampleIdx] = (uint16_t)(accSpeed / accCount);
        windVane[sampleIdx]  = lastVane;   /* direction snapshot at end of window */
        sampleIdx++;
        accSpeed = 0;
        accCount = 0;
        if (sampleIdx >= activeSamples)
            samplesReady = 1;
    }
}
