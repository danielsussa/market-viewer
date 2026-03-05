import './style.css'
import { CandlestickSeries, createChart, createSeriesMarkers } from 'lightweight-charts'

if (window.location.pathname.endsWith('/help')) {
  const target = `${window.location.pathname}/${window.location.search}${window.location.hash}`
  window.location.replace(target)
}

const chartEl = document.getElementById('chart')
const objectsLayerEl = document.getElementById('objectsLayer')
const errorEl = document.getElementById('error')
const titleEl = document.getElementById('title')
const subtitleEl = document.getElementById('subtitle')
const themeToggleEl = document.getElementById('themeToggle')

const THEME_KEY = 'market-viewer-theme'
const THEMES = {
  dark: {
    chartLayoutBg: '#0b0f14',
    chartText: '#b8c7da',
    crosshair: 'rgba(184, 199, 218, 0.18)',
  },
  light: {
    chartLayoutBg: '#f4f7fb',
    chartText: '#425469',
    crosshair: 'rgba(66, 84, 105, 0.22)',
  },
}

function showError(message) {
  errorEl.textContent = message
  errorEl.classList.remove('is-hidden')
}

function decodePayload(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('query param "payload" is required')

  const trimmed = raw.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed

  const attempts = [
    () => atob(trimmed.replace(/-/g, '+').replace(/_/g, '/')),
    () => atob(trimmed),
    () => decodeURIComponent(trimmed),
  ]

  for (const run of attempts) {
    try {
      const out = run()
      if (out?.trim()?.startsWith('{') || out?.trim()?.startsWith('[')) return out
    } catch {
      // ignore
    }
  }

  throw new Error('invalid payload: use raw/url-encoded JSON, base64, or base64url')
}

function toUnixSec(value) {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value)
  }
  if (typeof value === 'string') {
    const t = value.trim()
    if (!t) return null
    const n = Number(t)
    if (Number.isFinite(n) && n > 0) return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n)
    const dt = new Date(t)
    if (!Number.isNaN(dt.getTime())) return Math.floor(dt.getTime() / 1000)
  }
  return null
}

function readNum(obj, longKey, shortKey) {
  const a = Number(obj?.[longKey])
  if (Number.isFinite(a)) return a
  const b = Number(obj?.[shortKey])
  if (Number.isFinite(b)) return b
  return NaN
}

function normalizeCandles(payload) {
  const source = Array.isArray(payload?.candles)
    ? payload.candles
    : Array.isArray(payload?.candes)
      ? payload.candes
      : []

  if (source.length === 0) throw new Error('payload has no candles/candes array')

  const defaultStart = Math.floor(Date.now() / 1000) - source.length * 60
  const rows = source.map((item, idx) => {
    const open = readNum(item, 'open', 'o')
    const high = readNum(item, 'high', 'h')
    const low = readNum(item, 'low', 'l')
    const close = readNum(item, 'close', 'c')
    const time = toUnixSec(item?.time) ?? defaultStart + idx * 60

    if (![open, high, low, close, time].every(Number.isFinite)) {
      throw new Error(`invalid candle[${idx}] (ohlc/time)`)
    }
    if (low > high || high < Math.max(open, close) || low > Math.min(open, close)) {
      throw new Error(`candle[${idx}] has invalid OHLC relationship`)
    }

    return { time, open, high, low, close }
  })

  rows.sort((a, b) => a.time - b.time)
  return rows
}

function resolveGridVisibility(payload) {
  const grid = payload?.grid && typeof payload.grid === 'object' ? payload.grid : {}

  const parseBool = (value) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase()
      if (['1', 'true', 'yes', 'on'].includes(v)) return true
      if (['0', 'false', 'no', 'off'].includes(v)) return false
    }
    return null
  }

  const vertical = parseBool(grid.vertical ?? grid.vertLines ?? payload?.gridVertical)
  const horizontal = parseBool(grid.horizontal ?? grid.horzLines ?? payload?.gridHorizontal)

  return {
    vertical: vertical ?? false,
    horizontal: horizontal ?? false,
  }
}

function clearObjectsLayer() {
  if (!objectsLayerEl) return
  objectsLayerEl.innerHTML = ''
}

function normalizeObjectTime(raw) {
  return toUnixSec(raw)
}

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

