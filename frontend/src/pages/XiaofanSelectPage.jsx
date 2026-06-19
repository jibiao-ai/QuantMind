import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { 
  getXiaofanCategories, createXiaofanCategory, updateXiaofanCategory, deleteXiaofanCategory,
  addXiaofanStock, removeXiaofanStock, getDataQuote, getDataKline, getDataResearch,
  getDataNews, getDataAnnounce, getChipDistribution, validateStockCode, getGubaDiscussion
} from '../services/api'
import { 
  Plus, Trash2, RefreshCw, Search, X, BarChart3, MessageCircle, FileText, 
  Newspaper, Edit3, FolderPlus, ExternalLink, Eye, Loader2,
  Maximize2, Minimize2, Play, Pause, Clock, BookOpen, ChevronDown, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

// ==================== K线图组件 ====================
function KlineChart({ klines, title, compact = false, darkMode = true }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  const H = compact ? 180 : 260

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !klines || klines.length === 0) return
    const container = containerRef.current
    if (!container) return

    const dpr = window.devicePixelRatio || 1
    const W = container.getBoundingClientRect().width || 300
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const displayKlines = klines.slice(compact ? -40 : -80)
    const padL = compact ? 35 : 45
    const padR = 5
    const padT = compact ? 8 : 14
    const padB = compact ? 14 : 20
    const volH = compact ? 25 : 45
    const gapH = 5

    const kDrawW = W - padL - padR
    const kDrawH = H - padT - padB - volH - gapH

    // Price range
    let min = Infinity, max = -Infinity
    displayKlines.forEach(k => { if (k.low < min) min = k.low; if (k.high > max) max = k.high })
    const padding = (max - min) * 0.05 || 0.5
    const priceMin = min - padding, priceMax = max + padding

    // Background - white for light mode, dark for fullscreen
    ctx.fillStyle = darkMode ? '#0f0f14' : '#ffffff'
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = padT + (kDrawH / 4) * i
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
    }

    // Y labels
    ctx.fillStyle = darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)'
    ctx.font = `${compact ? 8 : 9}px monospace`
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const y = padT + (kDrawH / 4) * i
      const price = priceMax - ((priceMax - priceMin) / 4) * i
      ctx.fillText(price.toFixed(2), padL - 3, y + 3)
    }

    const priceToY = (p) => padT + ((priceMax - p) / (priceMax - priceMin)) * kDrawH
    const barW = Math.max(1.5, Math.floor(kDrawW / displayKlines.length) - 1)
    const barGap = (kDrawW - barW * displayKlines.length) / (displayKlines.length + 1)

    // Candlesticks
    displayKlines.forEach((k, i) => {
      const x = padL + barGap + (barW + barGap) * i
      const isUp = k.close >= k.open
      const bodyTop = priceToY(Math.max(k.open, k.close))
      const bodyBot = priceToY(Math.min(k.open, k.close))
      const bodyH = Math.max(1, bodyBot - bodyTop)
      const cx = x + barW / 2

      ctx.strokeStyle = isUp ? '#ff4757' : '#2ed573'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx, priceToY(k.high)); ctx.lineTo(cx, priceToY(k.low)); ctx.stroke()
      ctx.fillStyle = isUp ? '#ff4757' : '#2ed573'
      ctx.fillRect(x, bodyTop, barW, bodyH)
    })

    // MA lines
    const calcMA = (data, period) => data.map((_, i) => {
      if (i < period - 1) return null
      let sum = 0; for (let j = i - period + 1; j <= i; j++) sum += data[j].close
      return sum / period
    })
    const drawMA = (ma, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath()
      let started = false
      ma.forEach((v, i) => {
        if (v === null) return
        const x = padL + barGap + (barW + barGap) * i + barW / 2
        const y = priceToY(v)
        if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }
    drawMA(calcMA(displayKlines, 5), '#ffa502')
    drawMA(calcMA(displayKlines, 10), '#3498db')
    if (!compact) drawMA(calcMA(displayKlines, 20), '#a55eea')

    // Volume bars
    const volTop = H - volH
    const maxVol = Math.max(...displayKlines.map(k => k.volume || 0), 1)
    displayKlines.forEach((k, i) => {
      const x = padL + barGap + (barW + barGap) * i
      const isUp = k.close >= k.open
      const h = Math.max(1, ((k.volume || 0) / maxVol) * (volH - 5))
      ctx.fillStyle = isUp ? 'rgba(255,71,87,0.4)' : 'rgba(46,213,115,0.4)'
      ctx.fillRect(x, volTop + (volH - 5) - h, barW, h)
    })

    // Title
    if (title) {
      ctx.fillStyle = darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
      ctx.font = `bold ${compact ? 9 : 10}px sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(title, padL + 5, padT + 10)
    }

    // Latest price/change
    const last = displayKlines[displayKlines.length - 1]
    const prev = displayKlines[displayKlines.length - 2]
    if (last && prev) {
      const pct = ((last.close - prev.close) / prev.close * 100)
      const isUp = pct >= 0
      ctx.fillStyle = isUp ? '#ff4757' : '#2ed573'
      ctx.font = `bold ${compact ? 10 : 12}px monospace`
      ctx.textAlign = 'right'
      ctx.fillText(`${last.close.toFixed(2)} ${isUp ? '+' : ''}${pct.toFixed(2)}%`, W - padR - 5, padT + 12)
    }
  }, [klines, title, compact, H, darkMode])

  return (
    <div ref={containerRef} className="rounded-lg overflow-hidden" style={{ background: darkMode ? '#0f0f14' : '#ffffff' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: `${H}px`, cursor: 'crosshair' }} />
    </div>
  )
}

// ==================== 弹窗：股吧/新闻/公告 ====================
function InfoModal({ open, onClose, title, loading, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'scaleIn 0.2s ease-out' }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> 加载中...
            </div>
          ) : children}
        </div>
      </div>
      <style>{`@keyframes scaleIn { from { opacity:0; transform:scale(0.9) } to { opacity:1; transform:scale(1) } }`}</style>
    </div>
  )
}

// ==================== 确认弹窗组件 ====================
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

// ==================== 主组件 ====================
export default function XiaofanSelectPage() {
  // Category state
  const [categories, setCategories] = useState([])
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [editName, setEditName] = useState('')

  // Stock state
  const [addStockCode, setAddStockCode] = useState('')
  const [addingStock, setAddingStock] = useState(false)
  const [stockQuotes, setStockQuotes] = useState({})
  const [refreshing, setRefreshing] = useState(false)

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({ open: false })

  // K-line data for all stocks
  const [stockKlines, setStockKlines] = useState({}) // { code: { day, week, month, year } }
  const [klineLoading, setKlineLoading] = useState({})

  // Auto-rotation
  const [autoRotate, setAutoRotate] = useState(false)
  const [rotateInterval, setRotateInterval] = useState(5) // minutes (auto-refresh is 5min)
  const [showRotateMenu, setShowRotateMenu] = useState(false)
  const rotateTimerRef = useRef(null)

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenRef = useRef(null)

  // Info modal (guba/news/announce)
  const [infoModal, setInfoModal] = useState({ open: false, type: '', code: '', name: '' })
  const [modalData, setModalData] = useState([])
  const [modalLoading, setModalLoading] = useState(false)

  // K-line period display per stock
  const [stockPeriod, setStockPeriod] = useState({}) // { code: 'day'|'week'|'month'|'year' }

  // === Load categories ===
  const loadCategories = useCallback(async () => {
    try {
      const res = await getXiaofanCategories()
      if (res.code === 0) {
        setCategories(res.data || [])
        if (!activeCategoryId && res.data?.length > 0) {
          setActiveCategoryId(res.data[0].id)
        }
      }
    } catch (e) {
      console.error('Load categories failed:', e)
    }
    setLoadingCategories(false)
  }, [activeCategoryId])

  useEffect(() => { loadCategories() }, [])

  // Active stocks
  const activeCategory = useMemo(() => categories.find(c => c.id === activeCategoryId), [categories, activeCategoryId])
  const activeStocks = activeCategory?.stocks || []

  // === Fetch real-time quotes (1 minute interval) ===
  const fetchQuotes = useCallback(async () => {
    if (activeStocks.length === 0) return
    const codes = activeStocks.map(s => s.code).join(',')
    try {
      const res = await getDataQuote({ codes })
      if (res.code === 0 && res.data) {
        const quotesMap = {}
        if (Array.isArray(res.data)) {
          res.data.forEach(q => { quotesMap[q.code] = q })
        } else if (res.data.quotes) {
          res.data.quotes.forEach(q => { quotesMap[q.code] = q })
        }
        setStockQuotes(quotesMap)
      }
    } catch (e) { console.error('Fetch quotes failed:', e) }
  }, [activeStocks])

  useEffect(() => {
    fetchQuotes()
    const interval = setInterval(fetchQuotes, 300000) // 5分钟刷新
    return () => clearInterval(interval)
  }, [fetchQuotes])

  // === Fetch K-line data for all active stocks ===
  const fetchAllKlines = useCallback(async () => {
    if (activeStocks.length === 0) return
    for (const stock of activeStocks) {
      if (stockKlines[stock.code]) continue // already loaded
      setKlineLoading(prev => ({ ...prev, [stock.code]: true }))
      try {
        const [dayRes, weekRes, monthRes, yearRes] = await Promise.allSettled([
          getDataKline({ code: stock.code, period: 'day', count: 120 }),
          getDataKline({ code: stock.code, period: 'week', count: 120 }),
          getDataKline({ code: stock.code, period: 'month', count: 120 }),
          getDataKline({ code: stock.code, period: 'year', count: 60 }),
        ])
        setStockKlines(prev => ({
          ...prev,
          [stock.code]: {
            day: dayRes.status === 'fulfilled' && dayRes.value?.code === 0 ? (dayRes.value.data?.klines || dayRes.value.data || []) : [],
            week: weekRes.status === 'fulfilled' && weekRes.value?.code === 0 ? (weekRes.value.data?.klines || weekRes.value.data || []) : [],
            month: monthRes.status === 'fulfilled' && monthRes.value?.code === 0 ? (monthRes.value.data?.klines || monthRes.value.data || []) : [],
            year: yearRes.status === 'fulfilled' && yearRes.value?.code === 0 ? (yearRes.value.data?.klines || yearRes.value.data || []) : [],
          }
        }))
      } catch (e) { console.error(`Fetch kline for ${stock.code} failed`, e) }
      setKlineLoading(prev => ({ ...prev, [stock.code]: false }))
    }
  }, [activeStocks, stockKlines])

  useEffect(() => { fetchAllKlines() }, [activeStocks])

  // === Auto-rotate categories ===
  useEffect(() => {
    if (autoRotate && categories.length > 1) {
      rotateTimerRef.current = setInterval(() => {
        setActiveCategoryId(prev => {
          const idx = categories.findIndex(c => c.id === prev)
          const next = (idx + 1) % categories.length
          return categories[next].id
        })
      }, rotateInterval * 60000)
    }
    return () => { if (rotateTimerRef.current) clearInterval(rotateTimerRef.current) }
  }, [autoRotate, rotateInterval, categories])

  // === Fullscreen ===
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      fullscreenRef.current?.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // === Category CRUD ===
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) { toast.error('请输入分类名称'); return }
    try {
      const res = await createXiaofanCategory({ name: newCategoryName.trim() })
      if (res.code === 0) {
        toast.success('分类创建成功')
        setNewCategoryName('')
        loadCategories()
        if (res.data?.id) setActiveCategoryId(res.data.id)
      } else { toast.error(res.error || '创建失败') }
    } catch (e) { toast.error('创建分类失败') }
  }

  const handleUpdateCategory = async (id) => {
    if (!editName.trim()) return
    try {
      const res = await updateXiaofanCategory(id, { name: editName.trim() })
      if (res.code === 0) { toast.success('已更新'); setEditingCategory(null); loadCategories() }
    } catch (e) { toast.error('更新失败') }
  }

  const handleDeleteCategory = async (id) => {
    const cat = categories.find(c => c.id === id)
    setConfirmDialog({
      open: true,
      title: '删除分类',
      message: '确定删除该分类及其所有股票？此操作不可恢复。',
      detail: cat ? `${cat.name}（${cat.stocks?.length || 0} 只股票）` : '',
      confirmText: '确认删除',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog({ open: false })
        try {
          const res = await deleteXiaofanCategory(id)
          if (res.code === 0) {
            toast.success('已删除')
            if (activeCategoryId === id) setActiveCategoryId(categories.find(c => c.id !== id)?.id || null)
            loadCategories()
          }
        } catch (e) { toast.error('删除失败') }
      }
    })
  }

  // === Add stock with validation ===
  const handleAddStock = async () => {
    if (!activeCategoryId) { toast.error('请先选择一个分类'); return }
    const code = addStockCode.replace(/\D/g, '')
    if (!code || code.length !== 6) { toast.error('请输入6位股票代码'); return }

    setAddingStock(true)
    try {
      // Step 1: Validate stock code and get real name
      const validateRes = await validateStockCode({ code })
      if (!validateRes.valid) {
        toast.error(`无效股票代码 ${code}，请检查后重试`)
        setAddingStock(false)
        return
      }

      const realName = validateRes.name || code
      
      // Step 2: Add to category with validated name
      const res = await addXiaofanStock(activeCategoryId, { code, name: realName })
      if (res.code === 0) {
        toast.success(`已添加 ${realName}(${code})`)
        setAddStockCode('')
        setStockKlines(prev => { const n = { ...prev }; delete n[code]; return n }) // force reload klines
        loadCategories()
      } else { toast.error(res.error || '添加失败') }
    } catch (e) { toast.error('添加股票失败') }
    setAddingStock(false)
  }

  const handleRemoveStock = async (stockId, name) => {
    setConfirmDialog({
      open: true,
      title: '移除股票',
      message: '确定将该股票从当前分类中移除吗？',
      detail: name,
      confirmText: '确认移除',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog({ open: false })
        try {
          const res = await removeXiaofanStock(stockId)
          if (res.code === 0) { toast.success(`已移除 ${name}`); loadCategories() }
        } catch (e) { toast.error('移除失败') }
      }
    })
  }

  // === Info Modal (guba/news/announce) ===
  const openInfoModal = async (type, code, name) => {
    setInfoModal({ open: true, type, code, name })
    setModalData([])
    setModalLoading(true)
    try {
      let res
      if (type === 'guba') {
        // 使用与自选个股相同的东方财富股吧接口（已验证可用）
        res = await getGubaDiscussion({ code, page: 1, page_size: 30 })
        if (res?.code === 0 && res.data) {
          const posts = res.data.posts || []
          setModalData(posts)
          setModalLoading(false)
          return
        }
      } else if (type === 'news') res = await getDataNews({ code })
      else if (type === 'announce') res = await getDataAnnounce({ code, page_size: 20 })
      else if (type === 'research') res = await getDataResearch({ code, page_size: 20 })

      if (res?.code === 0) {
        const data = res.data?.posts || res.data?.list || res.data || []
        setModalData(Array.isArray(data) ? data : [])
      }
    } catch (e) { console.error(`Load ${type} failed:`, e) }
    setModalLoading(false)
  }

  // === Refresh ===
  const handleRefresh = async () => {
    setRefreshing(true)
    setStockKlines({}) // force reload all klines
    await fetchQuotes()
    setRefreshing(false)
    toast.success('已刷新')
  }

  // Get period for stock
  const getPeriod = (code) => stockPeriod[code] || 'day'
  const setPeriodForStock = (code, period) => setStockPeriod(prev => ({ ...prev, [code]: period }))

  const periodLabels = { day: '日K', week: '周K', month: '月K', year: '年K' }

  return (
    <div ref={fullscreenRef} className={`p-4 space-y-4 min-h-screen ${isFullscreen ? 'bg-[#0a0a0f]' : ''}`} 
      style={{ background: isFullscreen ? '#0a0a0f' : '#F8F9FC' }}>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isFullscreen ? 'text-white' : 'gradient-text'}`}>小樊精选</h1>
          <p className={`text-xs mt-1 ${isFullscreen ? 'text-gray-500' : 'text-gray-400'}`}>
            自定义分类 · 多周期K线 · 通达信+腾讯+东方财富多源数据
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-rotate control */}
          <div className="relative">
            <button onClick={() => setShowRotateMenu(!showRotateMenu)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                autoRotate ? 'bg-[#513CC8] text-white' : isFullscreen ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {autoRotate ? <Pause size={12} /> : <Play size={12} />}
              <Clock size={12} />
              {autoRotate ? `${rotateInterval}分轮播` : '轮播'}
            </button>
            {showRotateMenu && (
              <div className={`absolute right-0 top-full mt-1 rounded-xl shadow-xl border z-50 p-2 ${
                isFullscreen ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                {[1, 5, 10, 15].map(m => (
                  <button key={m} onClick={() => { setRotateInterval(m); setAutoRotate(true); setShowRotateMenu(false) }}
                    className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs transition ${
                      isFullscreen ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
                    } ${rotateInterval === m && autoRotate ? 'font-bold text-[#513CC8]' : ''}`}>
                    每 {m} 分钟切换
                  </button>
                ))}
                {autoRotate && (
                  <button onClick={() => { setAutoRotate(false); setShowRotateMenu(false) }}
                    className="block w-full text-left px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 transition mt-1 border-t border-gray-100 pt-2">
                    停止轮播
                  </button>
                )}
              </div>
            )}
          </div>

          <button onClick={handleRefresh} disabled={refreshing}
            className={`p-2 rounded-lg transition ${isFullscreen ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA]'}`}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={toggleFullscreen}
            className={`p-2 rounded-lg transition ${isFullscreen ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA]'}`}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Category bar + Add stock */}
      <div className={`rounded-xl p-4 ${isFullscreen ? 'bg-gray-900/50 border border-gray-800' : 'glass-card'}`}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Category tabs */}
          <div className="flex items-center gap-1 flex-wrap flex-1">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center group">
                {editingCategory === cat.id ? (
                  <div className="flex items-center gap-1">
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdateCategory(cat.id); if (e.key === 'Escape') setEditingCategory(null) }}
                      className="px-2 py-1 text-xs border border-[#513CC8] rounded-lg focus:outline-none w-20" autoFocus />
                    <button onClick={() => handleUpdateCategory(cat.id)} className="text-[#513CC8] text-xs">✓</button>
                    <button onClick={() => setEditingCategory(null)} className="text-gray-400 text-xs">✗</button>
                  </div>
                ) : (
                  <button onClick={() => { setActiveCategoryId(cat.id); setStockKlines({}) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                      activeCategoryId === cat.id
                        ? 'text-white shadow-md' 
                        : isFullscreen ? 'text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700' : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                    style={activeCategoryId === cat.id ? { background: '#513CC8' } : {}}>
                    {cat.name}
                    <span className="text-[10px] opacity-70">({cat.stocks?.length || 0})</span>
                  </button>
                )}
                {activeCategoryId === cat.id && editingCategory !== cat.id && (
                  <div className="flex ml-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { setEditingCategory(cat.id); setEditName(cat.name) }}
                      className="p-0.5 rounded text-gray-400 hover:text-[#513CC8]"><Edit3 size={11} /></button>
                    <button onClick={() => handleDeleteCategory(cat.id)}
                      className="p-0.5 rounded text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* New category */}
          <div className="flex items-center gap-2">
            <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
              placeholder="新分类名称"
              className={`px-3 py-1.5 text-xs border rounded-lg focus:border-[#513CC8] focus:ring-1 focus:ring-[#513CC8]/20 focus:outline-none w-24 ${
                isFullscreen ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'border-gray-200'}`} />
            <button onClick={handleCreateCategory}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1 hover:shadow-md transition"
              style={{ background: '#513CC8' }}>
              <FolderPlus size={12} /> 新建
            </button>
          </div>
        </div>

        {/* Add stock */}
        {activeCategoryId && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100/50">
            <div className="relative flex-1 max-w-[200px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={addStockCode} onChange={e => setAddStockCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStock()}
                placeholder="输入6位股票代码"
                className={`w-full pl-8 pr-3 py-2 text-xs border rounded-lg focus:border-[#513CC8] focus:outline-none ${
                  isFullscreen ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'border-gray-200'}`} />
            </div>
            <button onClick={handleAddStock} disabled={addingStock}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white flex items-center gap-1 hover:shadow-md transition"
              style={{ background: '#513CC8' }}>
              {addingStock ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              添加（自动校验）
            </button>
            <span className={`text-[10px] ${isFullscreen ? 'text-gray-500' : 'text-gray-400'}`}>
              添加时自动验证代码有效性并获取真实股票名称
            </span>
          </div>
        )}
      </div>

      {/* Main content: Stock K-line grid */}
      {loadingCategories ? (
        <div className={`rounded-xl p-8 text-center ${isFullscreen ? 'text-gray-400' : 'glass-card text-gray-400'}`}>
          <Loader2 size={24} className="mx-auto mb-2 animate-spin" /> 加载中...
        </div>
      ) : categories.length === 0 ? (
        <div className={`rounded-xl p-12 text-center ${isFullscreen ? 'bg-gray-900/50' : 'glass-card'}`}>
          <FolderPlus size={32} className="mx-auto mb-3 text-[#513CC8]" />
          <h3 className={`text-lg font-medium mb-2 ${isFullscreen ? 'text-white' : 'text-gray-700'}`}>还没有分类</h3>
          <p className={`text-sm ${isFullscreen ? 'text-gray-500' : 'text-gray-400'}`}>在上方创建你的第一个精选分类</p>
        </div>
      ) : activeStocks.length === 0 ? (
        <div className={`rounded-xl p-8 text-center ${isFullscreen ? 'bg-gray-900/50' : 'glass-card'}`}>
          <Plus size={24} className="mx-auto mb-2 text-[#513CC8]" />
          <p className={`text-sm ${isFullscreen ? 'text-gray-400' : 'text-gray-500'}`}>当前分类暂无股票，请添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {activeStocks.map(stock => {
            const q = stockQuotes[stock.code] || {}
            const price = q.price || q.current_price || 0
            const changePct = q.change_pct || q.pct_change || 0
            const isUp = changePct >= 0
            const klines = stockKlines[stock.code]
            const period = getPeriod(stock.code)
            const currentKlines = klines?.[period] || []
            const isKlineLoading = klineLoading[stock.code]

            return (
              <div key={stock.id}
                className={`rounded-xl overflow-hidden transition-all hover:shadow-xl ${
                  isFullscreen ? 'bg-gray-900/80 border border-gray-800 hover:border-gray-600' : 'bg-white border border-gray-200 hover:border-[#513CC8]/30 shadow-sm'
                }`}>
                {/* Stock header */}
                <div className={`px-3 py-2.5 flex items-center justify-between ${
                  isFullscreen ? 'border-b border-gray-800' : 'border-b border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-1 h-6 rounded-full ${isUp ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    <div>
                      <span className={`text-sm font-bold ${isFullscreen ? 'text-white' : 'text-gray-800'}`}>
                        {stock.name || stock.code}
                      </span>
                      <span className={`text-[10px] ml-1.5 ${isFullscreen ? 'text-gray-500' : 'text-gray-400'}`}>{stock.code}</span>
                    </div>
                    {price > 0 && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <span className={`text-sm font-bold ${isUp ? 'text-red-500' : 'text-green-500'}`}>{price.toFixed(2)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isUp ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                          {isUp ? '+' : ''}{changePct.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Info buttons */}
                    <button onClick={() => openInfoModal('guba', stock.code, stock.name)}
                      className={`p-1 rounded transition ${isFullscreen ? 'text-gray-500 hover:text-yellow-400 hover:bg-gray-800' : 'text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA]'}`}
                      title="股吧">
                      <MessageCircle size={12} />
                    </button>
                    <button onClick={() => openInfoModal('news', stock.code, stock.name)}
                      className={`p-1 rounded transition ${isFullscreen ? 'text-gray-500 hover:text-blue-400 hover:bg-gray-800' : 'text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA]'}`}
                      title="新闻">
                      <Newspaper size={12} />
                    </button>
                    <button onClick={() => openInfoModal('announce', stock.code, stock.name)}
                      className={`p-1 rounded transition ${isFullscreen ? 'text-gray-500 hover:text-orange-400 hover:bg-gray-800' : 'text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA]'}`}
                      title="公告">
                      <FileText size={12} />
                    </button>
                    <button onClick={() => openInfoModal('research', stock.code, stock.name)}
                      className={`p-1 rounded transition ${isFullscreen ? 'text-gray-500 hover:text-purple-400 hover:bg-gray-800' : 'text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA]'}`}
                      title="研报">
                      <BookOpen size={12} />
                    </button>
                    <button onClick={() => handleRemoveStock(stock.id, stock.name || stock.code)}
                      className={`p-1 rounded transition ${isFullscreen ? 'text-gray-600 hover:text-red-400 hover:bg-gray-800' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Period selector */}
                <div className={`px-3 py-1.5 flex gap-0.5 ${isFullscreen ? 'bg-gray-900' : 'bg-gray-50'}`}>
                  {['day', 'week', 'month', 'year'].map(p => (
                    <button key={p} onClick={() => setPeriodForStock(stock.code, p)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        period === p
                          ? 'bg-[#513CC8] text-white'
                          : isFullscreen ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'
                      }`}>
                      {periodLabels[p]}
                    </button>
                  ))}
                </div>

                {/* K-line chart */}
                <div className="p-1.5">
                  {isKlineLoading ? (
                    <div className={`flex items-center justify-center ${isFullscreen ? 'text-gray-500' : 'text-gray-400'}`} style={{ height: '180px' }}>
                      <Loader2 size={16} className="animate-spin mr-1.5" /><span className="text-xs">加载K线...</span>
                    </div>
                  ) : currentKlines.length > 0 ? (
                    <KlineChart klines={currentKlines} title={periodLabels[period]} compact={true} darkMode={isFullscreen} />
                  ) : (
                    <div className={`flex items-center justify-center text-xs ${isFullscreen ? 'text-gray-600' : 'text-gray-400'}`} style={{ height: '180px' }}>
                      暂无{periodLabels[period]}数据
                    </div>
                  )}
                </div>

                {/* Bottom stats */}
                <div className={`px-3 py-2 grid grid-cols-4 gap-1 text-center ${
                  isFullscreen ? 'bg-gray-900/50 border-t border-gray-800' : 'bg-gray-50/80 border-t border-gray-100'}`}>
                  <div>
                    <p className={`text-[9px] ${isFullscreen ? 'text-gray-600' : 'text-gray-400'}`}>最高</p>
                    <p className="text-[10px] font-bold text-red-500">{q.high ? q.high.toFixed(2) : '---'}</p>
                  </div>
                  <div>
                    <p className={`text-[9px] ${isFullscreen ? 'text-gray-600' : 'text-gray-400'}`}>最低</p>
                    <p className="text-[10px] font-bold text-green-500">{q.low ? q.low.toFixed(2) : '---'}</p>
                  </div>
                  <div>
                    <p className={`text-[9px] ${isFullscreen ? 'text-gray-600' : 'text-gray-400'}`}>成交量</p>
                    <p className={`text-[10px] font-bold ${isFullscreen ? 'text-gray-300' : 'text-gray-700'}`}>
                      {q.volume ? (q.volume >= 10000 ? (q.volume / 10000).toFixed(0) + '万' : q.volume) : '---'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-[9px] ${isFullscreen ? 'text-gray-600' : 'text-gray-400'}`}>换手率</p>
                    <p className={`text-[10px] font-bold ${isFullscreen ? 'text-gray-300' : 'text-gray-700'}`}>
                      {q.turnover_rate ? q.turnover_rate.toFixed(2) + '%' : '---'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer info */}
      {activeStocks.length > 0 && (
        <div className={`text-center text-[10px] py-2 ${isFullscreen ? 'text-gray-600' : 'text-gray-400'}`}>
          共 {activeStocks.length} 只 · 数据源：通达信 + 腾讯 + 东方财富 · 5分钟自动刷新
          {autoRotate && ` · 轮播中(${rotateInterval}分钟)`}
        </div>
      )}

      {/* Info Modal */}
      <InfoModal
        open={infoModal.open}
        onClose={() => setInfoModal({ open: false, type: '', code: '', name: '' })}
        title={`${infoModal.name}(${infoModal.code}) - ${{ guba: '股吧讨论', news: '新闻资讯', announce: '公告信息', research: '研报' }[infoModal.type] || ''}`}
        loading={modalLoading}>
        {modalData.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>
        ) : (
          <div className="space-y-1">
            {modalData.map((item, idx) => (
              <a key={idx} href={item.url || item.pdf_url || '#'} target="_blank" rel="noopener noreferrer"
                className="block px-3 py-2.5 rounded-lg hover:bg-[#F8F6FF] transition group border-b border-gray-50 last:border-0">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-[#513CC8] transition">
                      {item.title || item.announcementTitle || item.report_title || item.content || ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                      {item.author && <span className="font-medium text-gray-500">{item.author}</span>}
                      {item.source && <span>{item.source}</span>}
                      {item.org_name && <span>{item.org_name}</span>}
                      {(item.read_count || item.read_count === 0) && <span className="flex items-center gap-0.5"><Eye size={9} />{item.read_count > 10000 ? (item.read_count / 10000).toFixed(1) + '万' : item.read_count}</span>}
                      {item.comment_count > 0 && <span className="flex items-center gap-0.5"><MessageCircle size={9} />{item.comment_count}</span>}
                      <span className="ml-auto">{item.publish_time?.slice(0, 16) || item.datetime || item.date || item.announcementTime || ''}</span>
                    </div>
                  </div>
                  <ExternalLink size={11} className="text-gray-300 group-hover:text-[#513CC8] flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition" />
                </div>
              </a>
            ))}
          </div>
        )}
      </InfoModal>

      {/* Confirm Dialog */}
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
