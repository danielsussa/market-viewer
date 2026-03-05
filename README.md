# Market Viewer (Front-only)

Viewer de candles totalmente em frontend, sem backend.

## Stack

- Vite
- lightweight-charts

## Rodar local

```bash
cd /Users/danielkanczuk/Documents/projects/ewz-wdo-win-bova/market-viewer
npm install
npm run dev
```

Abra no navegador a URL do Vite com `?payload=...`.

## Payload aceito

Compatível com o formato combinado:

```json
{
  "title": "WINJ26",
  "candes": [
    {"o": 4242, "h": 4242, "l": 2424, "c": 3133},
    {"o": 4242, "h": 4242, "l": 2424, "c": 3133}
  ]
}
```

Também aceita:

- `candles` no lugar de `candes`
- `open/high/low/close` no lugar de `o/h/l/c`
- `time` opcional (unix sec/ms ou ISO). Se não vier, usa sequência por minuto.
- `objects` (lista de objetos para sobrepor no chart)

### Objects (overlay)

Estrutura inicial suportada:

```json
{
  "type": "vertical-line",
  "time": "2026-03-05T13:10:00Z",
  "color": "#ffcc00",
  "width": 2,
  "label": "Abertura NY",
  "labelColor": "#fff7cc"
}
```

```json
{
  "type": "horizontal-line",
  "price": 131200,
  "color": "#78c8ff",
  "width": 2,
  "label": "Nível",
  "labelColor": "#dcf0ff"
}
```

```json
{
  "type": "text",
  "text": "Zona de atenção",
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
  "label": "Compra",
  "color": "#2ed573",
  "size": 1.2
}
```

```json
{
  "type": "sell-arrow",
  "time": "2026-03-05T13:24:00Z",
  "label": "Venda",
  "color": "#ff6b6b",
  "size": 1.2
}
```

Campos:
- `type`: `vertical-line`, `horizontal-line`, `text`, `buy-arrow` ou `sell-arrow`
- `time`: posição da linha (ISO, unix sec ou unix ms)
- `price`: preço da linha horizontal
- `color` (opcional): cor da linha
- `width` (opcional): espessura da linha em px
- `label` (opcional): texto no topo da linha
- `labelColor` (opcional): cor do texto do label

Campos específicos do `text`:
- `text`: conteúdo do texto
- posição pode ser:
  - por mercado: `time` + `price`
  - por pixel absoluto: `x` + `y`
- `background` (opcional)
- `fontSize` (opcional)
- `offsetX` / `offsetY` (opcional)

Campos específicos de `buy-arrow` / `sell-arrow`:
- render nativo via lightweight-charts `createSeriesMarkers`
- âncora no candle do `time` (não usa `price` exato, nem `x/y`)
- `label` (opcional): texto do marker
- `color` (opcional)
- `size` (opcional): escala da seta

## Exemplo de URL

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
