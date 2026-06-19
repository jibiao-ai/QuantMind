import { useState, useEffect, useCallback } from 'react'
import { getMarketHotList, getTrendChart, getTrendChart5Day, getKLineRealtime, getGubaDiscussion } from '../services/api'
import {
  Flame, TrendingUp, TrendingDown, RefreshCw, ChevronLeft, ChevronRight,
  ArrowUpDown, Clock, Calendar, BarChart3, LineChart, CandlestickChart,
  X, ChevronDown, ChevronUp, Search, MessageCircle, Eye, Share2,
  Image, Video, ExternalLink, Loader2
} from 'lucide-react'
import {
  LineChart as ReLineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, ReferenceLine
} from 'recharts'
import { useRef } from 'react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

export default function HotListPage() {
  const [listType, setListType] = useState('hour') // hour | day
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [sortField, setSortField] = useState('rank')
  const [sortOrder, setSortOrder] = useState('asc')
  const [refreshing, setRefreshing] = useState(false)
  const [searchCode, setSearchCode] = useState('')

  // Selected stock for chart detail
  const [selectedStock, setSelectedStock] = useState(null)
  const [chartTab, setChartTab] = useState('minute') // minute | five_day | daily | weekly
  const [chartData, setChartData] = useState(null)
  const [chartLoading, setChartLoading] = useState(false)

  // Panel mode: 'chart' or 'guba'
  const [panelMode, setPanelMode] = useState('chart')

  // Guba discussion state
  const [gubaPosts, setGubaPosts] = useState([])
  const [gubaPage, setGubaPage] = useState(1)
  const [gubaTotal, setGubaTotal] = useState(0)
  const [gubaLoading, setGubaLoading] = useState(false)
  const [gubaLoadingMore, setGubaLoadingMore] = useState(false)
  const [gubaHasMore, setGubaHasMore] = useState(true)
  const gubaScrollRef = useRef(null)

  const loadData = useCallback(async (p = page, sf = sortField, so = sortOrder, type = listType) => {
    setLoading(true)
    try {
      const res = await getMarketHotList({
        type, page: p, page_size: PAGE_SIZE,
        sort_field: sf, sort_order: so
      })
      if (res?.code === 0 && res.data) {
        setStocks(res.data.stocks || [])
        setTotal(res.data.total || 0)
        setTotalPages(res.data.total_pages || 1)
      }
    } catch (e) {
      console.error('Failed to load hot list:', e)
      toast.error('加载热榜数据失败')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData(1, sortField, sortOrder, listType)
    setPage(1)
  }, [listType])

  const handlePageChange = (newPage) => {
    setPage(newPage)
    loadData(newPage, sortField, sortOrder, listType)
  }

  const handleSort = (field) => {
    const newOrder = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc'
    setSortField(field)
    setSortOrder(newOrder)
    setPage(1)
    loadData(1, field, newOrder, listType)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData(page, sortField, sortOrder, listType)
    setRefreshing(false)
    toast.success('热榜数据已刷新')
  }

  // Load chart data when stock or tab changes
  const loadChartData = useCallback(async (stock, tab) => {
    if (!stock) return
    setChartLoading(true)
    try {
      let res
      if (tab === 'minute') {
        res = await getTrendChart({ code: stock.code })
        if (res?.code === 0 && res.data) {
          setChartData({
            type: 'minute',
            name: res.data.name || stock.name,
            pre_close: res.data.pre_close,
            trends: res.data.trends || []
          })
        }
      } else if (tab === 'five_day') {
        res = await getTrendChart5Day({ code: stock.code })
        if (res?.code === 0 && res.data) {
          setChartData({
            type: 'five_day',
            name: res.data.name || stock.name,
            pre_close: res.data.pre_close,
            trends: res.data.trends || []
          })
        }
      } else if (tab === 'daily') {
        res = await getKLineRealtime({ code: stock.code, period: '101', limit: 60 })
        if (res?.code === 0 && res.data) {
          setChartData({
            type: 'kline',
            name: res.data.name || stock.name,
            klines: res.data.klines || []
          })
        }
      } else if (tab === 'weekly') {
        res = await getKLineRealtime({ code: stock.code, period: '102', limit: 60 })
        if (res?.code === 0 && res.data) {
          setChartData({
            type: 'kline',
            name: res.data.name || stock.name,
            klines: res.data.klines || []
          })
        }
      }
    } catch (e) {
      console.error('Failed to load chart:', e)
    }
    setChartLoading(false)
  }, [])

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

  const handleStockClick = (stock) => {
    if (selectedStock?.code === stock.code) {
      setSelectedStock(null)
      setChartData(null)
      setGubaPosts([])
      setPanelMode('chart')
      return
    }
    setSelectedStock(stock)
    setChartTab('minute')
    setPanelMode('chart')
    loadChartData(stock, 'minute')
    // Preload guba data
    loadGubaData(stock.code, 1, false)
  }

  const handleChartTabChange = (tab) => {
    setChartTab(tab)
    if (selectedStock) {
      loadChartData(selectedStock, tab)
    }
  }

  // Handle guba infinite scroll
  const handleGubaScroll = useCallback((e) => {
    const el = e.target
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && gubaHasMore && !gubaLoadingMore) {
      loadGubaData(selectedStock?.code, gubaPage + 1, true)
    }
  }, [gubaHasMore, gubaLoadingMore, gubaPage, selectedStock])

  // Refresh guba data
  const handleGubaRefresh = async () => {
    if (!selectedStock) return
    setGubaPosts([])
    setGubaPage(1)
    setGubaHasMore(true)
    await loadGubaData(selectedStock.code, 1, false)
    toast.success('股吧讨论已刷新')
    if (gubaScrollRef.current) gubaScrollRef.current.scrollTop = 0
  }

  // Format relative time
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

  const formatMarketCap = (v) => {
    if (!v || v === 0) return '---'
    if (v >= 10000) return (v / 10000).toFixed(0) + '万亿'
    if (v >= 1) return v.toFixed(0) + '亿'
    return (v * 10000).toFixed(0) + '万'
  }

  const formatHeat = (v) => {
    if (!v || v === 0) return '---'
    if (v >= 10000000) return (v / 10000000).toFixed(1) + 'M'
    if (v >= 10000) return (v / 10000).toFixed(1) + 'W'
    return v.toFixed(0)
  }

  const formatVol = (v) => {
    if (!v) return ''
    if (v >= 100000000) return (v / 100000000).toFixed(2) + '亿'
    if (v >= 10000) return (v / 10000).toFixed(0) + '万'
    return v.toFixed(0)
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={11} className="text-gray-300 ml-0.5" />
    return sortOrder === 'asc'
      ? <ChevronUp size={11} className="text-[#513CC8] ml-0.5" />
      : <ChevronDown size={11} className="text-[#513CC8] ml-0.5" />
  }

  const tooltipStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }

  // Filter by search
  const filteredStocks = searchCode
    ? stocks.filter(s => s.code?.includes(searchCode) || s.name?.includes(searchCode))
    : stocks

  // Pagination component
  const PaginationBar = () => {
    if (totalPages <= 1) return null
    const maxVisible = 7
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2))
    let endPage = Math.min(totalPages, startPage + maxVisible - 1)
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }
    const pages = []
    for (let i = startPage; i <= endPage; i++) pages.push(i)

    return (
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <span className="text-[11px] text-gray-400">
          共 {total} 只热股 · 第 {page}/{totalPages} 页
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page <= 1}
            className={`p-1 rounded transition ${page <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-[#513CC8] hover:bg-[#F0EDFA]'}`}>
            <ChevronLeft size={14} />
          </button>
          {pages.map(p => (
            <button key={p} onClick={() => handlePageChange(p)}
              className={`w-6 h-6 rounded text-[11px] font-medium transition ${p === page ? 'text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              style={p === page ? { background: '#513CC8' } : {}}>
              {p}
            </button>
          ))}
          <button onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
            className={`p-1 rounded transition ${page >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-[#513CC8] hover:bg-[#F0EDFA]'}`}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  // ==================== Chart Renderers ====================

  const renderMinuteChart = () => {
    if (!chartData || chartData.type !== 'minute' && chartData.type !== 'five_day') return null
    const trends = chartData.trends
    if (!trends || trends.length === 0) return <div className="text-center text-gray-400 text-xs py-8">暂无分时数据</div>
    const preClose = chartData.pre_close || 0
    const priceMin = Math.min(...trends.map(t => t.price).filter(p => p > 0))
    const priceMax = Math.max(...trends.map(t => t.price))
    const margin = (priceMax - priceMin) * 0.1 || 0.1

    return (
      <div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={trends} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9CA3AF' }}
              tickFormatter={v => {
                if (!v) return ''
                const t = v.split(' ')
                return t.length > 1 ? t[1].slice(0, 5) : v.slice(0, 5)
              }}
              interval={Math.floor(trends.length / 6)} />
            <YAxis domain={[priceMin - margin, priceMax + margin]}
              tick={{ fontSize: 9, fill: '#9CA3AF' }} width={55}
              tickFormatter={v => v?.toFixed(2)} />
            <Tooltip contentStyle={tooltipStyle}
              labelFormatter={v => v}
              formatter={(v, name) => {
                if (name === 'price') return [v?.toFixed(2), '价格']
                if (name === 'avg') return [v?.toFixed(2), '均价']
                return [v, name]
              }} />
            {preClose > 0 && <ReferenceLine y={preClose} stroke="#999" strokeDasharray="3 3" label={{ value: `昨收 ${preClose.toFixed(2)}`, fontSize: 9, fill: '#999' }} />}
            <Area type="monotone" dataKey="price" stroke="#EF4444" fill="rgba(239,68,68,0.06)" strokeWidth={1.5} dot={false} name="price" />
            <Line type="monotone" dataKey="avg" stroke="#F59E0B" strokeWidth={1} dot={false} name="avg" strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
        {/* Volume bars */}
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={trends} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Bar dataKey="volume" fill="#CBD5E1" radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderKLineChart = () => {
    if (!chartData || chartData.type !== 'kline') return null
    const klines = chartData.klines
    if (!klines || klines.length === 0) return <div className="text-center text-gray-400 text-xs py-8">暂无K线数据</div>

    // Build candlestick data
    const data = klines.map(k => ({
      date: k.date?.slice(5) || '',
      fullDate: k.date,
      open: k.open,
      close: k.close,
      high: k.high,
      low: k.low,
      volume: k.volume,
      change_pct: k.change_pct,
      // For bar coloring
      isUp: k.close >= k.open,
      body: Math.abs(k.close - k.open),
      bodyBottom: Math.min(k.open, k.close),
    }))

    const allPrices = data.flatMap(d => [d.high, d.low]).filter(p => p > 0)
    const priceMin = Math.min(...allPrices)
    const priceMax = Math.max(...allPrices)
    const margin = (priceMax - priceMin) * 0.05 || 0.5

    // Compute MA5 and MA10
    const ma5 = data.map((_, i) => {
      if (i < 4) return null
      const sum = data.slice(i - 4, i + 1).reduce((s, d) => s + d.close, 0)
      return sum / 5
    })
    const ma10 = data.map((_, i) => {
      if (i < 9) return null
      const sum = data.slice(i - 9, i + 1).reduce((s, d) => s + d.close, 0)
      return sum / 10
    })
    const enriched = data.map((d, i) => ({ ...d, ma5: ma5[i], ma10: ma10[i] }))

    return (
      <div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={enriched} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#9CA3AF' }}
              interval={Math.max(1, Math.floor(enriched.length / 8))} />
            <YAxis domain={[priceMin - margin, priceMax + margin]}
              tick={{ fontSize: 9, fill: '#9CA3AF' }} width={55}
              tickFormatter={v => v?.toFixed(2)} />
            <Tooltip contentStyle={tooltipStyle}
              formatter={(v, name) => {
                if (name === 'ma5') return [v?.toFixed(2), 'MA5']
                if (name === 'ma10') return [v?.toFixed(2), 'MA10']
                return [v, name]
              }}
              labelFormatter={(_, payload) => {
                if (payload?.[0]?.payload) {
                  const d = payload[0].payload
                  return `${d.fullDate} 开${d.open?.toFixed(2)} 高${d.high?.toFixed(2)} 低${d.low?.toFixed(2)} 收${d.close?.toFixed(2)} ${d.change_pct >= 0 ? '+' : ''}${d.change_pct?.toFixed(2)}%`
                }
                return ''
              }} />
            {/* Candlestick bodies using stacked bars */}
            <Bar dataKey="bodyBottom" stackId="candle" fill="transparent" />
            <Bar dataKey="body" stackId="candle" shape={(props) => {
              const { x, y, width, height, payload } = props
              const color = payload.isUp ? '#EF4444' : '#22C55E'
              // Draw candlestick
              const barW = Math.max(width * 0.6, 2)
              const barX = x + (width - barW) / 2
              const yScale = (priceMax + margin - (priceMin - margin)) / 260
              const highY = y - (payload.high - Math.max(payload.open, payload.close)) / yScale
              const lowY = y + height + (Math.min(payload.open, payload.close) - payload.low) / yScale
              const wickX = x + width / 2
              return (
                <g>
                  {/* Upper wick */}
                  <line x1={wickX} y1={highY} x2={wickX} y2={y} stroke={color} strokeWidth={1} />
                  {/* Body */}
                  <rect x={barX} y={y} width={barW} height={Math.max(height, 1)} fill={color} rx={1} />
                  {/* Lower wick */}
                  <line x1={wickX} y1={y + height} x2={wickX} y2={lowY} stroke={color} strokeWidth={1} />
                </g>
              )
            }} />
            <Line type="monotone" dataKey="ma5" stroke="#F59E0B" strokeWidth={1} dot={false} name="ma5" />
            <Line type="monotone" dataKey="ma10" stroke="#3B82F6" strokeWidth={1} dot={false} name="ma10" />
          </ComposedChart>
        </ResponsiveContainer>
        {/* Volume */}
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={enriched} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Bar dataKey="volume" shape={(props) => {
              const { x, y, width, height, payload } = props
              const color = payload.isUp ? '#EF4444' : '#22C55E'
              return <rect x={x} y={y} width={width} height={height} fill={color} opacity={0.6} rx={1} />
            }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ==================== RENDER ====================

  return (
    <div className="p-2 md:p-4 space-y-3 md:space-y-4 min-h-screen" style={{ background: '#F8F9FC' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <Flame size={24} className="text-orange-500" /> 市场热榜
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            数据来源：同花顺热榜 + 东方财富行情 · {loading ? '加载中...' : `共 ${total} 只热股`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time filter */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button onClick={() => setListType('hour')}
              className={`px-4 py-2 text-xs font-medium transition flex items-center gap-1 ${
                listType === 'hour' ? 'text-white' : 'text-gray-500 bg-white hover:bg-gray-50'
              }`}
              style={listType === 'hour' ? { background: '#513CC8' } : {}}>
              <Clock size={13} /> 1小时
            </button>
            <button onClick={() => setListType('day')}
              className={`px-4 py-2 text-xs font-medium transition flex items-center gap-1 ${
                listType === 'day' ? 'text-white' : 'text-gray-500 bg-white hover:bg-gray-50'
              }`}
              style={listType === 'day' ? { background: '#513CC8' } : {}}>
              <Calendar size={13} /> 24小时
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="text" placeholder="搜索代码/名称" value={searchCode}
              onChange={e => setSearchCode(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-xs w-36 focus:outline-none focus:border-[#513CC8] transition"
            />
          </div>
          {/* Refresh */}
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-lg text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA] transition">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`grid gap-3 md:gap-4 ${selectedStock ? 'grid-cols-1 md:grid-cols-12' : 'grid-cols-1'}`}>
        {/* Table */}
        <div className={`glass-card p-3 md:p-4 ${selectedStock ? 'col-span-1 md:col-span-7' : 'col-span-1'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left p-2 w-10">#</th>
                  <th className="text-left p-2">股票</th>
                  <th className="text-right p-2 cursor-pointer select-none" onClick={() => handleSort('change_pct')}>
                    <span className="flex items-center justify-end">涨跌幅 <SortIcon field="change_pct" /></span>
                  </th>
                  <th className="text-right p-2">现价</th>
                  <th className="text-right p-2 cursor-pointer select-none" onClick={() => handleSort('heat')}>
                    <span className="flex items-center justify-end">热度 <SortIcon field="heat" /></span>
                  </th>
                  <th className="text-left p-2">概念</th>
                  <th className="text-right p-2 cursor-pointer select-none" onClick={() => handleSort('market_cap')}>
                    <span className="flex items-center justify-end">市值 <SortIcon field="market_cap" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center p-8 text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#513CC8]" />加载中...
                  </td></tr>
                ) : filteredStocks.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-8 text-gray-400">暂无热榜数据</td></tr>
                ) : filteredStocks.map((s, i) => {
                  const isSelected = selectedStock?.code === s.code
                  const globalRank = s.rank || ((page - 1) * PAGE_SIZE + i + 1)
                  const rankColor = globalRank <= 3 ? '#EF4444' : globalRank <= 10 ? '#F59E0B' : '#9CA3AF'
                  return (
                    <tr key={s.code || i}
                      className={`border-b border-gray-50 cursor-pointer transition ${
                        isSelected ? 'bg-[#F0EDFA]' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleStockClick(s)}>
                      <td className="p-2">
                        <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
                          style={{ background: `${rankColor}15`, color: rankColor, border: `1px solid ${rankColor}30` }}>
                          {globalRank}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <div>
                            <span className="text-gray-800 font-medium">{s.name || '---'}</span>
                            <span className="text-gray-400 ml-1 text-[10px]">{s.code}</span>
                          </div>
                          {s.popularity_tag && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-500 border border-red-100 whitespace-nowrap">
                              {s.popularity_tag}
                            </span>
                          )}
                        </div>
                        {s.analyse_title && (
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[200px]">{s.analyse_title}</p>
                        )}
                      </td>
                      <td className={`p-2 text-right font-bold ${(s.change_pct || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
                        {(s.change_pct || 0) >= 0 ? '+' : ''}{s.change_pct?.toFixed(2)}%
                      </td>
                      <td className="p-2 text-right text-gray-700 font-medium">
                        {s.price > 0 ? s.price.toFixed(2) : '---'}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${Math.min(100, (s.heat || 0) / (stocks[0]?.heat || 1) * 100)}%`,
                              background: 'linear-gradient(90deg, #F59E0B, #EF4444)'
                            }} />
                          </div>
                          <span className="text-orange-500 font-medium text-[10px] w-12 text-right">{formatHeat(s.heat)}</span>
                        </div>
                      </td>
                      <td className="p-2 text-left">
                        <span className="text-gray-500 text-[10px] max-w-[100px] truncate block">{s.concepts || '---'}</span>
                      </td>
                      <td className="p-2 text-right text-gray-500">
                        {formatMarketCap(s.market_cap)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar />
        </div>

        {/* Detail Panel */}
        {selectedStock && (
          <div className="col-span-1 md:col-span-5 glass-card p-3 md:p-4 flex flex-col" style={{ maxHeight: 'calc(100vh - 140px)' }}>
            {/* Panel header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  {selectedStock.name}
                  <span className="text-gray-400 font-normal text-xs">{selectedStock.code}</span>
                  <span className={`text-sm font-bold ${(selectedStock.change_pct || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
                    {(selectedStock.change_pct || 0) >= 0 ? '+' : ''}{selectedStock.change_pct?.toFixed(2)}%
                  </span>
                </h3>
                {selectedStock.analyse_title && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{selectedStock.analyse_title}</p>
                )}
              </div>
              <button onClick={() => { setSelectedStock(null); setChartData(null); setGubaPosts([]); setPanelMode('chart') }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
                <X size={14} />
              </button>
            </div>

            {/* Panel mode toggle: Chart / Discussion */}
            <div className="flex gap-1 mb-3">
              <button onClick={() => setPanelMode('chart')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  panelMode === 'chart' ? 'text-white shadow-sm' : 'text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100'
                }`}
                style={panelMode === 'chart' ? { background: '#513CC8' } : {}}>
                <BarChart3 size={12} /> K线图表
              </button>
              <button onClick={() => { setPanelMode('guba'); if (gubaPosts.length === 0 && selectedStock) loadGubaData(selectedStock.code, 1, false) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  panelMode === 'guba' ? 'text-white shadow-sm' : 'text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100'
                }`}
                style={panelMode === 'guba' ? { background: '#513CC8' } : {}}>
                <MessageCircle size={12} /> 股吧讨论
                {gubaTotal > 0 && <span className="text-[9px] opacity-80 ml-0.5">({gubaTotal > 10000 ? (gubaTotal / 10000).toFixed(0) + '万' : gubaTotal})</span>}
              </button>
            </div>

            {/* Chart Mode */}
            {panelMode === 'chart' && (
              <>
                {/* Chart tabs */}
                <div className="flex gap-1 mb-3">
                  {[
                    { key: 'minute', label: '分时', icon: LineChart },
                    { key: 'five_day', label: '五日', icon: LineChart },
                    { key: 'daily', label: '日K', icon: CandlestickChart },
                    { key: 'weekly', label: '周K', icon: BarChart3 },
                  ].map(tab => (
                    <button key={tab.key}
                      onClick={() => handleChartTabChange(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                        chartTab === tab.key
                          ? 'text-white shadow-sm'
                          : 'text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100'
                      }`}
                      style={chartTab === tab.key ? { background: '#513CC8' } : {}}>
                      <tab.icon size={12} /> {tab.label}
                    </button>
                  ))}
                </div>

                {/* Chart content */}
                <div className="min-h-[340px]">
                  {chartLoading ? (
                    <div className="flex items-center justify-center h-[340px]">
                      <RefreshCw size={24} className="animate-spin text-[#513CC8]" />
                    </div>
                  ) : (
                    <>
                      {(chartTab === 'minute' || chartTab === 'five_day') && renderMinuteChart()}
                      {(chartTab === 'daily' || chartTab === 'weekly') && renderKLineChart()}
                    </>
                  )}
                </div>

                {/* Stock info footer */}
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-[10px]">
                  <div className="text-center">
                    <span className="text-gray-400">市值</span>
                    <p className="font-bold text-gray-700">{formatMarketCap(selectedStock.market_cap)}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400">热度排名</span>
                    <p className="font-bold text-orange-500">#{selectedStock.rank}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400">概念</span>
                    <p className="font-bold text-gray-700 truncate">{selectedStock.concepts || '---'}</p>
                  </div>
                </div>
              </>
            )}

            {/* Guba Discussion Mode */}
            {panelMode === 'guba' && (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Guba header bar */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-gray-400">
                    {selectedStock.name}吧 · {gubaTotal > 10000 ? (gubaTotal / 10000).toFixed(0) + '万' : gubaTotal} 条帖子
                  </span>
                  <button onClick={handleGubaRefresh} disabled={gubaLoading}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-gray-500 hover:text-[#513CC8] hover:bg-[#F0EDFA] transition">
                    <RefreshCw size={11} className={gubaLoading ? 'animate-spin' : ''} /> 刷新
                  </button>
                </div>

                {/* Discussion list with infinite scroll */}
                <div ref={gubaScrollRef} onScroll={handleGubaScroll}
                  className="flex-1 overflow-y-auto space-y-0 pr-1" style={{ maxHeight: 'calc(100vh - 340px)' }}>
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
            )}
          </div>
        )}
      </div>
    </div>
  )
}
