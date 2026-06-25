import json, re, sys

with open('documents/PCB_PCB_stacja_one_side_2026-06-19.json', encoding='utf8') as f:
    d = json.load(f)

for s in d['shape']:
    if not s.startswith('LIB'):
        continue
    if not ('ATMEGA328P-AU' in s or 'A7672E' in s or 'AO3400A' in s or 'MMBT' in s or 'XH-12A' in s):
        continue
    parts = s.split('#@$')
    head = parts[0]
    m = re.search(r'Manufacturer Part`([^`]+)`', head)
    if not m:
        m = re.search(r'package`([^`]+)`', head)
    name = m.group(1) if m else '?'
    print('=== ' + name + ' ===')
    for el in parts[1:]:
        if el.startswith('PAD'):
            ep = el.split('~')
            if len(ep) > 8:
                print('  pin ' + ep[8] + ': ' + ep[7])
        elif el.startswith('TEXT'):
            ep = el.split('~')
            if len(ep) > 10 and ep[2] == 'P':
                # text type P = designator label
                pass
