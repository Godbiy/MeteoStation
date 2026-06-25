"""
PCB viewer: render PCB JSON to HTML+SVG with highlighted pins.

Highlights are passed as CLI args:
  python make_viewer.py "COMPONENT|PIN|COLOR|LABEL" "COMPONENT|PIN|COLOR|LABEL" ...

If no args: default to PC2 source -> PWRK destination plan.
"""
import json, re, sys

JSON_PATH = 'documents/PCB_PCB_stacja_one_side_2026-06-19.json'
OUT_PATH  = 'documents/wire_plan.html'

with open(JSON_PATH, encoding='utf8') as f:
    d = json.load(f)

# Highlights
if len(sys.argv) > 1:
    highlights = []
    for a in sys.argv[1:]:
        parts = a.split('|')
        highlights.append((parts[0], parts[1], parts[2], parts[3]))
else:
    highlights = [
        ('XH-12A',         '7',  '#00ff66', 'SOURCE: XH-12A pin 7 (PC2) -- dupont female here'),
        ('A7672E_MODULE1', '9',  '#ff3030', 'DEST: A7672E pin 9 (PWRK) -- wire other end here'),
        ('A7672E_MODULE1', '10', '#ffaa00', 'BRIDGE: remove this -- it shorts PWRK to GND'),
    ]

# Parse shapes
comps  = []
tracks = []

for s in d['shape']:
    if s.startswith('LIB'):
        parts = s.split('#@$')
        head = parts[0].split('~')
        try:
            x   = float(head[1])
            y   = float(head[2])
            rot = float(head[4]) if head[4] else 0
        except (ValueError, IndexError):
            continue
        meta = head[3]
        m = re.search(r'Manufacturer Part`([^`]+)`', meta)
        if not m:
            m = re.search(r'package`([^`]+)`', meta)
        name = m.group(1) if m else '?'

        pads = []
        for el in parts[1:]:
            if el.startswith('PAD'):
                ep = el.split('~')
                if len(ep) > 8:
                    try:
                        rot_s = ep[11] if len(ep) > 11 else ''
                        try:
                            rot_v = float(rot_s) if rot_s else 0
                        except ValueError:
                            rot_v = 0
                        pads.append({
                            'shape': ep[1],
                            'x': float(ep[2]),
                            'y': float(ep[3]),
                            'w': float(ep[4]),
                            'h': float(ep[5]),
                            'rot': rot_v,
                            'net': ep[7],
                            'num': ep[8],
                        })
                    except (ValueError, IndexError):
                        pass
        comps.append({'name': name, 'x': x, 'y': y, 'rot': rot, 'pads': pads})

    elif s.startswith('TRACK'):
        parts = s.split('~')
        if len(parts) > 4:
            net = parts[3]
            coords = parts[4].split()
            try:
                points = [(float(coords[i]), float(coords[i+1])) for i in range(0, len(coords)-1, 2)]
                if len(points) >= 2:
                    tracks.append({'net': net, 'points': points})
            except (ValueError, IndexError):
                pass

# Bounds from pads + tracks
min_x = min_y =  1e9
max_x = max_y = -1e9
for c in comps:
    for p in c['pads']:
        min_x = min(min_x, p['x']); max_x = max(max_x, p['x'])
        min_y = min(min_y, p['y']); max_y = max(max_y, p['y'])
for t in tracks:
    for x, y in t['points']:
        min_x = min(min_x, x); max_x = max(max_x, x)
        min_y = min(min_y, y); max_y = max(max_y, y)

mx = 8
min_x -= mx; max_x += mx
min_y -= mx; max_y += mx
W = max_x - min_x
H = max_y - min_y

# Find highlight pads
hi_pads = []
for hi_name, hi_num, color, label in highlights:
    matched_comp = False
    matched_pin = False
    for c in comps:
        if c['name'] == hi_name:
            matched_comp = True
            for p in c['pads']:
                if str(p['num']) == str(hi_num):
                    matched_pin = True
                    hi_pads.append({
                        'x': p['x'], 'y': p['y'], 'color': color,
                        'label': label, 'comp': hi_name, 'num': hi_num,
                    })
    if not matched_comp:
        print(f'WARN: component {hi_name!r} not found')
    elif not matched_pin:
        print(f'WARN: pin {hi_num!r} not found in {hi_name!r}')
        # list pins of that component
        for c in comps:
            if c['name'] == hi_name:
                pins = [p['num'] for p in c['pads']]
                print(f'  available pins: {pins}')
                break

# Build SVG
svg = []
svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{min_x:.2f} {min_y:.2f} {W:.2f} {H:.2f}" '
           f'preserveAspectRatio="xMidYMid meet" font-family="monospace">')
