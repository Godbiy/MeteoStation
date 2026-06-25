/**
 * power.h -- power management + Timer1 millisecond counter
 *
 * Power-down (WDT): everything off except WDT and PCINT. ~10 uA.
 *   Used during sample collection.
 * IDLE sleep: CPU halted, UART and Timer1 keep running. ~75 uA @ 1 MHz.
 *   Used during GSM phase while waiting for responses.
 */
#ifndef POWER_H
#define POWER_H

#include "config.h"

/* Power management */
void powerInit(void);
void sleepWdt(void);          /* power-down 2s (WDT wakeup)         */
void sleepIdle(void);         /* IDLE sleep (UART + Timer1 running) */
void wdtSystemEnable(void);   /* 8s system watchdog (reset mode)    */
void wdtSystemDisable(void);
uint16_t measureVcc(void);    /* battery voltage in mV (bandgap)    */
uint16_t measureSolar(void);    /* solar panel voltage in mV (ADC0 via R15/R16 divider) */
uint16_t measureSolarRaw(void); /* raw 10-bit ADC count on ADC0 (debug) */

/* Timer1 millisecond counter (used during GSM phase) */
void     tickInit(void);
void     tickStart(void);
void     tickStop(void);
uint16_t tickMs(void);
uint8_t  tickElapsed(uint16_t start, uint16_t timeoutMs);

#endif /* POWER_H */
