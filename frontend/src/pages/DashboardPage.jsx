import { useState, useEffect, useRef, useCallback } from 'react'
import { getDashboard, getConceptHeat, getSectorFundFlow, getSectorHeat, getTsLimitStats, getTsLimitStep, getTsMoneyflow, getTsRealTimeStats, getDashboardOverview } from '../services/api'
import { BarChart3, TrendingUp, TrendingDown, Activity, Flame, Crown, AlertTriangle, DollarSign, Users, Zap, ArrowUp, ArrowDown, RefreshCw, Lightbulb, Eye, ChevronLeft, ChevronRight, Maximize, Minimize, Calendar } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// ==================== Modern Calendar Picker for Dashboard ====================
function DashboardCalendar({ date, onChange }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(date)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const today = new Date()
  const selectedDate = new Date(date)
  
  // Generate calendar grid
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay() // 0=Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const weeks = []
  let currentWeek = Array(7).fill(null)
  let dayCounter = 1
  
  // Fill first week with blanks
  for (let i = firstDay; i < 7 && dayCounter <= daysInMonth; i++) {
    currentWeek[i] = dayCounter++
  }
  weeks.push(currentWeek)
  
  while (dayCounter <= daysInMonth) {
    currentWeek = Array(7).fill(null)
    for (let i = 0; i < 7 && dayCounter <= daysInMonth; i++) {
      currentWeek[i] = dayCounter++
    }
    weeks.push(currentWeek)
  }

  const isWeekend = (day) => {
    if (!day) return false
    const d = new Date(year, month, day)
    return d.getDay() === 0 || d.getDay() === 6
  }

  const isFuture = (day) => {
    if (!day) return false
    const d = new Date(year, month, day)
    return d > today
  }

  const isSelected = (day) => {
    if (!day) return false
    return year === selectedDate.getFullYear() && month === selectedDate.getMonth() && day === selectedDate.getDate()
  }

  const isToday = (day) => {
    if (!day) return false
    return year === today.getFullYear() && month === today.getMonth() && day === today.getDate()
  }

  const handleDayClick = (day) => {
    if (!day || isWeekend(day) || isFuture(day)) return
    const newDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(newDate)
    setOpen(false)
  }

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1))

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-[#513CC8] transition text-sm shadow-sm">
        <Calendar size={14} style={{ color: '#513CC8' }} />
        <span className="font-medium text-gray-700">{date}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[300px] bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          {/* Month Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #F0EDFA, #E8E3F8)' }}>
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-white/50 transition text-gray-600">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold" style={{ color: '#513CC8' }}>{year}年 {monthNames[month]}</span>
            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-white/50 transition text-gray-600"
              disabled={new Date(year, month + 1, 1) > today}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
              <div key={i} className={`text-center text-[10px] font-medium ${i === 0 || i === 6 ? 'text-gray-300' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="px-3 pb-3">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0.5">
                {week.map((day, di) => (
                  <button
                    key={di}
                    disabled={!day || isWeekend(day) || isFuture(day)}
                    onClick={() => handleDayClick(day)}
                    className={`h-8 w-full rounded-lg text-xs font-medium transition flex items-center justify-center
                      ${!day ? '' : 
                        isSelected(day) ? 'text-white shadow-md' :
                        isToday(day) ? 'border-2 text-[#513CC8] font-bold' :
                        isWeekend(day) || isFuture(day) ? 'text-gray-200 cursor-not-allowed' :
                        'text-gray-700 hover:bg-[#F0EDFA] hover:text-[#513CC8]'
                      }`}
                    style={isSelected(day) ? { background: '#513CC8', borderColor: '#513CC8' } : 
                           isToday(day) ? { borderColor: '#513CC8' } : {}}>
                    {day || ''}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Quick select */}
          <div className="px-3 pb-3 border-t border-gray-100 pt-2 flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 mr-1">快捷:</span>
            {[0, 1, 2, 3, 4].map(offset => {
              let d = new Date()
              let count = 0
              while (count <= offset) {
                if (d.getDay() !== 0 && d.getDay() !== 6) count++
                if (count <= offset) d = new Date(d.getTime() - 86400000)
              }
              const dateStr = d.toISOString().slice(0, 10)
              const label = offset === 0 ? '今天' : offset === 1 ? '昨天' : `前${offset}天`
              return (
                <button key={offset} onClick={() => { onChange(dateStr); setOpen(false) }}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                    date === dateStr ? 'text-white' : 'text-gray-500 bg-gray-50 hover:bg-[#F0EDFA] hover:text-[#513CC8]'
                  }`}
                  style={date === dateStr ? { background: '#513CC8' } : {}}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [conceptData, setConceptData] = useState([])
  const [sectorFlows, setSectorFlows] = useState([])
  const [conceptFlows, setConceptFlows] = useState([])
  const [flowTab, setFlowTab] = useState('sector')
  const [limitTab, setLimitTab] = useState('up')
  const [limitPage, setLimitPage] = useState(1)
  const [limitSortKey, setLimitSortKey] = useState('status') // 'close', 'pct_chg', 'status', 'turnover_ratio'
  const [limitSortDir, setLimitSortDir] = useState('desc') // 'asc' or 'desc'
  const [flowPage, setFlowPage] = useState(1)

  // Dashboard Overview (大盘速览+涨跌分布+情绪温度)
  const [overview, setOverview] = useState(null)

  // Tushare-backed real-time stats
  const [tsStats, setTsStats] = useState(null)
  // Tushare-backed limit stats
  const [tsLimitData, setTsLimitData] = useState(null)
  // Tushare-backed limit step (board ladder)
  const [tsLimitStep, setTsLimitStep] = useState(null)
  // Tushare-backed moneyflow
  const [tsMoneyflow, setTsMoneyflow] = useState(null)
  const [moneyflowPage, setMoneyflowPage] = useState(1)
  const [moneyflowTab, setMoneyflowTab] = useState('stock')

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)
  const dashboardRef = useRef(null)
  // Sector/Concept heat pagination
  const [sectorHeatPage, setSectorHeatPage] = useState(1)
  const [sectorHeatData, setSectorHeatData] = useState([])
  const [sectorHeatTotal, setSectorHeatTotal] = useState(0)
  const [conceptHeatPage, setConceptHeatPage] = useState(1)
  const [conceptHeatTotal, setConceptHeatTotal] = useState(0)

  const MONEYFLOW_PAGE_SIZE = 15

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      const el = dashboardRef.current || document.documentElement
      el.requestFullscreen?.() || el.webkitRequestFullscreen?.() || el.msRequestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.() || document.msExitFullscreen?.()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => { loadData() }, [date])

  // Convert date to YYYYMMDD for tushare APIs
  const tsDate = date.replace(/-/g, '')

  const retryFetch = async (fn, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fn()
        if (res?.code === 0 && res.data) return res
      } catch (e) { /* retry */ }
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)))
    }
    return null
  }

  const loadData = async () => {
    setLoading(true)
    setMoneyflowPage(1)
    try {
      const [dashRes, conceptRes, sectorFlowRes, conceptFlowRes, sectorHeatRes,
             overviewRes, tsStatsRes, tsLimitRes, tsStepRes, tsMoneyflowRes] = await Promise.all([
        retryFetch(() => getDashboard({ date })),
        retryFetch(() => getConceptHeat({ page: 1, page_size: 100 })),
        retryFetch(() => getSectorFundFlow({ category: 'sector', page: 1, page_size: 100 })),
        retryFetch(() => getSectorFundFlow({ category: 'concept', page: 1, page_size: 100 })),
        retryFetch(() => getSectorHeat({ page: 1, page_size: 100 })),
        // New dashboard overview API
        retryFetch(() => getDashboardOverview({ trade_date: tsDate })),
        // Tushare-backed APIs
        retryFetch(() => getTsRealTimeStats({ trade_date: tsDate })),
        retryFetch(() => getTsLimitStats({ trade_date: tsDate })),
        retryFetch(() => getTsLimitStep({ trade_date: tsDate })),
        retryFetch(() => getTsMoneyflow({ trade_date: tsDate, category: 'stock', page: 1, page_size: MONEYFLOW_PAGE_SIZE })),
      ])

      if (dashRes?.code === 0) setData(dashRes.data || null)
      if (conceptRes?.code === 0) {
        const items = Array.isArray(conceptRes.data?.items) ? conceptRes.data.items : (Array.isArray(conceptRes.data) ? conceptRes.data : [])
        setConceptData(items)
        setConceptHeatTotal(conceptRes.data?.total || items.length)
      }
      if (sectorFlowRes?.code === 0) setSectorFlows(Array.isArray(sectorFlowRes.data?.flows) ? sectorFlowRes.data.flows : [])
      if (conceptFlowRes?.code === 0) setConceptFlows(Array.isArray(conceptFlowRes.data?.flows) ? conceptFlowRes.data.flows : [])
      if (sectorHeatRes?.code === 0) {
        const items = Array.isArray(sectorHeatRes.data?.items) ? sectorHeatRes.data.items : []
        setSectorHeatData(items)
        setSectorHeatTotal(sectorHeatRes.data?.total || items.length)
      }
      if (overviewRes?.code === 0) setOverview(overviewRes.data || null)
      // Tushare data
      if (tsStatsRes?.code === 0) setTsStats(tsStatsRes.data || null)
      if (tsLimitRes?.code === 0) setTsLimitData(tsLimitRes.data || null)
      if (tsStepRes?.code === 0) setTsLimitStep(tsStepRes.data || null)
      if (tsMoneyflowRes?.code === 0) setTsMoneyflow(tsMoneyflowRes.data || null)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // Refresh individual section
  const refreshSection = async (section) => {
    try {
      switch (section) {
        case 'overview': {
          const r = await retryFetch(() => getDashboardOverview({ trade_date: tsDate, refresh: 'true' }))
          if (r?.code === 0) setOverview(r.data)
          break
        }
        case 'stats': {
          const r = await retryFetch(() => getTsRealTimeStats({ trade_date: tsDate, refresh: 'true' }))
          if (r?.code === 0) setTsStats(r.data)
          break
        }
        case 'limit': {
          const lr = await retryFetch(() => getTsLimitStats({ trade_date: tsDate, refresh: 'true' }))
          if (lr?.code === 0) setTsLimitData(lr.data)
          break
        }
        case 'step': {
          const sr = await retryFetch(() => getTsLimitStep({ trade_date: tsDate, refresh: 'true' }))
          if (sr?.code === 0) setTsLimitStep(sr.data)
          break
        }
        case 'moneyflow': {
          const mfr = await retryFetch(() => getTsMoneyflow({ trade_date: tsDate, category: moneyflowTab, page: 1, page_size: MONEYFLOW_PAGE_SIZE, refresh: 'true' }))
          if (mfr?.code === 0) setTsMoneyflow(mfr.data)
          break
        }
      }
    } catch(e) { console.error(e) }
  }

  // Load moneyflow when tab changes
  const loadMoneyflow = async (category, page = 1) => {
    const res = await retryFetch(() => getTsMoneyflow({ trade_date: tsDate, category, page, page_size: MONEYFLOW_PAGE_SIZE }))
    if (res?.code === 0) setTsMoneyflow(res.data)
  }

  // Computed data from overview
  const indices = Array.isArray(overview?.indices) ? overview.indices : []
  const distribution = Array.isArray(overview?.distribution) ? overview.distribution : []
  const sentimentData = overview?.sentiment || {}
  const sentimentHistory = Array.isArray(overview?.sentiment_history) ? overview.sentiment_history : []
  const overviewUpCount = overview?.up_count || 0
  const overviewDownCount = overview?.down_count || 0
  // total_amount is now in 万亿 from backend
  const overviewTotalAmount = overview?.total_amount || 0

  // Board ladder from overview API (new) or tsLimitStep (fallback)
  const overviewBoardLadder = Array.isArray(overview?.board_ladder) ? overview.board_ladder : []
  // Limit stocks from overview API
  const overviewLimitStocks = overview?.limit_stocks || {}
  // Concept heat from overview API (Tushare ths_daily)
  const overviewConceptHeat = Array.isArray(overview?.concept_heat) ? overview.concept_heat : []

  // Fallback to tsStats if overview not available
  const tsSentiment = tsStats?.market_sentiment || {}
  const limitUps = Array.isArray(tsStats?.limit_ups) ? tsStats.limit_ups : []
  const brokens = Array.isArray(tsStats?.brokens) ? tsStats.brokens : []
  const boardLadder = tsStats?.board_ladder || (tsLimitStep ? { ladder: tsLimitStep.ladder_map, max_board: tsLimitStep.highest_board } : {})

  // Limit-up/down stocks: prefer overview API data, then tsLimitData
  const limitUpStocks = overviewLimitStocks.up_stocks?.length > 0 ? overviewLimitStocks.up_stocks : (tsLimitData?.up_stocks || [])
  const limitDownStocks = overviewLimitStocks.down_stocks?.length > 0 ? overviewLimitStocks.down_stocks : (tsLimitData?.down_stocks || [])
  const brokenStocks = overviewLimitStocks.broken_stocks || []

  // Ladder data: prefer overview board_ladder, then tsLimitStep
  const ladderList = overviewBoardLadder.length > 0 ? overviewBoardLadder : (tsLimitStep?.ladder || [])

  // Concept heat: prefer overview, then existing conceptData
  const finalConceptData = overviewConceptHeat.length > 0 ? overviewConceptHeat : conceptData

  const sectors = sectorHeatData.length > 0 ? sectorHeatData : (data?.sectors || [])
  const stats = data?.stats || {}

  const getScoreColor = (score) => {
    if (score >= 70) return '#EF4444'
    if (score >= 50) return '#F59E0B'
    return '#22C55E'
  }

  const tooltipStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }

  const formatFlow = (v) => {
    if (!v || v === 0) return '---'
    const abs = Math.abs(v)
    if (abs >= 10000) return (v / 10000).toFixed(2) + '亿'
    return v.toFixed(0) + '万'
  }

  const formatAmount = (v) => {
    if (!v || v === 0) return '---'
    const abs = Math.abs(v)
    if (abs >= 100000000) return (v / 100000000).toFixed(2) + '亿'
    if (abs >= 10000) return (v / 10000).toFixed(0) + '万'
    return v.toFixed(0)
  }

  const formatAmountWan = (v) => {
    if (!v || v === 0) return '---'
    const abs = Math.abs(v)
    if (abs >= 10000) return (v / 10000).toFixed(2) + '亿'
    return v.toFixed(0) + '万'
  }

  // Format 万亿 display
  const formatWanYi = (v) => {
    if (!v || v === 0) return '---'
    return v.toFixed(2) + '万亿'
  }

  const currentFlows = flowTab === 'sector' ? sectorFlows : conceptFlows
  const currentLimitStocks = limitTab === 'up' ? limitUpStocks : (limitTab === 'down' ? limitDownStocks : brokenStocks)

  // Normalize status: '---' or empty → '1连板'
  const getStatusNum = (s) => {
    if (s.limit_times > 0) return s.limit_times
    if (s.status) {
      const m = s.status.match(/(\d+)连板/)
      if (m) return parseInt(m[1])
      if (s.status.includes('一字')) return 1
      if (s.status.includes('换手')) return 1
      if (s.status !== '---') return 1
    }
    return 1
  }

  // Sort limit stocks
  const sortedLimitStocks = [...currentLimitStocks].sort((a, b) => {
    let va, vb
    switch (limitSortKey) {
      case 'close': va = a.close || 0; vb = b.close || 0; break
      case 'pct_chg': va = a.pct_chg || 0; vb = b.pct_chg || 0; break
      case 'status': va = getStatusNum(a); vb = getStatusNum(b); break
      case 'turnover_ratio': va = a.turnover_ratio || 0; vb = b.turnover_ratio || 0; break
      default: va = getStatusNum(a); vb = getStatusNum(b)
    }
    return limitSortDir === 'desc' ? vb - va : va - vb
  })

  const PAGE_SIZE = 12
  const limitTotalPages = Math.max(1, Math.ceil(sortedLimitStocks.length / PAGE_SIZE))
  const limitPagedStocks = sortedLimitStocks.slice((limitPage - 1) * PAGE_SIZE, limitPage * PAGE_SIZE)
  const flowTotalPages = Math.max(1, Math.ceil(currentFlows.length / PAGE_SIZE))
  const flowPagedItems = currentFlows.slice((flowPage - 1) * PAGE_SIZE, flowPage * PAGE_SIZE)

  // Moneyflow data
  const moneyflowItems = tsMoneyflow?.items || []
  const moneyflowTotal = tsMoneyflow?.total || 0
  const moneyflowTotalPages = tsMoneyflow?.total_pages || 1

  // Section refresh button
  const RefreshBtn = ({ onClick, title }) => (
    <button onClick={onClick} title={title || '刷新数据'} className="p-1 rounded text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA] transition">
      <RefreshCw size={12} />
    </button>
  )

  // Pagination component helper
  const PaginationBar = ({ page, totalPages, total, label, onPageChange }) => (
    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
      <span className="text-[10px] text-gray-400">共 {total} {label} · 第 {page}/{totalPages} 页</span>
      <div className="flex items-center gap-0.5">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
          className={`p-1 rounded transition ${page <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-[#513CC8] hover:bg-[#F0EDFA]'}`}>
          <ChevronLeft size={13} />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p
          if (totalPages <= 5) p = i + 1
          else if (page <= 3) p = i + 1
          else if (page >= totalPages - 2) p = totalPages - 4 + i
          else p = page - 2 + i
          return (
            <button key={p} onClick={() => onPageChange(p)}
              className={`w-5 h-5 rounded text-[10px] font-medium transition ${p === page ? 'text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              style={p === page ? { background: '#513CC8' } : {}}>
              {p}
            </button>
          )
        })}
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
          className={`p-1 rounded transition ${page >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-[#513CC8] hover:bg-[#F0EDFA]'}`}>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )

  // Sentiment gauge SVG
  const SentimentGauge = ({ score, label }) => {
    const clampedScore = Math.min(100, Math.max(0, score || 0))
    const radius = 60
    const circumference = 2 * Math.PI * radius * (240 / 360)
    const filled = (clampedScore / 100) * circumference
    const scoreColor = getScoreColor(clampedScore)

    return (
      <div className="flex flex-col items-center">
        <svg width="160" height="110" viewBox="0 0 160 110">
          {/* Background arc */}
          <path
            d="M 20 95 A 60 60 0 1 1 140 95"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d="M 20 95 A 60 60 0 1 1 140 95"
            fill="none"
            stroke={scoreColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            style={{ filter: `drop-shadow(0 0 4px ${scoreColor}40)` }}
          />
          {/* Score text */}
          <text x="80" y="70" textAnchor="middle" className="text-2xl font-bold" fill={scoreColor} fontSize="28" fontWeight="bold">
            {Math.round(clampedScore)}
          </text>
          <text x="80" y="92" textAnchor="middle" fill="#6B7280" fontSize="12">
            {label || '正常'}
          </text>
        </svg>
      </div>
    )
  }

  return (
    <div ref={dashboardRef} className="p-2 md:p-4 space-y-3 md:space-y-4 min-h-screen" style={{ background: '#F8F9FC' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold gradient-text">A股看板大屏</h1>
          <p className="text-xs text-gray-400 mt-1">
            数据来源：Tushare Pro → AkShare → 东方财富 · {loading ? '加载中...' : `最后更新 ${new Date().toLocaleTimeString('zh-CN')}`}
            {overview?.trade_date && <span className="ml-2 text-[#513CC8]">交易日: {overview.trade_date}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Modern Calendar Picker */}
          <DashboardCalendar date={date} onChange={setDate} />
          <button onClick={loadData} disabled={loading}
            className="p-2 rounded-lg text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA] transition ml-1">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={toggleFullscreen}
            className="p-2 rounded-lg text-gray-400 hover:text-[#513CC8] hover:bg-[#F0EDFA] transition"
            title={isFullscreen ? '退出全屏' : '全屏显示'}>
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* ==================== 大盘速览 ==================== */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-800">
          <TrendingUp size={16} style={{ color: '#513CC8' }} /> 大盘速览
          <RefreshBtn onClick={() => refreshSection('overview')} />
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
          {/* Index Cards */}
          <div className="col-span-1 md:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
              {(indices.length > 0 ? indices : [
                { name: '上证指数', price: 0, change: 0, change_pct: 0 },
                { name: '深证成指', price: 0, change: 0, change_pct: 0 },
                { name: '创业板指', price: 0, change: 0, change_pct: 0 },
              ]).map((idx, i) => (
                <div key={i} className="rounded-xl p-3 border transition hover:shadow-md"
                  style={{
                    background: (idx.change_pct || 0) >= 0 ? 'linear-gradient(135deg, #FEF2F2, #FFFFFF)' : 'linear-gradient(135deg, #F0FDF4, #FFFFFF)',
                    borderColor: (idx.change_pct || 0) >= 0 ? '#FECACA' : '#BBF7D0'
                  }}>
                  <p className="text-xs text-gray-500 mb-1">{idx.name}</p>
                  <p className={`text-xl font-bold ${(idx.change_pct || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {idx.price ? idx.price.toFixed(2) : '---'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-medium ${(idx.change_pct || 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {(idx.change || 0) >= 0 ? '+' : ''}{idx.change?.toFixed(2) || '0.00'}
                    </span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${(idx.change_pct || 0) >= 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {(idx.change_pct || 0) >= 0 ? '+' : ''}{idx.change_pct?.toFixed(2) || '0.00'}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Up/Down Progress Bar */}
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs font-bold text-red-500">涨 {overviewUpCount || tsSentiment.up_count || 0}</span>
              <div className="flex-1 h-3 rounded-full overflow-hidden flex bg-gray-100">
                {(() => {
                  const up = overviewUpCount || tsSentiment.up_count || 0
                  const down = overviewDownCount || tsSentiment.down_count || 0
                  const total = up + down || 1
                  return (
                    <>
                      <div className="h-full rounded-l-full" style={{ width: `${(up / total) * 100}%`, background: 'linear-gradient(90deg, #EF4444, #F87171)' }}></div>
                      <div className="h-full rounded-r-full" style={{ width: `${(down / total) * 100}%`, background: 'linear-gradient(90deg, #4ADE80, #22C55E)' }}></div>
                    </>
                  )
                })()}
              </div>
              <span className="text-xs font-bold text-green-500">跌 {overviewDownCount || tsSentiment.down_count || 0}</span>
            </div>
            {/* Total Amount - 万亿元 */}
            <div className="mt-2 px-1 flex items-center gap-3">
              <span className="text-xs text-gray-500">成交 <span className="font-bold text-gray-800">{formatWanYi(overviewTotalAmount || tsSentiment.total_amount || 0)}</span></span>
              {(() => {
                // Use backend-computed volume_change_yi (unit: 亿) for accuracy
                const volumeChangeYi = overview?.volume_change_yi
                if (volumeChangeYi && volumeChangeYi !== 0) {
                  const diff = volumeChangeYi
                  return (
                    <span className={`text-xs ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      较前日 {diff > 0 ? '放量' : '缩量'}{diff > 0 ? '+' : ''}{Math.round(diff)}亿
                    </span>
                  )
                }
                // Fallback: compute from sentimentHistory
                if (sentimentHistory.length > 1) {
                  const prev = sentimentHistory[sentimentHistory.length - 2]?.total_amount || 0
                  const curr = overviewTotalAmount || tsSentiment.total_amount || 0
                  if (prev > 0 && curr > 0) {
                    const diff = (curr - prev) * 10000 // 万亿 -> 亿
                    if (Math.abs(diff) > 1) {
                      return (
                        <span className={`text-xs ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          较前日 {diff > 0 ? '放量' : '缩量'}{diff > 0 ? '+' : ''}{Math.round(diff)}亿
                        </span>
                      )
                    }
                  }
                }
                return null
              })()}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="col-span-1 md:col-span-5 grid grid-cols-3 gap-2">
            {[
              { label: '涨停', value: sentimentData.limit_up || tsSentiment.limit_up_count || 0, color: '#EF4444', suffix: '家' },
              { label: '跌停', value: sentimentData.limit_down || tsSentiment.limit_down_count || 0, color: '#22C55E', suffix: '家' },
              { label: '炸板率', value: (sentimentData.broken_rate || 0).toFixed(1), color: '#F59E0B', suffix: '%' },
              { label: '最高板', value: sentimentData.highest_board || tsSentiment.highest_board || 0, color: '#513CC8', suffix: '板' },
              { label: '封板比', value: sentimentData.seal_ratio || '---', color: '#3B82F6', suffix: '' },
              { label: '情绪分', value: Math.round(sentimentData.score || tsSentiment.score || 0), color: getScoreColor(sentimentData.score || tsSentiment.score || 0), suffix: '分' },
            ].map((item, i) => (
              <div key={i} className="rounded-lg p-2.5 text-center border border-gray-100 hover:shadow-sm transition" style={{ background: `${item.color}05` }}>
                <p className="text-[10px] text-gray-400 mb-0.5">{item.label}</p>
                <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}<span className="text-[10px] ml-0.5 font-normal text-gray-400">{item.suffix}</span></p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== Row 2: 涨跌分布 + 情绪温度计 + 连板天梯 ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* 涨跌分布 */}
        <div className="col-span-1 md:col-span-4 glass-card p-3 md:p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-800">
            <BarChart3 size={16} style={{ color: '#513CC8' }} /> 涨跌分布
            {overview?.trade_date && <span className="text-[10px] text-gray-400 font-normal ml-1">({overview.trade_date})</span>}
          </h3>
          <div className="space-y-1.5">
            {distribution.map((item, i) => {
              const maxVal = Math.max(...distribution.map(d => d.value || 0), 1)
              const widthPct = ((item.value || 0) / maxVal) * 100
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-14 text-right flex-shrink-0">{item.label}</span>
                  <div className="flex-1 h-5 rounded-sm overflow-hidden bg-gray-50 relative">
                    <div className="h-full rounded-sm transition-all duration-500" style={{ width: `${widthPct}%`, background: item.color || '#D1D5DB' }}></div>
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-10 text-right">{item.value || 0}</span>
                </div>
              )
            })}
          </div>
          {distribution.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-xs">暂无涨跌分布数据</div>
          )}
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">涨停</p>
              <p className="text-sm font-bold text-red-500">{sentimentData.limit_up || distribution[0]?.value || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">跌停</p>
              <p className="text-sm font-bold text-green-500">{sentimentData.limit_down || distribution[distribution.length - 1]?.value || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">炸板率</p>
              <p className="text-sm font-bold text-yellow-500">{(sentimentData.broken_rate || 0).toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* 情绪温度计 */}
        <div className="col-span-1 md:col-span-4 glass-card p-3 md:p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-gray-800">
            <Activity size={16} style={{ color: '#F59E0B' }} /> 情绪温度计
            {overview?.trade_date && <span className="text-[10px] text-gray-400 font-normal ml-1">({overview.trade_date})</span>}
          </h3>
          <SentimentGauge 
            score={sentimentData.score || tsSentiment.score || 0} 
            label={sentimentData.label || getSentimentLabel(sentimentData.score || tsSentiment.score || 0)} 
          />
          {/* Quick indicator */}
          <div className="flex justify-center mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium border"
              style={{
                color: getScoreColor(sentimentData.score || 0),
                borderColor: getScoreColor(sentimentData.score || 0),
                background: `${getScoreColor(sentimentData.score || 0)}10`
              }}>
              {sentimentData.label || '均衡配置'}
            </span>
          </div>
          {/* 5-day sentiment stats */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-1 mb-2">
            {[
              { label: '涨停', value: sentimentData.limit_up || 0, color: '#EF4444' },
              { label: '跌停', value: sentimentData.limit_down || 0, color: '#22C55E' },
              { label: '炸板率', value: `${(sentimentData.broken_rate || 0).toFixed(1)}%`, color: '#F59E0B' },
              { label: '最高板', value: `${sentimentData.highest_board || 0}板`, color: '#513CC8' },
              { label: '封板比', value: sentimentData.seal_ratio || '---', color: '#3B82F6' },
            ].map((item, i) => (
              <div key={i} className="text-center p-1 rounded border border-gray-100">
                <p className="text-[9px] text-gray-400">{item.label}</p>
                <p className="text-xs font-bold" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
          {/* 5-day trend chart */}
          <div>
            <p className="text-[10px] text-gray-400 mb-1">近5日情绪走势</p>
            <ResponsiveContainer width="100%" height={60}>
              <AreaChart data={sentimentHistory}>
                <defs>
                  <linearGradient id="sentGradNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="trade_date" tick={{fontSize: 9, fill: '#9CA3AF'}} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={false} domain={[0, 100]} width={0} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Math.round(v), '情绪分']} />
                <Area type="monotone" dataKey="score" stroke="#F59E0B" fill="url(#sentGradNew)" strokeWidth={2} dot={{ fill: '#F59E0B', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 连板天梯 */}
        <div className="col-span-1 md:col-span-4 glass-card p-3 md:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800">
              <Crown size={16} className="text-red-500" /> 连板天梯
              {(overview?.trade_date || tsLimitStep?.trade_date) && <span className="text-[10px] text-gray-400 font-normal ml-1">({overview?.trade_date || tsLimitStep?.trade_date})</span>}
            </h3>
            <RefreshBtn onClick={() => refreshSection('step')} />
          </div>
          {/* Summary stats - 炸板 & 最高X板 from AkShare market_stats */}
          <div className="flex items-center gap-2 mb-3 flex-wrap text-[10px]">
            <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 font-bold border border-red-100">封板 {sentimentData.limit_up || tsSentiment.limit_up_count || 0}</span>
            <span className="px-2 py-0.5 rounded bg-yellow-50 text-yellow-600 font-bold border border-yellow-100">炸板 {sentimentData.broken || tsSentiment.broken_count || 0}</span>
            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-600 font-bold border border-purple-100">最高 {sentimentData.highest_board || boardLadder.max_board || 0}板</span>
            {ladderList.length > 0 && ladderList.slice(0, 3).map((lv, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100">
                {lv.level}板 {lv.count}只
              </span>
            ))}
          </div>
          {/* Ladder table with full stock details */}
          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
            {ladderList.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left p-1.5">股票</th>
                    <th className="text-right p-1.5">现价</th>
                    <th className="text-right p-1.5">涨跌幅</th>
                    <th className="text-left p-1.5">标签</th>
                    <th className="text-center p-1.5">状态</th>
                    <th className="text-right p-1.5">换手%</th>
                    <th className="text-right p-1.5">成交</th>
                  </tr>
                </thead>
                <tbody>
                  {ladderList.map((level) => (
                    (level.stocks || []).map((s, j) => (
                      <tr key={`${level.level}-${j}`} className="border-b border-gray-50 hover:bg-red-50/30 transition">
                        <td className="p-1.5">
                          <div className="flex items-center gap-1">
                            <span className="w-4 h-4 rounded bg-red-500 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                              {level.level}
                            </span>
                            <div className="min-w-0">
                              <div className="text-gray-800 font-medium truncate text-[11px]">{s.name}</div>
                              <div className="text-[9px] text-gray-400">{s.code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-1.5 text-right font-medium text-gray-800">{s.close ? s.close.toFixed(2) : '---'}</td>
                        <td className="p-1.5 text-right">
                          <span className={`font-medium ${(s.pct_chg || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
                            {s.pct_chg ? (s.pct_chg >= 0 ? '+' : '') + s.pct_chg.toFixed(2) + '%' : '---'}
                          </span>
                        </td>
                        <td className="p-1.5 text-left text-gray-500 truncate max-w-[60px]" title={s.tag}>{s.tag || '---'}</td>
                        <td className="p-1.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            s.status?.includes('连板') ? 'bg-red-100 text-red-600 border border-red-200' :
                            s.status === '炸板' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {s.status || '封板'}
                          </span>
                        </td>
                        <td className="p-1.5 text-right text-gray-600">{s.turnover_ratio ? s.turnover_ratio.toFixed(2) : '---'}</td>
                        <td className="p-1.5 text-right text-gray-600">{s.amount ? formatAmount(s.amount) : '---'}</td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            ) : (
              // Fallback: display from limitUps
              limitUps.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left p-1.5">股票</th>
                      <th className="text-right p-1.5">现价</th>
                      <th className="text-right p-1.5">涨跌幅</th>
                      <th className="text-left p-1.5">标签</th>
                      <th className="text-center p-1.5">状态</th>
                      <th className="text-right p-1.5">换手%</th>
                      <th className="text-right p-1.5">成交</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limitUps.slice(0, 15).map((s, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-red-50/30 transition">
                        <td className="p-1.5">
                          <div className="flex items-center gap-1">
                            <span className="w-4 h-4 rounded bg-red-500 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                              {s.board_count || s.limit_times || 1}
                            </span>
                            <div className="min-w-0">
                              <div className="text-gray-800 font-medium truncate text-[11px]">{s.name}</div>
                              <div className="text-[9px] text-gray-400">{s.code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-1.5 text-right font-medium text-gray-800">{s.close ? s.close.toFixed(2) : '---'}</td>
                        <td className="p-1.5 text-right">
                          <span className="stock-up font-medium">+{(s.change_pct || s.pct_chg)?.toFixed(2)}%</span>
                        </td>
                        <td className="p-1.5 text-left text-gray-500 truncate max-w-[60px]">{s.tag || s.industry || '---'}</td>
                        <td className="p-1.5 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-600 border border-red-200">
                            {s.board_count > 1 || s.limit_times > 1 ? `${s.board_count || s.limit_times}连板` : '封板'}
                          </span>
                        </td>
                        <td className="p-1.5 text-right text-gray-600">{s.turnover_ratio ? s.turnover_ratio.toFixed(2) : '---'}</td>
                        <td className="p-1.5 text-right text-gray-600">{s.amount ? formatAmount(s.amount) : '---'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-4 text-gray-400 text-xs">暂无连板天梯数据</div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ==================== Row 3: 涨跌停个股 + 资金流向 ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Daily Limit-up / Limit-down / Broken stocks from Tushare */}
        <div className="col-span-1 md:col-span-6 glass-card p-3 md:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800">
              <Eye size={16} style={{ color: '#EF4444' }} /> 当日涨跌停个股
              {(overviewLimitStocks.trade_date || tsLimitData?.trade_date) && <span className="text-[10px] text-gray-400 font-normal ml-1">({overviewLimitStocks.trade_date || tsLimitData?.trade_date})</span>}
            </h3>
            <div className="flex gap-1 items-center">
              <RefreshBtn onClick={() => refreshSection('limit')} />
              <button onClick={() => { setLimitTab('up'); setLimitPage(1) }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${limitTab === 'up' ? 'text-white bg-red-500' : 'text-gray-500 bg-gray-50 border border-gray-200'}`}>
                涨停 {overviewLimitStocks.limit_up || tsLimitData?.limit_up || limitUpStocks.length}
              </button>
              <button onClick={() => { setLimitTab('down'); setLimitPage(1) }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${limitTab === 'down' ? 'text-white bg-green-500' : 'text-gray-500 bg-gray-50 border border-gray-200'}`}>
                跌停 {overviewLimitStocks.limit_down || tsLimitData?.limit_down || limitDownStocks.length}
              </button>
              <button onClick={() => { setLimitTab('broken'); setLimitPage(1) }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${limitTab === 'broken' ? 'text-white bg-yellow-500' : 'text-gray-500 bg-gray-50 border border-gray-200'}`}>
                炸板 {overviewLimitStocks.broken || brokenStocks.length}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left p-2">股票</th>
                  <th className="text-right p-2 cursor-pointer select-none hover:text-[#513CC8] transition"
                    onClick={() => { setLimitSortKey('close'); setLimitSortDir(limitSortKey === 'close' && limitSortDir === 'desc' ? 'asc' : 'desc'); setLimitPage(1) }}>
                    现价 {limitSortKey === 'close' && (limitSortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="text-right p-2 cursor-pointer select-none hover:text-[#513CC8] transition"
                    onClick={() => { setLimitSortKey('pct_chg'); setLimitSortDir(limitSortKey === 'pct_chg' && limitSortDir === 'desc' ? 'asc' : 'desc'); setLimitPage(1) }}>
                    涨跌幅 {limitSortKey === 'pct_chg' && (limitSortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="text-left p-2">标签</th>
                  <th className="text-center p-2 cursor-pointer select-none hover:text-[#513CC8] transition"
                    onClick={() => { setLimitSortKey('status'); setLimitSortDir(limitSortKey === 'status' && limitSortDir === 'desc' ? 'asc' : 'desc'); setLimitPage(1) }}>
                    状态 {limitSortKey === 'status' && (limitSortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="text-right p-2 cursor-pointer select-none hover:text-[#513CC8] transition"
                    onClick={() => { setLimitSortKey('turnover_ratio'); setLimitSortDir(limitSortKey === 'turnover_ratio' && limitSortDir === 'desc' ? 'asc' : 'desc'); setLimitPage(1) }}>
                    换手% {limitSortKey === 'turnover_ratio' && (limitSortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="text-right p-2">成交额</th>
                </tr>
              </thead>
              <tbody>
                {limitPagedStocks.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="p-2">
                      <span className="text-gray-800 font-medium">{s.name}</span>
                      <span className="text-gray-400 ml-1 text-[10px]">{s.code}</span>
                    </td>
                    <td className={`p-2 text-right font-medium ${limitTab === 'down' ? 'stock-down' : 'stock-up'}`}>
                      {s.close?.toFixed(2) || '---'}
                    </td>
                    <td className={`p-2 text-right font-medium ${(s.pct_chg || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
                      {(s.pct_chg || 0) >= 0 ? '+' : ''}{s.pct_chg?.toFixed(2)}%
                    </td>
                    <td className="p-2 text-left max-w-[80px]">
                      {(s.tag || s.industry) ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-50 text-orange-600 border border-orange-100 truncate inline-block max-w-full" title={s.tag || s.industry}>
                          {s.tag || s.industry}
                        </span>
                      ) : '---'}
                    </td>
                    <td className="p-2 text-center">
                      {s.status && s.status !== '---' ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          s.status.includes('连板') ? 'bg-red-50 text-red-500 border border-red-100' :
                          s.status.includes('一字') ? 'bg-purple-50 text-purple-500 border border-purple-100' :
                          'bg-gray-50 text-gray-500 border border-gray-100'
                        }`}>{s.status}</span>
                      ) : s.limit_times > 1 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-500 border border-red-100">{s.limit_times}连板</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-500 border border-orange-100">1连板</span>
                      )}
                    </td>
                    <td className="p-2 text-right text-gray-600">{s.turnover_ratio?.toFixed(2) || '---'}</td>
                    <td className="p-2 text-right text-gray-600">{s.amount ? formatAmount(s.amount) : '---'}</td>
                  </tr>
                ))}
                {sortedLimitStocks.length === 0 && (
                  <tr><td colSpan={7} className="text-center p-4 text-gray-400">暂无当日涨跌停数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {sortedLimitStocks.length > PAGE_SIZE && (
            <PaginationBar page={limitPage} totalPages={limitTotalPages} total={sortedLimitStocks.length} label="只" onPageChange={setLimitPage} />
          )}
        </div>

        {/* Tushare资金流向 */}
        <div className="col-span-1 md:col-span-6 glass-card p-3 md:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800">
              <DollarSign size={16} style={{ color: '#3B82F6' }} /> 资金流向
              {tsMoneyflow?.trade_date && <span className="text-[10px] text-gray-400 font-normal ml-1">({tsMoneyflow.trade_date})</span>}
            </h3>
            <div className="flex gap-1 items-center">
              <RefreshBtn onClick={() => refreshSection('moneyflow')} />
              <button onClick={() => { setMoneyflowTab('stock'); setMoneyflowPage(1); loadMoneyflow('stock', 1) }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${moneyflowTab === 'stock' ? 'text-white' : 'text-gray-500 bg-gray-50 border border-gray-200'}`}
                style={moneyflowTab === 'stock' ? { background: '#513CC8' } : {}}>
                个股
              </button>
              <button onClick={() => { setMoneyflowTab('concept'); setMoneyflowPage(1); loadMoneyflow('concept', 1) }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${moneyflowTab === 'concept' ? 'text-white' : 'text-gray-500 bg-gray-50 border border-gray-200'}`}
                style={moneyflowTab === 'concept' ? { background: '#513CC8' } : {}}>
                概念
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left p-2">名称</th>
                  {moneyflowTab === 'stock' ? (
                    <>
                      <th className="text-right p-2">主力净流入</th>
                      <th className="text-right p-2">主力流入</th>
                      <th className="text-right p-2">主力流出</th>
                      <th className="text-right p-2">散户净流入</th>
                    </>
                  ) : (
                    <>
                      <th className="text-right p-2">涨跌%</th>
                      <th className="text-right p-2">净流入</th>
                      <th className="text-right p-2">净买入</th>
                      <th className="text-left p-2">领涨股</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {moneyflowItems.map((f, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="p-2 font-medium text-gray-800">
                      {f.name}
                      {f.code && <span className="text-gray-400 ml-1 text-[10px]">{f.code}</span>}
                    </td>
                    {moneyflowTab === 'stock' ? (
                      <>
                        <td className={`p-2 text-right font-medium ${(f.main_net || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>{formatAmountWan(f.main_net)}</td>
                        <td className="p-2 text-right text-red-400">{formatAmountWan(f.main_in)}</td>
                        <td className="p-2 text-right text-green-400">{formatAmountWan(f.main_out)}</td>
                        <td className={`p-2 text-right ${(f.retail_net || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>{formatAmountWan(f.retail_net)}</td>
                      </>
                    ) : (
                      <>
                        <td className={`p-2 text-right font-medium ${(f.pct_change || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
                          {(f.pct_change || 0) >= 0 ? '+' : ''}{f.pct_change?.toFixed(2)}%
                        </td>
                        <td className={`p-2 text-right font-medium ${(f.net_amount || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>{formatAmountWan(f.net_amount)}</td>
                        <td className={`p-2 text-right ${(f.net_buy_amount || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>{formatAmountWan(f.net_buy_amount)}</td>
                        <td className="p-2 text-gray-400 truncate max-w-[60px]">{f.lead_stock || '---'}</td>
                      </>
                    )}
                  </tr>
                ))}
                {moneyflowItems.length === 0 && (
                  <tr><td colSpan={5} className="text-center p-4 text-gray-400">暂无资金流向数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {moneyflowTotal > MONEYFLOW_PAGE_SIZE && (
            <PaginationBar page={moneyflowPage} totalPages={moneyflowTotalPages} total={moneyflowTotal} label="条"
              onPageChange={(p) => { setMoneyflowPage(p); loadMoneyflow(moneyflowTab, p) }} />
          )}
        </div>
      </div>

      {/* ==================== Row 4: 热力板块 + 热力概念 ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3" style={{ alignItems: 'stretch' }}>
        <div className="col-span-1 md:col-span-6 glass-card p-3 md:p-4 flex flex-col">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-800"><Flame size={16} style={{ color: '#513CC8' }} /> 热力板块 {overview?.trade_date && <span className="text-[10px] text-gray-400 font-normal ml-1">({overview.trade_date})</span>} <span className="text-[10px] text-gray-400 font-normal">({sectorHeatTotal || sectors.length}个)</span></h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 flex-1">
            {sectors.slice((sectorHeatPage - 1) * 16, sectorHeatPage * 16).map((s, i) => {
              const intensity = Math.min(Math.abs(s.change_pct) / 4, 1)
              const bg = s.change_pct >= 0
                ? `rgba(239,68,68,${0.08 + intensity * 0.25})`
                : `rgba(34,197,94,${0.08 + intensity * 0.25})`
              return (
                <div key={i} className="rounded-lg p-2.5 text-center border border-transparent hover:border-gray-200 transition flex flex-col justify-center" style={{ background: bg, minHeight: '72px' }}>
                  <p className="text-xs font-medium truncate text-gray-700">{s.name}</p>
                  <p className={`text-sm font-bold ${s.change_pct >= 0 ? 'stock-up' : 'stock-down'}`}>
                    {s.change_pct > 0 ? '+' : ''}{s.change_pct?.toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">{s.lead_stock || '\u00A0'}</p>
                </div>
              )
            })}
          </div>
          {sectors.length > 16 && (
            <PaginationBar page={sectorHeatPage} totalPages={Math.ceil(sectors.length / 16)} total={sectors.length} label="个板块" onPageChange={setSectorHeatPage} />
          )}
        </div>

        <div className="col-span-1 md:col-span-6 glass-card p-3 md:p-4 flex flex-col">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-800"><Lightbulb size={16} style={{ color: '#513CC8' }} /> 热力概念 {overview?.trade_date && <span className="text-[10px] text-gray-400 font-normal ml-1">({overview.trade_date})</span>} <span className="text-[10px] text-gray-400 font-normal">({finalConceptData.length}个)</span></h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 flex-1">
            {finalConceptData.slice((conceptHeatPage - 1) * 16, conceptHeatPage * 16).map((c, i) => {
              const changePct = c.change_pct || c.pct_change || 0
              const intensity = Math.min(Math.abs(changePct) / 4, 1)
              const bg = changePct >= 0
                ? `rgba(239,68,68,${0.08 + intensity * 0.25})`
                : `rgba(34,197,94,${0.08 + intensity * 0.25})`
              return (
                <div key={i} className="rounded-lg p-2.5 text-center border border-transparent hover:border-gray-200 transition flex flex-col justify-center" style={{ background: bg, minHeight: '72px' }}>
                  <p className="text-xs font-medium truncate text-gray-700">{c.name}</p>
                  <p className={`text-sm font-bold ${changePct >= 0 ? 'stock-up' : 'stock-down'}`}>
                    {changePct > 0 ? '+' : ''}{changePct?.toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">{c.net_flow ? formatFlow(c.net_flow * 10000) : (c.volume ? `${(c.volume / 10000).toFixed(0)}万` : '\u00A0')}</p>
                </div>
              )
            })}
            {finalConceptData.length === 0 && (
              <div className="col-span-4 text-center py-4 text-gray-400 text-xs">暂无概念数据</div>
            )}
          </div>
          {finalConceptData.length > 16 && (
            <PaginationBar page={conceptHeatPage} totalPages={Math.ceil(finalConceptData.length / 16)} total={finalConceptData.length} label="个概念" onPageChange={setConceptHeatPage} />
          )}
        </div>
      </div>
    </div>
  )
}

function getSentimentLabel(score) {
  if (score >= 80) return '过热'
  if (score >= 60) return '偏热'
  if (score >= 40) return '正常'
  if (score >= 20) return '偏冷'
  return '冰点'
}