function applyTheme(theme, chart) {
  const t = THEMES[theme] || THEMES.dark
  document.body.dataset.theme = theme
  if (themeToggleEl) themeToggleEl.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false')

  if (chart) {
    chart.applyOptions({
      layout: { background: { color: t.chartLayoutBg }, textColor: t.chartText },
      crosshair: {
        vertLine: { color: t.crosshair },
        horzLine: { color: t.crosshair },
      },
    })
  }
}

function positionThemeToggle(chart) {
  if (!themeToggleEl || !chart) return
  let rightScaleWidth = 0
  try {
    rightScaleWidth = Number(chart.priceScale('right').width()) || 0
  } catch {
    rightScaleWidth = 0
  }
  // Keep distance from right-side price scale labels using the actual scale width
  themeToggleEl.style.right = `${Math.round(rightScaleWidth + 16)}px`
}

function buildNativeArrowMarkers(payload) {
  const objects = Array.isArray(payload?.objects) ? payload.objects : []
  const out = []

  for (const obj of objects) {
    if (!obj || (obj.type !== 'buy-arrow' && obj.type !== 'sell-arrow')) continue
    const ts = normalizeObjectTime(obj.time)
    if (!Number.isFinite(ts)) continue

    const marker = {
      time: ts,
      shape: obj.type === 'buy-arrow' ? 'arrowUp' : 'arrowDown',
      position: obj.type === 'buy-arrow' ? 'belowBar' : 'aboveBar',
      color: String(obj.color || (obj.type === 'buy-arrow' ? '#2ed573' : '#ff6b6b')),
    }

    const text = obj.label != null
      ? String(obj.label)
      : (obj.type === 'buy-arrow' ? 'Buy' : 'Sell')
    if (text) marker.text = text
    if (Number.isFinite(Number(obj.size))) marker.size = Math.max(1, Number(obj.size))

    out.push(marker)
  }

  return out
}

function renderObjects(payload, chart, series) {
  clearObjectsLayer()
  const objects = Array.isArray(payload?.objects) ? payload.objects : []
  if (objects.length === 0) return

  const timeScale = chart.timeScale()

  const draw = () => {
    clearObjectsLayer()

    const resolvePoint = (obj) => {
      let x = null
      let y = null

      if (obj.time != null) {
        const ts = normalizeObjectTime(obj.time)
        if (Number.isFinite(ts)) {
          const coordX = timeScale.timeToCoordinate(ts)
          if (Number.isFinite(coordX)) x = coordX
        }
      }
      if (obj.price != null) {
        const price = Number(obj.price)
        if (Number.isFinite(price)) {
          const coordY = series.priceToCoordinate(price)
          if (Number.isFinite(coordY)) y = coordY
        }
      }

      if (x == null && Number.isFinite(Number(obj.x))) x = Number(obj.x)
      if (y == null && Number.isFinite(Number(obj.y))) y = Number(obj.y)

      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      return { x, y }
    }

    for (const obj of objects) {
      if (!obj) continue

      if (obj.type === 'vertical-line') {
        const ts = normalizeObjectTime(obj.time)
        if (!Number.isFinite(ts)) continue
        const x = timeScale.timeToCoordinate(ts)
        if (!Number.isFinite(x)) continue

        const line = document.createElement('div')
        line.className = 'obj-vline'
        line.style.left = `${Math.round(x)}px`
        if (obj.color) line.style.background = String(obj.color)
        if (Number.isFinite(Number(obj.width))) line.style.width = `${Math.max(1, Number(obj.width))}px`

        const labelText = obj.label != null ? String(obj.label) : ''
        if (labelText) {
          const label = document.createElement('div')
          label.className = 'obj-vline-label'
          label.textContent = labelText
          if (obj.labelColor) label.style.color = String(obj.labelColor)
          line.appendChild(label)
        }

        objectsLayerEl.appendChild(line)
        continue
      }

      if (obj.type === 'horizontal-line') {
        const price = Number(obj.price)
        if (!Number.isFinite(price)) continue
        const y = series.priceToCoordinate(price)
        if (!Number.isFinite(y)) continue

        const line = document.createElement('div')
        line.className = 'obj-hline'
        line.style.top = `${Math.round(y)}px`
        if (obj.color) line.style.background = String(obj.color)
        if (Number.isFinite(Number(obj.width))) line.style.height = `${Math.max(1, Number(obj.width))}px`

        const labelText = obj.label != null ? String(obj.label) : ''
        if (labelText) {
          const label = document.createElement('div')
          label.className = 'obj-hline-label'
          label.textContent = labelText
          if (obj.labelColor) label.style.color = String(obj.labelColor)
          line.appendChild(label)
        }

        objectsLayerEl.appendChild(line)
        continue
      }

      if (obj.type === 'text') {
        const textValue = obj.text != null ? String(obj.text) : ''
        if (!textValue) continue
        const p = resolvePoint(obj)
        if (!p) continue

        const el = document.createElement('div')
        el.className = 'obj-text'
        el.textContent = textValue
        el.style.left = `${Math.round(p.x)}px`
        el.style.top = `${Math.round(p.y)}px`
        const offsetX = Number.isFinite(Number(obj.offsetX)) ? Number(obj.offsetX) : 0
        const offsetY = Number.isFinite(Number(obj.offsetY)) ? Number(obj.offsetY) : 0
        if (offsetX !== 0 || offsetY !== 0) {
          el.style.transform = `translate(${offsetX}px, ${offsetY}px)`
        }
        if (obj.color) el.style.color = String(obj.color)
        if (obj.background) el.style.background = String(obj.background)
        if (Number.isFinite(Number(obj.fontSize))) el.style.fontSize = `${Math.max(8, Number(obj.fontSize))}px`

        objectsLayerEl.appendChild(el)
        continue
      }

      if (obj.type === 'buy-arrow' || obj.type === 'sell-arrow') {
        // Arrows are rendered by the native primitive (Series Markers)
        continue
      }
    }
  }

  draw()
  timeScale.subscribeVisibleTimeRangeChange(draw)
  return {
    redraw: draw,
    detach: () => timeScale.unsubscribeVisibleTimeRangeChange(draw),
  }
}