svg.append('<rect x="{0}" y="{1}" width="{2}" height="{3}" fill="#0a0a0a"/>'.format(min_x, min_y, W, H))

# Tracks
for t in tracks:
    pts = ' '.join(f'{x:.2f},{y:.2f}' for x, y in t['points'])
    svg.append(f'<polyline points="{pts}" stroke="#444" stroke-width="0.3" fill="none" stroke-linecap="round" stroke-linejoin="round" />')

# Pads
for c in comps:
    for p in c['pads']:
        cx, cy = p['x'], p['y']
        w, h = p['w'], p['h']
        if p['shape'].upper() == 'ELLIPSE' or p['shape'].upper() == 'OVAL':
            svg.append(f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{w/2:.2f}" ry="{h/2:.2f}" fill="#999" />')
        else:
            svg.append(f'<rect x="{cx-w/2:.2f}" y="{cy-h/2:.2f}" width="{w:.2f}" height="{h:.2f}" fill="#999" />')

# Component centers (labels)
for c in comps:
    if c['name'] in ('ATMEGA328P-AU', 'A7672E_MODULE1', 'XH-12A', 'B10B-XH-A(LF)(SN)', 'MPPT_FOOT_PRT', 'AO3400A', 'MMBT3904(RANGE:100-300)'):
        svg.append(f'<text x="{c["x"]:.2f}" y="{c["y"]:.2f}" font-size="1.5" fill="#ff9933" text-anchor="middle" dominant-baseline="middle" font-weight="bold">{c["name"]}</text>')

# Special: annotate XH-12A pins with their AVR net names so user can pick visually
xh_pin_labels = {
    '1': 'GND', '2': 'VCC', '3': 'ADC6', '4': 'AREF', '5': 'ADC7',
    '6': 'PC1*', '7': 'PC2', '8': 'PC3', '9': 'PC4',
    '10': 'PC5', '11': 'PD2', '12': 'PD6*',
}
for c in comps:
    if c['name'] == 'XH-12A':
        for p in c['pads']:
            label = xh_pin_labels.get(p['num'], p['net'])
            color = '#888'
            if label.endswith('*'):       # used (debug TX or IS_ON LED)
                color = '#ff5555'
            elif label in ('GND', 'VCC', 'AREF'):
                color = '#888'
            elif label.startswith(('PC', 'PD', 'AD')):
                color = '#66ff99'         # free GPIO
            svg.append(f'<text x="{p["x"]:.2f}" y="{p["y"]-4:.2f}" font-size="1.4" fill="{color}" '
                       f'text-anchor="middle" font-weight="bold">{p["num"]}:{label}</text>')

# Highlights -- supports markers: ring (default), CUT (red X), ROUTE (dashed line group)
def esc(s): return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def find_pad(comp_name, pin_num):
    for c in comps:
        if c['name'] == comp_name:
            for p in c['pads']:
                if str(p['num']) == str(pin_num):
                    return p
    return None

# Process labels for special markers (CUT: / WIRE:)
for hp in hi_pads:
    label = hp['label']
    if label.startswith('CUT:'):
        # Draw a red X over the pad
        x, y = hp['x'], hp['y']
        svg.append(f'<line x1="{x-4}" y1="{y-4}" x2="{x+4}" y2="{y+4}" stroke="#ff0000" stroke-width="0.8"/>')
        svg.append(f'<line x1="{x-4}" y1="{y+4}" x2="{x+4}" y2="{y-4}" stroke="#ff0000" stroke-width="0.8"/>')
        svg.append(f'<circle cx="{x}" cy="{y}" r="5.5" fill="none" stroke="#ff0000" stroke-width="0.4" stroke-dasharray="0.8,0.4"/>')
    else:
        svg.append(f'<circle cx="{hp["x"]:.2f}" cy="{hp["y"]:.2f}" r="6" fill="none" stroke="{hp["color"]}" stroke-width="0.6" opacity="0.55"/>')
        svg.append(f'<circle cx="{hp["x"]:.2f}" cy="{hp["y"]:.2f}" r="3" fill="none" stroke="{hp["color"]}" stroke-width="1.2"/>')

# Wire routes -- look for pairs of hi_pads with matching ROUTE labels
route_groups = {}
for i, hp in enumerate(hi_pads):
    if hp['label'].startswith('ROUTE:'):
        # format: ROUTE:groupid:description
        parts = hp['label'].split(':', 2)
        if len(parts) >= 2:
            gid = parts[1]
            route_groups.setdefault(gid, []).append(hp)

for gid, pads in route_groups.items():
    if len(pads) >= 2:
        color = pads[0]['color']
        for i in range(len(pads)-1):
            a, b = pads[i], pads[i+1]
            svg.append(f'<line x1="{a["x"]:.2f}" y1="{a["y"]:.2f}" x2="{b["x"]:.2f}" y2="{b["y"]:.2f}" '
                       f'stroke="{color}" stroke-width="0.6" stroke-dasharray="1.5,0.8" opacity="0.9"/>')

svg.append('</svg>')
svg_str = '\n'.join(svg)

# Highlight legend HTML
legend_items = ''
for hp in hi_pads:
    legend_items += (
        f'<div class="hi"><span class="dot" style="background:{hp["color"]}"></span>'
        f'<b>{hp["comp"]} pin {hp["num"]}</b> — {esc(hp["label"])}</div>'
    )

html = f"""<!doctype html>
<html><head>
<meta charset="utf-8">
<title>PCB wire plan</title>
<style>
  html, body {{ margin:0; padding:0; background:#0a0a0a; color:#ddd; font-family:Consolas,monospace; }}
  header {{ padding:10px 20px; background:#1a1a1a; border-bottom:1px solid #333; }}
  header h1 {{ margin:0; font-size:16px; color:#eee; }}
  .panel {{ padding:10px 20px; background:#181818; border-bottom:1px solid #333; }}
  .hi {{ margin:4px 0; font-size:13px; }}
  .dot {{ display:inline-block; width:12px; height:12px; border-radius:50%; vertical-align:middle; margin-right:8px; }}
  .actions {{ margin-top:8px; padding-top:8px; border-top:1px solid #333; color:#ffd000; font-size:13px; }}
  .actions li {{ margin:3px 0; }}
  #stage {{ width:100vw; height:calc(100vh - 200px); overflow:hidden; cursor:grab; }}
  #stage:active {{ cursor:grabbing; }}
  svg {{ display:block; width:100%; height:100%; }}
  .hint {{ color:#888; font-size:11px; margin-top:4px; }}
</style>
</head>
<body>
<header><h1>MeteoStation PCB — wire plan viewer</h1></header>
<div class="panel">
  {legend_items}
  <div class="actions"><b>Plan:</b>
    <ul>
      <li>1) Зняти solder bridge між pin 9 і pin 10 на A7672E (помаранчевий маркер)</li>
      <li>2) Прокинути dupont з XH-12A pin 7 (PC2, зелений) до A7672E pin 9 (PWRK, червоний)</li>
      <li>3) BJT можна не чіпати — поки PD7 LOW він не заважає</li>
    </ul>
  </div>
  <div class="hint">Скрол — zoom · drag — pan</div>
</div>
<div id="stage">
{svg_str}
</div>
<script>
(function(){{
  var stage = document.getElementById('stage');
  var svg   = stage.querySelector('svg');
  var vb    = svg.viewBox.baseVal;
  var x0 = vb.x, y0 = vb.y, w0 = vb.width, h0 = vb.height;
  var x = x0, y = y0, w = w0, h = h0;

  function apply() {{ svg.setAttribute('viewBox', x+' '+y+' '+w+' '+h); }}

  stage.addEventListener('wheel', function(e){{
    e.preventDefault();
    var rect = stage.getBoundingClientRect();
    var px = (e.clientX-rect.left)/rect.width;
    var py = (e.clientY-rect.top)/rect.height;
    var mx = x + w*px;
    var my = y + h*py;
    var k = e.deltaY < 0 ? 0.85 : 1.17;
    w *= k; h *= k;
    x = mx - w*px;
    y = my - h*py;
    apply();
  }}, {{passive:false}});

  var drag = null;
  stage.addEventListener('mousedown', function(e){{ drag={{sx:e.clientX,sy:e.clientY,x0:x,y0:y}}; }});
  window.addEventListener('mouseup', function(){{ drag=null; }});
  window.addEventListener('mousemove', function(e){{
    if (!drag) return;
    var rect = stage.getBoundingClientRect();
    var dx = (e.clientX-drag.sx) * w/rect.width;
    var dy = (e.clientY-drag.sy) * h/rect.height;
    x = drag.x0 - dx; y = drag.y0 - dy;
    apply();
  }});

  // Double-click resets
  stage.addEventListener('dblclick', function(){{
    x=x0; y=y0; w=w0; h=h0; apply();
  }});
}})();
</script>
</body></html>
"""

with open(OUT_PATH, 'w', encoding='utf8') as f:
    f.write(html)

print('Wrote', OUT_PATH)
print(f'Bounds: x [{min_x:.1f}, {max_x:.1f}]  y [{min_y:.1f}, {max_y:.1f}]')
print('Highlights:')
for hp in hi_pads:
    print(f'  {hp["comp"]:30s} pin {hp["num"]:3s}  ({hp["x"]:.1f}, {hp["y"]:.1f})  {hp["label"]}')
