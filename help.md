# Market Viewer Help

This guide explains how to generate a Market Viewer URL using `?payload=...`.

## 1) URL format

```text
https://YOUR_DOMAIN/?payload=ENCODED_PAYLOAD
```

GitHub Pages DNS for this project:

```text
https://danielsussa.github.io/market-viewer/
```

Accepted payload encodings:
- raw JSON
- URL encoded JSON
- base64
- base64url (recommended)

## 2) Minimum JSON structure (root payload fields)

```json
{
  "title": "WINJ26",
  "candles": [
    { "time": "2026-03-05T13:10:00Z", "open": 131150, "high": 131220, "low": 131120, "close": 131205 },
    { "time": "2026-03-05T13:11:00Z", "open": 131205, "high": 131240, "low": 131180, "close": 131210 }
  ]
}
```

Notes:
- `title` is optional (fallback: `symbol`, then `Market Viewer`)
- `symbol` can be used as title fallback
- `subtitle` is optional (default empty string)
- `candles` and `candes` are both accepted (`candles` is preferred)
- OHLC can be `open/high/low/close` or `o/h/l/c`
- `time` supports ISO date string, unix seconds, or unix milliseconds (number or numeric string)
- `time` is optional; when missing, a 1-minute sequence is generated from `now - candles.length * 60s`
- candles are sorted by ascending `time` before rendering
- OHLC validation per candle:
  - `low <= high`
  - `high >= max(open, close)`
  - `low <= min(open, close)`

## 3) Export via query string

Supported URL params (in addition to `payload`):
- `export=png|jpg|jpeg` (`jpeg` is normalized to `jpg`)
- `download=1|0|true|false|yes|no|on|off` (default: `true`)
- `filename=...` (optional; sanitized and extension is always appended)
- `quality=0..1` (JPG only, default `0.92`, clamped to `0..1`)
- `exportDelay=ms` (default `120`, min `0`)

Example:

```text
https://YOUR_DOMAIN/?payload=ENCODED_PAYLOAD&export=png&download=1&filename=snapshot
```

Export behavior:
- invalid `export` throws: `invalid export format: use export=png or export=jpg`
- if `download=false`, no file is downloaded, but `window.__MARKET_VIEWER_EXPORT__` is still filled
- default filename: `<title-or-market-viewer>-<timestamp>.<ext>`

## 4) Overlay objects

Supported `objects[].type`:
- `vertical-line`
- `horizontal-line`
- `text`
- `buy-arrow`
- `sell-arrow`

Example:

```json
{
  "objects": [
    { "type": "vertical-line", "time": "2026-03-05T13:10:00Z", "label": "NY Open", "color": "#ffcc00" },
    { "type": "horizontal-line", "price": 131200, "label": "Level", "color": "#78c8ff" },
    { "type": "text", "text": "Attention zone", "time": "2026-03-05T13:18:00Z", "price": 131205 },
    { "type": "buy-arrow", "time": "2026-03-05T13:18:00Z", "label": "Buy" },
    { "type": "sell-arrow", "time": "2026-03-05T13:24:00Z", "label": "Sell" }
  ]
}
```

Fields by object type:
- `vertical-line`: `time`, `color`, `width`, `label`, `labelColor`
- `horizontal-line`: `price`, `color`, `width`, `label`, `labelColor`
- `text`:
  - required: `text`
  - position: `time + price` or raw pixel `x + y`
  - optional: `offsetX`, `offsetY`, `color`, `background`, `fontSize`
- `buy-arrow` / `sell-arrow`: `time`, `label`, `color`, `size`

## 5) Grid options (full)

```json
{
  "grid": {
    "vertical": true,
    "horizontal": false
  }
}
```

Visibility aliases supported:
- `grid.vertical`, `grid.horizontal`
- `grid.vertLines`, `grid.horzLines`
- `gridVertical`, `gridHorizontal` at root level

Accepted values: boolean, `1/0`, `true/false`, `yes/no`, `on/off`.

Color fields:
- global: `grid.color`
- vertical: `grid.verticalColor` or `grid.vertColor`
- horizontal: `grid.horizontalColor` or `grid.horzColor`

Opacity fields:
- global: `grid.opacity`
- vertical: `grid.verticalOpacity`
- horizontal: `grid.horizontalOpacity`

Style fields:
- global: `grid.style`
- vertical: `grid.verticalStyle`
- horizontal: `grid.horizontalStyle`

Dashed compatibility fields:
- global: `grid.dashed`
- vertical: `grid.verticalDashed`
- horizontal: `grid.horizontalDashed`

Style values accepted:
- text: `solid`, `dotted`, `dashed`, `large-dashed`, `sparse-dotted`
- numeric: `0..4` (Lightweight Charts `LineStyle`)

Defaults:
- grid is invisible by default (`vertical=false`, `horizontal=false`)
- default base color: `#2b3a4a`
- default opacity per axis: `0.24`
- style fallback: `solid`

You can combine visibility, color, opacity, and style:

```json
{
  "grid": {
    "vertical": true,
    "horizontal": true,
    "opacity": 0.2,
    "verticalOpacity": 0.35,
    "horizontalOpacity": 0.15,
    "style": "dashed",
    "verticalStyle": "dotted",
    "horizontalStyle": "solid"
  }
}
```

## 6) AI bot recipe

1. Generate valid JSON with candles
2. Validate OHLC per candle (`low <= min(open, close)` and `high >= max(open, close)`)
3. Sort candles by ascending time
4. Serialize compact JSON
5. Encode as base64url
6. Build final URL: `BASE_URL + "?payload=" + encoded`

## 7) JavaScript example

```js
const payload = {
  title: "WINJ26",
  candles: [
    { time: "2026-03-05T13:10:00Z", open: 131150, high: 131220, low: 131120, close: 131205 },
    { time: "2026-03-05T13:11:00Z", open: 131205, high: 131240, low: 131180, close: 131210 }
  ],
  grid: { vertical: true, horizontal: true },
  objects: [
    { type: "buy-arrow", time: "2026-03-05T13:11:00Z", label: "Entry" }
  ]
}

const json = JSON.stringify(payload)
const b64url = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
const url = `https://danielsussa.github.io/market-viewer/?payload=${b64url}`
console.log(url)
```

## 8) Python example

```python
import json, base64

payload = {
  "title": "WINJ26",
  "candles": [
    {"time": "2026-03-05T13:10:00Z", "open": 131150, "high": 131220, "low": 131120, "close": 131205},
    {"time": "2026-03-05T13:11:00Z", "open": 131205, "high": 131240, "low": 131180, "close": 131210}
  ],
  "grid": {"vertical": True, "horizontal": False}
}

raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
b64url = base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")
url = f"https://danielsussa.github.io/market-viewer/?payload={b64url}"
print(url)
```

## 9) Shell example

```bash
PAYLOAD=$(jq -nc '{
  title:"WINJ26",
  candles:[
    {time:"2026-03-05T13:10:00Z",open:131150,high:131220,low:131120,close:131205},
    {time:"2026-03-05T13:11:00Z",open:131205,high:131240,low:131180,close:131210}
  ],
  grid:{vertical:true,horizontal:false}
}' | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')

open "https://danielsussa.github.io/market-viewer/?payload=${PAYLOAD}"
```

## 10) Common errors

- `query param "payload" is required` → missing `?payload=...`
- `invalid payload` → invalid encoding
- `payload has no candles/candes array` → missing candles array
- `invalid candle[n] (ohlc/time)` → invalid numbers/time
- `candle[n] has invalid OHLC relationship` → inconsistent OHLC values
