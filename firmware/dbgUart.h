/**
 * dbgUart.h -- soft UART TX on PC1 for debug output
 *
 * DEBUG_LEVEL 0: all macros expand to nothing (zero overhead)
 * DEBUG_LEVEL 1+: real functions
 */
#ifndef DBG_UART_H
#define DBG_UART_H

#include "config.h"

#if DEBUG_LEVEL >= 1
void dbgInit(void);
void dbgPutc(uint8_t byte);
void dbgPuts(const char *str);
void dbgPutsP(const char *pgmStr);
void dbgPutU16(uint16_t val);
#else
#define dbgInit()      ((void)0)
#define dbgPutc(b)     ((void)0)
#define dbgPuts(s)     ((void)0)
#define dbgPutsP(s)    ((void)0)
#define dbgPutU16(v)   ((void)0)
#endif

/* Use these macros instead of #if DEBUG_LEVEL blocks in code */
#if DEBUG_LEVEL >= 1
#define DBG(msg)    dbgPutsP(PSTR(msg))
#define DBGU(val)   dbgPutU16(val)
#else
#define DBG(msg)    ((void)0)
#define DBGU(val)   ((void)0)
#endif

#if DEBUG_LEVEL >= 2
#define DBG2(msg)    dbgPutsP(PSTR(msg))
#define DBG2P(ptr)   dbgPutsP(ptr)       /* already a PROGMEM pointer */
#define DBG2S(str)   dbgPuts(str)        /* RAM string (e.g. respBuf) */
#else
#define DBG2(msg)    ((void)0)
#define DBG2P(ptr)   ((void)0)
#define DBG2S(str)   ((void)0)
#endif

#endif /* DBG_UART_H */
