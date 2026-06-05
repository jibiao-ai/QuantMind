import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { 
  getXiaofanCategories, createXiaofanCategory, updateXiaofanCategory, deleteXiaofanCategory,
  addXiaofanStock, removeXiaofanStock, getDataQuote, getDataKline, getDataResearch,
  getDataNews, getDataGuba, getDataF10, getDataAnnounce, getChipDistribution
} from '../services/api'
import { 
  Plus, Trash2, RefreshCw, Search, X, BarChart3, MessageCircle, FileText, 
  Newspaper, Edit3, FolderPlus, ChevronRight, ExternalLink, Eye, Loader2,
  TrendingUp, TrendingDown, BookOpen, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

// ==================== ChipPeakChart (Mini version for Xiaofan) ====================
function MiniChipChart({ klines, chips, summary }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !klines || klines.length === 0) return
    const container = containerRef.current
    if (!container) return

    const dpr = window.devicePixelRatio || 1
    const W = container.getBoundingClientRect().width || 400
    const H = 240
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const displayKlines = klines.slice(-60)
    const klineW = Math.floor(W * 0.72)
    const chipW = W - klineW
    const padL = 40, padR = 5, padT = 12, padB = 18

    const kDrawW = klineW - padL - padR
    const kDrawH = H - padT - padB - 50

    // Price range
    let min = Infinity, max = -Infinity
    displayKlines.forEach(k => { if (k.low < min) min = k.low; if (k.high > max) max = k.high })
    const padding = (max - min) * 0.05
    const priceMin = min - padding, priceMax = max + padding

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = 'rgba(0,0,0,0.05)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = padT + (kDrawH / 4) * i
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(klineW - padR, y); ctx.stroke()
    }

    const priceToY = (p) => padT + ((priceMax - p) / (priceMax - priceMin)) * kDrawH
    const barW = Math.max(2, Math.floor(kDrawW / displayKlines.length) - 1)
    const barGap = (kDrawW - barW * displayKlines.length) / (displayKlines.length + 1)

    // Candlesticks
    displayKlines.forEach((k, i) => {
      const x = padL + barGap + (barW + barGap) * i
      const isUp = k.close >= k.open
      const bodyTop = priceToY(Math.max(k.open, k.close))
      const bodyBot = priceToY(Math.min(k.open, k.close))
      const bodyH = Math.max(1, bodyBot - bodyTop)
      const cx = x + barW / 2

      ctx.strokeStyle = isUp ? '#ef4444' : '#22c55e'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx, priceToY(k.high)); ctx.lineTo(cx, priceToY(k.low)); ctx.stroke()
      ctx.fillStyle = isUp ? '#ef4444' : '#22c55e'
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
    drawMA(calcMA(displayKlines, 5), '#f59e0b')
    drawMA(calcMA(displayKlines, 10), '#3b82f6')
    drawMA(calcMA(displayKlines, 20), '#a855f7')

    // Chip distribution (right side)
    if (chips && chips.length > 0) {
      const chipDrawW = chipW - 10
      const maxPct = Math.max(...chips.map(c => c.percent || 0), 0.001)
      const latestPrice = summary?.latest_price || displayKlines[displayKlines.length - 1]?.close || 0

      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(klineW, padT); ctx.lineTo(klineW, padT + kDrawH); ctx.stroke()

      chips.forEach((chip) => {
        const price = chip.price || 0
        if (price < priceMin || price > priceMax) return
        const y = priceToY(price)
        const barHeight = Math.max(1.2, kDrawH / chips.length * 0.8)
        const barLength = (chip.percent / maxPct) * chipDrawW * 0.8
        const isProfit = price <= latestPrice
        ctx.fillStyle = isProfit ? 'rgba(239,68,68,0.7)' : 'rgba(59,130,246,0.7)'
        ctx.fillRect(klineW + chipDrawW + 5 - barLength, y - barHeight / 2, barLength, barHeight)
      })
    }

    // Volume bars
    const volTop = H - 45, volH = 35
    const maxVol = Math.max(...displayKlines.map(k => k.volume || 0), 1)
    displayKlines.forEach((k, i) => {
      const x = padL + barGap + (barW + barGap) * i
      const isUp = k.close >= k.open
      const h = Math.max(1, ((k.volume || 0) / maxVol) * volH)
      ctx.fillStyle = isUp ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'
      ctx.fillRect(x, volTop + volH - h, barW, h)
    })
  }, [klines, chips, summary])

  return (
    <div ref={containerRef} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '240px' }} />
    </div>
  )
}

