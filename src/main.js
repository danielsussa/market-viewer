import './style.css'
import { CandlestickSeries, LineStyle, createChart, createSeriesMarkers } from 'lightweight-charts'

if (window.location.pathname.endsWith('/help')) {
  const target = `${window.location.pathname}/${window.location.search}${window.location.hash}`
  window.location.replace(target)
}

const chartEl = document.getElementById('chart')
const chartShellEl = document.querySelector('.chart-shell')
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

function clamp01(value, fallback = 0.22) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(1, n))
}

function withOpacity(color, opacity) {
  const c = String(color || '#2b3a4a').trim()
  const a = clamp01(opacity)

  if (c.startsWith('#')) {
    let hex = c.slice(1)
    if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('')
    if (hex.length === 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }
  }

  const rgb = c.match(/^rgba?\(([^)]+)\)$/i)
  if (rgb) {
    const parts = rgb[1].split(',').map((v) => v.trim())
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`
    }
  }

  return c
}

function parseLineStyle(value, fallback = LineStyle.Solid) {
  if (Number.isFinite(Number(value))) {
    const n = Number(value)
    if ([0, 1, 2, 3, 4].includes(n)) return n
  }

  if (typeof value !== 'string') return fallback
  const v = value.trim().toLowerCase()

  if (['solid'].includes(v)) return LineStyle.Solid
  if (['dotted', 'dot', 'pontilhado'].includes(v)) return LineStyle.Dotted
  if (['dashed', 'dash', 'tracejado'].includes(v)) return LineStyle.Dashed
  if (['large-dashed', 'largedashed', 'big-dashed'].includes(v)) return LineStyle.LargeDashed
  if (['sparse-dotted', 'sparsedotted'].includes(v)) return LineStyle.SparseDotted

  return fallback
}

function resolveGridOptions(payload) {
  const grid = payload?.grid && typeof payload.grid === 'object' ? payload.grid : {}
  const visibility = resolveGridVisibility(payload)

  const defaultColor = '#2b3a4a'
  const baseVerticalColor = grid.verticalColor || grid.vertColor || grid.color || defaultColor
  const baseHorizontalColor = grid.horizontalColor || grid.horzColor || grid.color || defaultColor

  const verticalOpacity = clamp01(grid.verticalOpacity ?? grid.opacity ?? 0.24)
  const horizontalOpacity = clamp01(grid.horizontalOpacity ?? grid.opacity ?? 0.24)

  const dashed = grid.dashed
  const verticalDashed = grid.verticalDashed
  const horizontalDashed = grid.horizontalDashed

  const globalStyle = grid.style
  const verticalStyle = grid.verticalStyle
  const horizontalStyle = grid.horizontalStyle

  const resolvedVerticalStyle = parseLineStyle(
    verticalStyle ?? (verticalDashed === true ? 'dashed' : verticalDashed === false ? 'solid' : undefined) ??
      (dashed === true ? 'dashed' : dashed === false ? 'solid' : undefined) ?? globalStyle,
    LineStyle.Solid,
  )

  const resolvedHorizontalStyle = parseLineStyle(
    horizontalStyle ?? (horizontalDashed === true ? 'dashed' : horizontalDashed === false ? 'solid' : undefined) ??
      (dashed === true ? 'dashed' : dashed === false ? 'solid' : undefined) ?? globalStyle,
    LineStyle.Solid,
  )

  return {
    vertLines: {
      visible: visibility.vertical,
      color: withOpacity(baseVerticalColor, verticalOpacity),
      style: resolvedVerticalStyle,
    },
    horzLines: {
      visible: visibility.horizontal,
      color: withOpacity(baseHorizontalColor, horizontalOpacity),
      style: resolvedHorizontalStyle,
    },
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseBooleanParam(value, fallback) {
  if (value == null) return fallback
  if (typeof value !== 'string') return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}

function sanitizeFilename(value) {
  const raw = String(value || 'market-viewer').trim() || 'market-viewer'
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'market-viewer'
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawLineWithLabel(ctx, lineEl, isVertical) {
  const lineStyle = getComputedStyle(lineEl)
  const x = Number.parseFloat(lineEl.style.left || '0')
  const y = Number.parseFloat(lineEl.style.top || '0')

  if (isVertical) {
    const width = Math.max(1, Number.parseFloat(lineEl.style.width || lineStyle.width || '1'))
    ctx.fillStyle = lineStyle.backgroundColor || 'rgba(255,255,255,0.9)'
    ctx.fillRect(Math.round(x), 0, width, ctx.canvas.height)
  } else {
    const height = Math.max(1, Number.parseFloat(lineEl.style.height || lineStyle.height || '1'))
    ctx.fillStyle = lineStyle.backgroundColor || 'rgba(255,255,255,0.9)'
    ctx.fillRect(0, Math.round(y), ctx.canvas.width, height)
  }

  const labelEl = lineEl.querySelector(isVertical ? '.obj-vline-label' : '.obj-hline-label')
  if (!labelEl) return
  const ls = getComputedStyle(labelEl)
  const rect = labelEl.getBoundingClientRect()
  const rootRect = objectsLayerEl.getBoundingClientRect()
  const lx = rect.left - rootRect.left
  const ly = rect.top - rootRect.top
  ctx.save()
  ctx.fillStyle = ls.backgroundColor || 'rgba(0,0,0,0.5)'
  drawRoundedRect(ctx, lx, ly, rect.width, rect.height, 4)
  ctx.fill()
  ctx.fillStyle = ls.color || '#fff'
  ctx.font = `${ls.fontWeight} ${ls.fontSize} ${ls.fontFamily}`
  ctx.textBaseline = 'middle'
  ctx.fillText(labelEl.textContent || '', lx + 6, ly + rect.height / 2)
  ctx.restore()
}

function drawTextObjects(ctx) {
  const textEls = objectsLayerEl.querySelectorAll('.obj-text')
  const rootRect = objectsLayerEl.getBoundingClientRect()
  for (const el of textEls) {
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    const x = rect.left - rootRect.left
    const y = rect.top - rootRect.top
    ctx.save()
    ctx.fillStyle = style.backgroundColor || 'rgba(0,0,0,0.5)'
    drawRoundedRect(ctx, x, y, rect.width, rect.height, 6)
    ctx.fill()
    ctx.fillStyle = style.color || '#fff'
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    ctx.textBaseline = 'middle'
    const paddingX = Number.parseFloat(style.paddingLeft || '8')
    ctx.fillText(el.textContent || '', x + paddingX, y + rect.height / 2)
    ctx.restore()
  }
}

function drawChartHeader(ctx) {
  const headEl = document.querySelector('.chart-head')
  if (!headEl) return
  const headStyle = getComputedStyle(headEl)
  const rootRect = chartShellEl.getBoundingClientRect()
  const rect = headEl.getBoundingClientRect()
  const x = rect.left - rootRect.left
  const y = rect.top - rootRect.top

  ctx.save()
  ctx.fillStyle = headStyle.backgroundColor || 'rgba(11,15,20,0.45)'
  drawRoundedRect(ctx, x, y, rect.width, rect.height, 6)
  ctx.fill()

  const titleStyle = getComputedStyle(titleEl)
  const subtitleStyle = getComputedStyle(subtitleEl)

  const paddingLeft = Number.parseFloat(headStyle.paddingLeft || '8')
  const paddingTop = Number.parseFloat(headStyle.paddingTop || '4')
  const gap = Number.parseFloat(headStyle.rowGap || headStyle.gap || '2')

  ctx.fillStyle = titleStyle.color || '#d6e2f0'
  ctx.font = `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`
  ctx.textBaseline = 'top'
  const tx = x + paddingLeft
  const ty = y + paddingTop
  ctx.fillText(titleEl.textContent || '', tx, ty)

  const titleHeight = Number.parseFloat(titleStyle.lineHeight)
    || Number.parseFloat(titleStyle.fontSize || '14')

  if (subtitleEl.textContent) {
    ctx.fillStyle = subtitleStyle.color || '#b8c7da'
    ctx.font = `${subtitleStyle.fontWeight} ${subtitleStyle.fontSize} ${subtitleStyle.fontFamily}`
    ctx.fillText(subtitleEl.textContent || '', tx, ty + titleHeight + gap)
  }

  ctx.restore()
}

async function renderSnapshotCanvas() {
  const width = Math.max(1, Math.floor(chartShellEl.clientWidth))
  const height = Math.max(1, Math.floor(chartShellEl.clientHeight))
  const scale = Math.max(1, Math.min(3, window.devicePixelRatio || 1))

  const out = document.createElement('canvas')
  out.width = Math.floor(width * scale)
  out.height = Math.floor(height * scale)

  const ctx = out.getContext('2d')
  ctx.scale(scale, scale)

  const bodyStyle = getComputedStyle(document.body)
  ctx.fillStyle = bodyStyle.backgroundColor || '#0b0f14'
  ctx.fillRect(0, 0, width, height)

  const shellRect = chartShellEl.getBoundingClientRect()
  const chartCanvases = chartEl.querySelectorAll('canvas')
  for (const canvas of chartCanvases) {
    const rect = canvas.getBoundingClientRect()
    const x = rect.left - shellRect.left
    const y = rect.top - shellRect.top
    if (rect.width <= 0 || rect.height <= 0) continue
    ctx.drawImage(canvas, x, y, rect.width, rect.height)
  }

  const verticalLines = objectsLayerEl.querySelectorAll('.obj-vline')
  for (const line of verticalLines) drawLineWithLabel(ctx, line, true)

  const horizontalLines = objectsLayerEl.querySelectorAll('.obj-hline')
  for (const line of horizontalLines) drawLineWithLabel(ctx, line, false)

  drawTextObjects(ctx)
  drawChartHeader(ctx)

  return out
}

async function maybeExportFromQuery() {
  const params = new URLSearchParams(window.location.search)
  const exportFmtRaw = String(params.get('export') || '').trim().toLowerCase()
  if (!exportFmtRaw) return

  const format = exportFmtRaw === 'jpeg' ? 'jpg' : exportFmtRaw
  if (!['png', 'jpg'].includes(format)) {
    throw new Error('invalid export format: use export=png or export=jpg')
  }

  const delayMs = Math.max(0, Number(params.get('exportDelay') || 120) || 120)
  await wait(delayMs)

  const qualityNum = Number(params.get('quality'))
  const quality = Number.isFinite(qualityNum) ? Math.max(0, Math.min(1, qualityNum)) : 0.92
  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  const download = parseBooleanParam(params.get('download'), true)

  const titlePart = sanitizeFilename(titleEl.textContent)
  const rawFileName = params.get('filename') || `${titlePart || 'market-viewer'}-${Date.now()}`
  const fileName = `${sanitizeFilename(rawFileName)}.${format}`

  const snapshot = await renderSnapshotCanvas()
  const dataUrl = format === 'png'
    ? snapshot.toDataURL(mime)
    : snapshot.toDataURL(mime, quality)

  if (download) {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  window.__MARKET_VIEWER_EXPORT__ = {
    format,
    mime,
    fileName,
    dataUrl,
  }
}

function run() {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('payload')

  const decoded = decodePayload(raw)
  const payload = JSON.parse(decoded)

  const rows = normalizeCandles(payload)
  const gridOptions = resolveGridOptions(payload)

  const title = String(payload?.title || payload?.symbol || 'Market Viewer')
  titleEl.textContent = title
  subtitleEl.textContent = String(payload?.subtitle || '')

  const chart = createChart(chartEl, {
    width: Math.max(320, chartEl.clientWidth),
    height: Math.max(320, chartEl.clientHeight),
    layout: { background: { color: '#0b0f14' }, textColor: '#b8c7da' },
    grid: gridOptions,
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

  maybeExportFromQuery().catch((err) => {
    showError(err?.message || String(err))
  })
}

try {
  run()
} catch (err) {
  showError(err?.message || String(err))
}
