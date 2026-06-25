/**
 * dbgUart.c -- soft UART TX on PC1 @ 4800 baud
 */
#include "dbgUart.h"

#if DEBUG_LEVEL >= 1

#include <avr/pgmspace.h>
#include <avr/interrupt.h>
#include <util/delay.h>

void dbgInit(void)
{
    DDRC  |=  (1 << PIN_DBG_TX);
    PORTC |=  (1 << PIN_DBG_TX);  /* idle HIGH */
}

void dbgPutc(uint8_t byte)
{
    cli();

    PORTC &= ~(1 << PIN_DBG_TX);  /* start bit */
    _delay_us(DBG_BIT_US);

    for (uint8_t i = 0; i < 8; i++) {
        if (byte & 1)
            PORTC |=  (1 << PIN_DBG_TX);
        else
            PORTC &= ~(1 << PIN_DBG_TX);
        byte >>= 1;
        _delay_us(DBG_BIT_US);
    }

    PORTC |= (1 << PIN_DBG_TX);   /* stop bit */
    _delay_us(DBG_BIT_US);

    sei();
}

void dbgPuts(const char *str)
{
    while (*str) dbgPutc(*str++);
    dbgPutc('\r');
    dbgPutc('\n');
}

void dbgPutsP(const char *pgmStr)
{
    char c;
    while ((c = pgm_read_byte(pgmStr++))) dbgPutc(c);
    dbgPutc('\r');
    dbgPutc('\n');
}

void dbgPutU16(uint16_t val)
{
    char tmp[6];
    uint8_t i = 0;

    if (val == 0) {
        dbgPutc('0');
        dbgPutc('\r');
        dbgPutc('\n');
        return;
    }

    while (val) {
        tmp[i++] = '0' + (val % 10);
        val /= 10;
    }
    while (i--) dbgPutc(tmp[i]);
    dbgPutc('\r');
    dbgPutc('\n');
}

#endif /* DEBUG_LEVEL >= 1 */
