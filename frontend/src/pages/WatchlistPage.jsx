import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getWatchlistQuotes, addWatchlistItem, removeWatchlistItem, getStockQuote, getTrendChart, getChipDistribution, getStockFundFlow, getDragonTigerHotMoney, getGubaDiscussion } from '../services/api'
import { Plus, Trash2, RefreshCw, Star, Search, TrendingUp, TrendingDown, ArrowUpDown, X, BarChart3, Activity, DollarSign, Users, LineChart, MessageCircle, Eye, Share2, Image, Video, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, LineChart as RLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart, ReferenceLine } from 'recharts'
import toast from 'react-hot-toast'

// ==================== ChipPeakChart Component ====================
// A professional K-line candlestick chart with overlaid chip peak distribution bars
// Mimics the standard A-stock chip peak (筹码峰) chart style
function ChipPeakChart({ klines, chips, summary }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [tooltipData, setTooltipData] = useState(null)
  const [containerWidth, setContainerWidth] = useState(500)

  // ResizeObserver for responsive canvas
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(container)
    setContainerWidth(container.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  // Display last 60 klines
  const displayKlines = useMemo(() => klines.slice(-60), [klines])

  // Calculate MA lines
  const maData = useMemo(() => {
    const calcMA = (data, period) => {
      return data.map((_, i) => {
        if (i < period - 1) return null
        let sum = 0
        for (let j = i - period + 1; j <= i; j++) sum += data[j].close
        return sum / period
      })
    }
    return {
      ma5: calcMA(displayKlines, 5),
      ma10: calcMA(displayKlines, 10),
      ma20: calcMA(displayKlines, 20),
    }
  }, [displayKlines])

  // Price range
  const priceRange = useMemo(() => {
    if (displayKlines.length === 0) return { min: 0, max: 1 }
    let min = Infinity, max = -Infinity
    displayKlines.forEach(k => {
      if (k.low < min) min = k.low
      if (k.high > max) max = k.high
    })
    const padding = (max - min) * 0.05
    return { min: min - padding, max: max + padding }
  }, [displayKlines])

  // Volume range
  const volRange = useMemo(() => {
    if (displayKlines.length === 0) return { max: 1 }
    let max = 0
    displayKlines.forEach(k => { if (k.volume > max) max = k.volume })
    return { max: max || 1 }
  }, [displayKlines])

  // Draw the chart on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || displayKlines.length === 0) return
    const container = containerRef.current
    if (!container) return

    const dpr = window.devicePixelRatio || 1
    const W = containerWidth || 500
    const H = 340
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    // Layout: kline area (left 72%), chip area (right 28%), volume bar below
    const klineW = Math.floor(W * 0.72)
    const chipW = W - klineW
    const klineH = 240 // candlestick area height
    const volH = 60    // volume bar height
    const gapH = 10    // gap between k-line and volume
    const padL = 45     // left padding for Y axis labels
    const padR = 5      // right padding
    const padT = 15     // top padding
    const padB = 20     // bottom padding for X axis labels

    const kDrawW = klineW - padL - padR
    const kDrawH = klineH - padT - padB

    // ===== Background =====
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, W, H)

    // ===== Grid lines =====
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 0.5
    const numGridH = 5
    for (let i = 0; i <= numGridH; i++) {
      const y = padT + (kDrawH / numGridH) * i
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(klineW - padR, y)
      ctx.stroke()
    }

    // ===== Y-axis labels (price) =====
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    for (let i = 0; i <= numGridH; i++) {
      const y = padT + (kDrawH / numGridH) * i
      const price = priceRange.max - ((priceRange.max - priceRange.min) / numGridH) * i
      ctx.fillText(price.toFixed(2), padL - 4, y + 3)
    }

    // Helper: price to Y
    const priceToY = (price) => {
      return padT + ((priceRange.max - price) / (priceRange.max - priceRange.min)) * kDrawH
    }

    // ===== Candlestick Chart =====
    const barW = Math.max(2, Math.floor(kDrawW / displayKlines.length) - 1)
    const barGap = (kDrawW - barW * displayKlines.length) / (displayKlines.length + 1)

    displayKlines.forEach((k, i) => {
      const x = padL + barGap + (barW + barGap) * i
      const isUp = k.close >= k.open
      const bodyTop = priceToY(Math.max(k.open, k.close))
      const bodyBot = priceToY(Math.min(k.open, k.close))
      const bodyH = Math.max(1, bodyBot - bodyTop)
      const wickTop = priceToY(k.high)
      const wickBot = priceToY(k.low)
      const cx = x + barW / 2

      // Wick (shadow)
      ctx.strokeStyle = isUp ? '#ef4444' : '#22c55e'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx, wickTop)
      ctx.lineTo(cx, wickBot)
      ctx.stroke()

      // Body
      ctx.fillStyle = isUp ? '#ef4444' : '#22c55e'
      if (bodyH <= 1) {
        ctx.fillRect(x, bodyTop, barW, 1)
      } else {
        ctx.fillRect(x, bodyTop, barW, bodyH)
      }
    })

    // ===== MA Lines =====
    const drawMA = (maArr, color) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      let started = false
      maArr.forEach((v, i) => {
        if (v === null) return
        const x = padL + barGap + (barW + barGap) * i + barW / 2
        const y = priceToY(v)
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    drawMA(maData.ma5, '#f59e0b')  // yellow
    drawMA(maData.ma10, '#3b82f6') // blue
    drawMA(maData.ma20, '#a855f7') // purple

    // ===== MA Legend =====
    ctx.font = '8px sans-serif'
    const legends = [
      { label: 'MA5', color: '#f59e0b', val: maData.ma5[maData.ma5.length - 1] },
      { label: 'MA10', color: '#3b82f6', val: maData.ma10[maData.ma10.length - 1] },
      { label: 'MA20', color: '#a855f7', val: maData.ma20[maData.ma20.length - 1] },
    ]
    let lx = padL + 5
    legends.forEach(l => {
      if (l.val === null) return
      ctx.fillStyle = l.color
      ctx.fillRect(lx, 4, 12, 6)
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.textAlign = 'left'
      ctx.fillText(`${l.label}:${l.val.toFixed(2)}`, lx + 15, 10)
      lx += 85
    })

    // ===== Average cost reference line =====
    if (summary.avg_cost > 0 && summary.avg_cost >= priceRange.min && summary.avg_cost <= priceRange.max) {
      const y = priceToY(summary.avg_cost)
      ctx.strokeStyle = 'rgba(245,158,11,0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(klineW - padR, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#f59e0b'
      ctx.font = '8px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('成本' + summary.avg_cost.toFixed(2), klineW - padR - 60, y - 3)
    }

    // ===== X-axis date labels =====
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    const labelInterval = Math.max(1, Math.floor(displayKlines.length / 6))
    displayKlines.forEach((k, i) => {
      if (i % labelInterval === 0 || i === displayKlines.length - 1) {
        const x = padL + barGap + (barW + barGap) * i + barW / 2
        ctx.fillText(k.date?.slice(5) || '', x, klineH - 2)
      }
    })

    // ===== Volume Bars =====
    const volTop = klineH + gapH
    const volDrawH = volH - 10
    displayKlines.forEach((k, i) => {
      const x = padL + barGap + (barW + barGap) * i
      const isUp = k.close >= k.open
      const h = Math.max(1, (k.volume / volRange.max) * volDrawH)
      ctx.fillStyle = isUp ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)'
      ctx.fillRect(x, volTop + volDrawH - h, barW, h)
    })

    // VOL label
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('VOL', padL, volTop + 8)

    // ===== Chip Peak Distribution (right side) =====
    if (chips.length > 0) {
      const chipX = klineW
      const chipDrawW = chipW - 10
      const chipDrawH = kDrawH
      const chipTop = padT

      const maxPct = Math.max(...chips.map(c => c.percent || 0), 0.001)
      const latestPrice = summary.latest_price || displayKlines[displayKlines.length - 1]?.close || 0

      // Separator line
      ctx.strokeStyle = 'rgba(0,0,0,0.1)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(chipX, padT)
      ctx.lineTo(chipX, padT + kDrawH)
      ctx.stroke()

      // Label
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.font = '8px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('筹码分布', chipX + chipDrawW / 2 + 5, 10)

      // Draw each chip bar (horizontal, growing from right to left)
      // Use gradient fills for professional look
      const profitGrad = ctx.createLinearGradient(chipX, 0, chipX + chipDrawW, 0)
      profitGrad.addColorStop(0, 'rgba(239, 68, 68, 0.2)')
      profitGrad.addColorStop(1, 'rgba(239, 68, 68, 0.9)')

      const lossGrad = ctx.createLinearGradient(chipX, 0, chipX + chipDrawW, 0)
      lossGrad.addColorStop(0, 'rgba(59, 130, 246, 0.2)')
      lossGrad.addColorStop(1, 'rgba(59, 130, 246, 0.85)')

      chips.forEach((chip) => {
        const price = chip.price || 0
        if (price < priceRange.min || price > priceRange.max) return

        const y = priceToY(price)
        const barHeight = Math.max(1.5, chipDrawH / chips.length * 0.85)
        const barLength = (chip.percent / maxPct) * chipDrawW * 0.85

        const isProfit = price <= latestPrice

        // Draw bar from right edge toward left
        const barX = chipX + chipDrawW + 5 - barLength

        if (isProfit) {
          ctx.fillStyle = profitGrad
        } else {
          ctx.fillStyle = lossGrad
        }

        ctx.fillRect(barX, y - barHeight / 2, barLength, barHeight)
      })

      // Current price line across chip area
      if (latestPrice >= priceRange.min && latestPrice <= priceRange.max) {
        const priceY = priceToY(latestPrice)
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'
        ctx.lineWidth = 0.5
        ctx.setLineDash([3, 2])
        ctx.beginPath()
        ctx.moveTo(chipX, priceY)
        ctx.lineTo(W, priceY)
        ctx.stroke()
        ctx.setLineDash([])

        // Price label on chip area
        ctx.fillStyle = '#fbbf24'
        ctx.font = 'bold 8px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(latestPrice.toFixed(2), W - 2, priceY - 3)
      }
    }

    // ===== Hover highlight =====
    if (hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < displayKlines.length) {
      const x = padL + barGap + (barW + barGap) * hoveredIdx + barW / 2
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'
      ctx.lineWidth = 0.5
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(x, padT)
      ctx.lineTo(x, H)
      ctx.stroke()
      ctx.setLineDash([])
    }

  }, [displayKlines, chips, summary, priceRange, volRange, maData, hoveredIdx, containerWidth])

  // Handle mouse move for tooltip
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const W = rect.width
    const klineW = Math.floor(W * 0.72)
    const padL = 45
    const padR = 5
    const kDrawW = klineW - padL - padR
    const barW = Math.max(2, Math.floor(kDrawW / displayKlines.length) - 1)
    const barGap = (kDrawW - barW * displayKlines.length) / (displayKlines.length + 1)

    if (x >= padL && x <= klineW - padR) {
      const idx = Math.floor((x - padL) / (barW + barGap))
      if (idx >= 0 && idx < displayKlines.length) {
        setHoveredIdx(idx)
        setTooltipData(displayKlines[idx])
        return
      }
    }
    setHoveredIdx(null)
    setTooltipData(null)
  }, [displayKlines])

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null)
    setTooltipData(null)
  }, [])

  return (
    <div className="space-y-3">
      {/* Summary stats bar */}
      {summary.avg_cost > 0 && (
        <div className="grid grid-cols-5 gap-1.5 p-2.5 rounded-xl border border-gray-200" style={{ background: '#F8F9FB' }}>
          <div className="text-center">
            <p className="text-[9px] text-gray-400">获利比例</p>
            <p className="text-xs font-bold text-red-600">{summary.profit_ratio?.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-400">平均成本</p>
            <p className="text-xs font-bold text-amber-600">{summary.avg_cost?.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-400">90%筹码</p>
            <p className="text-xs font-bold text-blue-600">{summary.chip_low_90?.toFixed(2)}-{summary.chip_high_90?.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-400">集中度</p>
            <p className="text-xs font-bold text-purple-600">{summary.concentration?.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-400">最新价</p>
            <p className="text-xs font-bold text-gray-900">{summary.latest_price?.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Main chart area: Canvas-based K-line + Chip Peak */}
      <div ref={containerRef} className="relative rounded-xl overflow-hidden border border-gray-200" style={{ background: '#FFFFFF' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'crosshair', display: 'block', width: '100%', height: '340px' }}
        />

        {/* Floating tooltip */}
        {tooltipData && (
          <div className="absolute top-2 left-12 bg-white/95 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[10px] space-y-0.5 pointer-events-none z-10 shadow-md backdrop-blur-sm">
            <div className="text-gray-700 font-medium">{tooltipData.date}</div>
            <div className="flex gap-3">
              <span className="text-gray-500">开:<span className={tooltipData.close >= tooltipData.open ? 'text-red-600' : 'text-green-600'}>{tooltipData.open?.toFixed(2)}</span></span>
              <span className="text-gray-500">收:<span className={tooltipData.close >= tooltipData.open ? 'text-red-600' : 'text-green-600'}>{tooltipData.close?.toFixed(2)}</span></span>
            </div>
            <div className="flex gap-3">
              <span className="text-gray-500">高:<span className="text-red-600">{tooltipData.high?.toFixed(2)}</span></span>
              <span className="text-gray-500">低:<span className="text-green-600">{tooltipData.low?.toFixed(2)}</span></span>
            </div>
            <div className="flex gap-3">
              <span className="text-gray-500">量:<span className="text-gray-700">{(tooltipData.volume / 10000).toFixed(0)}万</span></span>
              {tooltipData.change_pct !== undefined && (
                <span className="text-gray-500">幅:<span className={tooltipData.change_pct >= 0 ? 'text-red-600' : 'text-green-600'}>{tooltipData.change_pct >= 0 ? '+' : ''}{tooltipData.change_pct?.toFixed(2)}%</span></span>
              )}
            </div>
          </div>
        )}

        {/* Chip legend */}
        <div className="absolute bottom-1 right-2 flex items-center gap-3 text-[8px]">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: 'rgba(239,68,68,0.85)' }}></span><span className="text-gray-500">获利筹码</span></span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: 'rgba(59,130,246,0.75)' }}></span><span className="text-gray-500">套牢筹码</span></span>
        </div>
      </div>
    </div>
  )
}

// ==================== Modern Confirm Dialog ====================
function ConfirmDialog({ open, title, message, detail, confirmText, cancelText, danger, onConfirm, onCancel }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel?.() }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" style={{ animation: 'fadeIn 0.15s ease-out' }} />
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        style={{ animation: 'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-4 ${
            danger ? 'bg-red-50' : 'bg-[#F0EDFA]'}`}>
            {danger
              ? <Trash2 size={22} className="text-red-500" />
              : <AlertTriangle size={22} className="text-[#513CC8]" />}
          </div>
          {/* Title */}
          <h3 className="text-center text-base font-bold text-gray-900 mb-1.5">{title}</h3>
          {/* Message */}
          <p className="text-center text-sm text-gray-500 leading-relaxed">{message}</p>
          {/* Detail info */}
          {detail && (
            <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-center text-xs text-gray-600 font-medium">{detail}</p>
            </div>
          )}
        </div>
        {/* Buttons */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all active:scale-[0.97]">
            {cancelText || '取消'}
          </button>
          <button onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all active:scale-[0.97] shadow-sm ${
              danger
                ? 'bg-red-500 hover:bg-red-600 shadow-red-200'
                : 'hover:opacity-90 shadow-purple-200'}`}
            style={danger ? {} : { background: '#513CC8' }}>
            {confirmText || '确认'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.85) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  )
}

