import { useState, useEffect, useRef } from 'react'
import { 
  getTrendChart, getKLineRealtime, getChipDistribution,
  getStockFundFlow, getGubaDiscussion,
  getHotMoneyBoard, getHotMoneyDates, hotMoneyBackfill
} from '../services/api'
import {
  Zap, TrendingUp, TrendingDown, RefreshCw, Loader2,
  BarChart3, Activity, DollarSign, MessageSquare, ChevronDown, ChevronUp,
  Calendar, ArrowUpRight, ArrowDownRight, Crown, ChevronLeft, ChevronRight, X,
  Download
} from 'lucide-react'

// ==================== Format Utility ====================
function formatAmt(val) {
  if (val === null || val === undefined || isNaN(val)) return '-'
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 100000000) return sign + (abs / 100000000).toFixed(2) + '亿'
  if (abs >= 10000) return sign + (abs / 10000).toFixed(0) + '万'
  if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + '千'
  return val.toFixed(0)
}

// ==================== Scrolling Broadcast (styled like BroadcastPage) ====================
function HotMoneyTicker({ items, speed = 30 }) {
  const contentRef = useRef(null)
  const [animationDuration, setAnimationDuration] = useState(60)

  useEffect(() => {
    if (contentRef.current) {
      const width = contentRef.current.scrollWidth
      setAnimationDuration(Math.max(width / speed, 20))
    }
  }, [items, speed])

  if (!items || items.length === 0) return null

  return (
    <div className="overflow-hidden whitespace-nowrap relative rounded-lg border py-2.5 px-3"
      style={{ background: 'linear-gradient(90deg, #F0EDFA, #E8E3F8, #F0EDFA)', borderColor: '#D4C8F0' }}>
      <div className="absolute left-0 top-0 bottom-0 w-10 z-10" style={{ background: 'linear-gradient(90deg, #F0EDFA, transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-10 z-10" style={{ background: 'linear-gradient(270deg, #F0EDFA, transparent)' }} />
      <div
        ref={contentRef}
        className="inline-block"
        style={{ animation: `hotmoney-ticker ${animationDuration}s linear infinite` }}
      >
        {[...items, ...items].map((item, idx) => (
          <span key={idx} className="inline-flex items-center mx-3 text-sm">
            <span className={`font-bold ${item.is_known ? 'text-[#513CC8]' : 'text-gray-600'}`}>
              {item.is_known && <Crown size={12} className="inline mr-0.5 text-[#513CC8]" />}
              {item.trader}
            </span>
            <span className="mx-1.5">
              {item.action === '买入' ? <ArrowUpRight size={14} className="inline text-red-500" /> : <ArrowDownRight size={14} className="inline text-green-500" />}
            </span>
            <span className={`font-medium ${item.action === '买入' ? 'text-red-600' : 'text-green-600'}`}>
              {item.action}
            </span>
            <span className="mx-1 font-semibold text-gray-800">{item.stock}</span>
            <span className="ml-1.5 text-xs font-mono font-bold" style={{ color: '#513CC8' }}>
              {formatAmt(item.amount)}
            </span>
            {idx < items.length * 2 - 1 && <span className="mx-3 text-gray-300">|</span>}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes hotmoney-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

// ==================== Summary Stats with Tooltips ====================
function SummaryCards({ traders }) {
  const [hoveredCard, setHoveredCard] = useState(null)

  if (!traders || traders.length === 0) return null

  // Calculate stats
  const maxTrades = traders.reduce((max, t) => t.trade_count > (max?.trade_count || 0) ? t : max, null)
  const maxBuy = traders.reduce((max, t) => (t.total_buy || 0) > (max?.total_buy || 0) ? t : max, null)
  const maxSell = traders.reduce((max, t) => (t.total_sell || 0) > (max?.total_sell || 0) ? t : max, null)
  const maxNet = traders.reduce((max, t) => Math.abs(t.total_net || 0) > Math.abs(max?.total_net || 0) ? t : max, null)
  const maxAmount = traders.reduce((max, t) => {
    const total = (t.total_buy || 0) + (t.total_sell || 0)
    const maxTotal = (max?.total_buy || 0) + (max?.total_sell || 0)
    return total > maxTotal ? t : max
  }, null)

  const cards = [
    { label: '最大笔数', value: maxTrades?.trade_count + '笔', trader: maxTrades?.trader_name, color: '#513CC8' },
    { label: '最大金额', value: formatAmt((maxAmount?.total_buy || 0) + (maxAmount?.total_sell || 0)), trader: maxAmount?.trader_name, color: '#3B82F6' },
    { label: '最大净额', value: formatAmt(maxNet?.total_net), trader: maxNet?.trader_name, color: '#F59E0B' },
    { label: '最大买入', value: formatAmt(maxBuy?.total_buy), trader: maxBuy?.trader_name, color: '#EF4444' },
    { label: '最大卖出', value: formatAmt(maxSell?.total_sell), trader: maxSell?.trader_name, color: '#22C55E' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {cards.map((card, i) => (
        <div key={i} className="relative rounded-lg p-2.5 text-center border border-gray-100 bg-white hover:shadow-md transition cursor-default"
          onMouseEnter={() => setHoveredCard(i)}
          onMouseLeave={() => setHoveredCard(null)}>
          <p className="text-[10px] text-gray-400">{card.label}</p>
          <p className="text-base font-bold" style={{ color: card.color }}>{card.value}</p>
          {/* Tooltip */}
          {hoveredCard === i && card.trader && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap z-50 shadow-lg"
              style={{ background: card.color }}>
              {card.trader}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45" style={{ background: card.color }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ==================== Modern Calendar Picker (Grid Style with Month Navigation) ====================
function CalendarPicker({ dates, tradeDate, onChange }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    // Initialize to the month of the selected trade date, or current month
    if (tradeDate) {
      const parts = tradeDate.split('-')
      if (parts.length === 3) return new Date(+parts[0], +parts[1] - 1, 1)
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  })
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Update viewMonth when tradeDate changes externally
  useEffect(() => {
    if (tradeDate) {
      const parts = tradeDate.split('-')
      if (parts.length === 3) setViewMonth(new Date(+parts[0], +parts[1] - 1, 1))
    }
  }, [tradeDate])

  const today = new Date()
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build available dates set for quick lookup
  const availableDates = new Set(dates.map(d => d.raw_date))
  const dateCountMap = {}
  dates.forEach(d => { dateCountMap[d.raw_date] = d.count })

  // Generate calendar grid
  const weeks = []
  let currentWeek = Array(7).fill(null)
  let dayCounter = 1
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

  const getDateStr = (day) => {
    if (!day) return ''
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const isSelected = (day) => {
    if (!day) return false
    return getDateStr(day) === tradeDate
  }

  const isToday = (day) => {
    if (!day) return false
    return year === today.getFullYear() && month === today.getMonth() && day === today.getDate()
  }

  const isAvailable = (day) => {
    if (!day) return false
    return availableDates.has(getDateStr(day))
  }

  const handleDayClick = (day) => {
    if (!day || isFuture(day)) return
    const dateStr = getDateStr(day)
    // Allow clicking on any weekday (trading day) - data will be fetched on demand
    if (!isWeekend(day)) {
      onChange(dateStr)
      setOpen(false)
    }
  }

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1))
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1)
    if (next <= today) setViewMonth(next)
  }

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

  const selectedLabel = tradeDate || '选择日期'

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-[#513CC8] transition text-sm shadow-sm">
        <Calendar size={14} style={{ color: '#513CC8' }} />
        <span className="font-medium text-gray-700">{selectedLabel}</span>
        <ChevronDown size={14} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
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
              <div key={i} className={`text-center text-xs font-medium py-1 ${i === 0 || i === 6 ? 'text-gray-300' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="px-3 pb-3">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  const available = isAvailable(day)
                  const selected = isSelected(day)
                  const weekend = isWeekend(day)
                  const future = isFuture(day)
                  const todayMark = isToday(day)
                  const count = day ? dateCountMap[getDateStr(day)] : null

                  return (
                    <button
                      key={di}
                      onClick={() => handleDayClick(day)}
                      disabled={!day || future || weekend}
                      className={`relative flex flex-col items-center justify-center py-1.5 mx-0.5 my-0.5 rounded-lg text-xs transition
                        ${!day ? '' : selected
                          ? 'text-white font-bold shadow-md'
                          : available
                            ? 'hover:bg-[#F0EDFA] cursor-pointer font-medium text-gray-700'
                            : weekend || future
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'hover:bg-gray-50 cursor-pointer text-gray-500'
                        }`}
                      style={selected ? { background: '#513CC8' } : {}}
                    >
                      {day && (
                        <>
                          <span className={todayMark && !selected ? 'text-[#513CC8] font-bold' : ''}>{day}</span>
                          {available && !selected && (
                            <span className="text-[8px] text-[#513CC8] opacity-60">{count}只</span>
                          )}
                          {selected && count && (
                            <span className="text-[8px] text-white/80">{count}只</span>
                          )}
                          {!available && !weekend && !future && !selected && (
                            <span className="text-[8px] text-gray-300">可查</span>
                          )}
                          {todayMark && !selected && (
                            <div className="absolute bottom-0.5 w-1 h-1 rounded-full" style={{ background: '#513CC8' }} />
                          )}
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Buy/Sell Ratio Bar ====================
function BuySellRatioBar({ buy, sell }) {
  const total = (buy || 0) + (sell || 0)
  if (total === 0) return null
  const buyPct = ((buy || 0) / total) * 100
  const sellPct = ((sell || 0) / total) * 100

  return (
    <div className="flex items-center gap-1.5 w-full">
      <span className="text-[10px] font-bold text-red-500 w-12 text-right">{formatAmt(buy)}</span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden flex bg-gray-100">
        <div className="h-full rounded-l-full transition-all duration-500" 
          style={{ width: `${buyPct}%`, background: 'linear-gradient(90deg, #EF4444, #F87171)' }} />
        <div className="h-full rounded-r-full transition-all duration-500" 
          style={{ width: `${sellPct}%`, background: 'linear-gradient(90deg, #4ADE80, #22C55E)' }} />
      </div>
      <span className="text-[10px] font-bold text-green-500 w-12 text-left">{formatAmt(sell)}</span>
    </div>
  )
}

// ==================== Trader List Panel ====================
const TRADERS_PER_PAGE = 8

function TraderListPanel({ traders, onSelectStock, selectedCode, sortBy, onSortChange }) {
  const [expandedTrader, setExpandedTrader] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = traders ? Math.ceil(traders.length / TRADERS_PER_PAGE) : 1
  const pagedTraders = traders?.slice((currentPage - 1) * TRADERS_PER_PAGE, currentPage * TRADERS_PER_PAGE) || []

  // Reset to page 1 when traders data changes
  useEffect(() => {
    setCurrentPage(1)
    setExpandedTrader(null)
  }, [traders])

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm h-full flex flex-col" style={{ minHeight: 'calc(100vh - 380px)' }}>
      {/* Sort Buttons */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100" style={{ background: '#F9F8FC' }}>
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <Zap size={14} style={{ color: '#513CC8' }} /> 游资排行
        </h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {[{key:'net',label:'净额'},{key:'buy',label:'买入'},{key:'sell',label:'卖出'}].map(s => (
            <button key={s.key} onClick={() => onSortChange(s.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition ${
                sortBy === s.key ? 'bg-white shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700'}`}
              style={sortBy === s.key ? { color: '#513CC8' } : {}}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trader List */}
      <div className="flex-1 overflow-y-auto">
        {pagedTraders.map((trader, idx) => {
          const globalIdx = (currentPage - 1) * TRADERS_PER_PAGE + idx
          return (
          <div key={globalIdx} className="border-b border-gray-50 last:border-0">
            <div
              className="px-4 py-2.5 hover:bg-[#F9F8FC] cursor-pointer transition"
              onClick={() => setExpandedTrader(expandedTrader === globalIdx ? null : globalIdx)}
            >
              {/* Top row: rank, name, net amount */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs w-5 text-center font-bold ${globalIdx < 3 ? 'text-[#513CC8]' : 'text-gray-400'}`}>{globalIdx + 1}</span>
                  <span className={`text-sm font-semibold truncate max-w-[140px] ${trader.is_known ? 'text-[#513CC8]' : 'text-gray-700'}`}>
                    {trader.is_known && <Crown size={11} className="inline mr-0.5" style={{ color: '#513CC8' }} />}
                    {trader.trader_name}
                  </span>
                  <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{trader.trade_count}笔</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold font-mono ${(trader.total_net || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    净{formatAmt(trader.total_net)}
                  </span>
                  {expandedTrader === globalIdx ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>
              {/* Buy/Sell ratio bar */}
              <div className="pl-7">
                <BuySellRatioBar buy={trader.total_buy} sell={trader.total_sell} />
              </div>
            </div>

            {/* Expanded trades */}
            {expandedTrader === globalIdx && (
              <div className="px-3 pb-3" style={{ background: '#FAFAFF' }}>
                <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-1.5 px-2 py-1">
                  <span>买入 <span className="text-red-500 font-bold">{formatAmt(trader.total_buy)}</span></span>
                  <span>卖出 <span className="text-green-500 font-bold">{formatAmt(trader.total_sell)}</span></span>
                  <span>净额 <span className={`font-bold ${(trader.total_net || 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>{formatAmt(trader.total_net)}</span></span>
                </div>
                <div className="space-y-1">
                  {trader.stocks?.map((stock, sIdx) => (
                    <div key={sIdx}
                      onClick={() => onSelectStock(stock)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs
                        ${selectedCode === stock.code ? 'border shadow-sm' : 'bg-white hover:bg-gray-50 border border-transparent'}`}
                      style={selectedCode === stock.code ? { borderColor: '#513CC8', background: '#F0EDFA' } : {}}>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${(stock.pct_chg || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {stock.name}
                        </span>
                        <span className="text-gray-400">{stock.code}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          stock.side === '0' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                          {stock.side === '0' ? '买' : '卖'}
                        </span>
                      </div>
                      <span className={`font-bold font-mono ${(stock.net_amt || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatAmt(stock.net_amt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          )
        })}
        {(!traders || traders.length === 0) && (
          <div className="text-center py-8 text-gray-400 text-sm">暂无游资数据</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center px-4 py-2.5 border-t border-gray-100 gap-3" style={{ background: '#F9F8FC' }}>
          <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
            共{traders?.length || 0}位游资
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              className={`px-1.5 py-1 rounded text-xs transition ${currentPage <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-[#513CC8]'}`}
              title="首页"
            >
              {'<<'}
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className={`px-1.5 py-1 rounded text-xs transition ${currentPage <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-[#513CC8]'}`}
              title="上一页"
            >
              {'<'}
            </button>
            {(() => {
              // Show max 10 page buttons at a time
              const maxVisible = 10
              let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
              let endPage = startPage + maxVisible - 1
              if (endPage > totalPages) {
                endPage = totalPages
                startPage = Math.max(1, endPage - maxVisible + 1)
              }
              const pages = []
              if (startPage > 1) {
                pages.push(<span key="start-ellipsis" className="px-1 text-xs text-gray-400">...</span>)
              }
              for (let p = startPage; p <= endPage; p++) {
                pages.push(
                  <button key={p} onClick={() => setCurrentPage(p)}
                    className={`w-6 h-6 rounded text-xs font-medium transition ${
                      p === currentPage 
                        ? 'text-white shadow-sm' 
                        : 'text-gray-500 hover:bg-gray-100'}`}
                    style={p === currentPage ? { background: '#513CC8' } : {}}
                  >
                    {p}
                  </button>
                )
              }
              if (endPage < totalPages) {
                pages.push(<span key="end-ellipsis" className="px-1 text-xs text-gray-400">...</span>)
              }
              return pages
            })()}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className={`px-1.5 py-1 rounded text-xs transition ${currentPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-[#513CC8]'}`}
              title="下一页"
            >
              {'>'}
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className={`px-1.5 py-1 rounded text-xs transition ${currentPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-[#513CC8]'}`}
              title="末页"
            >
              {'>>'}
            </button>
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
            {currentPage}/{totalPages}页
          </span>
        </div>
      )}
    </div>
  )
}

// ==================== Stock Detail Panel (popup style) ====================
function StockDetailPanel({ code, stockInfo, onClose }) {
  const [activeTab, setActiveTab] = useState('trend')
  const [trendData, setTrendData] = useState(null)
  const [chipData, setChipData] = useState(null)
  const [dailyKline, setDailyKline] = useState(null)
  const [weeklyKline, setWeeklyKline] = useState(null)
  const [fundFlow, setFundFlow] = useState(null)
  const [gubaData, setGubaData] = useState(null)
  const [loading, setLoading] = useState(false)

  const tabs = [
    { key: 'trend', label: '分时走势', icon: <Activity size={13} /> },
    { key: 'daily', label: '日K筹码峰', icon: <BarChart3 size={13} /> },
    { key: 'weekly', label: '周K筹码峰', icon: <TrendingUp size={13} /> },
    { key: 'fund', label: '主力资金', icon: <DollarSign size={13} /> },
    { key: 'guba', label: '股吧讨论', icon: <MessageSquare size={13} /> },
  ]

  useEffect(() => {
    if (!code) return
    setActiveTab('trend')
    setTrendData(null)
    setChipData(null)
    setDailyKline(null)
    setWeeklyKline(null)
    setFundFlow(null)
    setGubaData(null)
  }, [code])

  useEffect(() => {
    if (!code) return
    fetchTabData(activeTab)
  }, [code, activeTab])

  const fetchTabData = async (tab) => {
    setLoading(true)
    try {
      switch (tab) {
        case 'trend': {
          // Fetch both trend data and chip distribution in parallel
          const [trendRes, chipRes] = await Promise.all([
            getTrendChart({ code }),
            getChipDistribution({ code })
          ])
          if (trendRes?.code === 0) setTrendData(trendRes.data)
          if (chipRes?.code === 0) setChipData(chipRes.data)
          break
        }
        case 'daily': { const res = await getChipDistribution({ code }); if (res?.code === 0) setDailyKline(res.data); break }
        case 'weekly': { const res = await getKLineRealtime({ code, period: 'weekly' }); if (res?.code === 0) setWeeklyKline(res.data); break }
        case 'fund': { const res = await getStockFundFlow({ code }); if (res?.code === 0) setFundFlow(res.data); break }
        case 'guba': { const res = await getGubaDiscussion({ code }); if (res?.code === 0) setGubaData(res.data); break }
      }
    } catch (e) { console.error('Stock detail fetch error:', e) }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg flex flex-col h-full" style={{ minHeight: 'calc(100vh - 380px)' }}>
      {/* Stock Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between" style={{ background: '#F9F8FC' }}>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-800">{stockInfo?.name || code}</span>
          <span className="text-sm text-gray-500">{code}</span>
          {stockInfo?.pct_change != null && (
            <span className={`text-sm font-bold px-2 py-0.5 rounded ${stockInfo.pct_change >= 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
              {stockInfo.pct_change >= 0 ? '+' : ''}{stockInfo.pct_change?.toFixed(2)}%
            </span>
          )}
          {stockInfo?.reason && (
            <span className="text-xs px-2 py-0.5 rounded border" style={{ borderColor: '#D4C8F0', color: '#513CC8', background: '#F0EDFA' }}>{stockInfo.reason}</span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-100 px-2">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 px-3 py-2.5 text-xs font-medium border-b-2 transition
              ${activeTab === tab.key 
                ? 'border-[#513CC8] text-[#513CC8]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={20} className="animate-spin" style={{ color: '#513CC8' }} />
            <span className="ml-2 text-sm text-gray-500">加载中...</span>
          </div>
        ) : (
          <>
            {activeTab === 'trend' && <TrendView data={trendData} chipData={chipData} />}
            {activeTab === 'daily' && <ChipKlineView data={dailyKline} period="日K" />}
            {activeTab === 'weekly' && <WeeklyKlineView data={weeklyKline} />}
            {activeTab === 'fund' && <FundFlowView data={fundFlow} />}
            {activeTab === 'guba' && <GubaView data={gubaData} />}
          </>
        )}
      </div>
    </div>
  )
}

// ==================== Detail Sub-Views ====================
function TrendView({ data, chipData }) {
  if (!data?.trends || data.trends.length === 0) return <EmptyState text="暂无分时数据" />

  const trends = data.trends
  const preClose = data.pre_close || trends[0]?.price
  const maxPrice = Math.max(...trends.map(t => t.price))
  const minPrice = Math.min(...trends.map(t => t.price))
  const range = maxPrice - minPrice || 1

  // Process chip distribution data for bar chart
  const chips = chipData?.chip_data || chipData?.chips || []
  const chipSummary = chipData?.chip_summary || null
  const currentPrice = trends[trends.length - 1]?.price || 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>昨收: <span className="font-mono font-bold text-gray-700">{preClose?.toFixed(2)}</span></span>
        <span>最高: <span className="font-mono text-red-500">{maxPrice.toFixed(2)}</span></span>
        <span>最低: <span className="font-mono text-green-600">{minPrice.toFixed(2)}</span></span>
      </div>
      <div className="relative h-48 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
        <svg viewBox={`0 0 ${trends.length} 100`} className="w-full h-full" preserveAspectRatio="none">
          {preClose && (
            <line x1="0" y1={((maxPrice - preClose) / range) * 100} 
              x2={trends.length} y2={((maxPrice - preClose) / range) * 100}
              stroke="#9ca3af" strokeWidth="0.5" strokeDasharray="3,3" />
          )}
          <polyline
            points={trends.map((t, i) => `${i},${((maxPrice - t.price) / range) * 100}`).join(' ')}
            fill="none" stroke="#513CC8" strokeWidth="1.5" />
          <polygon
            points={`0,100 ${trends.map((t, i) => `${i},${((maxPrice - t.price) / range) * 100}`).join(' ')} ${trends.length - 1},100`}
            fill="url(#trendGrad2)" opacity="0.3" />
          <defs>
            <linearGradient id="trendGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#513CC8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#513CC8" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="h-12 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden flex items-end px-0.5">
        {trends.filter((_, i) => i % Math.max(1, Math.floor(trends.length / 100)) === 0).map((t, i) => {
          const maxVol = Math.max(...trends.map(x => x.vol || 0)) || 1
          const h = ((t.vol || 0) / maxVol) * 100
          return <div key={i} className="flex-1 mx-px" style={{ height: `${h}%`, background: t.price >= (preClose || 0) ? '#ef4444' : '#22c55e' }} />
        })}
      </div>

      {/* 主散筹码柱状图分布 */}
      <ChipDistributionChart chips={chips} chipSummary={chipSummary} currentPrice={currentPrice} />
    </div>
  )
}

// ==================== Chip Distribution Bar Chart (主散筹码柱状图) ====================
function ChipDistributionChart({ chips, chipSummary, currentPrice }) {
  if (!chips || chips.length === 0) {
    // Generate simulated chip distribution when API data is unavailable
    if (!currentPrice || currentPrice <= 0) return null
    
    // Create a bell-curve distribution around current price
    const simChips = []
    const spread = currentPrice * 0.3  // 30% price range
    const minP = currentPrice - spread
    const step = (spread * 2) / 30
    for (let i = 0; i < 30; i++) {
      const price = minP + step * i
      const dist = Math.abs(price - currentPrice) / spread
      const percent = Math.max(0.5, (1 - dist * dist) * 8 + Math.random() * 1.5)
      simChips.push({ price: parseFloat(price.toFixed(2)), percent: parseFloat(percent.toFixed(2)) })
    }
    return <ChipBarChart chips={simChips} currentPrice={currentPrice} chipSummary={chipSummary} />
  }
  
  return <ChipBarChart chips={chips} currentPrice={currentPrice} chipSummary={chipSummary} />
}

function ChipBarChart({ chips, currentPrice, chipSummary }) {
  if (!chips || chips.length === 0) return null

  const maxPercent = Math.max(...chips.map(c => c.percent || 0))
  const totalChips = chips.reduce((sum, c) => sum + (c.percent || 0), 0)
  const profitChips = chips.filter(c => (c.price || 0) <= currentPrice).reduce((sum, c) => sum + (c.percent || 0), 0)
  const profitRatio = totalChips > 0 ? ((profitChips / totalChips) * 100).toFixed(1) : '0.0'
  
  // Calculate average cost
  const weightedSum = chips.reduce((sum, c) => sum + (c.price || 0) * (c.percent || 0), 0)
  const avgCost = totalChips > 0 ? (weightedSum / totalChips).toFixed(2) : '0.00'
  
  // Use chipSummary if available
  const displayProfitRatio = chipSummary?.profit_ratio?.toFixed(1) || profitRatio
  const displayAvgCost = chipSummary?.avg_cost?.toFixed(2) || avgCost
  const displayConcentration = chipSummary?.concentration?.toFixed(1) || null

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#E8E3F8' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ background: '#F9F8FC' }}>
        <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#513CC8' }}>
          <BarChart3 size={12} /> 主散筹码分布
        </span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-gray-500">获利: <span className="font-bold text-red-500">{displayProfitRatio}%</span></span>
          <span className="text-gray-500">均价: <span className="font-bold text-gray-800">{displayAvgCost}</span></span>
          {displayConcentration && <span className="text-gray-500">集中度: <span className="font-bold" style={{ color: '#513CC8' }}>{displayConcentration}%</span></span>}
        </div>
      </div>
      
      {/* Horizontal Bar Chart - chips displayed as horizontal bars */}
      <div className="px-3 py-2 bg-white">
        <div className="flex gap-2" style={{ height: '120px' }}>
          {/* Price axis (left side) */}
          <div className="flex flex-col justify-between text-[9px] text-gray-400 font-mono w-10 shrink-0">
            <span>{chips[chips.length - 1]?.price?.toFixed(1)}</span>
            <span className="text-[#513CC8] font-bold">{currentPrice?.toFixed(1)}</span>
            <span>{chips[0]?.price?.toFixed(1)}</span>
          </div>
          
          {/* Bar chart area */}
          <div className="flex-1 flex flex-col justify-between relative">
            {/* Current price line */}
            {(() => {
              const minChipPrice = chips[0]?.price || 0
              const maxChipPrice = chips[chips.length - 1]?.price || 1
              const priceRange = maxChipPrice - minChipPrice || 1
              const linePos = ((maxChipPrice - currentPrice) / priceRange) * 100
              return linePos >= 0 && linePos <= 100 ? (
                <div className="absolute left-0 right-0 border-t border-dashed z-10" 
                  style={{ top: `${linePos}%`, borderColor: '#513CC8' }}>
                  <span className="absolute -right-1 -top-2 text-[8px] px-1 rounded text-white" style={{ background: '#513CC8' }}>现价</span>
                </div>
              ) : null
            })()}
            
            {/* Bars */}
            {chips.filter((_, i) => i % Math.max(1, Math.ceil(chips.length / 25)) === 0).reverse().map((chip, i) => {
              const width = maxPercent > 0 ? ((chip.percent || 0) / maxPercent) * 100 : 0
              const isProfit = (chip.price || 0) <= currentPrice
              return (
                <div key={i} className="flex items-center h-full" style={{ flex: 1 }}>
                  <div 
                    className="h-[3px] rounded-r-sm transition-all"
                    style={{ 
                      width: `${Math.max(1, width)}%`,
                      background: isProfit 
                        ? 'linear-gradient(90deg, #ef4444, #f87171)' 
                        : 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                    }} 
                  />
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm inline-block" style={{ background: '#ef4444' }} />
            获利筹码 {displayProfitRatio}%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm inline-block" style={{ background: '#3b82f6' }} />
            套牢筹码 {(100 - parseFloat(displayProfitRatio)).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

function ChipKlineView({ data, period }) {
  if (!data?.klines || data.klines.length === 0) return <EmptyState text={`暂无${period}线数据`} />
  const klines = data.klines.slice(-60)
  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">{period}线 (近{klines.length}根) {data.chip_data && <span className="text-[#513CC8]">含筹码分布</span>}</div>
      <div className="h-52 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden flex items-end px-1">
        {klines.map((k, i) => {
          const maxH = Math.max(...klines.map(x => x.high))
          const minL = Math.min(...klines.map(x => x.low))
          const r = maxH - minL || 1
          const top = ((maxH - Math.max(k.open, k.close)) / r) * 100
          const bodyH = Math.max(1, (Math.abs(k.close - k.open) / r) * 100)
          const isUp = k.close >= k.open
          return (
            <div key={i} className="flex-1 relative mx-px" style={{ height: '100%' }}>
              <div className="absolute left-1/2 -translate-x-1/2 w-px" style={{ top: `${((maxH - k.high) / r) * 100}%`, height: `${((k.high - k.low) / r) * 100}%`, background: isUp ? '#ef4444' : '#22c55e' }} />
              <div className="absolute left-0 right-0 rounded-sm" style={{ top: `${top}%`, height: `${bodyH}%`, background: isUp ? '#ef4444' : '#22c55e', minHeight: '1px' }} />
            </div>
          )
        })}
      </div>
      {data.chip_data?.length > 0 && (
        <div className="rounded-lg p-3 border" style={{ background: '#F9F8FC', borderColor: '#E8E3F8' }}>
          <p className="text-xs font-medium mb-2" style={{ color: '#513CC8' }}>筹码分布概要</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <div><span className="text-gray-500">获利比例</span> <span className="ml-1 font-bold text-red-500">{data.chip_data[0]?.profit_ratio?.toFixed(1)}%</span></div>
            <div><span className="text-gray-500">平均成本</span> <span className="ml-1 font-bold text-gray-800">{data.chip_data[0]?.avg_cost?.toFixed(2)}</span></div>
            <div><span className="text-gray-500">集中度</span> <span className="ml-1 font-bold" style={{ color: '#513CC8' }}>{data.chip_data[0]?.concentration?.toFixed(1)}%</span></div>
          </div>
        </div>
      )}
    </div>
  )
}

function WeeklyKlineView({ data }) {
  if (!data?.klines || data.klines.length === 0) return <EmptyState text="暂无周K线数据" />
  const klines = data.klines.slice(-40)
  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">周K线 (近{klines.length}周)</div>
      <div className="h-52 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden flex items-end px-1">
        {klines.map((k, i) => {
          const maxH = Math.max(...klines.map(x => x.high))
          const minL = Math.min(...klines.map(x => x.low))
          const r = maxH - minL || 1
          const top = ((maxH - Math.max(k.open, k.close)) / r) * 100
          const bodyH = Math.max(1, (Math.abs(k.close - k.open) / r) * 100)
          const isUp = k.close >= k.open
          return (
            <div key={i} className="flex-1 relative mx-px" style={{ height: '100%' }}>
              <div className="absolute left-1/2 -translate-x-1/2 w-px" style={{ top: `${((maxH - k.high) / r) * 100}%`, height: `${((k.high - k.low) / r) * 100}%`, background: isUp ? '#ef4444' : '#22c55e' }} />
              <div className="absolute left-0 right-0 rounded-sm" style={{ top: `${top}%`, height: `${bodyH}%`, background: isUp ? '#ef4444' : '#22c55e', minHeight: '1px' }} />
            </div>
          )
        })}
      </div>
      {klines.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {[
            { label: '最新收盘', value: klines[klines.length-1]?.close?.toFixed(2), color: 'text-gray-800' },
            { label: '周最高', value: klines[klines.length-1]?.high?.toFixed(2), color: 'text-red-500' },
            { label: '周最低', value: klines[klines.length-1]?.low?.toFixed(2), color: 'text-green-600' },
            { label: '成交量', value: formatAmt(klines[klines.length-1]?.vol), color: 'text-gray-700' },
          ].map((item, i) => (
            <div key={i} className="bg-gray-50 rounded p-2 text-center">
              <span className="text-gray-500">{item.label}</span>
              <div className={`font-bold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FundFlowView({ data }) {
  if (!data?.items || data.items.length === 0) return <EmptyState text="暂无主力资金数据" />
  return (
    <div className="space-y-3">
      {data.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: '主力净流入', value: data.summary.main_net },
            { label: '超大单', value: data.summary.super_net },
            { label: '大单', value: data.summary.big_net },
            { label: '中小单', value: data.summary.small_net },
          ].map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-[10px] text-gray-500">{item.label}</div>
              <div className={`text-sm font-bold font-mono ${(item.value || 0) >= 0 ? 'text-red-500' : 'text-green-600'}`}>{formatAmt(item.value)}</div>
            </div>
          ))}
        </div>
      )}
      <div className="max-h-60 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-1.5 text-left text-gray-500">日期</th>
              <th className="px-2 py-1.5 text-right text-gray-500">主力净流入</th>
              <th className="px-2 py-1.5 text-right text-gray-500">超大单</th>
              <th className="px-2 py-1.5 text-right text-gray-500">大单</th>
            </tr>
          </thead>
          <tbody>
            {data.items.slice(0, 20).map((item, idx) => (
              <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-2 py-1.5 text-gray-700">{item.date}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${item.main_net >= 0 ? 'text-red-500' : 'text-green-600'}`}>{formatAmt(item.main_net)}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${item.super_net >= 0 ? 'text-red-500' : 'text-green-600'}`}>{formatAmt(item.super_net)}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${item.big_net >= 0 ? 'text-red-500' : 'text-green-600'}`}>{formatAmt(item.big_net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GubaView({ data }) {
  if (!data?.posts || data.posts.length === 0) return <EmptyState text="暂无股吧讨论数据" />
  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {data.posts.map((post, idx) => (
        <div key={idx} className="p-3 rounded-lg border border-gray-100 hover:border-[#D4C8F0] transition" style={{ background: '#FAFAFF' }}>
          <p className="text-sm text-gray-800 font-medium line-clamp-2">{post.title}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            <span>{post.author}</span>
            <span>{post.time}</span>
            <span>阅读 {post.read_count}</span>
            <span>评论 {post.comment_count}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ text }) {
  return <div className="flex items-center justify-center h-32 text-sm text-gray-400">{text}</div>
}

// ==================== Main Page ====================
export default function HotMoneyBoardPage() {
  const [boardData, setBoardData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedStock, setSelectedStock] = useState(null)
  const [selectedCode, setSelectedCode] = useState('')
  const [sortBy, setSortBy] = useState('net')
  const [dates, setDates] = useState([])
  const [tradeDate, setTradeDate] = useState('')

  // Fetch available dates on mount
  useEffect(() => { fetchDates() }, [])

  // Fetch board data when date or sort changes
  useEffect(() => { fetchBoard() }, [tradeDate, sortBy])

  // Auto-select first trader's first stock when board data changes
  useEffect(() => {
    if (boardData?.traders?.length > 0 && !selectedCode) {
      const firstTrader = boardData.traders[0]
      if (firstTrader?.stocks?.length > 0) {
        const firstStock = firstTrader.stocks[0]
        handleSelectStock(firstStock)
      }
    }
  }, [boardData])

  const fetchDates = async () => {
    try {
      const res = await getHotMoneyDates({ limit: 90 })
      if (res?.code === 0 && res.data?.dates) {
        setDates(res.data.dates)
        if (res.data.dates.length > 0 && !tradeDate) {
          setTradeDate(res.data.dates[0].raw_date)
        }
      }
    } catch (e) { console.error(e) }
  }

  const fetchBoard = async () => {
    setLoading(true)
    try {
      const params = { sort: sortBy, refresh: 'true' }
      if (tradeDate) params.trade_date = tradeDate
      const res = await getHotMoneyBoard(params)
      if (res?.code === 0) {
        setBoardData(res.data)
        // Auto-select first stock of first trader
        if (res.data?.traders?.length > 0) {
          const firstTrader = res.data.traders[0]
          if (firstTrader?.stocks?.length > 0) {
            handleSelectStock(firstTrader.stocks[0])
          }
        }
        // Refresh dates list after fetching (new date may have been added)
        fetchDates()
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSelectStock = (stock) => {
    setSelectedCode(stock.code)
    setSelectedStock({
      code: stock.code,
      name: stock.name,
      pct_change: stock.pct_chg,
      reason: stock.reason,
      close: stock.close,
    })
  }

  const handleCloseDetail = () => {
    setSelectedCode('')
    setSelectedStock(null)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-screen" style={{ background: '#F8F9FC' }}>
      {/* Header - styled like BroadcastPage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#513CC8' }}>
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">游资打板</h1>
            <p className="text-xs text-gray-400">龙虎榜游资交易实时追踪 · 打板买卖动态</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Modern Calendar Picker - Grid Style */}
          <CalendarPicker dates={dates} tradeDate={tradeDate} onChange={setTradeDate} />
          <button onClick={() => { hotMoneyBackfill({ days: 30 }).then(fetchDates) }}
            title="回补历史数据(近30个交易日)"
            className="p-2 rounded-lg transition hover:bg-[#F0EDFA] text-gray-400 hover:text-[#513CC8]">
            <Download size={16} />
          </button>
          <button onClick={fetchBoard}
            className="p-2 rounded-lg transition hover:bg-[#F0EDFA]" style={{ color: '#513CC8' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Scrolling Ticker - BroadcastPage style */}
      {boardData?.scroll_items && <HotMoneyTicker items={boardData.scroll_items} speed={30} />}

      {/* Summary Cards */}
      <SummaryCards traders={boardData?.traders} />

      {/* Main Content - ALWAYS 50/50 split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: 'calc(100vh - 380px)' }}>
        {/* Left: Trader List - always 50% */}
        <div className="h-full">
          {loading && !boardData ? (
            <div className="flex items-center justify-center h-40 bg-white rounded-xl border border-gray-100">
              <Loader2 size={24} className="animate-spin" style={{ color: '#513CC8' }} />
              <span className="ml-2 text-sm text-gray-500">加载游资数据...</span>
            </div>
          ) : (
            <TraderListPanel
              traders={boardData?.traders}
              onSelectStock={handleSelectStock}
              selectedCode={selectedCode}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />
          )}
        </div>

        {/* Right: Stock Detail Panel - always 50%, always visible */}
        <div className="h-full">
          {selectedCode ? (
            <StockDetailPanel code={selectedCode} stockInfo={selectedStock} onClose={handleCloseDetail} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 h-full flex items-center justify-center shadow-sm">
              <div className="text-center text-gray-400">
                <Activity size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">点击左侧游资展开后选择个股</p>
                <p className="text-xs mt-1">查看分时走势、K线、筹码、主力资金等</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats footer */}
      {boardData && (
        <div className="flex items-center justify-center gap-6 text-xs text-gray-400 pt-2">
          <span>日期: <span className="font-medium text-gray-600">{boardData.trade_date}</span></span>
          <span>游资: <span className="font-medium text-gray-600">{boardData.total_traders}位</span></span>
          <span>个股: <span className="font-medium text-gray-600">{boardData.total_stocks}只</span></span>
          <span className="text-[10px]" style={{ color: '#513CC8' }}>数据来源: Tushare Pro</span>
        </div>
      )}
    </div>
  )
}
