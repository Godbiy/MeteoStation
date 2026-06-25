import json, re, sys
with open('documents/PCB_PCB_stacja_one_side_2026-06-19.json', encoding='utf8') as f:
    d = json.load(f)

# For each LIB component, collect (component_name, [(pin, net)])
comps = {}
for s in d['shape']:
    if not s.startswith('LIB'):
        continue
    parts = s.split('#@$')
    head = parts[0]
    m = re.search(r'Manufacturer Part`([^`]+)`', head)
    if not m:
        m = re.search(r'package`([^`]+)`', head)
    name = m.group(1) if m else '?'
    head_parts = head.split('~')
    gge = head_parts[7] if len(head_parts) > 7 else '?'
    pins = []
    for el in parts[1:]:
        if el.startswith('PAD'):
            ep = el.split('~')
            if len(ep) > 8:
                pins.append((ep[8], ep[7]))
    comps.setdefault(name, []).append((gge, pins))

# nets we care about
target_nets = sys.argv[1:] if len(sys.argv) > 1 else ['ADC6', 'ADC7', 'BAT', 'VCC', 'NET_SOLAR_VCC', 'NET_U3', 'MOSFET_1', 'WIND_VANE_10']

for net in target_nets:
    print(f'\n=== net: {net} ===')
    for cname, instances in comps.items():
        for gge, pins in instances:
            for pin_num, pin_net in pins:
                if pin_net == net:
                    print(f'  {cname:25s} pin {pin_num}')