export default function WatchlistPage() {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [addCode, setAddCode] = useState('')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [refreshing, setRefreshing] = useState(false)
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({ open: false })
  // Stock detail panel
  const [detailStock, setDetailStock] = useState(null)
  const [detailTab, setDetailTab] = useState('trend')
  const [trendData, setTrendData] = useState(null)
  const [chipData, setChipData] = useState(null)
  const [fundFlowData, setFundFlowData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Guba discussion state
  const [gubaPosts, setGubaPosts] = useState([])
  const [gubaPage, setGubaPage] = useState(1)
  const [gubaTotal, setGubaTotal] = useState(0)
  const [gubaLoading, setGubaLoading] = useState(false)
  const [gubaLoadingMore, setGubaLoadingMore] = useState(false)
  const [gubaHasMore, setGubaHasMore] = useState(true)
  const gubaScrollRef = useRef(null)

  const loadStocks = useCallback(async () => {
    try {
      const res = await getWatchlistQuotes()
      if (res.code === 0) setStocks(res.data || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { loadStocks() }, [loadStocks])

  // Load detail data when stock or tab changes
  useEffect(() => {
    if (detailStock) {
      if (detailTab === 'guba') {
        if (gubaPosts.length === 0) loadGubaData(detailStock.code, 1, false)
      } else {
        loadDetailData(detailStock.code, detailTab)
      }
    }
  }, [detailStock, detailTab])

  const loadDetailData = async (code, tab) => {
    setDetailLoading(true)
    try {
      if (tab === 'trend') {
        const res = await getTrendChart({ code })
        if (res.code === 0) setTrendData(res.data)
      } else if (tab === 'chip') {
        const res = await getChipDistribution({ code })
        if (res.code === 0) setChipData(res.data)
      } else if (tab === 'fundflow') {
        const res = await getStockFundFlow({ code })
        if (res.code === 0) setFundFlowData(res.data)
      }
    } catch (e) {
      console.error(e)
    }
    setDetailLoading(false)
  }

  // Load Guba discussion data
  const loadGubaData = useCallback(async (stockCode, pageNum = 1, append = false) => {
    if (!stockCode) return
    if (pageNum === 1) {
      setGubaLoading(true)
    } else {
      setGubaLoadingMore(true)
    }
    try {
      const res = await getGubaDiscussion({ code: stockCode, page: pageNum, page_size: 20 })
      if (res?.code === 0 && res.data) {
        const newPosts = res.data.posts || []
        if (append) {
          setGubaPosts(prev => [...prev, ...newPosts])
        } else {
          setGubaPosts(newPosts)
        }
        setGubaTotal(res.data.total || 0)
        setGubaPage(pageNum)
        setGubaHasMore(newPosts.length >= 20 && pageNum < (res.data.total_pages || 1))
      }
    } catch (e) {
      console.error('Failed to load guba:', e)
      if (pageNum === 1) toast.error('加载股吧讨论失败')
    }
    setGubaLoading(false)
    setGubaLoadingMore(false)
  }, [])

  // Handle guba infinite scroll
  const handleGubaScroll = useCallback((e) => {
    const el = e.target
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && gubaHasMore && !gubaLoadingMore) {
      loadGubaData(detailStock?.code, gubaPage + 1, true)
    }
  }, [gubaHasMore, gubaLoadingMore, gubaPage, detailStock])

  // Refresh guba data
  const handleGubaRefresh = async () => {
    if (!detailStock) return
    setGubaPosts([])
    setGubaPage(1)
    setGubaHasMore(true)
    await loadGubaData(detailStock.code, 1, false)
    toast.success('股吧讨论已刷新')
    if (gubaScrollRef.current) gubaScrollRef.current.scrollTop = 0
  }

  // Format relative time for guba posts
  const formatRelativeTime = (timeStr) => {
    if (!timeStr) return ''
    try {
      const t = new Date(timeStr.replace(/-/g, '/'))
      const now = new Date()
      const diff = (now - t) / 1000
      if (diff < 60) return '刚刚'
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
      if (diff < 172800) return '昨天'
      return timeStr.slice(5, 16)
    } catch { return timeStr?.slice(5, 16) || '' }
  }

  const formatReadCount = (v) => {
    if (!v) return '0'
    if (v >= 10000) return (v / 10000).toFixed(1) + '万'
    return v.toString()
  }

  const handleAdd = async () => {
    const code = addCode.replace(/\D/g, '')
    if (!code || code.length !== 6) {
      toast.error('请输入6位股票代码')
      return
    }
    setAdding(true)
    try {
      let name = ''
      try {
        const quoteRes = await getStockQuote({ code, source: 'eastmoney' })
        if (quoteRes.code === 0 && quoteRes.data?.name) {
          name = quoteRes.data.name
        }
      } catch (e) {}
      
      const res = await addWatchlistItem({ code, name })
      if (res.code === 0) {
        toast.success(`已添加 ${name || code} 到自选`)
        setAddCode('')
        loadStocks()
      } else {
        toast.error(res.message || '添加失败')
      }
    } catch (e) {
      toast.error('添加失败')
    }
    setAdding(false)
  }

  const handleRemove = async (code, name) => {
    setConfirmDialog({
      open: true,
      title: '删除自选股',
      message: '确定将该股票从自选列表中移除吗？',
      detail: `${name}（${code}）`,
      confirmText: '确认删除',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog({ open: false })
        try {
          const res = await removeWatchlistItem(code)
          if (res.code === 0) {
            toast.success(`已删除 ${name}`)
            setStocks(prev => prev.filter(s => s.code !== code))
            setSelected(prev => { const n = new Set(prev); n.delete(code); return n })
            if (detailStock?.code === code) {
              setDetailStock(null)
              setGubaPosts([])
            }
          } else {
            toast.error(res.message || '删除失败')
          }
        } catch (e) {
          toast.error('删除失败')
        }
      }
    })
  }

  const handleBatchRemove = async () => {
    if (selected.size === 0) return
    const names = stocks.filter(s => selected.has(s.code)).map(s => s.name).join('、')
    setConfirmDialog({
      open: true,
      title: '批量删除自选股',
      message: `确定将选中的 ${selected.size} 只股票从自选列表中移除吗？`,
      detail: names.length > 30 ? names.slice(0, 30) + '...' : names,
      confirmText: `删除 ${selected.size} 只`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog({ open: false })
        for (const code of selected) {
          try {
            await removeWatchlistItem(code)
          } catch (e) {}
        }
        toast.success(`已删除 ${selected.size} 只股票`)
        setSelected(new Set())
        if (detailStock && selected.has(detailStock.code)) {
          setDetailStock(null)
          setGubaPosts([])
        }
        loadStocks()
      }
    })
  }

  const toggleSelect = (code) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(code)) n.delete(code)
      else n.add(code)
      return n
    })
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadStocks()
  }

  const formatAmount = (v) => {
    if (!v || v === 0) return '---'
    if (Math.abs(v) >= 10000) return (v / 10000).toFixed(2) + '亿'
    return v.toFixed(0) + '万'
  }

  const tooltipStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }

  // Detail tabs
  const detailTabs = [
    { key: 'trend', label: '分时走势', icon: Activity },
    { key: 'chip', label: '日K筹码峰', icon: BarChart3 },
    { key: 'fundflow', label: '主力资金', icon: DollarSign },
    { key: 'guba', label: '股吧讨论', icon: MessageCircle },
  ]

  // Render detail chart based on tab
  const renderDetailChart = () => {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> 加载中...
        </div>
      )
    }

    if (detailTab === 'trend' && trendData) {
      const trends = trendData.trends || []
      const preClose = trendData.pre_close || 0
      if (trends.length === 0) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">暂无分时数据（非交易时段）</div>
      }
      return (
        <div>
          <div className="flex items-center gap-4 mb-2 text-xs text-gray-500">
            <span>昨收: <b className="text-gray-700">{preClose.toFixed(2)}</b></span>
            <span>最新: <b className={trends[trends.length-1]?.price >= preClose ? 'text-red-500' : 'text-green-500'}>
              {trends[trends.length-1]?.price?.toFixed(2)}
            </b></span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{fontSize: 9, fill: '#9CA3AF'}} tickFormatter={v => v?.split(' ')?.[1]?.slice(0,5) || v} interval={Math.floor(trends.length / 6)} />
              <YAxis tick={{fontSize: 9, fill: '#9CA3AF'}} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle}
                labelFormatter={v => v?.split(' ')?.[1]?.slice(0,5) || v}
                formatter={(v, name) => {
                  if (name === '价格') return [v?.toFixed(2), '价格']
                  if (name === '均价') return [v?.toFixed(2), '均价']
                  return [v, name]
                }} />
              <ReferenceLine y={preClose} stroke="#9CA3AF" strokeDasharray="3 3" label={{ value: '昨收', position: 'right', fontSize: 9, fill: '#9CA3AF' }} />
              <Area type="monotone" dataKey="price" stroke="#EF4444" fill="rgba(239,68,68,0.08)" strokeWidth={1.5} name="价格" dot={false} />
              <Line type="monotone" dataKey="avg" stroke="#F59E0B" strokeWidth={1} name="均价" dot={false} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={trends}>
              <XAxis dataKey="time" tick={{fontSize: 8, fill: '#9CA3AF'}} tickFormatter={v => v?.split(' ')?.[1]?.slice(0,5) || v} interval={Math.floor(trends.length / 6)} />
              <YAxis tick={{fontSize: 8, fill: '#9CA3AF'}} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [(v || 0).toFixed(0), '成交量']} />
              <Bar dataKey="volume" fill="#CBD5E1" radius={[1,1,0,0]} name="成交量" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    }

    if (detailTab === 'chip' && chipData) {
      const klines = chipData.klines || []
      const chips = chipData.chips || []
      const summary = chipData.summary || {}
      if (klines.length === 0) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">暂无K线筹码数据</div>
      }

      return <ChipPeakChart klines={klines} chips={chips} summary={summary} />
    }

    if (detailTab === 'fundflow' && fundFlowData) {
      const klines = fundFlowData.klines || []
      if (klines.length === 0) {
        return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">暂无主力/散户资金数据</div>
      }
      return (
        <div>
          <div className="flex items-center gap-3 mb-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> 主力净流入</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 散户净流入</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> 超大单</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> 大单</span>
          </div>
          {/* Bar chart for main_net and retail_net */}
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={klines}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{fontSize: 9, fill: '#9CA3AF'}} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{fontSize: 9, fill: '#9CA3AF'}} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => {
                const labels = { main_net: '主力净流入', retail_net: '散户净流入' }
                return [typeof v === 'number' ? v.toFixed(2) : v, labels[name] || name]
              }} />
              <ReferenceLine y={0} stroke="#D1D5DB" />
              <Bar dataKey="main_net" name="main_net" radius={[3,3,0,0]}>
                {klines.map((entry, index) => (
                  <rect key={index} fill={(entry.main_net || 0) >= 0 ? '#EF4444' : '#22C55E'} />
                ))}
              </Bar>
              <Bar dataKey="retail_net" name="retail_net" radius={[3,3,0,0]}>
                {klines.map((entry, index) => (
                  <rect key={index} fill={(entry.retail_net || 0) >= 0 ? '#3B82F6' : '#93C5FD'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Line chart for super_big, big, mid */}
          <ResponsiveContainer width="100%" height={140}>
            <RLineChart data={klines}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{fontSize: 9, fill: '#9CA3AF'}} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{fontSize: 9, fill: '#9CA3AF'}} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => {
                const labels = { super_big: '超大单', big: '大单', mid: '中单' }
                return [typeof v === 'number' ? v.toFixed(2) : v, labels[name] || name]
              }} />
              <ReferenceLine y={0} stroke="#D1D5DB" />
              <Line type="monotone" dataKey="super_big" stroke="#7C3AED" strokeWidth={2} name="super_big" dot={{ r: 2 }} />
              <Line type="monotone" dataKey="big" stroke="#F59E0B" strokeWidth={2} name="big" dot={{ r: 2 }} />
              <Line type="monotone" dataKey="mid" stroke="#06B6D4" strokeWidth={2} name="mid" dot={{ r: 2 }} />
            </RLineChart>
          </ResponsiveContainer>
        </div>
      )
    }

    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">暂无数据</div>
  }

  // Render Guba discussion panel
  const renderGubaPanel = () => {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 380px)', minHeight: '360px' }}>
        {/* Guba header bar */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-gray-400">
            {detailStock?.name}吧 {gubaTotal > 0 && <>&middot; {gubaTotal > 10000 ? (gubaTotal / 10000).toFixed(0) + '万' : gubaTotal} 条帖子</>}
          </span>
          <button onClick={handleGubaRefresh} disabled={gubaLoading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-gray-500 hover:text-[#513CC8] hover:bg-[#F0EDFA] transition">
            <RefreshCw size={11} className={gubaLoading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>

        {/* Discussion list with infinite scroll */}
        <div ref={gubaScrollRef} onScroll={handleGubaScroll}
          className="flex-1 overflow-y-auto space-y-0 pr-1">
          {gubaLoading && gubaPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#513CC8] mb-2" />
              <span className="text-xs text-gray-400">加载股吧讨论...</span>
            </div>
          ) : gubaPosts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">暂无讨论数据</div>
          ) : (
            <>
              {gubaPosts.map((post, idx) => (
                <a key={`${post.post_id}-${idx}`}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2.5 hover:bg-[#F8F6FF] rounded-lg transition group border-b border-gray-50 last:border-0">
                  {/* Title */}
                  <div className="flex items-start gap-1.5">
                    <p className="text-xs text-gray-800 font-medium leading-relaxed flex-1 line-clamp-2 group-hover:text-[#513CC8] transition">
                      {post.title}
                    </p>
                    <ExternalLink size={10} className="text-gray-300 group-hover:text-[#513CC8] mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
                  </div>
                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                    <span className="font-medium text-gray-500 truncate max-w-[80px]">{post.author}</span>
                    <span className="flex items-center gap-0.5"><Eye size={9} /> {formatReadCount(post.read_count)}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle size={9} /> {post.comment_count}</span>
                    {post.forward_count > 0 && <span className="flex items-center gap-0.5"><Share2 size={9} /> {post.forward_count}</span>}
                    {post.has_pic && <Image size={9} className="text-blue-400" />}
                    {post.has_video && <Video size={9} className="text-red-400" />}
                    <span className="ml-auto">{formatRelativeTime(post.publish_time)}</span>
                  </div>
                </a>
              ))}

              {/* Load more indicator */}
              {gubaLoadingMore && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 size={16} className="animate-spin text-[#513CC8] mr-2" />
                  <span className="text-[10px] text-gray-400">加载更多...</span>
                </div>
              )}
              {!gubaHasMore && gubaPosts.length > 0 && (
                <div className="text-center py-3 text-[10px] text-gray-300">— 已加载全部 —</div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-2 md:p-4 space-y-3 md:space-y-4 min-h-screen" style={{ background: '#F8F9FC' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">自选个股</h1>
          <p className="text-xs text-gray-400 mt-1">对接东方财富 · 实时涨幅 · 主力/散户资金 · 5日收盘价 · 点击查看详情</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={handleBatchRemove}
              className="px-3 py-2 rounded-xl text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 transition flex items-center gap-1 border border-red-100">
              <Trash2 size={14} />
              删除选中 ({selected.size})
            </button>
          )}
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-lg text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA] transition">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Add Stock */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={addCode} onChange={e => setAddCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="输入股票代码添加自选 如 600519"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#513CC8] focus:ring-2 focus:ring-[#513CC8]/10 focus:outline-none text-sm"
            />
          </div>
          <button onClick={handleAdd} disabled={adding}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition hover:shadow-lg"
            style={{ background: '#513CC8', boxShadow: '0 2px 8px rgba(81,60,200,0.3)' }}>
            {adding ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
            添加自选
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-xs text-gray-400">快速添加:</span>
          {[
            { code: '600519', name: '贵州茅台' },
            { code: '000001', name: '平安银行' },
            { code: '300750', name: '宁德时代' },
            { code: '002594', name: '比亚迪' },
            { code: '600036', name: '招商银行' },
          ].map(s => (
            <button key={s.code} onClick={() => setAddCode(s.code)}
              className="px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 transition border border-gray-200">
              {s.name} {s.code}
            </button>
          ))}
        </div>
      </div>

      {/* Main content: Table + Detail Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
        {/* Stocks Table */}
        <div className={detailStock ? 'col-span-1 md:col-span-7' : 'col-span-1 md:col-span-12'}>
          {loading ? (
            <div className="glass-card p-8 text-center text-gray-400">
              <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
              加载中...
            </div>
          ) : stocks.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#F0EDFA' }}>
                <Star size={32} style={{ color: '#513CC8' }} />
              </div>
              <h3 className="text-lg text-gray-700 mb-2 font-medium">暂无自选股</h3>
              <p className="text-sm text-gray-400">在上方输入股票代码添加到自选列表</p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="text-left p-3 w-8">
                      <input type="checkbox"
                        checked={selected.size === stocks.length && stocks.length > 0}
                        onChange={() => {
                          if (selected.size === stocks.length) setSelected(new Set())
                          else setSelected(new Set(stocks.map(s => s.code)))
                        }}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left p-3 text-xs text-gray-500 font-medium">股票</th>
                    <th className="text-right p-3 text-xs text-gray-500 font-medium">现价</th>
                    <th className="text-right p-3 text-xs text-gray-500 font-medium">涨跌幅</th>
                    <th className="text-right p-3 text-xs text-gray-500 font-medium">主力净额</th>
                    <th className="text-right p-3 text-xs text-gray-500 font-medium">散户净额</th>
                    {!detailStock && <th className="text-center p-3 text-xs text-gray-500 font-medium">近5日收盘</th>}
                    <th className="text-center p-3 text-xs text-gray-500 font-medium w-16">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s, i) => {
                    const isUp = (s.change_pct || 0) >= 0
                    const isActive = detailStock?.code === s.code
                    return (
                      <tr key={s.code}
                        className={`border-b border-gray-50 transition cursor-pointer ${
                          isActive ? 'bg-[#F0EDFA]/60 border-l-2 border-l-[#513CC8]' :
                          selected.has(s.code) ? 'bg-[#F0EDFA]/30 hover:bg-[#F0EDFA]/40' :
                          'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          if (isActive) {
                            setDetailStock(null)
                            setGubaPosts([])
                          } else {
                            setDetailStock(s)
                            setDetailTab('trend')
                            setGubaPosts([])
                            setGubaPage(1)
                            setGubaHasMore(true)
                          }
                        }}
                      >
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(s.code)} onChange={() => toggleSelect(s.code)}
                            className="rounded border-gray-300" />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-1 h-8 rounded-full ${isUp ? 'bg-red-400' : 'bg-green-400'}`}></div>
                            <div>
                              <p className="font-medium text-gray-800">{s.name}</p>
                              <p className="text-xs text-gray-400">{s.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`p-3 text-right font-semibold ${isUp ? 'stock-up' : 'stock-down'}`}>
                          {s.price ? s.price.toFixed(2) : '---'}
                        </td>
                        <td className={`p-3 text-right font-medium ${isUp ? 'stock-up' : 'stock-down'}`}>
                          <span className="px-2 py-0.5 rounded text-xs" 
                            style={{ background: isUp ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)' }}>
                            {isUp ? '+' : ''}{(s.change_pct || 0).toFixed(2)}%
                          </span>
                        </td>
                        <td className={`p-3 text-right text-xs ${(s.main_net || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
                          {formatAmount(s.main_net)}
                        </td>
                        <td className={`p-3 text-right text-xs ${(s.retail_net || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
                          {formatAmount(s.retail_net)}
                        </td>
                        {!detailStock && (
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              {(s.five_day_close || []).map((d, j) => (
                                <div key={j} className="text-center">
                                  <div className="text-[10px] text-gray-400">{d.date?.slice(5)}</div>
                                  <div className="text-xs font-medium text-gray-600">{d.close?.toFixed(2)}</div>
                                </div>
                              ))}
                              {(!s.five_day_close || s.five_day_close.length === 0) && (
                                <span className="text-xs text-gray-300">---</span>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleRemove(s.code, s.name)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-gray-50/50 text-xs text-gray-400 flex items-center justify-between border-t border-gray-100">
                <span>共 {stocks.length} 只自选股 · 点击行查看详细图表</span>
                <span>数据来源：东方财富 · 自动刷新</span>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {detailStock && (
          <div className="col-span-1 md:col-span-5">
            <div className="glass-card p-4 sticky top-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-8 rounded-full ${(detailStock.change_pct || 0) >= 0 ? 'bg-red-400' : 'bg-green-400'}`}></div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{detailStock.name}</h3>
                    <p className="text-xs text-gray-400">{detailStock.code}</p>
                  </div>
                  <span className={`text-lg font-bold ml-2 ${(detailStock.change_pct || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
                    {detailStock.price?.toFixed(2)}
                  </span>
                  <span className={`text-sm px-2 py-0.5 rounded ${(detailStock.change_pct || 0) >= 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                    {(detailStock.change_pct || 0) >= 0 ? '+' : ''}{(detailStock.change_pct || 0).toFixed(2)}%
                  </span>
                </div>
                <button onClick={() => setDetailStock(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                  <X size={16} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-4 bg-gray-50 rounded-xl p-1">
                {detailTabs.map(tab => (
                  <button key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      detailTab === tab.key ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white'
                    }`}
                    style={detailTab === tab.key ? { background: '#513CC8' } : {}}>
                    <tab.icon size={13} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Chart area / Guba area */}
              <div className="min-h-[300px]">
                {detailTab === 'guba' ? renderGubaPanel() : renderDetailChart()}
              </div>

              {/* Quick stats (hide when guba tab is active) */}
              {detailTab !== 'guba' && (
              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">最高</p>
                  <p className="text-xs font-bold stock-up">{detailStock.high?.toFixed(2) || '---'}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">最低</p>
                  <p className="text-xs font-bold stock-down">{detailStock.low?.toFixed(2) || '---'}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">主力净额</p>
                  <p className={`text-xs font-bold ${(detailStock.main_net || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>{formatAmount(detailStock.main_net)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">散户净额</p>
                  <p className={`text-xs font-bold ${(detailStock.retail_net || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>{formatAmount(detailStock.retail_net)}</p>
                </div>
              </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modern Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        detail={confirmDialog.detail}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        danger={confirmDialog.danger}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false })}
      />
    </div>
  )
}