// ==================== Main Component ====================
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
  const [addStockName, setAddStockName] = useState('')
  const [addingStock, setAddingStock] = useState(false)
  const [stockQuotes, setStockQuotes] = useState({})
  const [refreshing, setRefreshing] = useState(false)

  // Detail panel state
  const [detailStock, setDetailStock] = useState(null)
  const [detailTab, setDetailTab] = useState('kline')
  const [detailLoading, setDetailLoading] = useState(false)
  const [klineData, setKlineData] = useState(null)
  const [chipData, setChipData] = useState(null)
  const [researchData, setResearchData] = useState([])
  const [newsData, setNewsData] = useState([])
  const [gubaData, setGubaData] = useState([])
  const [announceData, setAnnounceData] = useState([])
  const [f10Data, setF10Data] = useState(null)
  const [klinePeriod, setKlinePeriod] = useState('day')

  // Load categories
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

  // Get active category stocks
  const activeCategory = useMemo(() => 
    categories.find(c => c.id === activeCategoryId), 
    [categories, activeCategoryId]
  )
  const activeStocks = activeCategory?.stocks || []

  // Fetch real-time quotes for active category stocks
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
    } catch (e) {
      console.error('Fetch quotes failed:', e)
    }
  }, [activeStocks])

  useEffect(() => {
    fetchQuotes()
    const interval = setInterval(fetchQuotes, 15000) // Auto refresh every 15s
    return () => clearInterval(interval)
  }, [fetchQuotes])

  // Handle create category
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('请输入分类名称')
      return
    }
    try {
      const res = await createXiaofanCategory({ name: newCategoryName.trim() })
      if (res.code === 0) {
        toast.success('分类创建成功')
        setNewCategoryName('')
        loadCategories()
        if (res.data?.id) setActiveCategoryId(res.data.id)
      } else {
        toast.error(res.error || '创建失败')
      }
    } catch (e) {
      toast.error('创建分类失败')
    }
  }

  // Handle update category
  const handleUpdateCategory = async (id) => {
    if (!editName.trim()) return
    try {
      const res = await updateXiaofanCategory(id, { name: editName.trim() })
      if (res.code === 0) {
        toast.success('分类已更新')
        setEditingCategory(null)
        loadCategories()
      }
    } catch (e) {
      toast.error('更新失败')
    }
  }

  // Handle delete category
  const handleDeleteCategory = async (id) => {
    if (!confirm('确定删除该分类及其所有股票？')) return
    try {
      const res = await deleteXiaofanCategory(id)
      if (res.code === 0) {
        toast.success('分类已删除')
        if (activeCategoryId === id) setActiveCategoryId(null)
        loadCategories()
      }
    } catch (e) {
      toast.error('删除失败')
    }
  }

  // Handle add stock
  const handleAddStock = async () => {
    if (!activeCategoryId) {
      toast.error('请先选择一个分类')
      return
    }
    const code = addStockCode.replace(/\D/g, '')
    if (!code || code.length !== 6) {
      toast.error('请输入6位股票代码')
      return
    }
    setAddingStock(true)
    try {
      const res = await addXiaofanStock(activeCategoryId, { 
        code, 
        name: addStockName.trim() || code 
      })
      if (res.code === 0) {
        toast.success(`已添加 ${addStockName || code}`)
        setAddStockCode('')
        setAddStockName('')
        loadCategories()
      } else {
        toast.error(res.error || '添加失败')
      }
    } catch (e) {
      toast.error('添加股票失败')
    }
    setAddingStock(false)
  }

  // Handle remove stock
  const handleRemoveStock = async (stockId, name) => {
    if (!confirm(`确定移除 ${name}？`)) return
    try {
      const res = await removeXiaofanStock(stockId)
      if (res.code === 0) {
        toast.success(`已移除 ${name}`)
        if (detailStock?.id === stockId) setDetailStock(null)
        loadCategories()
      }
    } catch (e) {
      toast.error('移除失败')
    }
  }

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchQuotes()
    setRefreshing(false)
    toast.success('行情已刷新')
  }

  // Load detail data
  const loadDetailData = useCallback(async (code, tab, period) => {
    setDetailLoading(true)
    try {
      if (tab === 'kline') {
        const periodMap = { day: 'day', week: 'week', month: 'month', year: 'year' }
        const res = await getDataKline({ code, period: periodMap[period] || 'day', count: 120 })
        if (res.code === 0) setKlineData(res.data)
        // Also load chip data
        try {
          const chipRes = await getChipDistribution({ code })
          if (chipRes.code === 0) setChipData(chipRes.data)
        } catch(e) {}
      } else if (tab === 'research') {
        const res = await getDataResearch({ code, page_size: 20 })
        if (res.code === 0) setResearchData(res.data?.list || res.data || [])
      } else if (tab === 'news') {
        const res = await getDataNews({ code })
        if (res.code === 0) setNewsData(res.data || [])
      } else if (tab === 'guba') {
        const res = await getDataGuba({ code, page_size: 30 })
        if (res.code === 0) setGubaData(res.data?.posts || res.data || [])
      } else if (tab === 'announce') {
        const res = await getDataAnnounce({ code, page_size: 20 })
        if (res.code === 0) setAnnounceData(res.data?.list || res.data || [])
      } else if (tab === 'f10') {
        const res = await getDataF10({ code })
        if (res.code === 0) setF10Data(res.data)
      }
    } catch (e) {
      console.error(`Load ${tab} failed:`, e)
    }
    setDetailLoading(false)
  }, [])

  // When detail stock or tab changes
  useEffect(() => {
    if (detailStock) {
      loadDetailData(detailStock.code, detailTab, klinePeriod)
    }
  }, [detailStock, detailTab, klinePeriod])

  // Detail tabs config
  const detailTabs = [
    { key: 'kline', label: 'K线筹码', icon: BarChart3 },
    { key: 'research', label: '研报', icon: BookOpen },
    { key: 'news', label: '新闻', icon: Newspaper },
    { key: 'guba', label: '股吧', icon: MessageCircle },
    { key: 'announce', label: '公告', icon: FileText },
    { key: 'f10', label: 'F10', icon: AlertCircle },
  ]

  // Render detail panel content
  const renderDetailContent = () => {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中...
        </div>
      )
    }

    if (detailTab === 'kline') {
      const klines = klineData?.klines || klineData || []
      const chips = chipData?.chips || []
      const summary = chipData?.summary || {}
      if (!Array.isArray(klines) || klines.length === 0) {
        return <div className="text-center py-12 text-gray-400 text-sm">暂无K线数据</div>
      }
      return (
        <div className="space-y-3">
          {/* Period selector */}
          <div className="flex gap-1">
            {['day', 'week', 'month', 'year'].map(p => (
              <button key={p} onClick={() => setKlinePeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  klinePeriod === p ? 'text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                style={klinePeriod === p ? { background: '#513CC8' } : {}}>
                {{ day: '日K', week: '周K', month: '月K', year: '年K' }[p]}
              </button>
            ))}
          </div>
          {/* Chip summary */}
          {summary.avg_cost > 0 && (
            <div className="grid grid-cols-4 gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50/50 text-center">
              <div><p className="text-[9px] text-gray-400">获利比例</p><p className="text-xs font-bold text-red-600">{summary.profit_ratio?.toFixed(1)}%</p></div>
              <div><p className="text-[9px] text-gray-400">平均成本</p><p className="text-xs font-bold text-amber-600">{summary.avg_cost?.toFixed(2)}</p></div>
              <div><p className="text-[9px] text-gray-400">集中度</p><p className="text-xs font-bold text-purple-600">{summary.concentration?.toFixed(1)}%</p></div>
              <div><p className="text-[9px] text-gray-400">最新价</p><p className="text-xs font-bold text-gray-900">{summary.latest_price?.toFixed(2)}</p></div>
            </div>
          )}
          <MiniChipChart klines={klines} chips={chips} summary={summary} />
        </div>
      )
    }

    if (detailTab === 'research') {
      if (!researchData || researchData.length === 0) {
        return <div className="text-center py-12 text-gray-400 text-sm">暂无研报数据</div>
      }
      return (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {researchData.map((item, idx) => (
            <a key={idx} href={item.url || item.pdf_url || '#'} target="_blank" rel="noopener noreferrer"
              className="block p-3 rounded-lg border border-gray-100 hover:bg-[#F8F6FF] transition group">
              <div className="flex items-start gap-2">
                <BookOpen size={14} className="text-[#513CC8] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-[#513CC8]">
                    {item.title || item.report_title || '研报'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                    <span>{item.org_name || item.source || ''}</span>
                    <span>{item.publish_date || item.date || ''}</span>
                    {item.rating && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">{item.rating}</span>}
                  </div>
                </div>
                <ExternalLink size={12} className="text-gray-300 group-hover:text-[#513CC8] flex-shrink-0" />
              </div>
            </a>
          ))}
        </div>
      )
    }

    if (detailTab === 'news') {
      if (!newsData || newsData.length === 0) {
        return <div className="text-center py-12 text-gray-400 text-sm">暂无新闻数据</div>
      }
      return (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {newsData.map((item, idx) => (
            <a key={idx} href={item.url || '#'} target="_blank" rel="noopener noreferrer"
              className="block p-3 rounded-lg border border-gray-100 hover:bg-[#F8F6FF] transition group">
              <p className="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-[#513CC8]">
                {item.title || item.content || ''}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                <span>{item.source || ''}</span>
                <span>{item.datetime || item.publish_time || ''}</span>
              </div>
            </a>
          ))}
        </div>
      )
    }

    if (detailTab === 'guba') {
      if (!gubaData || gubaData.length === 0) {
        return <div className="text-center py-12 text-gray-400 text-sm">暂无股吧讨论</div>
      }
      return (
        <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
          {gubaData.map((post, idx) => (
            <a key={idx} href={post.url || '#'} target="_blank" rel="noopener noreferrer"
              className="block px-3 py-2.5 rounded-lg hover:bg-[#F8F6FF] transition group border-b border-gray-50">
              <p className="text-xs text-gray-800 font-medium line-clamp-2 group-hover:text-[#513CC8]">
                {post.title}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                <span className="font-medium text-gray-500 truncate max-w-[80px]">{post.author}</span>
                <span className="flex items-center gap-0.5"><Eye size={9} /> {post.read_count > 10000 ? (post.read_count / 10000).toFixed(1) + '万' : post.read_count || 0}</span>
                <span className="flex items-center gap-0.5"><MessageCircle size={9} /> {post.comment_count || 0}</span>
                <span className="ml-auto">{post.publish_time?.slice(5, 16) || ''}</span>
              </div>
            </a>
          ))}
        </div>
      )
    }

    if (detailTab === 'announce') {
      if (!announceData || announceData.length === 0) {
        return <div className="text-center py-12 text-gray-400 text-sm">暂无公告数据</div>
      }
      return (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {announceData.map((item, idx) => (
            <a key={idx} href={item.url || item.pdf_url || '#'} target="_blank" rel="noopener noreferrer"
              className="block p-3 rounded-lg border border-gray-100 hover:bg-[#F8F6FF] transition group">
              <div className="flex items-start gap-2">
                <FileText size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-[#513CC8]">
                    {item.title || item.announcementTitle || ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                    <span>{item.date || item.announcementTime || ''}</span>
                    {item.type && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{item.type}</span>}
                  </div>
                </div>
                <ExternalLink size={12} className="text-gray-300 group-hover:text-[#513CC8] flex-shrink-0" />
              </div>
            </a>
          ))}
        </div>
      )
    }

    if (detailTab === 'f10') {
      if (!f10Data) {
        return <div className="text-center py-12 text-gray-400 text-sm">暂无F10数据</div>
      }
      return (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {/* Basic info */}
          {f10Data.basic && (
            <div className="p-3 rounded-lg border border-gray-100">
              <h4 className="text-xs font-bold text-gray-700 mb-2">基本信息</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {Object.entries(f10Data.basic).slice(0, 10).map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <span className="text-gray-400 whitespace-nowrap">{k}:</span>
                    <span className="text-gray-700 truncate">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Finance */}
          {f10Data.finance && (
            <div className="p-3 rounded-lg border border-gray-100">
              <h4 className="text-xs font-bold text-gray-700 mb-2">财务数据</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {Object.entries(f10Data.finance).slice(0, 12).map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <span className="text-gray-400 whitespace-nowrap">{k}:</span>
                    <span className="text-gray-700 truncate">{typeof v === 'number' ? v.toFixed(2) : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* If raw object */}
          {!f10Data.basic && !f10Data.finance && typeof f10Data === 'object' && (
            <div className="p-3 rounded-lg border border-gray-100">
              <h4 className="text-xs font-bold text-gray-700 mb-2">F10 数据</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {Object.entries(f10Data).slice(0, 20).map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <span className="text-gray-400 whitespace-nowrap">{k}:</span>
                    <span className="text-gray-700 truncate">{typeof v === 'number' ? v.toFixed(4) : String(v).slice(0, 30)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    return <div className="text-center py-12 text-gray-400 text-sm">暂无数据</div>
  }

  return (
    <div className="p-4 space-y-4 min-h-screen" style={{ background: '#F8F9FC' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">小樊精选</h1>
          <p className="text-xs text-gray-400 mt-1">自定义分类 · 实时行情 · K线筹码 · 研报新闻 · 股吧公告</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="p-2 rounded-lg text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA] transition">
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Category Management Bar */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Category tabs */}
          <div className="flex items-center gap-1 flex-wrap flex-1">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center group">
                {editingCategory === cat.id ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdateCategory(cat.id); if (e.key === 'Escape') setEditingCategory(null) }}
                      className="px-2 py-1 text-xs border border-[#513CC8] rounded-lg focus:outline-none w-20"
                      autoFocus
                    />
                    <button onClick={() => handleUpdateCategory(cat.id)} className="text-[#513CC8] text-xs">确定</button>
                    <button onClick={() => setEditingCategory(null)} className="text-gray-400 text-xs">取消</button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                      activeCategoryId === cat.id 
                        ? 'text-white shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
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

          {/* New category input */}
          <div className="flex items-center gap-2">
            <input 
              type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
              placeholder="新分类名称"
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-[#513CC8] focus:ring-1 focus:ring-[#513CC8]/20 focus:outline-none w-28"
            />
            <button onClick={handleCreateCategory}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1 transition hover:shadow-md"
              style={{ background: '#513CC8' }}>
              <FolderPlus size={13} /> 新建
            </button>
          </div>
        </div>

        {/* Add stock input */}
        {activeCategoryId && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-[180px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={addStockCode} onChange={e => setAddStockCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddStock()}
                  placeholder="股票代码 如 600519"
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:border-[#513CC8] focus:ring-1 focus:ring-[#513CC8]/20 focus:outline-none"
                />
              </div>
              <input type="text" value={addStockName} onChange={e => setAddStockName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStock()}
                placeholder="股票名称（可选）"
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:border-[#513CC8] focus:ring-1 focus:ring-[#513CC8]/20 focus:outline-none w-32"
              />
              <button onClick={handleAddStock} disabled={addingStock}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white flex items-center gap-1 transition hover:shadow-md"
                style={{ background: '#513CC8' }}>
                {addingStock ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                添加
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400">快捷:</span>
              {[{c:'600519',n:'茅台'},{c:'000001',n:'平安'},{c:'300750',n:'宁德'}].map(s => (
                <button key={s.c} onClick={() => { setAddStockCode(s.c); setAddStockName(s.n) }}
                  className="px-1.5 py-0.5 rounded text-[10px] text-gray-500 hover:text-[#513CC8] bg-gray-50 hover:bg-[#F0EDFA] transition border border-gray-100">
                  {s.n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content area: Stock list + Detail panel */}
      {loadingCategories ? (
        <div className="glass-card p-8 text-center text-gray-400">
          <Loader2 size={24} className="mx-auto mb-2 animate-spin" /> 加载中...
        </div>
      ) : categories.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#F0EDFA' }}>
            <FolderPlus size={32} style={{ color: '#513CC8' }} />
          </div>
          <h3 className="text-lg text-gray-700 mb-2 font-medium">还没有分类</h3>
          <p className="text-sm text-gray-400">在上方输入分类名称，创建你的第一个精选分类</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* Stock list table */}
          <div className={detailStock ? 'col-span-7' : 'col-span-12'}>
            {activeStocks.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#F0EDFA' }}>
                  <Plus size={24} style={{ color: '#513CC8' }} />
                </div>
                <p className="text-sm text-gray-500">当前分类暂无股票，请添加</p>
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left p-3 text-xs text-gray-500 font-medium">股票</th>
                      <th className="text-right p-3 text-xs text-gray-500 font-medium">现价</th>
                      <th className="text-right p-3 text-xs text-gray-500 font-medium">涨跌幅</th>
                      <th className="text-right p-3 text-xs text-gray-500 font-medium">涨跌额</th>
                      <th className="text-right p-3 text-xs text-gray-500 font-medium">成交量</th>
                      <th className="text-right p-3 text-xs text-gray-500 font-medium">最高</th>
                      <th className="text-right p-3 text-xs text-gray-500 font-medium">最低</th>
                      <th className="text-center p-3 text-xs text-gray-500 font-medium w-14">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStocks.map((stock) => {
                      const q = stockQuotes[stock.code] || {}
                      const price = q.price || q.current_price || 0
                      const changePct = q.change_pct || q.pct_change || 0
                      const change = q.change || 0
                      const volume = q.volume || 0
                      const high = q.high || 0
                      const low = q.low || 0
                      const isUp = changePct >= 0
                      const isActive = detailStock?.id === stock.id

                      return (
                        <tr key={stock.id}
                          className={`border-b border-gray-50 transition cursor-pointer ${
                            isActive ? 'bg-[#F0EDFA]/60 border-l-2 border-l-[#513CC8]' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            if (isActive) { setDetailStock(null) } 
                            else { setDetailStock(stock); setDetailTab('kline'); setKlinePeriod('day') }
                          }}>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-1 h-8 rounded-full ${isUp ? 'bg-red-400' : 'bg-green-400'}`}></div>
                              <div>
                                <p className="font-medium text-gray-800">{stock.name || stock.code}</p>
                                <p className="text-[10px] text-gray-400">{stock.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className={`p-3 text-right font-semibold ${isUp ? 'text-red-500' : 'text-green-500'}`}>
                            {price ? price.toFixed(2) : '---'}
                          </td>
                          <td className={`p-3 text-right font-medium`}>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              isUp ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                              {isUp ? '+' : ''}{changePct.toFixed(2)}%
                            </span>
                          </td>
                          <td className={`p-3 text-right text-xs ${isUp ? 'text-red-500' : 'text-green-500'}`}>
                            {change ? (isUp ? '+' : '') + change.toFixed(2) : '---'}
                          </td>
                          <td className="p-3 text-right text-xs text-gray-600">
                            {volume ? (volume >= 10000 ? (volume / 10000).toFixed(0) + '万' : volume) : '---'}
                          </td>
                          <td className="p-3 text-right text-xs text-red-400">{high ? high.toFixed(2) : '---'}</td>
                          <td className="p-3 text-right text-xs text-green-400">{low ? low.toFixed(2) : '---'}</td>
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleRemoveStock(stock.id, stock.name || stock.code)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2 bg-gray-50/50 text-[10px] text-gray-400 flex items-center justify-between border-t border-gray-100">
                  <span>共 {activeStocks.length} 只 · 点击行查看详情</span>
                  <span>数据源：mootdx + 腾讯 · 15s自动刷新</span>
                </div>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {detailStock && (
            <div className="col-span-5">
              <div className="glass-card p-4 sticky top-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-8 rounded-full ${
                      (stockQuotes[detailStock.code]?.change_pct || 0) >= 0 ? 'bg-red-400' : 'bg-green-400'
                    }`}></div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{detailStock.name || detailStock.code}</h3>
                      <p className="text-xs text-gray-400">{detailStock.code}</p>
                    </div>
                    {stockQuotes[detailStock.code]?.price && (
                      <>
                        <span className={`text-lg font-bold ml-2 ${
                          (stockQuotes[detailStock.code]?.change_pct || 0) >= 0 ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {stockQuotes[detailStock.code].price.toFixed(2)}
                        </span>
                        <span className={`text-sm px-2 py-0.5 rounded ${
                          (stockQuotes[detailStock.code]?.change_pct || 0) >= 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'
                        }`}>
                          {(stockQuotes[detailStock.code]?.change_pct || 0) >= 0 ? '+' : ''}
                          {(stockQuotes[detailStock.code]?.change_pct || 0).toFixed(2)}%
                        </span>
                      </>
                    )}
                  </div>
                  <button onClick={() => setDetailStock(null)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                    <X size={16} />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-0.5 mb-3 bg-gray-50 rounded-xl p-1 overflow-x-auto">
                  {detailTabs.map(tab => (
                    <button key={tab.key}
                      onClick={() => setDetailTab(tab.key)}
                      className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition whitespace-nowrap ${
                        detailTab === tab.key ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white'
                      }`}
                      style={detailTab === tab.key ? { background: '#513CC8' } : {}}>
                      <tab.icon size={12} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="min-h-[300px]">
                  {renderDetailContent()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
