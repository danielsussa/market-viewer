# Market Viewer (Front-only)

A fully frontend candlestick viewer (no backend required).

## Documentation for bots/AI

- Open **`/help/`** for full instructions on generating URLs with `?payload=...`.
- The help page includes accepted formats, validations, common errors, and examples in JavaScript, Python, and shell.

## Stack

- Vite
- lightweight-charts

## Run locally

```bash
cd /Users/danielkanczuk/Documents/projects/market-viewer
npm install
npm run dev
```

Then open the Vite URL with `?payload=...`.

You can also open `http://localhost:5173/help/` for the complete documentation.

## Accepted payload

Compatible with this format:

```json
{
  "title": "WINJ26",
  "candes": [
    {"o": 4242, "h": 4242, "l": 2424, "c": 3133},
    {"o": 4242, "h": 4242, "l": 2424, "c": 3133}
  ]
}
```

Also accepted:

- `candles` instead of `candes`
- `open/high/low/close` instead of `o/h/l/c`
- optional `time` (unix sec/ms or ISO). If missing, the app uses 1-minute sequential timestamps.
- `objects` (list of overlays to render on the chart)
- `grid` to enable/disable horizontal and vertical grid lines

### Grid (optional)

You can configure grid lines through the payload:

```json
{
  "grid": {
    "vertical": true,
    "horizontal": false
  }
}
```

Supported aliases:
- `grid.vertLines` and `grid.horzLines`
- `gridVertical` and `gridHorizontal` at payload root level

Accepted values: boolean, `1/0`, `true/false`, `yes/no`, `on/off`.

### Objects (overlay)

Supported object structures:

```json
{
  "type": "vertical-line",
  "time": "2026-03-05T13:10:00Z",
  "color": "#ffcc00",
  "width": 2,
  "label": "NY Open",
  "labelColor": "#fff7cc"
}
```

```json
{
  "type": "horizontal-line",
  "price": 131200,
  "color": "#78c8ff",
  "width": 2,
  "label": "Level",
  "labelColor": "#dcf0ff"
}
```

```json
{
  "type": "text",
  "text": "Attention zone",
  "time": "2026-03-05T13:18:00Z",
  "price": 131205,
  "color": "#eef1f8",
  "background": "rgba(11,15,20,0.62)",
  "fontSize": 12,
  "offsetX": 8,
  "offsetY": -14
}
```

```json
{
  "type": "buy-arrow",
  "time": "2026-03-05T13:18:00Z",
  "label": "Buy",
  "color": "#2ed573",
  "size": 1.2
}
```

```json
{
  "type": "sell-arrow",
  "time": "2026-03-05T13:24:00Z",
  "label": "Sell",
  "color": "#ff6b6b",
  "size": 1.2
}
```

Fields:
- `type`: `vertical-line`, `horizontal-line`, `text`, `buy-arrow`, or `sell-arrow`
- `time`: line/marker position (ISO, unix sec, or unix ms)
- `price`: horizontal line price
- `color` (optional): line color
- `width` (optional): line thickness in px
- `label` (optional): top label text
- `labelColor` (optional): label text color

`text`-specific fields:
- `text`: text content
- position can be either:
  - market coordinates: `time` + `price`
  - absolute pixel coordinates: `x` + `y`
- `background` (optional)
- `fontSize` (optional)
- `offsetX` / `offsetY` (optional)

`buy-arrow` / `sell-arrow` specific fields:
- native rendering via lightweight-charts `createSeriesMarkers`
- anchored to candle `time` (does not use exact `price`, nor `x/y`)
- `label` (optional): marker text
- `color` (optional)
- `size` (optional): arrow scale

## URL example

```bash
PAYLOAD=$(jq -nc '{
  title:"WINJ26",
  candes:[
    {o:4242,h:4242,l:2424,c:3133},
    {o:4242,h:4242,l:2424,c:3133}
  ]
}' | base64 | tr -d '\n')

open "http://localhost:5173/?payload=${PAYLOAD}"
```
