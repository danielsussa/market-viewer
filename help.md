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

## 2) Minimum JSON structure

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
- `title` is optional (fallback: `symbol` or `Market Viewer`)
- `candles` and `candes` are both accepted
- OHLC can be `open/high/low/close` or `o/h/l/c`
- `time` is optional (ISO, unix sec, unix ms); if missing, 1-minute sequence is generated

## 3) Overlay objects

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

## 4) Grid options

```json
{
  "grid": {
    "vertical": true,
    "horizontal": false
  }
}
```

Aliases also supported:
- `grid.vertLines`, `grid.horzLines`
- `gridVertical`, `gridHorizontal` at root level

Accepted values: boolean, `1/0`, `true/false`, `yes/no`, `on/off`.

You can also control opacity and line style:

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

Style values: `solid`, `dotted`, `dashed`, `large-dashed`, `sparse-dotted`.

## 5) AI bot recipe

1. Generate valid JSON with candles
2. Validate OHLC per candle (`low <= min(open, close)` and `high >= max(open, close)`)
3. Sort candles by ascending time
4. Serialize compact JSON
5. Encode as base64url
6. Build final URL: `BASE_URL + "?payload=" + encoded`

## 6) JavaScript example

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
const url = `http://localhost:5173/?payload=${b64url}`
console.log(url)
```

## 7) Python example

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
url = f"http://localhost:5173/?payload={b64url}"
print(url)
```

## 8) Shell example

```bash
PAYLOAD=$(jq -nc '{
  title:"WINJ26",
  candles:[
    {time:"2026-03-05T13:10:00Z",open:131150,high:131220,low:131120,close:131205},
    {time:"2026-03-05T13:11:00Z",open:131205,high:131240,low:131180,close:131210}
  ],
  grid:{vertical:true,horizontal:false}
}' | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')

open "http://localhost:5173/?payload=${PAYLOAD}"
```

## 9) Common errors

- `query param "payload" is required` → missing `?payload=...`
- `invalid payload` → invalid encoding
- `payload has no candles/candes array` → missing candles array
- `invalid candle[n] (ohlc/time)` → invalid numbers/time
