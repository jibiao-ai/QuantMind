import { useState, useEffect, useCallback } from 'react'
import { getCompassStrategies, runCompassAnalysis, getCompassHistory } from '../services/api'
import {
  Compass, Play, Loader2, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Shield, Brain, Target, Zap,
  BarChart3, Activity, Clock, ChevronDown, RefreshCw, ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'

// ==================== 金策罗盘 Jin Ce Compass ====================
// 三省六部体系: CrownPrince → ZhongshuSheng → MenxiaSheng → ShangshuSheng

export default function JinCeCompassPage() {
  const [code, setCode] = useState('')
  const [stockName, setStockName] = useState('')
  const [strategies, setStrategies] = useState([])
  const [selectedStrategies, setSelectedStrategies] = useState([])
  const [mode, setMode] = useState('analyze')
  const [period, setPeriod] = useState('day')
  const [dataSource, setDataSource] = useState('system')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [showStrategies, setShowStrategies] = useState(false)
  const [activeTab, setActiveTab] = useState('result')

  // Load strategies on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCompassStrategies()
        if (res?.code === 0 && res?.data?.strategies) {
          setStrategies(res.data.strategies)
          setSelectedStrategies(res.data.strategies.filter(s => s.is_active).map(s => s.id))
        }
      } catch (e) {
        console.error('Load strategies failed:', e)
      }
    }
    load()
  }, [])

  // Load history
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCompassHistory({})
        if (res?.code === 0 && res?.data) {
          setHistory(Array.isArray(res.data) ? res.data : [])
        }
      } catch (e) {}
    }
    load()
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) {
      toast.error('请输入股票代码')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await runCompassAnalysis({
        code: code.trim(),
        name: stockName || code.trim(),
        mode,
        strategies: selectedStrategies,
        period,
        data_source: dataSource,
      })
      if (res?.code === 0 && res?.data) {
        setResult(res.data)
        setActiveTab('result')
        toast.success(`分析完成 · ${res.data.data_source_used || ''}`)
      } else {
        toast.error(res?.message || '分析失败')
      }
    } catch (e) {
      toast.error('分析请求失败: ' + (e.response?.data?.message || e.message))
    }
    setLoading(false)
  }, [code, stockName, mode, selectedStrategies, period, dataSource])

  const toggleStrategy = (id) => {
    setSelectedStrategies(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const selectAllStrategies = () => setSelectedStrategies(strategies.map(s => s.id))
  const deselectAllStrategies = () => setSelectedStrategies([])

  return (
    <div className="p-4 md:p-6 space-y-4" style={{ background: '#F8F9FB', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Compass className="text-[#513CC8]" size={22} />
            金策罗盘
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            三省六部体系 · AI多策略研判 · 数据源: AkShare + 东方财富
          </p>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#F0EDFA] text-[#513CC8] font-semibold">
          {strategies.length} 策略就绪
        </span>
      </div>

      {/* Control Panel */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Row 1: Code + Mode */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] text-gray-500 font-medium mb-1 block">股票代码</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="如 600519"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#513CC8] focus:ring-1 focus:ring-[#513CC8]/20 outline-none transition"
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              />
              <input
                type="text"
                value={stockName}
                onChange={(e) => setStockName(e.target.value)}
                placeholder="名称(选填)"
                className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#513CC8] outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 font-medium mb-1 block">分析模式</label>
            <div className="flex gap-1">
              {[
                { key: 'analyze', label: '策略研判', icon: Brain },
                { key: 'backtest', label: '回测验证', icon: BarChart3 },
                { key: 'evolve', label: '策略进化', icon: Zap },
              ].map(m => (
                <button key={m.key} onClick={() => setMode(m.key)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    mode === m.key
                      ? 'bg-[#513CC8] text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}>
                  <m.icon size={12} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Period + DataSource + Strategies + Run Button */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] text-gray-500 font-medium mb-1 block">K线周期</label>
            <div className="flex gap-1">
              {[{k:'day',l:'日K'},{k:'week',l:'周K'},{k:'month',l:'月K'}].map(p => (
                <button key={p.k} onClick={() => setPeriod(p.k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    period === p.k
                      ? 'bg-[#513CC8] text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 font-medium mb-1 block">数据源</label>
            <div className="flex gap-1">
              {[
                { key: 'system', label: '系统设置' },
                { key: 'akshare', label: 'AkShare' },
                { key: 'eastmoney', label: '东方财富' },
              ].map(ds => (
                <button key={ds.key} onClick={() => setDataSource(ds.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    dataSource === ds.key
                      ? 'bg-[#513CC8] text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}>
                  {ds.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy selector */}
          <div className="relative">
            <label className="text-[10px] text-gray-500 font-medium mb-1 block">策略组合</label>
            <button onClick={() => setShowStrategies(!showStrategies)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition">
              <Target size={11} className="text-[#513CC8]" />
              {selectedStrategies.length}/{strategies.length} 策略
              <ChevronDown size={10} />
            </button>
            {showStrategies && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-80 max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-600">选择策略</span>
                  <div className="flex gap-2">
                    <button onClick={selectAllStrategies} className="text-[10px] text-[#513CC8] hover:underline">全选</button>
                    <button onClick={deselectAllStrategies} className="text-[10px] text-gray-400 hover:underline">全不选</button>
                  </div>
                </div>
                {strategies.map(s => (
                  <label key={s.id} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 px-2 rounded-lg transition">
                    <input type="checkbox" checked={selectedStrategies.includes(s.id)}
                      onChange={() => toggleStrategy(s.id)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-[#513CC8] focus:ring-[#513CC8]" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-gray-700 font-medium">{s.name}</span>
                      <span className="text-[9px] text-gray-400 ml-1.5">{s.description}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{s.category}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Run button */}
          <div>
            <label className="text-[10px] text-gray-500 font-medium mb-1 block">&nbsp;</label>
            <button onClick={handleAnalyze} disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold text-white transition disabled:opacity-50 shadow-sm hover:shadow-md"
              style={{ background: loading ? '#9CA3AF' : '#513CC8' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {loading ? '分析中...' : '开始分析'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
            {[
              { key: 'result', label: '综合研判', icon: Brain },
              { key: 'pipeline', label: '六部流水线', icon: Activity },
              { key: 'backtest', label: '回测', icon: BarChart3, show: result.backtest_result },
              { key: 'history', label: '历史', icon: Clock },
            ].filter(t => t.show !== null && t.show !== undefined ? t.show : true).map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === t.key
                    ? 'bg-[#513CC8] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                <t.icon size={12} />
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'result' && <ResultPanel result={result} />}
          {activeTab === 'pipeline' && <PipelinePanel result={result} />}
          {activeTab === 'backtest' && result.backtest_result && <BacktestPanel data={result.backtest_result} />}
          {activeTab === 'history' && <HistoryPanel history={history} />}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0EDFA] flex items-center justify-center">
            <Compass size={32} className="text-[#513CC8]" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">金策罗盘 · 量化策略分析</h3>
          <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed">
            输入股票代码，选择分析模式和策略组合，系统通过<b className="text-[#513CC8]">三省六部体系</b>（太子监→中书省→门下省→尚书省）进行全流程策略信号生成、风控审核和执行建议
          </p>
          <div className="mt-6 flex justify-center gap-2 flex-wrap">
            {[
              ['600519', '贵州茅台'], ['000001', '平安银行'],
              ['300750', '宁德时代'], ['002475', '立讯精密'],
              ['601318', '中国平安'], ['000858', '五粮液'],
            ].map(([c, n]) => (
              <button key={c} onClick={() => { setCode(c); setStockName(n) }}
                className="px-3 py-1.5 rounded-full text-xs bg-[#F0EDFA] text-[#513CC8] hover:bg-[#E4DFF7] transition font-medium">
                {c} {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !result && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <Loader2 size={32} className="mx-auto mb-3 text-[#513CC8] animate-spin" />
          <p className="text-sm text-gray-500">正在执行六部体系分析流程...</p>
          <div className="mt-4 flex justify-center gap-2">
            {['太子监', '中书省', '门下省', '尚书省', 'AI研判'].map((step, i) => (
              <span key={step} className="text-[10px] px-2 py-1 rounded bg-[#F0EDFA] text-[#513CC8] animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}>
                {step}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Result Panel ====================
function ResultPanel({ result }) {
  const cfg = {
    buy:  { label: '买入', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: TrendingUp },
    sell: { label: '卖出', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: TrendingDown },
    hold: { label: '观望', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: Minus },
  }[result.suggestion] || { label: '观望', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: Minus }

  const Icon = cfg.icon

  return (
    <div className="space-y-3">
      {/* Summary Card */}
      <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white border ${cfg.border} shadow-sm`}>
              <Icon size={22} className={cfg.color} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">
                {result.name || result.code}
                <span className="text-xs text-gray-400 ml-2 font-normal">{result.code}</span>
              </h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[10px] text-gray-400">信心度</span>
                <span className="text-sm font-bold text-[#513CC8]">{result.confidence}%</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  result.risk_level === 'low' ? 'bg-green-100 text-green-700' :
                  result.risk_level === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  风险{result.risk_level === 'low' ? '低' : result.risk_level === 'high' ? '高' : '中'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-gray-400">AI模型</div>
            <div className="text-xs font-medium text-gray-600 max-w-[120px] truncate">{result.ai_model}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{result.analyzed_at}</div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: '建议仓位', value: `${result.menxia_sheng?.max_position || 0}%`, color: 'text-[#513CC8]' },
            { label: '止损位', value: result.menxia_sheng?.stop_loss ? result.menxia_sheng.stop_loss.toFixed(2) : '---', color: 'text-green-600' },
            { label: '止盈位', value: result.menxia_sheng?.take_profit ? result.menxia_sheng.take_profit.toFixed(2) : '---', color: 'text-red-500' },
            { label: '数据源', value: result.data_source_used || '---', color: 'text-gray-600' },
          ].map((item, i) => (
            <div key={i} className="text-center p-2 rounded-lg bg-white/70 border border-white">
              <div className="text-[9px] text-gray-400">{item.label}</div>
              <div className={`text-sm font-bold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      {result.ai_insights && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-2">
            <Brain size={14} className="text-[#513CC8]" /> AI智能研判
          </h4>
          <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100">
            {result.ai_insights}
          </div>
        </div>
      )}

      {/* Strategy Signals */}
      {result.zhongshu_sheng?.signals?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-3">
            <Target size={14} className="text-[#513CC8]" />
            策略信号
            <span className="text-[10px] font-normal text-gray-400 ml-1">
              买{result.zhongshu_sheng.buy_count} / 卖{result.zhongshu_sheng.sell_count} / 持{result.zhongshu_sheng.hold_count}
            </span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {result.zhongshu_sheng.signals.map((sig, i) => (
              <SignalCard key={i} signal={sig} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SignalCard({ signal }) {
  const colors = {
    buy:  { bg: 'bg-red-50', border: 'border-red-100', badge: 'bg-red-500 text-white', bar: 'bg-red-400' },
    sell: { bg: 'bg-green-50', border: 'border-green-100', badge: 'bg-green-500 text-white', bar: 'bg-green-400' },
    hold: { bg: 'bg-gray-50', border: 'border-gray-100', badge: 'bg-gray-400 text-white', bar: 'bg-gray-300' },
  }[signal.signal] || { bg: 'bg-gray-50', border: 'border-gray-100', badge: 'bg-gray-400 text-white', bar: 'bg-gray-300' }

  return (
    <div className={`p-2.5 rounded-lg border ${colors.border} ${colors.bg}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-700">{signal.strategy_name}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${colors.badge}`}>
          {signal.signal === 'buy' ? '买' : signal.signal === 'sell' ? '卖' : '持'}
        </span>
      </div>
      <p className="text-[10px] text-gray-500 leading-tight mb-1.5 line-clamp-2">{signal.reason}</p>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${colors.bar}`}
            style={{ width: `${Math.round(signal.strength * 100)}%` }} />
        </div>
        <span className="text-[9px] text-gray-400 w-7 text-right">{Math.round(signal.strength * 100)}%</span>
      </div>
    </div>
  )
}

// ==================== Pipeline Panel ====================
function PipelinePanel({ result }) {
  const steps = [
    {
      title: '太子监',
      subtitle: 'CrownPrince · 数据校验',
      icon: Shield,
      color: '#10B981',
      data: result.crown_prince,
      render: (d) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {d.is_valid ? <CheckCircle size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
            <span className="text-xs text-gray-700">{d.message}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className={`px-1.5 py-0.5 rounded ${d.is_st ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
              ST: {d.is_st ? '是' : '否'}
            </span>
            <span className={`px-1.5 py-0.5 rounded ${d.is_limit_up ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
              涨停: {d.is_limit_up ? '是' : '否'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              流动性: {d.liquidity === 'high' ? '高' : d.liquidity === 'low' ? '低' : '中'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#F0EDFA] text-[#513CC8]">
              K线: {d.data_bars}根
            </span>
          </div>
        </div>
      )
    },
    {
      title: '中书省',
      subtitle: 'ZhongshuSheng · 策略信号',
      icon: Brain,
      color: '#513CC8',
      data: result.zhongshu_sheng,
      render: (d) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              d.consensus === 'buy' ? 'bg-red-100 text-red-600' :
              d.consensus === 'sell' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
            }`}>
              共识: {d.consensus === 'buy' ? '买入' : d.consensus === 'sell' ? '卖出' : '持有'}
            </span>
            <span className="text-[10px] text-gray-400">
              买{d.buy_count} / 卖{d.sell_count} / 持{d.hold_count}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 flex overflow-hidden">
            {d.buy_count > 0 && <div className="bg-red-400 transition-all" style={{ width: `${d.buy_count/(d.buy_count+d.sell_count+d.hold_count)*100}%` }} />}
            {d.sell_count > 0 && <div className="bg-green-400 transition-all" style={{ width: `${d.sell_count/(d.buy_count+d.sell_count+d.hold_count)*100}%` }} />}
            {d.hold_count > 0 && <div className="bg-amber-300 transition-all" style={{ width: `${d.hold_count/(d.buy_count+d.sell_count+d.hold_count)*100}%` }} />}
          </div>
        </div>
      )
    },
    {
      title: '门下省',
      subtitle: 'MenxiaSheng · 风控审核',
      icon: Shield,
      color: '#F59E0B',
      data: result.menxia_sheng,
      render: (d) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {d.approved
              ? <CheckCircle size={12} className="text-green-500" />
              : <XCircle size={12} className="text-red-500" />}
            <span className="text-xs font-medium">{d.approved ? '风控通过' : '风控拒绝'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              风险分: {typeof d.risk_score === 'number' ? d.risk_score.toFixed(0) : d.risk_score}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0EDFA] text-[#513CC8]">
              仓位≤{d.max_position}%
            </span>
          </div>
          {d.risk_warnings?.length > 0 && (
            <div className="space-y-0.5">
              {d.risk_warnings.map((w, i) => (
                <div key={i} className="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={9} /> {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    },
    {
      title: '尚书省',
      subtitle: 'ShangshuSheng · 执行建议',
      icon: Zap,
      color: '#EF4444',
      data: result.shangshu_sheng,
      render: (d) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              d.action === 'buy' ? 'bg-red-100 text-red-600' :
              d.action === 'sell' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {d.action === 'buy' ? '建议买入' : d.action === 'sell' ? '建议卖出' : '建议持有'}
            </span>
            <span className="text-[10px] text-gray-400">{d.time_horizon}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <span className="px-1.5 py-1 rounded bg-gray-50 text-center">入场: <b>{d.entry_price?.toFixed(2) || '---'}</b></span>
            <span className="px-1.5 py-1 rounded bg-red-50 text-center text-red-600">目标: <b>{d.target_price?.toFixed(2) || '---'}</b></span>
            <span className="px-1.5 py-1 rounded bg-green-50 text-center text-green-600">止损: <b>{d.exit_price?.toFixed(2) || '---'}</b></span>
          </div>
          <p className="text-[10px] text-gray-500">{d.execution}</p>
        </div>
      )
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-1.5">
        <Activity size={14} className="text-[#513CC8]" />
        六部流水线 · Pipeline
      </h4>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const StepIcon = step.icon
          return (
            <div key={i} className="relative flex gap-3">
              {/* Vertical line */}
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ background: step.color + '12', border: `1.5px solid ${step.color}30` }}>
                  <StepIcon size={15} style={{ color: step.color }} />
                </div>
                {i < steps.length - 1 && (
                  <div className="w-0.5 flex-1 my-1 rounded-full" style={{ background: step.color + '30' }}>
                    <ArrowRight size={8} className="mx-auto mt-1 text-gray-300 rotate-90" />
                  </div>
                )}
              </div>
              {/* Content */}
              <div className={`flex-1 pb-3 ${i < steps.length - 1 ? 'mb-1' : ''}`}>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-700">{step.title}</span>
                    <span className="text-[9px] text-gray-400 font-mono">{step.subtitle}</span>
                  </div>
                  {step.data ? step.render(step.data) : (
                    <span className="text-[10px] text-gray-400">暂无数据</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== Backtest Panel ====================
function BacktestPanel({ data }) {
  const metrics = [
    { label: '总收益', value: `${(data.total_return * 100).toFixed(1)}%`, color: data.total_return >= 0 ? 'text-red-500' : 'text-green-500' },
    { label: '年化收益', value: `${(data.annual_return * 100).toFixed(1)}%`, color: 'text-[#513CC8]' },
    { label: '最大回撤', value: `${(data.max_drawdown * 100).toFixed(1)}%`, color: 'text-green-600' },
    { label: '胜率', value: `${(data.win_rate * 100).toFixed(0)}%`, color: 'text-amber-500' },
    { label: '交易次数', value: data.trade_count, color: 'text-gray-700' },
    { label: '夏普比率', value: data.sharpe_ratio?.toFixed(2) || '---', color: 'text-[#513CC8]' },
    { label: '盈亏比', value: data.profit_factor?.toFixed(2) || '---', color: 'text-gray-700' },
    { label: '回测区间', value: `${data.start_date || '---'} ~ ${data.end_date || '---'}`, color: 'text-gray-500' },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-3">
        <BarChart3 size={14} className="text-[#513CC8]" /> 回测结果
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((item, i) => (
          <div key={i} className="text-center p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div className="text-[10px] text-gray-400 mb-1">{item.label}</div>
            <div className={`text-sm font-bold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== History Panel ====================
function HistoryPanel({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
        <Clock size={28} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-400">暂无分析历史</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
        <Clock size={14} className="text-[#513CC8]" /> 分析历史
      </h4>
      <div className="space-y-1.5">
        {history.map((item, i) => (
          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-[#513CC8]/20 transition">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">{item.name || item.code}</span>
              <span className="text-[10px] text-gray-400">{item.code}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                item.suggestion === 'buy' || item.suggestion === '买入' ? 'bg-red-100 text-red-600' :
                item.suggestion === 'sell' || item.suggestion === '卖出' ? 'bg-green-100 text-green-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {item.suggestion || '观望'}
              </span>
              <span className="text-[10px] text-gray-400">{item.trade_date || item.created_at}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
