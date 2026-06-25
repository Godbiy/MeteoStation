/**
 * power.c -- low-power modes + Timer1 millisecond counter
 *
 * power-down (WDT): everything off except WDT and PCINT. ~10 uA.
 * IDLE sleep: CPU halted, UART and Timer1 keep running. ~75 uA @ 1 MHz.
 *
 * Timer1 CTC, prescaler 8, OCR1A=124 -> 1ms tick @ 1 MHz.
 * tickElapsed() handles uint16_t wraparound correctly.
 */
#include "power.h"
#include <avr/interrupt.h>
#include <avr/sleep.h>
#include <avr/wdt.h>
#include <util/delay.h>

/* ---- Power-down (WDT 2s) ---- */

static volatile uint8_t wdtFired = 0;

ISR(WDT_vect) { wdtFired = 1; }

void powerInit(void)
{
    ADCSRA &= ~(1 << ADEN);  /* disable ADC */
    PRR = (1 << PRTWI) | (1 << PRTIM2) | (1 << PRTIM0)
        | (1 << PRSPI) | (1 << PRADC);
    /* Timer1 and USART0 stay enabled */
}

void wdtSystemEnable(void)
{
    wdt_reset();
    wdt_enable(WDTO_8S);
}

void wdtSystemDisable(void)
{
    wdt_reset();
    wdt_disable();
}

void sleepWdt(void)
{
    wdtFired = 0;
    wdt_reset();
    WDTCSR = (1 << WDCE) | (1 << WDE);
    WDTCSR = (1 << WDIE) | (1 << WDP2) | (1 << WDP1) | (1 << WDP0);  /* 2s */

    set_sleep_mode(SLEEP_MODE_PWR_DOWN);
    while (!wdtFired) {
        cli();
        if (!wdtFired) { sleep_enable(); sei(); sleep_cpu(); sleep_disable(); }
        else sei();
    }
}

void sleepIdle(void)
{
    wdt_reset();
    set_sleep_mode(SLEEP_MODE_IDLE);
    cli(); sleep_enable(); sei(); sleep_cpu(); sleep_disable();
}

/* ---- Timer1 millisecond counter ---- */

static volatile uint16_t millis = 0;

ISR(TIMER1_COMPA_vect) { millis++; }

void tickInit(void)
{
    TCCR1A = 0;
    TCCR1B = (1 << WGM12);   /* CTC mode, clock stopped */
    OCR1A  = 124;             /* 1ms @ 1MHz, prescaler 8 */
    TCNT1  = 0;
    TIMSK1 = 0;
}

void tickStart(void)
{
    TCNT1  = 0;
    millis = 0;
    TIFR1  = (1 << OCF1A);
    TIMSK1 = (1 << OCIE1A);
    TCCR1B = (1 << WGM12) | (1 << CS11);  /* prescaler 8, start */
}

void tickStop(void)
{
    TCCR1B = (1 << WGM12);  /* CS=000, stop clock */
    TIMSK1 = 0;
}

uint16_t tickMs(void)
{
    uint16_t val;
    cli(); val = millis; sei();
    return val;
}

uint8_t tickElapsed(uint16_t start, uint16_t timeoutMs)
{
    return (uint16_t)(tickMs() - start) >= timeoutMs;
}

/* ---- Battery voltage (bandgap trick) ---- */

uint16_t measureVcc(void)
{
    PRR &= ~(1 << PRADC);              /* ungate ADC clock        */
    ADCSRA = (1 << ADEN)               /* enable ADC              */
           | (1 << ADPS1) | (1 << ADPS0); /* prescaler 8 -> 125kHz @ 1MHz */
    ADMUX  = (1 << REFS0)              /* AVcc as reference       */
           | (1 << MUX3) | (1 << MUX2) | (1 << MUX1); /* MUX=1110 = 1.1V bandgap */

    _delay_ms(2);                       /* bandgap settle          */

    /* 4 conversions: drop first (S/H + reference still settling), average rest */
    uint16_t sum = 0;
    for (uint8_t i = 0; i < 4; i++) {
        ADCSRA |= (1 << ADSC);
        while (ADCSRA & (1 << ADSC));
        if (i > 0) sum += ADC;
    }
    uint16_t adc = sum / 3;
    uint16_t mv  = (uint16_t)(1100UL * 1024 / adc);

    ADCSRA &= ~(1 << ADEN);            /* disable ADC             */
    PRR |= (1 << PRADC);               /* re-gate ADC clock       */

    return mv;
}

/* ---- Solar panel voltage via R15 (39k) / R16 (10k) divider on ADC0/PC0 ----
 * V_ADC = V_solar × 10 / (39+10) = V_solar / 4.9
 * V_solar = V_ADC × 49 / 10
 * Max safe input: ~16V (above that ADC saturates at AVCC).
 * Returns voltage in mV. */
uint16_t measureSolarRaw(void)
{
    PRR &= ~(1 << PRADC);
    ADCSRA = (1 << ADEN) | (1 << ADPS1) | (1 << ADPS0);
    ADMUX  = (1 << REFS0);              /* AVcc ref, MUX=0000 = ADC0/PC0 */

    _delay_ms(5);                        /* analog settle */

    /* 4 conversions, drop first */
    uint16_t sum = 0;
    for (uint8_t i = 0; i < 4; i++) {
        ADCSRA |= (1 << ADSC);
        while (ADCSRA & (1 << ADSC));
        if (i > 0) sum += ADC;
    }
    uint16_t adc = sum / 3;

    ADCSRA &= ~(1 << ADEN);
    PRR |= (1 << PRADC);
    return adc;
}

uint16_t measureSolar(void)
{
    uint16_t adc = measureSolarRaw();
    /* V_ADC_mV = adc × 3300 / 1024 (nominal AVCC=3.3V).
     * V_solar = V_ADC × (R15+R16)/R16 = V_ADC × 49/10. */
    uint32_t v_adc = ((uint32_t)adc * 3300UL) / 1024UL;
    uint32_t v_sol = (v_adc * 49UL) / 10UL;
    return v_sol > 0xFFFF ? 0xFFFF : (uint16_t)v_sol;
}
