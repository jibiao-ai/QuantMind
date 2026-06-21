import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { 
  Search, RefreshCw, Filter, ChevronLeft, ChevronRight, X, TrendingUp, 
  BarChart3, Activity, Clock, Target, Zap, ArrowUpRight, ArrowDownRight,
  Info, MessageSquare, Calendar, Layers, Play, Award, Shield, AlertTriangle,
  ChevronDown, ChevronUp, Check
} from 'lucide-react'
import { 
  getAIStockPicks, runAIStockPick, getAIStockPickStats, getAIStockPickBatches,
  getTrendChart, getTrendChart5Day, getKLineRealtime, getGubaDiscussion, getChipDistribution
} from '../services/api'
import toast from 'react-hot-toast'

// ==================== Main Page ====================

export default function AIStockPickPage() {
  const [picks, setPicks] = useState([])
  const [batches, setBatches] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [selectedStock, setSelectedStock] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const pageSize = 5

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: pageSize }
      if (selectedBatchId) params.batch_id = selectedBatchId
      const res = await getAIStockPicks(params)
      if (res.code === 0) {
        setPicks(res.data.items || [])
        setTotalPages(res.data.total_pages || 1)
        setTotal(res.data.total || 0)
        if (res.data.batches) setBatches(res.data.batches)
      }
    } catch (e) {
      console.error('Failed to fetch picks', e)
    }
    setLoading(false)
  }, [page, selectedBatchId])

  const fetchStats = async () => {
    try {
      const res = await getAIStockPickStats()
      if (res.code === 0) setStats(res.data)
    } catch(e) {}
  }

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchStats() }, [])

  const handleRun = async () => {
    setRunning(true)
    try {
      const res = await runAIStockPick()
      if (res.code === 0) {
        toast.success('隔夜套利筛选已提交，正在获取实时行情...')
        setTimeout(() => { fetchData(); fetchStats() }, 15000)
      } else {
        toast.error('任务提交失败')
      }
    } catch(e) {
      toast.error('任务提交失败')
    }
    setRunning(false)
  }

  const handleSelectStock = (stock) => {
    setSelectedStock(stock)
    setShowDetail(true)
  }

  return (
    <div className="p-4 md:p-6 space-y-4" style={{ background: '#F8F9FB', minHeight: '100vh' }}>
      {/* ==================== Header ==================== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="text-[#513CC8]" size={22} />
            隔夜套利
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            尾盘选股八步筛选 | 交易日 13:30 / 14:30 / 15:30 自动运行 | 数据来源: AkShare + 东方财富
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRun} disabled={running}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all shadow-sm"
            style={{ background: running ? '#9CA3AF' : '#513CC8' }}>
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? '筛选中...' : '立即筛选'}
          </button>
          <button onClick={() => { fetchData(); fetchStats() }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw size={14} /> 刷新
          </button>
        </div>
      </div>

      {/* ==================== 生死铁律 (Absolute Rules) ==================== */}
      <IronRules />

      {/* ==================== 八步筛选条件 ==================== */}
      <EightStepConditions />

      {/* ==================== 筛选过程展示 (Screening Process) ==================== */}
      <ScreeningProcess batches={batches} stats={stats} />

      {/* ==================== Stats Cards ==================== */}
      <StatsCards stats={stats} batches={batches} />

      {/* ==================== Batch Selector ==================== */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Layers size={14} />
          <span>筛选批次:</span>
        </div>
        <select value={selectedBatchId} onChange={(e) => { setSelectedBatchId(e.target.value); setPage(1) }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-200 outline-none">
          <option value="">最新批次</option>
          {batches.map(b => (
            <option key={b.batch_id} value={b.batch_id}>
              {b.trade_date} {b.screen_time} ({b.result_count}只)
            </option>
          ))}
        </select>
        <div className="ml-auto text-sm text-gray-500">
          共 <span className="font-bold text-[#513CC8]">{total}</span> 只筛选结果
        </div>
      </div>

      {/* ==================== Stock Table ==================== */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100" style={{ background: '#F0EDFA' }}>
                <th className="text-left py-3 px-3 font-medium text-gray-500 text-xs">#</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500 text-xs">代码</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500 text-xs">名称</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500 text-xs">现价</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500 text-xs">涨幅</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500 text-xs">换手率</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500 text-xs">量比</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500 text-xs">市值(亿)</th>
                <th className="text-right py-3 px-3 font-medium text-gray-500 text-xs">评分</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500 text-xs min-w-[200px]">推荐理由</th>
                <th className="text-center py-3 px-3 font-medium text-gray-500 text-xs">条件</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-20 text-gray-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />加载中...
                </td></tr>
              ) : picks.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-20 text-gray-400">
                  <Target size={24} className="mx-auto mb-2 opacity-40" />
                  <p>暂无筛选结果</p>
                  <p className="text-xs mt-1">点击"立即筛选"获取实时行情数据筛选</p>
                </td></tr>
              ) : picks.map((pick, idx) => (
                <StockRow key={pick.id || idx} pick={pick} index={(page - 1) * pageSize + idx + 1} 
                  onSelect={() => handleSelectStock(pick)} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              第 {page} / {totalPages} 页，共 {total} 条
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum
                if (totalPages <= 7) pageNum = i + 1
                else if (page <= 4) pageNum = i + 1
                else if (page >= totalPages - 3) pageNum = totalPages - 6 + i
                else pageNum = page - 3 + i
                return (
                  <button key={pageNum} onClick={() => setPage(pageNum)}
                    className={`min-w-[32px] h-8 rounded text-xs transition ${
                      page === pageNum ? 'text-white font-medium' : 'text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
                    style={page === pageNum ? { background: '#513CC8' } : {}}>
                    {pageNum}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stock Detail Modal */}
      {showDetail && selectedStock && (
        <StockDetailModal stock={selectedStock} onClose={() => setShowDetail(false)} />
      )}
    </div>
  )
}

// ==================== 生死铁律 (Iron Rules) ====================

function IronRules() {
  return (
    <div className="rounded-xl overflow-hidden border-2 border-red-200 shadow-sm"
      style={{ background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF7ED 100%)' }}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)' }}>
            <Shield size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-red-800 flex items-center gap-2">
              生死铁律
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                刻进骨子里
              </span>
            </h3>
            <div className="mt-2 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700 font-bold">
                  次日早盘必须清仓！无论盈亏！
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                <div className="p-2.5 rounded-lg bg-white/70 border border-red-100">
                  <p className="text-[11px] font-bold text-red-700 mb-1">唯一例外</p>
                  <p className="text-[10px] text-red-600 leading-relaxed">缩量涨停 或 一字涨停可继续持有</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/70 border border-red-100">
                  <p className="text-[11px] font-bold text-red-700 mb-1">其余情况</p>
                  <p className="text-[10px] text-red-600 leading-relaxed">哪怕赚七八个点、盈亏平衡、亏手续费，一律离场</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/70 border border-purple-100">
                  <p className="text-[11px] font-bold text-[#3D2E9E] mb-1">战法精髓</p>
                  <p className="text-[10px] text-[#513CC8] leading-relaxed">把A股T+1做成T+0，只赚确定的惯性溢价，不赌未知行情</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== 八步筛选条件 (Eight-Step Conditions) ====================

function EightStepConditions() {
  const [expanded, setExpanded] = useState(false)

  const steps = [
    { num: 1, title: '主板股票', desc: '仅选上海(60xxxx)和深圳(00xxxx)主板，排除ST', color: '#2563EB' },
    { num: 2, title: '涨幅3%-5%', desc: '不追涨停、不选弱势，最佳上升动能区间', color: '#16A34A' },
    { num: 3, title: '近期涨停', desc: '近20交易日有涨停，说明有资金关注', color: '#DC2626' },
    { num: 4, title: '量比>1', desc: '当日成交活跃度高于近期平均水平', color: '#9333EA' },
    { num: 5, title: '换手率5%-10%', desc: '适度换手，筹码充分交换不过度投机', color: '#0891B2' },
    { num: 6, title: '市值50-200亿', desc: '中盘股，流动性好弹性足够', color: '#CA8A04' },
    { num: 7, title: '分时走势确认', desc: '全天运行在分时均价线之上，走势最强', color: '#E11D48' },
    { num: 8, title: '尾盘进场', desc: '创当天新高回踩分时均线不破时进场', color: '#7C3AED' },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} 
        className="w-full flex items-center justify-between p-3 hover:bg-purple-50/50 transition">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-[#513CC8]" />
          <span className="text-sm font-medium text-gray-900">八步筛选条件</span>
          <div className="flex gap-1 ml-2">
            {steps.map(s => (
              <span key={s.num} className="w-5 h-5 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
                style={{ background: s.color }}>
                {s.num}
              </span>
            ))}
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {steps.map(step => (
              <div key={step.num} className="p-3 rounded-lg border border-gray-100 hover:shadow-sm transition"
                style={{ borderLeftColor: step.color, borderLeftWidth: '3px' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
                    style={{ background: step.color }}>{step.num}</span>
                  <span className="text-xs font-bold text-gray-900">{step.title}</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== 筛选过程展示 (Screening Process Visualization) ====================

function ScreeningProcess({ batches, stats }) {
  const latestBatch = batches?.[0]
  
  if (!latestBatch) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-[#513CC8]" />
          <span className="text-sm font-medium text-gray-900">筛选过程跟踪</span>
        </div>
        <div className="text-center py-6">
          <AlertTriangle size={24} className="mx-auto mb-2 text-amber-400" />
          <p className="text-sm text-gray-500">暂无筛选记录</p>
          <p className="text-xs text-gray-400 mt-1">点击"立即筛选"启动八步筛选流程，每步结果将实时展示</p>
        </div>
      </div>
    )
  }

  const steps = [
    { num: 0, title: '获取数据', desc: '全市场A股实时行情', count: latestBatch.total_stocks, color: '#6B7280' },
    { num: 1, title: '主板非ST', desc: '仅上海/深圳主板', count: latestBatch.main_board, color: '#2563EB' },
    { num: 2, title: '涨幅3%-5%', desc: '最佳上升动能区间', count: latestBatch.pct_filter, color: '#16A34A' },
    { num: 3, title: '近期涨停', desc: '近20日有涨停记录', count: latestBatch.limit_filter, color: '#DC2626' },
    { num: 4, title: '量比>1', desc: '成交活跃度高', count: latestBatch.volume_filter, color: '#9333EA' },
    { num: 5, title: '换手5%-10%', desc: '筹码充分交换', count: latestBatch.turnover_filter, color: '#0891B2' },
    { num: 6, title: '市值50-200亿', desc: '中盘股弹性足', count: latestBatch.market_cap_filter, color: '#CA8A04' },
    { num: 7, title: '分时+尾盘', desc: '走势确认+尾盘信号', count: latestBatch.result_count, color: '#7C3AED' },
  ]

  const isFailed = latestBatch.status === 'failed'
  const isRunning = latestBatch.status === 'running'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-[#513CC8]" />
            <span className="text-sm font-medium text-gray-900">筛选过程跟踪</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              isFailed ? 'bg-red-100 text-red-600' : isRunning ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
            }`}>
              {isFailed ? '失败' : isRunning ? '运行中' : '完成'}
            </span>
          </div>
          <span className="text-[10px] text-gray-400">
            {latestBatch.trade_date} {latestBatch.screen_time}
          </span>
        </div>

        {isFailed && latestBatch.error_msg && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-red-700 flex items-center gap-1.5">
              <AlertTriangle size={12} />
              <span className="font-medium">筛选失败：</span>
              {latestBatch.error_msg}
            </p>
          </div>
        )}

        {/* Step-by-step funnel visualization */}
        <div className="relative">
          {/* Connection line */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-100 z-0" style={{ marginLeft: '3.5%', marginRight: '3.5%' }}></div>
          
          <div className="grid grid-cols-8 gap-1 relative z-10">
            {steps.map((step, i) => {
              const hasData = step.count > 0
              const prevCount = i > 0 ? steps[i - 1].count : step.count
              const filterRate = prevCount > 0 ? ((step.count / prevCount) * 100).toFixed(0) : '0'
              
              return (
                <div key={step.num} className="flex flex-col items-center">
                  {/* Circle indicator */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 mb-1 transition-all ${
                    hasData 
                      ? 'text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`} style={hasData ? { background: step.color, borderColor: step.color } : {}}>
                    {step.num === 0 ? '⓪' : step.num}
                  </div>
                  
                  {/* Count */}
                  <span className={`text-xs font-bold ${hasData ? 'text-gray-900' : 'text-gray-300'}`}>
                    {step.count || 0}
                  </span>
                  
                  {/* Title */}
                  <span className="text-[9px] text-gray-500 text-center leading-tight mt-0.5">
                    {step.title}
                  </span>
                  
                  {/* Filter rate (except first step) */}
                  {i > 0 && (
                    <span className={`text-[8px] mt-0.5 ${
                      hasData ? (parseInt(filterRate) > 50 ? 'text-green-500' : parseInt(filterRate) > 10 ? 'text-amber-500' : 'text-red-500') : 'text-gray-300'
                    }`}>
                      {hasData ? `${filterRate}%` : '—'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] text-gray-500">
            <span>全市场 <b className="text-gray-700">{latestBatch.total_stocks || 0}</b> 只</span>
            <span>→ 最终通过 <b className="text-[#513CC8]">{latestBatch.result_count || 0}</b> 只</span>
            <span>通过率 <b className="text-[#513CC8]">
              {latestBatch.total_stocks > 0 ? ((latestBatch.result_count / latestBatch.total_stocks) * 100).toFixed(2) : '0'}%
            </b></span>
          </div>
          {latestBatch.total_stocks === 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
              ⚠ 未获取到行情数据
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== Stats Cards ====================

function StatsCards({ stats, batches }) {
  const latestBatch = batches?.[0]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EDE9FE' }}>
            <Target size={16} className="text-[#513CC8]" />
          </div>
          <span className="text-xs text-gray-500">本次入选</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{latestBatch?.result_count || 0}</div>
        <p className="text-[10px] text-gray-400 mt-1">
          {latestBatch ? `${latestBatch.screen_time} 筛选` : '暂无数据'}
        </p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#DBEAFE' }}>
            <Clock size={16} className="text-blue-600" />
          </div>
          <span className="text-xs text-gray-500">累计批次</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats?.total_batches || 0}</div>
        <p className="text-[10px] text-gray-400 mt-1">13:30/14:30/15:30</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#D1FAE5' }}>
            <Award size={16} className="text-emerald-600" />
          </div>
          <span className="text-xs text-gray-500">累计选股</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats?.total_stocks || 0}</div>
        <p className="text-[10px] text-gray-400 mt-1">不重复股票数</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F3E8FF' }}>
            <Zap size={16} className="text-purple-600" />
          </div>
          <span className="text-xs text-gray-500">平均入选</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats?.avg_result || 0}</div>
        <p className="text-[10px] text-gray-400 mt-1">每次筛选平均</p>
      </div>
    </div>
  )
}

// ==================== Stock Row ====================

function StockRow({ pick, index, onSelect }) {
  const isUp = pick.change_pct >= 0
  const pctColor = isUp ? '#EF4444' : '#22C55E'

  const getScoreColor = (score) => {
    if (score >= 80) return '#EF4444'
    if (score >= 65) return '#513CC8'
    if (score >= 50) return '#2563EB'
    return '#6B7280'
  }

  const pureCode = pick.code?.split('.')?.[0] || pick.code
  const passedSteps = (pick.passed_steps || '').split(',').filter(Boolean)
  const reason = pick.note || ''

  return (
    <tr className="border-b border-gray-50 hover:bg-purple-50/30 transition cursor-pointer" onClick={onSelect}>
      <td className="py-2.5 px-3 text-gray-400 text-xs">{index}</td>
      <td className="py-2.5 px-3">
        <span className="font-mono text-xs text-gray-600">{pureCode}</span>
      </td>
      <td className="py-2.5 px-3">
        <span className="font-medium text-gray-900 text-sm">{pick.name}</span>
        {pick.industry && <span className="ml-1.5 text-[10px] text-gray-400">{pick.industry}</span>}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-sm" style={{ color: pctColor }}>
        {pick.close_price?.toFixed(2)}
      </td>
      <td className="py-2.5 px-3 text-right">
        <span className="flex items-center justify-end gap-0.5 font-medium text-sm" style={{ color: pctColor }}>
          {isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {isUp ? '+' : ''}{pick.change_pct?.toFixed(2)}%
        </span>
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-600">
        {pick.turnover_rate?.toFixed(2)}%
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-600">
        {pick.volume_ratio?.toFixed(2)}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-600">
        {pick.total_mv?.toFixed(0)}
      </td>
      <td className="py-2.5 px-3 text-right">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-white"
          style={{ background: getScoreColor(pick.score) }}>
          {pick.score?.toFixed(0)}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <p className="text-[10px] text-gray-500 line-clamp-2 max-w-[250px]" title={reason}>
          {reason || '-'}
        </p>
      </td>
      <td className="py-2.5 px-3 text-center">
        <div className="flex gap-0.5 justify-center flex-wrap">
          {passedSteps.slice(0, 8).map(s => (
            <span key={s} className="w-4 h-4 rounded-full bg-green-100 text-green-700 text-[8px] flex items-center justify-center font-bold">
              {s}
            </span>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ==================== Stock Detail Modal ====================

function StockDetailModal({ stock, onClose }) {
  const [activeTab, setActiveTab] = useState('info')
  const [trendData, setTrendData] = useState(null)
  const [klineData, setKlineData] = useState(null)
  const [weeklyKlineData, setWeeklyKlineData] = useState(null)
  const [monthlyKlineData, setMonthlyKlineData] = useState(null)
  const [chipData, setChipData] = useState(null)
  const [gubaData, setGubaData] = useState(null)
  const [gubaPage, setGubaPage] = useState(1)
  const [loadingChart, setLoadingChart] = useState(false)
  const canvasRef = useRef(null)

  const pureCode = stock.code?.split('.')?.[0] || stock.code

  const tabs = [
    { key: 'info', label: '筛选信息', icon: Info },
    { key: 'daily', label: '日K线', icon: BarChart3 },
    { key: 'weekly', label: '周K线', icon: TrendingUp },
    { key: 'monthly', label: '月K线', icon: Calendar },
    { key: 'chip', label: '筹码分布', icon: Layers },
    { key: 'guba', label: '股吧信息', icon: MessageSquare },
  ]

  useEffect(() => {
    const fetchTabData = async () => {
      setLoadingChart(true)
      try {
        switch(activeTab) {
          case 'daily': {
            const res = await getKLineRealtime({ code: pureCode, period: 'day', limit: 120 })
            if (res.code === 0) setKlineData(res.data)
            break
          }
          case 'weekly': {
            const res = await getKLineRealtime({ code: pureCode, period: 'week', limit: 60 })
            if (res.code === 0) setWeeklyKlineData(res.data)
            break
          }
          case 'monthly': {
            const res = await getKLineRealtime({ code: pureCode, period: 'month', limit: 36 })
            if (res.code === 0) setMonthlyKlineData(res.data)
            break
          }
          case 'chip': {
            const res = await getChipDistribution({ code: pureCode })
            if (res.code === 0) setChipData(res.data)
            break
          }
          case 'guba': {
            const res = await getGubaDiscussion({ code: pureCode, page: gubaPage })
            if (res.code === 0) setGubaData(res.data)
            break
          }
        }
      } catch(e) { console.error('Fetch failed', e) }
      setLoadingChart(false)
    }
    if (activeTab !== 'info') fetchTabData()
  }, [activeTab, pureCode, gubaPage])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[960px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100" style={{ background: '#F0EDFA' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#513CC8' }}>
              <Target size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{stock.name}</h2>
                <span className="font-mono text-xs text-gray-500">{pureCode}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-[#513CC8] font-medium">
                  评分 {stock.score?.toFixed(0)}
                </span>
              </div>
              <p className="text-xs text-gray-500">{stock.industry || '-'} | {stock.trade_date} {stock.screen_time} 筛选</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs whitespace-nowrap transition ${
                  active ? 'text-[#513CC8] font-medium border-b-2' : 'text-gray-500 hover:text-gray-900'}`}
                style={active ? { borderColor: '#513CC8' } : {}}>
                <Icon size={13} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: '420px' }}>
          {activeTab === 'info' && <StockInfoTab stock={stock} />}
          {activeTab === 'daily' && <KLineTab loading={loadingChart} data={klineData} period="日K" code={pureCode} />}
          {activeTab === 'weekly' && <KLineTab loading={loadingChart} data={weeklyKlineData} period="周K" code={pureCode} />}
          {activeTab === 'monthly' && <KLineTab loading={loadingChart} data={monthlyKlineData} period="月K" code={pureCode} />}
          {activeTab === 'chip' && <ChipTab loading={loadingChart} data={chipData} />}
          {activeTab === 'guba' && <GubaTab loading={loadingChart} data={gubaData} page={gubaPage} setPage={setGubaPage} />}
        </div>
      </div>
    </div>
  )
}

// ==================== Stock Info Tab ====================

function StockInfoTab({ stock }) {
  const isUp = stock.change_pct >= 0
  const pctColor = isUp ? '#EF4444' : '#22C55E'
  const passedSteps = (stock.passed_steps || '').split(',').filter(Boolean)
  const reason = stock.note || ''

  const allSteps = [
    { num: '1', title: '主板非ST' },
    { num: '2', title: '涨幅3%-5%' },
    { num: '3', title: '近期涨停' },
    { num: '4', title: '量比>1' },
    { num: '5', title: '换手5%-10%' },
    { num: '6', title: '市值50-200亿' },
    { num: '7', title: '分时走势强' },
    { num: '8', title: '尾盘信号' },
  ]

  return (
    <div className="space-y-4">
      {/* Price Banner */}
      <div className="rounded-xl p-5" style={{ background: 'linear-gradient(135deg, #F0EDFA 0%, #E8E3F8 100%)' }}>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">当前价格</p>
            <div className="text-3xl font-bold" style={{ color: pctColor }}>
              ¥{stock.close_price?.toFixed(2)}
            </div>
          </div>
          <div className="flex items-center gap-1 pb-1">
            {isUp ? <ArrowUpRight size={18} style={{ color: pctColor }} /> : <ArrowDownRight size={18} style={{ color: pctColor }} />}
            <span className="text-lg font-bold" style={{ color: pctColor }}>
              {isUp ? '+' : ''}{stock.change_pct?.toFixed(2)}%
            </span>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold text-white"
              style={{ background: '#513CC8' }}>
              <Award size={14} /> 评分 {stock.score?.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {[
          { label: '开盘', value: `¥${stock.open?.toFixed(2) || '-'}` },
          { label: '最高', value: `¥${stock.high?.toFixed(2) || '-'}`, color: '#EF4444' },
          { label: '最低', value: `¥${stock.low?.toFixed(2) || '-'}`, color: '#22C55E' },
          { label: '昨收', value: `¥${stock.pre_close?.toFixed(2) || '-'}` },
          { label: '换手率', value: `${stock.turnover_rate?.toFixed(2)}%` },
          { label: '量比', value: stock.volume_ratio?.toFixed(2) },
          { label: '市值', value: `${stock.total_mv?.toFixed(0)}亿` },
          { label: '成交额', value: `${stock.amount?.toFixed(2) || '-'}亿` },
        ].map(f => (
          <div key={f.label} className="p-2 rounded-lg bg-gray-50 text-center">
            <p className="text-[9px] text-gray-400">{f.label}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: f.color || '#1F2937' }}>{f.value}</p>
          </div>
        ))}
      </div>

      {/* Passed Steps */}
      <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
        <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
          <Check size={13} className="text-green-600" /> 满足条件
        </p>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
          {allSteps.map(step => {
            const passed = passedSteps.includes(step.num)
            return (
              <div key={step.num} className={`p-2 rounded-lg text-center border ${
                passed ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-200 opacity-50'}`}>
                <div className={`w-5 h-5 rounded-full mx-auto mb-1 flex items-center justify-center text-[9px] font-bold ${
                  passed ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'}`}>
                  {passed ? <Check size={10} /> : step.num}
                </div>
                <p className={`text-[9px] ${passed ? 'text-green-700 font-medium' : 'text-gray-400'}`}>{step.title}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recommendation Reason */}
      {reason && (
        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50">
          <p className="text-xs font-bold text-[#3D2E9E] mb-2 flex items-center gap-1.5">
            <Zap size={13} className="text-[#513CC8]" /> 推荐理由
          </p>
          <div className="space-y-1.5">
            {reason.split('; ').map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#513CC8] mt-1.5 flex-shrink-0"></span>
                <p className="text-xs text-gray-700">{r}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trading Suggestion */}
      <div className="p-4 rounded-xl border border-red-200 bg-red-50">
        <p className="text-xs font-bold text-red-800 mb-2 flex items-center gap-1.5">
          <AlertTriangle size={13} className="text-red-600" /> 操作提醒
        </p>
        <ol className="text-xs text-red-700 space-y-1 list-decimal ml-4">
          <li>14:30后观察分时走势，确认运行在均价线之上</li>
          <li>等待创当天新高后回踩分时均线不破时进场</li>
          <li>尾盘果断进场，控制仓位</li>
          <li className="font-bold">次日早盘必须清仓！除非缩量涨停或一字涨停</li>
        </ol>
      </div>
    </div>
  )
}

// ==================== K-Line Tab (Daily/Weekly/Monthly) ====================

function KLineTab({ loading, data, period, code }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!data || !canvasRef.current) return
    const container = containerRef.current
    if (!container) return

    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth || 800
    const h = 400

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    drawKlineChart(ctx, w, h, data)
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[420px] text-gray-400">
        <RefreshCw size={20} className="animate-spin mr-2" />加载{period}数据...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[420px] text-gray-400">
        <BarChart3 size={24} className="mr-2 opacity-40" />暂无{period}数据
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="w-full rounded-lg" />
    </div>
  )
}

// ==================== Chip Distribution Tab ====================

function ChipTab({ loading, data }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!data || !canvasRef.current) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!container) return

    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth || 800
    const h = 380

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    drawChipChart(ctx, w, h, data)
  }, [data])

  if (loading) {
    return <div className="flex items-center justify-center h-[400px] text-gray-400"><RefreshCw size={20} className="animate-spin mr-2" />加载筹码数据...</div>
  }
  if (!data) {
    return <div className="flex items-center justify-center h-[400px] text-gray-400"><Layers size={24} className="mr-2 opacity-40" />暂无筹码分布数据</div>
  }

  const summary = data.summary || {}

  return (
    <div className="space-y-3">
      {summary.avg_cost > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
          <div className="text-center">
            <p className="text-[9px] text-gray-400">获利比例</p>
            <p className="text-xs font-bold text-red-600">{summary.profit_ratio?.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-400">平均成本</p>
            <p className="text-xs font-bold text-[#513CC8]">{summary.avg_cost?.toFixed(2)}</p>
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
      <div ref={containerRef} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '380px' }} />
      </div>
    </div>
  )
}

// ==================== Guba (Stock Forum) Tab with Pagination ====================

function GubaTab({ loading, data, page, setPage }) {
  if (loading) {
    return <div className="flex items-center justify-center h-[400px] text-gray-400"><RefreshCw size={20} className="animate-spin mr-2" />加载股吧信息...</div>
  }

  const posts = data?.posts || data?.items || []
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
        <MessageSquare size={28} className="mb-2 opacity-40" />
        <span>暂无股吧讨论数据</span>
      </div>
    )
  }

  const totalPosts = data?.total || posts.length
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">股吧讨论 ({totalPosts} 条)</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
              className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
              <ChevronLeft size={12} />
            </button>
            <span className="text-xs text-gray-500 px-2">{page}/{totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
              className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
      <div className="space-y-2 max-h-[380px] overflow-y-auto">
        {posts.map((post, i) => (
          <div key={i} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 font-medium truncate">{post.title || post.content || '无标题'}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                  <span>{post.author || '匿名'}</span>
                  <span>{post.time || post.created_at || ''}</span>
                  {post.read_count && <span>阅读 {post.read_count}</span>}
                  {post.comment_count && <span>评论 {post.comment_count}</span>}
                </div>
              </div>
              {post.sentiment && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                  post.sentiment === 'positive' ? 'bg-red-100 text-red-600' :
                  post.sentiment === 'negative' ? 'bg-green-100 text-green-600' :
                  'bg-gray-100 text-gray-500'}`}>
                  {post.sentiment === 'positive' ? '看多' : post.sentiment === 'negative' ? '看空' : '中性'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== Draw K-Line Chart ====================

function drawKlineChart(ctx, w, h, data) {
  const klines = data?.klines || data?.items || []
  if (klines.length === 0) return

  const pad = { top: 30, right: 20, bottom: 40, left: 65 }
  const volH = 60
  const chartH = h - pad.top - pad.bottom - volH - 10
  const chartW = w - pad.left - pad.right

  const parsed = klines.map(k => {
    if (typeof k === 'string') {
      const p = k.split(',')
      return { date: p[0], open: +p[1], close: +p[2], high: +p[3], low: +p[4], vol: +p[5] }
    }
    return { 
      date: k.date || k.trade_date, 
      open: k.open, close: k.close, high: k.high, low: k.low, 
      vol: k.volume || k.vol || 0 
    }
  }).filter(k => k.close > 0)

  if (parsed.length === 0) return

  const allPrices = parsed.flatMap(k => [k.high, k.low])
  let minP = Math.min(...allPrices)
  let maxP = Math.max(...allPrices)
  const pPad = (maxP - minP) * 0.05 || 1
  minP -= pPad; maxP += pPad
  const maxVol = Math.max(...parsed.map(k => k.vol)) || 1

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, w, h)

  // Grid
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke()
  }

  // Candlesticks
  const candleW = Math.max(2, (chartW / parsed.length) * 0.7)
  const gap = chartW / parsed.length

  parsed.forEach((k, i) => {
    const x = pad.left + i * gap + gap / 2
    const isUp = k.close >= k.open
    const color = isUp ? '#EF4444' : '#22C55E'

    const yHigh = pad.top + (1 - (k.high - minP) / (maxP - minP)) * chartH
    const yLow = pad.top + (1 - (k.low - minP) / (maxP - minP)) * chartH
    ctx.strokeStyle = color; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, yHigh); ctx.lineTo(x, yLow); ctx.stroke()

    const yOpen = pad.top + (1 - (k.open - minP) / (maxP - minP)) * chartH
    const yClose = pad.top + (1 - (k.close - minP) / (maxP - minP)) * chartH
    const bodyTop = Math.min(yOpen, yClose)
    const bodyH = Math.max(1, Math.abs(yOpen - yClose))

    ctx.fillStyle = color
    if (isUp) { ctx.strokeStyle = color; ctx.strokeRect(x - candleW/2, bodyTop, candleW, bodyH) }
    else { ctx.fillRect(x - candleW/2, bodyTop, candleW, bodyH) }

    // Volume
    const volTop = h - pad.bottom - (k.vol / maxVol) * volH
    ctx.fillStyle = isUp ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'
    ctx.fillRect(x - candleW/2, volTop, candleW, h - pad.bottom - volTop)
  })

  // MA lines
  const drawMA = (period, color) => {
    if (parsed.length < period) return
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1
    for (let i = period - 1; i < parsed.length; i++) {
      let sum = 0
      for (let j = 0; j < period; j++) sum += parsed[i-j].close
      const avg = sum / period
      const x = pad.left + i * gap + gap / 2
      const y = pad.top + (1 - (avg - minP) / (maxP - minP)) * chartH
      if (i === period - 1) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  drawMA(5, '#F59E0B'); drawMA(10, '#3B82F6'); drawMA(20, '#A855F7')

  // Y-axis
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.font = '10px monospace'; ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    const price = maxP - ((maxP - minP) / 4) * i
    ctx.fillText(price.toFixed(2), pad.left - 6, pad.top + (chartH / 4) * i + 3)
  }

  // X-axis
  ctx.textAlign = 'center'
  const xStep = Math.max(1, Math.floor(parsed.length / 6))
  for (let i = 0; i < parsed.length; i += xStep) {
    const x = pad.left + i * gap + gap / 2
    const date = parsed[i].date || ''
    ctx.fillText(date.substring(5, 10), x, h - pad.bottom + 15)
  }

  // Legend
  ctx.font = '10px sans-serif'; ctx.textAlign = 'left'
  ctx.fillStyle = '#F59E0B'; ctx.fillRect(pad.left, 8, 12, 3); ctx.fillText('MA5', pad.left + 16, 13)
  ctx.fillStyle = '#3B82F6'; ctx.fillRect(pad.left + 50, 8, 12, 3); ctx.fillText('MA10', pad.left + 66, 13)
  ctx.fillStyle = '#A855F7'; ctx.fillRect(pad.left + 110, 8, 12, 3); ctx.fillText('MA20', pad.left + 126, 13)
}

// ==================== Draw Chip Distribution Chart ====================

function drawChipChart(ctx, w, h, data) {
  const klines = data?.klines || []
  const chips = data?.chips || []
  const summary = data?.summary || {}

  if (klines.length === 0 && chips.length === 0) return

  const pad = { top: 25, right: 5, bottom: 25, left: 55 }
  const klineW = Math.floor(w * 0.7)
  const chipW = w - klineW
  const chartH = h - pad.top - pad.bottom

  // Calculate price range from klines
  const displayKlines = klines.slice(-60)
  let minP = Infinity, maxP = -Infinity
  displayKlines.forEach(k => { if (k.low < minP) minP = k.low; if (k.high > maxP) maxP = k.high })
  if (minP === Infinity) { minP = 0; maxP = 100 }
  const pPad = (maxP - minP) * 0.05
  minP -= pPad; maxP += pPad

  const priceToY = (price) => pad.top + ((maxP - price) / (maxP - minP)) * chartH

  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h)

  // Grid
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 0.5
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + (chartH / 5) * i
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(klineW - 5, y); ctx.stroke()
  }

  // K-lines
  if (displayKlines.length > 0) {
    const barW = Math.max(2, Math.floor((klineW - pad.left - 10) / displayKlines.length) - 1)
    const barGap = ((klineW - pad.left - 10) - barW * displayKlines.length) / (displayKlines.length + 1)

    displayKlines.forEach((k, i) => {
      const x = pad.left + barGap + (barW + barGap) * i
      const isUp = k.close >= k.open
      const color = isUp ? '#ef4444' : '#22c55e'
      const cx = x + barW / 2

      ctx.strokeStyle = color; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx, priceToY(k.high)); ctx.lineTo(cx, priceToY(k.low)); ctx.stroke()

      const bodyTop = priceToY(Math.max(k.open, k.close))
      const bodyBot = priceToY(Math.min(k.open, k.close))
      ctx.fillStyle = color
      ctx.fillRect(x, bodyTop, barW, Math.max(1, bodyBot - bodyTop))
    })
  }

  // Y-axis
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.font = '9px monospace'; ctx.textAlign = 'right'
  for (let i = 0; i <= 5; i++) {
    const price = maxP - ((maxP - minP) / 5) * i
    ctx.fillText(price.toFixed(2), pad.left - 4, pad.top + (chartH / 5) * i + 3)
  }

  // Chip distribution (right side)
  if (chips.length > 0) {
    const chipX = klineW
    const chipDrawW = chipW - 10
    const maxPct = Math.max(...chips.map(c => c.percent || 0), 0.001)
    const latestPrice = summary.latest_price || displayKlines[displayKlines.length - 1]?.close || 0

    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(chipX, pad.top); ctx.lineTo(chipX, pad.top + chartH); ctx.stroke()

    chips.forEach((chip) => {
      const price = chip.price || 0
      if (price < minP || price > maxP) return
      const y = priceToY(price)
      const barH = Math.max(1.5, chartH / chips.length * 0.85)
      const barLen = (chip.percent / maxPct) * chipDrawW * 0.85
      const isProfit = price <= latestPrice
      ctx.fillStyle = isProfit ? 'rgba(239,68,68,0.7)' : 'rgba(59,130,246,0.7)'
      ctx.fillRect(chipX + chipDrawW - barLen + 5, y - barH / 2, barLen, barH)
    })

    // Latest price line
    if (latestPrice >= minP && latestPrice <= maxP) {
      const y = priceToY(latestPrice)
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5
      ctx.setLineDash([3, 2])
      ctx.beginPath(); ctx.moveTo(chipX, y); ctx.lineTo(w, y); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'right'
      ctx.fillText(latestPrice.toFixed(2), w - 3, y - 3)
    }

    // Labels
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('筹码分布', chipX + chipDrawW / 2 + 5, 12)
  }
}
