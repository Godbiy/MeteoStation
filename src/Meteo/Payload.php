<?php
namespace Meteo;

/* Binary payload decoding + CRC-8. Pure functions, no state.
 * Wire format matches firmware gsm.c (see CLAUDE.md "Binary Payload Format"). */
final class Payload
{
    /* Regular batch POST: v0x03 (no solar) / v0x04 (+solar). 11+3N bytes (v4). */
    public static function decode(string $raw): ?array
    {
        $len = strlen($raw);
        if ($len < 10) return null;

        $expected = ord($raw[$len - 1]);
        if (self::crc8($raw, $len - 1) !== $expected) return null;

        $pos = 0;
        $version = ord($raw[$pos++]);
        if ($version !== 0x03 && $version !== 0x04) return null;

        $cycle   = unpack('v', $raw, $pos)[1]; $pos += 2;
        $n       = unpack('v', $raw, $pos)[1]; $pos += 2;
        $battMv  = unpack('v', $raw, $pos)[1]; $pos += 2;
        $solarMv = null;
        if ($version === 0x04) { $solarMv = unpack('v', $raw, $pos)[1]; $pos += 2; }
        $csq = ord($raw[$pos++]);

        $expectedLen = ($version === 0x04 ? 11 : 9) + 3 * $n;
        if ($len !== $expectedLen) return null;

        $vane = [];
        for ($i = 0; $i < $n; $i++) $vane[] = ord($raw[$pos++]);
        $speed = [];
        for ($i = 0; $i < $n; $i++) { $speed[] = unpack('v', $raw, $pos)[1]; $pos += 2; }

        return [
            'version'  => $version,
            'cycle'    => $cycle,
            'samples'  => $n,
            'batt_mv'  => $battMv,
            'batt_v'   => sprintf('%.2f', $battMv / 1000.0),
            'solar_mv' => $solarMv,
            'solar_v'  => $solarMv !== null ? sprintf('%.2f', $solarMv / 1000.0) : null,
            'csq'      => $csq,
            'vane'     => $vane,
            'speed'    => $speed,
        ];
    }

    /* Live-mode single sample: v0x10 (9 bytes) / v0x11 (11 bytes, +solar). */
    public static function decodeLive(string $raw): ?array
    {
        $len = strlen($raw);
        $ver = ord($raw[0]);
        if ($ver === 0x10 && $len === 9) {
            if (self::crc8($raw, 8) !== ord($raw[8])) return null;
            return [
                'vane_on'    => ord($raw[1]),
                'vane_off'   => ord($raw[2]),
                'vane'       => ord($raw[1]),
                'pulses_sec' => unpack('v', substr($raw, 3, 2))[1],
                'batt_mv'    => unpack('v', substr($raw, 5, 2))[1],
                'solar_mv'   => null,
                'csq'        => ord($raw[7]),
            ];
        }
        if ($ver === 0x11 && $len === 11) {
            if (self::crc8($raw, 10) !== ord($raw[10])) return null;
            return [
                'vane_on'    => ord($raw[1]),
                'vane_off'   => ord($raw[2]),
                'vane'       => ord($raw[1]),
                'pulses_sec' => unpack('v', substr($raw, 3, 2))[1],
                'batt_mv'    => unpack('v', substr($raw, 5, 2))[1],
                'solar_mv'   => unpack('v', substr($raw, 7, 2))[1],
                'csq'        => ord($raw[9]),
            ];
        }
        return null;
    }

    /* CRC-8 Dallas/Maxim (1-Wire). Reflected poly 0x8C, init 0, no final XOR.
     * Same algorithm as firmware gsm.c crc8Update(). */
    public static function crc8(string $buf, int $len): int
    {
        $crc = 0;
        for ($i = 0; $i < $len; $i++) {
            $crc ^= ord($buf[$i]);
            for ($j = 0; $j < 8; $j++) {
                $crc = ($crc & 1) ? (($crc >> 1) ^ 0x8C) : ($crc >> 1);
            }
        }
        return $crc & 0xFF;
    }
}
