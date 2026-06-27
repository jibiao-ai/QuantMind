import { useState, useEffect, useCallback, useRef } from 'react'
import { getCompassStrategies, runCompassAnalysis, getCompassHistory, getCompassKline, runCompassEvolution } from '../services/api'
import {
  Compass, Play, Loader2, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Shield, Brain, Target, Zap,
  BarChart3, Activity, Clock, ChevronDown, ArrowRight, Square,
  RefreshCw, Settings, Layers, Radio, BookOpen, Gavel, Landmark, History
} from 'lucide-react'
import toast from 'react-hot-toast'

// ==================== 金策罗盘 V2 - White Theme ====================
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
  const [klineData, setKlineData] = useState(null)
  const [activeView, setActiveView] = useState('decision') // decision/evolution/chart
  const [evolutionResult, setEvolutionResult] = useState(null)
  const [evolving, setEvolving] = useState(false)
  const [logs, setLogs] = useState([])
  const [pipelineStep, setPipelineStep] = useState(-1)
  const [history, setHistory] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCompassStrategies()
        if (res?.code === 0 && res?.data?.strategies) {
          setStrategies(res.data.strategies)
          setSelectedStrategies(res.data.strategies.filter(s => s.is_active).map(s => s.id))
        }
      } catch (e) {}
    }
    load()
    // Load history from localStorage
    try {
      const saved = localStorage.getItem('jince_compass_history')
      if (saved) setHistory(JSON.parse(saved))
    } catch (e) {}
  }, [])

  const saveHistory = (record) => {
    const newHistory = [record, ...history.filter(h => h.code !== record.code || h.time !== record.time)].slice(0, 20)
    setHistory(newHistory)
    localStorage.setItem('jince_compass_history', JSON.stringify(newHistory))
  }

  const addLog = (type, msg) => {
    const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setLogs(prev => [...prev.slice(-50), { ts, type, msg }])
  }

  const fetchKline = useCallback(async (stockCode) => {
    try {
      const res = await getCompassKline({ code: stockCode, period })
      if (res?.code === 0 && res?.data?.klines) {
        setKlineData(res.data)
        addLog('info', `K线加载完成: ${res.data.count}根 (${res.data.data_source})`)
      }
    } catch (e) {
      addLog('error', 'K线加载失败')
    }
  }, [period])

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) { toast.error('请输入股票代码'); return }
    setLoading(true)
    setResult(null)
    setPipelineStep(0)
    setLogs([])
    addLog('system', '系统启动，等待连接...')

    // Fetch kline first
    await fetchKline(code.trim())
    addLog('info', 'K线数据获取成功')

    // Simulate pipeline steps
    setPipelineStep(1)
    addLog('info', '太子监: 数据校验中...')

    try {
      const res = await runCompassAnalysis({
        code: code.trim(), name: stockName || code.trim(),
        mode, strategies: selectedStrategies, period, data_source: dataSource,
      })
      if (res?.code === 0 && res?.data) {
        setResult(res.data)
        setPipelineStep(2)
        addLog('info', `中书省: 策略信号生成 - 共识=${res.data.zhongshu_sheng?.consensus}`)
        setTimeout(() => { setPipelineStep(3); addLog('info', `门下省: 风控审核 - ${res.data.menxia_sheng?.approved ? '通过' : '拒绝'}`) }, 500)
        setTimeout(() => { setPipelineStep(4); addLog('info', `尚书省: 执行建议 - ${res.data.shangshu_sheng?.action}`) }, 1000)
        setTimeout(() => { setPipelineStep(5); addLog('success', `分析完成: 建议=${res.data.suggestion} 信心度=${res.data.confidence}%`) }, 1500)
        toast.success('六部决策完成')
        // Save to history
        saveHistory({
          code: code.trim(),
          stock_name: res.data.stock_name || stockName || code.trim(),
          suggestion: res.data.suggestion,
          confidence: res.data.confidence,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString('zh-CN'),
          result: res.data,
        })
      } else {
        toast.error(res?.message || '分析失败')
        addLog('error', res?.message || '分析失败')
      }
    } catch (e) {
      toast.error('分析请求失败')
      addLog('error', '请求失败: ' + (e.message || ''))
    }
    setLoading(false)
  }, [code, stockName, mode, selectedStrategies, period, dataSource, fetchKline])

  const handleEvolution = useCallback(async () => {
    if (!code.trim()) { toast.error('请输入股票代码'); return }
    setEvolving(true)
    setEvolutionResult(null)
    addLog('system', '策略进化启动...')
    try {
      const res = await runCompassEvolution({
        code: code.trim(), name: stockName || '',
        strategies: selectedStrategies, max_rounds: 3, period,
      })
      if (res?.code === 0 && res?.data) {
        setEvolutionResult(res.data)
        addLog('success', `进化完成: 最佳策略=${res.data.best_strategy} 评分=${res.data.best_score?.toFixed(2)}`)
        toast.success('策略进化完成')
      } else {
        toast.error(res?.message || '进化失败')
        addLog('error', res?.message || '进化失败')
      }
    } catch (e) {
      toast.error('进化请求失败')
      addLog('error', '进化失败: ' + e.message)
    }
    setEvolving(false)
  }, [code, stockName, selectedStrategies, period])

  const loadHistory = (record) => {
    setCode(record.code)
    setStockName(record.stock_name || '')
    if (record.result) {
      setResult(record.result)
      setPipelineStep(5)
      setLogs([{ ts: '—', type: 'info', msg: `加载 ${record.stock_name} 历史分析结果` }])
    }
  }

  return (
    <div className="p-3 md:p-4 space-y-3" style={{ background: '#F8F9FC', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Compass size={20} style={{ color: '#513CC8' }} />
          <h1 className="text-lg font-bold gradient-text">金策罗盘</h1>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#F0EDFA] text-[#513CC8] border border-[#513CC8]/20">
            {strategies.length} 策略
          </span>
        </div>
        <div className="flex gap-1">
          {[
            { key: 'decision', label: '六部决策', icon: Landmark },
            { key: 'chart', label: 'K线图表', icon: BarChart3 },
            { key: 'evolution', label: '策略进化', icon: Zap },
          ].map(v => (
            <button key={v.key} onClick={() => setActiveView(v.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeView === v.key ? 'bg-[#513CC8] text-white shadow-sm' : 'bg-white text-gray-500 hover:text-[#513CC8] border border-gray-200 hover:border-[#513CC8]/30'
              }`}>
              <v.icon size={11} />{v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Control Bar */}
      <ControlBar
        code={code} setCode={setCode}
        stockName={stockName} setStockName={setStockName}
        period={period} setPeriod={setPeriod}
        dataSource={dataSource} setDataSource={setDataSource}
        mode={mode} setMode={setMode}
        strategies={strategies} selectedStrategies={selectedStrategies}
        setSelectedStrategies={setSelectedStrategies}
        loading={loading} onAnalyze={handleAnalyze}
        evolving={evolving} onEvolve={handleEvolution}
        activeView={activeView}
      />

      {/* Main Content */}
      {activeView === 'decision' && (
        <DecisionDashboard result={result} loading={loading} pipelineStep={pipelineStep} logs={logs} />
      )}
      {activeView === 'chart' && (
        <KlineChart klineData={klineData} result={result} code={code} onLoad={fetchKline} />
      )}
      {activeView === 'evolution' && (
        <EvolutionPanel result={evolutionResult} evolving={evolving} strategies={strategies} logs={logs} />
      )}

      {/* History Section */}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <History size={12} className="text-gray-400" />
            <span className="text-[10px] text-gray-500 font-medium">历史分析记录</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {history.map((record, i) => (
              <HistoryCard key={i} record={record} onClick={() => loadHistory(record)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== History Card (matching 大师研判 format) ====================
function HistoryCard({ record, onClick }) {
  const suggestionColor = record.suggestion === 'buy' ? '#EF4444' : record.suggestion === 'sell' ? '#22C55E' : '#F59E0B'
  const suggestionText = record.suggestion === 'buy' ? '买入' : record.suggestion === 'sell' ? '卖出' : '观望'
  const suggestionBg = record.suggestion === 'buy' ? 'bg-red-50 text-red-600' : record.suggestion === 'sell' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
  return (
    <div onClick={onClick} className="flex-shrink-0 w-36 p-2.5 rounded-xl border border-gray-100 bg-white hover:border-[#513CC8]/30 hover:shadow-sm cursor-pointer transition-all">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-gray-800 truncate">{record.stock_name || record.code}</span>
        <span className="text-[10px] font-bold" style={{ color: suggestionColor }}>{record.confidence}%</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-gray-400">{record.code}</span>
        <span className={`text-[8px] px-1 py-0.5 rounded ${suggestionBg}`}>{suggestionText}</span>
      </div>
      <div className="text-[8px] text-gray-400 mt-1">{record.date} {record.time}</div>
    </div>
  )
}

// ==================== Control Bar ====================
function ControlBar({ code, setCode, stockName, setStockName, period, setPeriod, dataSource, setDataSource, mode, setMode, strategies, selectedStrategies, setSelectedStrategies, loading, onAnalyze, evolving, onEvolve, activeView }) {
  const [showStrats, setShowStrats] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] text-gray-500 mb-1 block">股票代码</label>
          <div className="flex gap-2">
            <input type="text" value={code} onChange={e => setCode(e.target.value)}
              placeholder="600519" onKeyDown={e => e.key === 'Enter' && onAnalyze()}
              className="flex-1 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 text-sm placeholder-gray-400 focus:border-[#513CC8] focus:ring-2 focus:ring-[#513CC8]/20 outline-none" />
            <input type="text" value={stockName} onChange={e => setStockName(e.target.value)}
              placeholder="名称"
              className="w-20 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 text-sm placeholder-gray-400 outline-none" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">周期</label>
          <div className="flex gap-1">
            {['day','week','month'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-2.5 py-1.5 rounded text-[10px] font-medium transition ${period===p?'bg-[#513CC8] text-white':'bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#513CC8]/30'}`}>
                {{day:'日K',week:'周K',month:'月K'}[p]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">数据源</label>
          <div className="flex gap-1">
            {[{k:'system',l:'系统'},{k:'akshare',l:'AkShare'},{k:'eastmoney',l:'东财'}].map(d => (
              <button key={d.k} onClick={() => setDataSource(d.k)} className={`px-2.5 py-1.5 rounded text-[10px] font-medium transition ${dataSource===d.k?'bg-[#513CC8] text-white':'bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#513CC8]/30'}`}>
                {d.l}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <label className="text-[10px] text-gray-500 mb-1 block">策略</label>
          <button onClick={() => setShowStrats(!showStrats)} className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-gray-50 border border-gray-200 text-gray-600 text-[10px] hover:border-[#513CC8]/30">
            <Target size={10} className="text-[#513CC8]" />{selectedStrategies.length}/{strategies.length}<ChevronDown size={9}/>
          </button>
          {showStrats && (
            <div className="absolute top-full mt-1 left-0 z-50 bg-white rounded-lg border border-gray-200 p-2 w-64 max-h-56 overflow-y-auto shadow-xl">
              {strategies.map(s => (
                <label key={s.id} className="flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-[#F0EDFA] text-[10px] text-gray-600">
                  <input type="checkbox" checked={selectedStrategies.includes(s.id)}
                    onChange={() => setSelectedStrategies(prev => prev.includes(s.id)?prev.filter(x=>x!==s.id):[...prev,s.id])}
                    className="w-3 h-3 rounded border-gray-300 text-[#513CC8]" />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-gray-400">{s.category}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button onClick={activeView === 'evolution' ? onEvolve : onAnalyze} disabled={loading || evolving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition disabled:opacity-50 shadow-sm"
          style={{ background: '#513CC8' }}>
          {(loading||evolving) ? <Loader2 size={13} className="animate-spin"/> : <Play size={13}/>}
          {loading?'分析中...':evolving?'进化中...':activeView==='evolution'?'启动进化':'开始分析'}
        </button>
      </div>
    </div>
  )
}

// ==================== K-line Chart ====================
function KlineChart({ klineData, result, code, onLoad }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!klineData?.klines?.length || !canvasRef.current) return
    drawChart(canvasRef.current, klineData.klines, result)
  }, [klineData, result])

  if (!klineData || !klineData.klines?.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
        <BarChart3 size={36} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">输入股票代码并执行分析后显示K线图表</p>
        {code && <button onClick={() => onLoad(code)} className="mt-3 px-4 py-1.5 rounded text-white text-xs" style={{background:'#513CC8'}}>加载K线</button>}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{code} · {klineData.period} · {klineData.data_source} · {klineData.count}根</span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/>买入</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"/>卖出</span>
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full rounded-lg" style={{height: 320}} />
    </div>
  )
}

function drawChart(canvas, klines, result) {
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = 320 * dpr
  canvas.style.height = '320px'
  ctx.scale(dpr, dpr)
  const W = rect.width, H = 320
  const chartH = H * 0.7, volH = H * 0.25, gap = H * 0.05

  // White background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  if (!klines.length) return

  // Price range
  const closes = klines.map(k => k.close || 0).filter(v => v > 0)
  const highs = klines.map(k => k.high || k.close || 0).filter(v => v > 0)
  const lows = klines.map(k => k.low || k.close || 0).filter(v => v > 0)
  const vols = klines.map(k => k.volume || 0)
  if (!closes.length) return

  const priceMin = Math.min(...lows) * 0.98
  const priceMax = Math.max(...highs) * 1.02
  const volMax = Math.max(...vols) * 1.1 || 1

  const n = klines.length
  const barW = Math.max(2, (W - 40) / n)
  const candleW = Math.max(1, barW * 0.6)

  const px = (i) => 20 + i * barW + barW / 2
  const py = (price) => 10 + (1 - (price - priceMin) / (priceMax - priceMin)) * (chartH - 20)
  const vy = (vol) => chartH + gap + volH * (1 - vol / volMax)

  // Grid lines
  ctx.strokeStyle = '#F0F0F0'
  ctx.lineWidth = 0.5
  for (let i = 0; i < 5; i++) {
    const y = 10 + i * (chartH - 20) / 4
    ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 10, y); ctx.stroke()
    const price = priceMax - i * (priceMax - priceMin) / 4
    ctx.fillStyle = '#999'
    ctx.font = '9px monospace'
    ctx.fillText(price.toFixed(2), W - 45, y + 3)
  }

  // Candlesticks + Volume
  klines.forEach((k, i) => {
    const o = k.open || k.close, c = k.close, h = k.high || c, l = k.low || c, v = k.volume || 0
    const isUp = c >= o
    const color = isUp ? '#EF4444' : '#22C55E'
    const x = px(i)

    // Wick
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, py(h)); ctx.lineTo(x, py(l)); ctx.stroke()

    // Body
    const top = py(Math.max(o, c)), bot = py(Math.min(o, c))
    const bodyH = Math.max(1, bot - top)
    ctx.fillStyle = color
    ctx.fillRect(x - candleW/2, top, candleW, bodyH)

    // Volume bar
    const volTop = vy(v)
    ctx.fillStyle = isUp ? '#EF444440' : '#22C55E40'
    ctx.fillRect(x - candleW/2, volTop, candleW, chartH + gap + volH - volTop)
  })

  // Buy/Sell signals from result
  if (result?.zhongshu_sheng?.signals) {
    const signals = result.zhongshu_sheng.signals
    const buySignals = signals.filter(s => s.signal === 'buy')
    const sellSignals = signals.filter(s => s.signal === 'sell')
    const lastIdx = n - 1
    const lastClose = closes[closes.length - 1]

    if (buySignals.length > sellSignals.length && lastIdx >= 0) {
      // Draw buy arrow at last bar
      const x = px(lastIdx), y = py(lows[lastIdx] || lastClose) + 15
      ctx.fillStyle = '#EF4444'
      ctx.beginPath(); ctx.moveTo(x, y-10); ctx.lineTo(x-5, y); ctx.lineTo(x+5, y); ctx.closePath(); ctx.fill()
      ctx.font = '9px sans-serif'; ctx.fillText(lastClose.toFixed(2), x+8, y-5)
    } else if (sellSignals.length > buySignals.length && lastIdx >= 0) {
      const x = px(lastIdx), y = py(highs[lastIdx] || lastClose) - 5
      ctx.fillStyle = '#22C55E'
      ctx.beginPath(); ctx.moveTo(x, y+10); ctx.lineTo(x-5, y); ctx.lineTo(x+5, y); ctx.closePath(); ctx.fill()
      ctx.font = '9px sans-serif'; ctx.fillText(lastClose.toFixed(2), x+8, y+5)
    }
  }
}

// ==================== Six Ministry Decision Dashboard (3 equal cols) ====================
function DecisionDashboard({ result, loading, pipelineStep, logs }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* Column 1: 智能决策中枢 */}
      <div className="space-y-3">
        <SectionTitle icon={Landmark} title="智能决策中枢" subtitle="CENTRAL HUB" color="#513CC8" />
        <MinistryCard title="中书省 - 策略研究中心" icon={Brain} color="#513CC8" active={pipelineStep >= 2} badge={result ? '真实数据' : null}>
          {result?.zhongshu_sheng ? (
            <div className="space-y-2">
              <p className="text-[10px] text-gray-500">职能: 策略生成 & 信号整合</p>
              <p className="text-[10px] text-gray-700">策略: {result.zhongshu_sheng.signals?.length}个 · 共识: <b className={result.zhongshu_sheng.consensus==='buy'?'text-red-500':result.zhongshu_sheng.consensus==='sell'?'text-green-500':'text-amber-500'}>{result.zhongshu_sheng.consensus==='buy'?'买入':result.zhongshu_sheng.consensus==='sell'?'卖出':'持有'}</b></p>
              <div className="flex gap-2 text-[10px]">
                <span className="text-red-500">买入:{result.zhongshu_sheng.buy_count}</span>
                <span className="text-green-500">卖出:{result.zhongshu_sheng.sell_count}</span>
                <span className="text-amber-500">持有:{result.zhongshu_sheng.hold_count}</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">&gt; 信号生成完成</div>
            </div>
          ) : <p className="text-[10px] text-gray-400">{loading ? '> 等待分析...' : '> 等待启动'}</p>}
        </MinistryCard>

        <MinistryCard title="门下省 - 风控审核中心" icon={Shield} color="#F59E0B" active={pipelineStep >= 3} badge={result?.menxia_sheng?.approved ? '真实数据' : null}>
          {result?.menxia_sheng ? (
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-500">职能: 风险评估 & 决策过滤</p>
              <p className="text-[10px] text-gray-700">止损 {result.menxia_sheng.stop_loss?.toFixed(2)} · 止盈 {result.menxia_sheng.take_profit?.toFixed(2)}</p>
              {result.menxia_sheng.risk_warnings?.map((w,i) => (
                <p key={i} className="text-[10px] text-amber-600 flex items-center gap-1"><AlertTriangle size={9}/>{w}</p>
              ))}
              <div className="text-[10px] text-gray-400">&gt; 审核{result.menxia_sheng.approved?'通过':'拒绝'}</div>
            </div>
          ) : <p className="text-[10px] text-gray-400">{loading ? '> 审核中...' : '> 等待上游'}</p>}
        </MinistryCard>

        <MinistryCard title="尚书省 - 指令执行中心" icon={Gavel} color="#EF4444" active={pipelineStep >= 4} badge={result?.shangshu_sheng ? '真实数据' : null}>
          {result?.shangshu_sheng ? (
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-500">职能: 指令调度与执行</p>
              <p className="text-[10px] text-gray-700">执行: <b>{result.shangshu_sheng.action==='buy'?'买入':result.shangshu_sheng.action==='sell'?'卖出':'持有'}</b> · 仓位: {result.shangshu_sheng.position_size}% · 模式: backtest</p>
              <p className="text-[10px] text-gray-500">{result.shangshu_sheng.execution}</p>
              <div className="text-[10px] text-gray-400">&gt; 成交 ...</div>
            </div>
          ) : <p className="text-[10px] text-gray-400">{loading ? '> 执行中...' : '> 等待风控'}</p>}
        </MinistryCard>
      </div>

      {/* Column 2: 核心执行模块 */}
      <div className="space-y-3">
        <SectionTitle icon={Activity} title="核心执行模块" subtitle="CORE EXECUTION" color="#10B981" />
        
        <MiniMinistry title="吏部 - 资金部" icon={Layers} color="#3B82F6" badge="运行中">
          <div className="text-[10px] text-gray-500">仓位管理 & 资金分配</div>
          {result && <div className="text-xs text-gray-800 mt-1">建议仓位: <b className="text-[#513CC8]">{result.menxia_sheng?.max_position || 0}%</b></div>}
        </MiniMinistry>

        <MiniMinistry title="户部 - 交易部" icon={Target} color="#10B981" badge={result?.shangshu_sheng?.action === 'buy' ? '交易信号' : null}>
          {result ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">交易方向</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${result.shangshu_sheng?.action==='buy'?'bg-red-50 text-red-600':'bg-green-50 text-green-600'}`}>
                  {result.shangshu_sheng?.action==='buy'?'买入':'卖出/观望'}
                </span>
              </div>
              <div className="text-[10px] text-gray-500">入场: {result.shangshu_sheng?.entry_price?.toFixed(2)}</div>
            </div>
          ) : <div className="text-[10px] text-gray-400">等待信号</div>}
        </MiniMinistry>

        <MiniMinistry title="礼部 - 合规部" icon={BookOpen} color="#8B5CF6" badge="监测">
          <div className="text-[10px] text-gray-500">市场温度 & 合规检查</div>
          {result?.crown_prince && (
            <div className="text-[10px] text-gray-600 mt-1">
              ST: {result.crown_prince.is_st?'是':'否'} · 涨停: {result.crown_prince.is_limit_up?'是':'否'}
            </div>
          )}
        </MiniMinistry>

        <MiniMinistry title="刑部 - 风控部" icon={Shield} color="#EF4444" badge="风控">
          {result?.menxia_sheng ? (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">风险评分</span>
                <span className={result.menxia_sheng.risk_score>70?'text-red-500':result.menxia_sheng.risk_score<30?'text-green-500':'text-amber-500'}>
                  {result.menxia_sheng.risk_score?.toFixed(0)}/100
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${result.menxia_sheng.risk_score>70?'bg-red-500':result.menxia_sheng.risk_score<30?'bg-green-500':'bg-amber-500'}`}
                  style={{width:`${result.menxia_sheng.risk_score}%`}}/>
              </div>
            </div>
          ) : <div className="text-[10px] text-gray-400">等待数据</div>}
        </MiniMinistry>

        <MiniMinistry title="兵部 - 操盘部" icon={Radio} color="#F97316" badge={result?.suggestion==='buy'?'买入信号':null}>
          {result ? (
            <div className="text-[10px] text-gray-700">
              最终建议: <b className={result.suggestion==='buy'?'text-red-500':result.suggestion==='sell'?'text-green-500':'text-amber-500'}>
                {result.suggestion==='buy'?'买入':result.suggestion==='sell'?'卖出':'观望'}
              </b> · 信心度: <b className="text-[#513CC8]">{result.confidence}%</b>
            </div>
          ) : <div className="text-[10px] text-gray-400">等待信号</div>}
        </MiniMinistry>

        <MiniMinistry title="工部 - 数据部" icon={BarChart3} color="#0891B2" badge="在线">
          <div className="text-[10px] text-gray-500">数据采集 & 指标计算</div>
          {result && <div className="text-[10px] text-gray-600 mt-1">数据源: {result.data_source || 'system'} · K线已加载</div>}
        </MiniMinistry>
      </div>

      {/* Column 3: 系统运行日志 */}
      <div className="space-y-3">
        <SectionTitle icon={Clock} title="系统运行日志" subtitle="SYSTEM LOGS" color="#6B7280" />
        
        {/* Strategy description */}
        {result && (
          <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <div className="text-[10px] text-gray-500 mb-1">当前策略文字说明</div>
            <div className="text-xs text-gray-800 font-bold mb-1">全部策略总览</div>
            <div className="text-[10px] text-gray-600 leading-relaxed">
              {result.ai_insights ? result.ai_insights.slice(0, 200) + '...' : `分析: ${result.code} 建议${result.suggestion} 信心${result.confidence}%`}
            </div>
            {result.shangshu_sheng && (
              <div className="mt-2 text-[10px] text-gray-500 border-t border-gray-100 pt-2">
                建议仓位: {result.shangshu_sheng.position_size}% · 入场: {result.shangshu_sheng.entry_price?.toFixed(2)} · {result.shangshu_sheng.time_horizon}
              </div>
            )}
          </div>
        )}

        {/* Real-time logs */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-[380px] overflow-y-auto shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-gray-500">实时指令流</div>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
              <span className="text-[9px] text-gray-400">运行</span>
            </div>
          </div>
          <div className="space-y-1 font-mono">
            {logs.length === 0 ? (
              <p className="text-[10px] text-gray-400">等待操作...</p>
            ) : logs.map((log, i) => (
              <div key={i} className="text-[10px] flex gap-2">
                <span className="text-gray-400 flex-shrink-0">[{log.ts}]</span>
                <span className={
                  log.type==='error'?'text-red-500':
                  log.type==='success'?'text-green-500':
                  log.type==='system'?'text-[#513CC8]':'text-gray-600'
                }>{log.type==='system'?'系统':log.type==='error'?'错误':log.type==='success'?'完成':'信息'}: {log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== Evolution Panel ====================
function EvolutionPanel({ result, evolving, strategies, logs }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* Left: Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-[#513CC8]"/>
          <span className="text-sm font-bold text-gray-800">Evolution 策略进化看板</span>
        </div>
        <div className="text-[10px] text-gray-500">策略进化运行看板（起点配置/过程日志/结果摘要）</div>

        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="text-[10px] text-gray-500 font-medium">运行配置</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div><span className="text-gray-500">间隔(s):</span> <span className="text-gray-800">1</span></div>
            <div><span className="text-gray-500">最大轮数:</span> <span className="text-gray-800">3</span></div>
          </div>
          <div className="text-[10px] text-gray-500 font-medium mt-2">起点策略</div>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {strategies.slice(0, 8).map(s => (
              <div key={s.id} className="text-[10px] text-gray-600 px-2 py-1 rounded bg-gray-50 border border-gray-100">
                [{s.id}] {s.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle: Progress & Results */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-sm">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            状态: {evolving ? '运行中' : result ? '已完成' : '待启动'} · 进度 {result ? '100%' : evolving ? '...' : '0%'}
          </span>
          {result && <span className="text-[10px] text-green-500">数据状态: 正常</span>}
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{width: result ? '100%' : evolving ? '60%' : '0%', background: '#513CC8'}}/>
        </div>

        {result && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                {l:'当前轮次',v:`${result.current_round}/${result.max_rounds}`},
                {l:'最佳评分',v:result.best_score?.toFixed(2), color:'text-green-500'},
                {l:'最佳策略',v:result.best_strategy},
              ].map((item,i) => (
                <div key={i} className="text-center p-2 rounded bg-gray-50 border border-gray-100">
                  <div className="text-[9px] text-gray-500">{item.l}</div>
                  <div className={`text-xs font-bold ${item.color||'text-gray-800'} truncate`}>{item.v}</div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="text-[10px] text-gray-500 mb-1">进化结论摘要</div>
              <p className="text-[10px] text-gray-700 leading-relaxed">{result.summary}</p>
            </div>

            {/* Rounds table */}
            <div className="max-h-40 overflow-y-auto">
              <div className="text-[10px] text-gray-500 mb-1">进化记录</div>
              {result.rounds?.map((r, i) => (
                <div key={i} className={`flex items-center justify-between py-1 px-2 rounded mb-0.5 text-[10px] ${r.status==='pass'?'bg-green-50':'bg-red-50'}`}>
                  <span className="text-gray-700">#{r.round} {r.strategy_name}</span>
                  <div className="flex items-center gap-2">
                    <span className={r.status==='pass'?'text-green-600':'text-red-500'}>{r.status==='pass'?'通过':'驳回'}</span>
                    <span className="text-gray-500">{r.score?.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!result && !evolving && (
          <div className="text-center py-6">
            <Zap size={28} className="mx-auto mb-2 text-gray-300"/>
            <p className="text-[10px] text-gray-400">点击"启动进化"开始策略演化</p>
          </div>
        )}
      </div>

      {/* Right: Logs */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="text-[10px] text-gray-500 mb-2">进化日志</div>
        <div className="space-y-1 font-mono max-h-[400px] overflow-y-auto">
          {logs.filter(l => l.type !== 'info' || l.msg.includes('进化')).length === 0 ? (
            <p className="text-[10px] text-gray-400">等待启动...</p>
          ) : logs.map((log, i) => (
            <div key={i} className="text-[10px]">
              <span className="text-gray-400">[{log.ts}]</span>{' '}
              <span className={log.type==='error'?'text-red-500':log.type==='success'?'text-green-500':'text-[#513CC8]'}>
                {log.msg}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==================== UI Components ====================
function SectionTitle({ icon: Icon, title, subtitle, color }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} style={{color}}/>
      <span className="text-xs font-bold text-gray-800">{title}</span>
      <span className="text-[9px] text-gray-400">({subtitle})</span>
    </div>
  )
}

function MinistryCard({ title, icon: Icon, color, active, badge, children }) {
  return (
    <div className={`bg-white rounded-lg border p-3 transition-all shadow-sm ${active ? 'border-['+color+']/30 shadow-md' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={13} style={{color}}/>
          <span className="text-xs font-bold text-gray-800">{title}</span>
        </div>
        {badge && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F0EDFA] text-[#513CC8] border border-[#513CC8]/20">{badge}</span>}
      </div>
      {children}
    </div>
  )
}

function MiniMinistry({ title, icon: Icon, color, badge, children }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon size={11} style={{color}}/>
          <span className="text-[10px] font-bold text-gray-700">{title}</span>
        </div>
        {badge && <span className="text-[8px] px-1 py-0.5 rounded bg-red-50 text-red-500 border border-red-100">{badge}</span>}
      </div>
      {children}
    </div>
  )
}
