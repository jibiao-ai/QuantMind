import { useState, useEffect, useCallback } from 'react'
import { getCompassStrategies, runCompassAnalysis, getCompassHistory } from '../services/api'
import { 
  Compass, Search, Play, Loader2, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Shield, Brain, Target, Zap,
  BarChart3, Activity, Clock, ChevronDown, ChevronRight, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

// ==================== 金策罗盘 (Jin Ce Compass) ====================
// Reference: ScottZt/jin-ce-zhi-suan 六部体系
// CrownPrince(太子) → ZhongshuSheng(中书省) → MenxiaSheng(门下省) → ShangshuSheng(尚书省)

export default function JinCeCompassPage() {
  const [code, setCode] = useState('')
  const [stockName, setStockName] = useState('')
  const [strategies, setStrategies] = useState([])
  const [selectedStrategies, setSelectedStrategies] = useState([])
  const [mode, setMode] = useState('analyze') // analyze/backtest/evolve
  const [period, setPeriod] = useState('day')
  const [dataSource, setDataSource] = useState('system')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [showStrategies, setShowStrategies] = useState(false)
  const [activeTab, setActiveTab] = useState('result') // result/pipeline/history

  // Load strategies
  useEffect(() => {
    const loadStrategies = async () => {
      try {
        const res = await getCompassStrategies()
        if (res?.data?.data?.strategies) {
          setStrategies(res.data.data.strategies)
          setSelectedStrategies(res.data.data.strategies.filter(s => s.is_active).map(s => s.id))
        }
      } catch (e) { console.error('Load strategies failed:', e) }
    }
    loadStrategies()
  }, [])

  // Load history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await getCompassHistory({})
        if (res?.data?.data) setHistory(res.data.data)
      } catch (e) {}
    }
    loadHistory()
  }, [])

  // Run analysis
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
      if (res?.data?.data) {
        setResult(res.data.data)
        toast.success('分析完成')
      } else {
        toast.error(res?.data?.error || '分析失败')
      }
    } catch (e) {
      toast.error('分析请求失败: ' + (e.response?.data?.error || e.message))
    }
    setLoading(false)
  }, [code, stockName, mode, selectedStrategies, period, dataSource])

  const toggleStrategy = (id) => {
    setSelectedStrategies(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  return (
    <div className="p-4 space-y-4 min-h-screen" style={{ background: '#F8F9FC' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <Compass size={24} className="text-[#513CC8]" />
            金策罗盘
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            六部体系 · AI策略研判 · 多数据源 · 参考 jin-ce-zhi-suan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded-full bg-[#F0EDFA] text-[#513CC8] font-medium">
            {strategies.length} 策略就绪
          </span>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        {/* Row 1: Stock code + mode */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] text-gray-500 font-medium mb-1 block">股票代码</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="输入代码，如 600519"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#513CC8] focus:ring-1 focus:ring-[#513CC8]/20 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              />
              <input
                type="text"
                value={stockName}
                onChange={(e) => setStockName(e.target.value)}
                placeholder="名称(可选)"
                className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#513CC8] outline-none"
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
                    mode === m.key ? 'bg-[#513CC8] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  <m.icon size={12} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Period + DataSource + Strategies */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] text-gray-500 font-medium mb-1 block">K线周期</label>
            <div className="flex gap-1">
              {['day', 'week', 'month'].map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    period === p ? 'bg-[#513CC8] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {{day:'日K', week:'周K', month:'月K'}[p]}
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
                    dataSource === ds.key ? 'bg-[#513CC8] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {ds.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <button onClick={() => setShowStrategies(!showStrategies)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
              <Target size={12} />
              策略 ({selectedStrategies.length}/{strategies.length})
              <ChevronDown size={10} />
            </button>
            {showStrategies && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-72 max-h-64 overflow-y-auto">
                {strategies.map(s => (
                  <label key={s.id} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 px-2 rounded">
                    <input type="checkbox" checked={selectedStrategies.includes(s.id)}
                      onChange={() => toggleStrategy(s.id)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-[#513CC8] focus:ring-[#513CC8]" />
                    <span className="text-xs text-gray-700 flex-1">{s.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{s.category}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleAnalyze} disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold bg-[#513CC8] text-white hover:bg-[#4130A0] transition disabled:opacity-50 shadow-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {loading ? '分析中...' : '开始分析'}
          </button>
        </div>
      </div>

      {/* Results Area */}
      {result && (
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1">
            {[
              { key: 'result', label: '综合研判', icon: Brain },
              { key: 'pipeline', label: '六部流水线', icon: Activity },
              { key: 'history', label: '分析历史', icon: Clock },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === t.key ? 'bg-[#513CC8] text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                <t.icon size={12} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'result' && <ResultPanel result={result} />}
          {activeTab === 'pipeline' && <PipelinePanel result={result} />}
          {activeTab === 'history' && <HistoryPanel history={history} />}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Compass size={48} className="mx-auto mb-4 text-[#513CC8]/30" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">金策罗盘 · 智能策略分析</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            输入股票代码，选择分析模式和策略组合，系统将通过六部体系
            （太子→中书省→门下省→尚书省）进行全流程分析
          </p>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            {['600519 贵州茅台', '000001 平安银行', '300750 宁德时代', '002475 立讯精密'].map(s => {
              const [c, n] = s.split(' ')
              return (
                <button key={c} onClick={() => { setCode(c); setStockName(n) }}
                  className="px-3 py-1.5 rounded-full text-xs bg-[#F0EDFA] text-[#513CC8] hover:bg-[#E0DBF5] transition">
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Result Panel ====================
function ResultPanel({ result }) {
  const suggestionConfig = {
    buy: { label: '买入', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', icon: TrendingUp },
    sell: { label: '卖出', color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200', icon: TrendingDown },
    hold: { label: '持有/观望', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', icon: Minus },
  }
  const cfg = suggestionConfig[result.suggestion] || suggestionConfig.hold
  const SugIcon = cfg.icon

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
              <SugIcon size={24} className={cfg.color} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                {result.name || result.code}
                <span className="text-xs text-gray-400 ml-2">{result.code}</span>
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[10px] text-gray-400">信心度</span>
                <span className="text-sm font-bold text-[#513CC8]">{result.confidence}%</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-400">AI模型</div>
            <div className="text-xs font-medium text-gray-600">{result.ai_model}</div>
            <div className="text-[10px] text-gray-400 mt-1">{result.analyzed_at}</div>
          </div>
        </div>

        {/* Risk & Position */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          <div className="text-center p-2 rounded-lg bg-white/60">
            <div className="text-[9px] text-gray-400">风险等级</div>
            <div className={`text-sm font-bold ${
              result.risk_level === 'low' ? 'text-green-500' : result.risk_level === 'high' ? 'text-red-500' : 'text-amber-500'
            }`}>
              {{low:'低', medium:'中', high:'高'}[result.risk_level]}
            </div>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/60">
            <div className="text-[9px] text-gray-400">建议仓位</div>
            <div className="text-sm font-bold text-[#513CC8]">{result.menxia_sheng?.max_position || 0}%</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/60">
            <div className="text-[9px] text-gray-400">止损位</div>
            <div className="text-sm font-bold text-green-600">{result.menxia_sheng?.stop_loss?.toFixed(2) || '---'}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/60">
            <div className="text-[9px] text-gray-400">止盈位</div>
            <div className="text-sm font-bold text-red-500">{result.menxia_sheng?.take_profit?.toFixed(2) || '---'}</div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-2">
          <Brain size={14} className="text-[#513CC8]" /> AI智能研判
        </h4>
        <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
          {result.ai_insights || '暂无AI分析结果'}
        </div>
      </div>

      {/* Strategy Signals Summary */}
      {result.zhongshu_sheng?.signals?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-3">
            <Target size={14} className="text-[#513CC8]" /> 策略信号 ({result.zhongshu_sheng.signals.length}个)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {result.zhongshu_sheng.signals.map((sig, i) => (
              <div key={i} className={`p-2.5 rounded-lg border ${
                sig.signal === 'buy' ? 'border-red-100 bg-red-50/50' :
                sig.signal === 'sell' ? 'border-green-100 bg-green-50/50' : 'border-gray-100 bg-gray-50/50'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-700">{sig.strategy_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    sig.signal === 'buy' ? 'bg-red-100 text-red-600' :
                    sig.signal === 'sell' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {sig.signal === 'buy' ? '买入' : sig.signal === 'sell' ? '卖出' : '持有'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">{sig.reason}</p>
                <div className="mt-1 h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div className={`h-full rounded-full ${
                    sig.signal === 'buy' ? 'bg-red-400' : sig.signal === 'sell' ? 'bg-green-400' : 'bg-gray-300'
                  }`} style={{ width: `${sig.strength * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backtest Result */}
      {result.backtest_result && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-3">
            <BarChart3 size={14} className="text-[#513CC8]" /> 回测结果
          </h4>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '总收益', value: `${(result.backtest_result.total_return * 100).toFixed(1)}%`, color: 'text-red-500' },
              { label: '年化收益', value: `${(result.backtest_result.annual_return * 100).toFixed(1)}%`, color: 'text-[#513CC8]' },
              { label: '最大回撤', value: `${(result.backtest_result.max_drawdown * 100).toFixed(1)}%`, color: 'text-green-600' },
              { label: '胜率', value: `${(result.backtest_result.win_rate * 100).toFixed(0)}%`, color: 'text-amber-500' },
              { label: '交易次数', value: result.backtest_result.trade_count, color: 'text-gray-700' },
              { label: '夏普比率', value: result.backtest_result.sharpe_ratio?.toFixed(2), color: 'text-[#513CC8]' },
              { label: '盈亏比', value: result.backtest_result.profit_factor?.toFixed(2), color: 'text-gray-700' },
              { label: '时间段', value: `${result.backtest_result.start_date}~`, color: 'text-gray-500' },
            ].map((item, i) => (
              <div key={i} className="text-center p-2 rounded-lg bg-gray-50">
                <div className="text-[9px] text-gray-400">{item.label}</div>
                <div className={`text-sm font-bold ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Pipeline Panel ====================
function PipelinePanel({ result }) {
  const steps = [
    {
      title: '太子 · 前置校验',
      subtitle: 'CrownPrince',
      icon: Shield,
      color: '#10B981',
      data: result.crown_prince,
      render: (d) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {d.is_valid ? <CheckCircle size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
            <span className="text-xs">{d.message}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <span className={d.is_st ? 'text-red-500 font-bold' : 'text-gray-400'}>ST: {d.is_st ? '是' : '否'}</span>
            <span className={d.is_limit_up ? 'text-red-500 font-bold' : 'text-gray-400'}>涨停: {d.is_limit_up ? '是' : '否'}</span>
            <span>流动性: {d.liquidity}</span>
          </div>
        </div>
      )
    },
    {
      title: '中书省 · 信号生成',
      subtitle: 'ZhongshuSheng',
      icon: Brain,
      color: '#513CC8',
      data: result.zhongshu_sheng,
      render: (d) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="text-xs">共识: <b className={d.consensus === 'buy' ? 'text-red-500' : d.consensus === 'sell' ? 'text-green-500' : 'text-amber-500'}>
              {d.consensus === 'buy' ? '买入' : d.consensus === 'sell' ? '卖出' : '持有'}
            </b></span>
            <span className="text-[10px] text-gray-400">买{d.buy_count} / 卖{d.sell_count} / 持{d.hold_count}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 flex overflow-hidden">
            {d.buy_count > 0 && <div className="bg-red-400" style={{ width: `${d.buy_count/(d.buy_count+d.sell_count+d.hold_count)*100}%` }} />}
            {d.sell_count > 0 && <div className="bg-green-400" style={{ width: `${d.sell_count/(d.buy_count+d.sell_count+d.hold_count)*100}%` }} />}
            {d.hold_count > 0 && <div className="bg-amber-300" style={{ width: `${d.hold_count/(d.buy_count+d.sell_count+d.hold_count)*100}%` }} />}
          </div>
        </div>
      )
    },
    {
      title: '门下省 · 风控审核',
      subtitle: 'MenxiaSheng',
      icon: Shield,
      color: '#F59E0B',
      data: result.menxia_sheng,
      render: (d) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {d.approved ? <CheckCircle size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
            <span className="text-xs">{d.approved ? '风控通过' : '风控拒绝'}</span>
            <span className="text-[10px] text-gray-400">风险分: {d.risk_score}</span>
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
      title: '尚书省 · 执行建议',
      subtitle: 'ShangshuSheng',
      icon: Zap,
      color: '#EF4444',
      data: result.shangshu_sheng,
      render: (d) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              d.action === 'buy' ? 'bg-red-100 text-red-600' :
              d.action === 'sell' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {d.action === 'buy' ? '建议买入' : d.action === 'sell' ? '建议卖出' : '建议持有'}
            </span>
            <span className="text-[10px] text-gray-400">{d.time_horizon}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <span>入场价: <b>{d.entry_price?.toFixed(2)}</b></span>
            <span>目标价: <b className="text-red-500">{d.target_price?.toFixed(2)}</b></span>
            <span>仓位: <b className="text-[#513CC8]">{d.position_size}%</b></span>
          </div>
          <p className="text-[10px] text-gray-500">{d.execution}</p>
        </div>
      )
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-1.5">
        <Activity size={14} className="text-[#513CC8]" />
        六部流水线 · Pipeline
      </h4>
      <div className="space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon
          return (
            <div key={i} className="relative">
              {/* Connection line */}
              {i < steps.length - 1 && (
                <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200 -mb-3" style={{ height: 'calc(100% - 24px)' }} />
              )}
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ background: step.color + '15', border: `1.5px solid ${step.color}40` }}>
                  <Icon size={16} style={{ color: step.color }} />
                </div>
                <div className="flex-1 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-700">{step.title}</span>
                    <span className="text-[9px] text-gray-400 font-mono">{step.subtitle}</span>
                  </div>
                  {step.data && step.render(step.data)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== History Panel ====================
function HistoryPanel({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Clock size={32} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-400">暂无分析历史</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
        <Clock size={14} className="text-[#513CC8]" /> 分析历史
      </h4>
      <div className="space-y-2">
        {history.map((item, i) => (
          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">{item.name || item.code}</span>
              <span className="text-[10px] text-gray-400">{item.code}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                item.suggestion === '买入' ? 'bg-red-100 text-red-600' :
                item.suggestion === '卖出' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {item.suggestion || '观望'}
              </span>
              <span className="text-[10px] text-gray-400">{item.trade_date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