function run() {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('payload')

  const decoded = decodePayload(raw)
  const payload = JSON.parse(decoded)

  const rows = normalizeCandles(payload)
  const gridVisibility = resolveGridVisibility(payload)

  const title = String(payload?.title || payload?.symbol || 'Market Viewer')
  titleEl.textContent = title
  subtitleEl.textContent = String(payload?.subtitle || '')

  const chart = createChart(chartEl, {
    width: Math.max(320, chartEl.clientWidth),
    height: Math.max(320, chartEl.clientHeight),
    layout: { background: { color: '#0b0f14' }, textColor: '#b8c7da' },
    grid: {
      vertLines: { visible: gridVisibility.vertical },
      horzLines: { visible: gridVisibility.horizontal },
    },
    crosshair: {
      vertLine: {
        color: 'rgba(184, 199, 218, 0.18)',
      },
      horzLine: {
        color: 'rgba(184, 199, 218, 0.18)',
      },
    },
    timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 6 },
    rightPriceScale: { autoScale: true, borderVisible: true, scaleMargins: { top: 0.08, bottom: 0.08 } },
  })

  const series = chart.addSeries(CandlestickSeries, {
    upColor: 'rgba(18,150,123,0.38)',
    downColor: 'rgba(212,77,64,0.38)',
    borderVisible: true,
    wickUpColor: 'rgba(18,150,123,0.38)',
    wickDownColor: 'rgba(212,77,64,0.38)',
    borderUpColor: 'rgba(18,150,123,0.38)',
    borderDownColor: 'rgba(212,77,64,0.38)',
  })

  series.setData(rows)
  createSeriesMarkers(series, buildNativeArrowMarkers(payload))
  chart.timeScale().fitContent()

  const objectsHandle = renderObjects(payload, chart, series)

  let currentTheme = getInitialTheme()
  applyTheme(currentTheme, chart)
  positionThemeToggle(chart)
  if (themeToggleEl) {
    themeToggleEl.onclick = () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_KEY, currentTheme)
      applyTheme(currentTheme, chart)
      positionThemeToggle(chart)
      if (objectsHandle && typeof objectsHandle.redraw === 'function') objectsHandle.redraw()
    }
  }

  const ro = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (!rect) return
    chart.applyOptions({
      width: Math.max(320, Math.floor(rect.width)),
      height: Math.max(320, Math.floor(rect.height)),
    })
    // Redraw on resize to keep objects aligned
    if (objectsHandle && typeof objectsHandle.redraw === 'function') {
      objectsHandle.redraw()
    }
    positionThemeToggle(chart)
  })
  ro.observe(chartEl)
}

try {
  run()
} catch (err) {
  showError(err?.message || String(err))
}
