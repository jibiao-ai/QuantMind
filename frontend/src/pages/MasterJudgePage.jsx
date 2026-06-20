import { useState, useEffect } from 'react'
import { masterJudgeAnalyze } from '../services/api'
import { 
  Search, Loader2, Lightbulb, TrendingUp, TrendingDown, Minus,
  Clock, BarChart3, Shield, Zap, Users, Activity, Target, History, X
} from 'lucide-react'
import toast from 'react-hot-toast'

// ==================== 65位投资大师数据 ====================
const MASTERS = [
  { id: 1, name: '巴菲特', school: 'A', style: '价值投资', emoji: '🧓' },
  { id: 2, name: '芒格', school: 'A', style: '逆向思维', emoji: '👴' },
  { id: 3, name: '格雷厄姆', school: 'A', style: '安全边际', emoji: '🎩' },
  { id: 4, name: '费雪', school: 'A', style: '成长价值', emoji: '🧔' },
  { id: 5, name: '邓普顿', school: 'A', style: '全球价值', emoji: '👨‍🏫' },
  { id: 6, name: '施洛斯', school: 'A', style: '低估值猎手', emoji: '🕵️' },
  { id: 7, name: 'Andreessen', school: 'B', style: 'VC/科技', emoji: '👨‍💻' },
  { id: 8, name: 'Gurley', school: 'B', style: '成长期投资', emoji: '🧑‍💼' },
  { id: 9, name: 'Naval', school: 'B', style: '天使投资', emoji: '🧘' },
  { id: 10, name: '孙正义', school: 'B', style: '科技愿景', emoji: '🤵' },
  { id: 11, name: 'Peter Thiel', school: 'B', style: '垄断创新', emoji: '🧑‍🔬' },
  { id: 12, name: '张磊', school: 'B', style: '长期结构性', emoji: '👨‍🎓' },
  { id: 13, name: 'Gerstner', school: 'B', style: '成长期', emoji: '👔' },
  { id: 14, name: 'Chamath', school: 'B', style: '科技赋能', emoji: '🎯' },
  { id: 15, name: '徐新', school: 'B', style: '消费科技', emoji: '👩‍💼' },
  { id: 16, name: '索罗斯', school: 'C', style: '宏观对冲', emoji: '🦊' },
  { id: 17, name: '达里奥', school: 'C', style: '全天候', emoji: '🌊' },
  { id: 18, name: '西蒙斯', school: 'C', style: '量化交易', emoji: '🧮' },
  { id: 19, name: 'Ackman', school: 'C', style: '激进对冲', emoji: '🦅' },
  { id: 20, name: 'Einhorn', school: 'C', style: '价值对冲', emoji: '🎲' },
  { id: 21, name: 'Burry', school: 'C', style: '逆向深度', emoji: '🔮' },
  { id: 22, name: 'Chanos', school: 'C', style: '做空专家', emoji: '🐻' },
  { id: 23, name: '利弗莫尔', school: 'D', style: '趋势投机', emoji: '🎰' },
  { id: 24, name: '奥尼尔', school: 'D', style: 'CANSLIM', emoji: '📈' },
  { id: 25, name: '温斯坦', school: 'D', style: '阶段分析', emoji: '📊' },
  { id: 26, name: '米勒', school: 'D', style: '动量价值', emoji: '⚡' },
  { id: 27, name: '格罗斯', school: 'E', style: '债券之王', emoji: '👑' },
  { id: 28, name: '冈拉克', school: 'E', style: '利率博弈', emoji: '🎯' },
  { id: 29, name: '德鲁肯米勒', school: 'E', style: '宏观择时', emoji: '⏰' },
  { id: 30, name: '罗杰斯', school: 'E', style: '商品/宏观', emoji: '🌍' },
  { id: 31, name: '鲍尔森', school: 'E', style: '事件驱动', emoji: '💣' },
  { id: 32, name: 'Tudor Jones', school: 'E', style: '宏观动量', emoji: '🏇' },
  { id: 33, name: '刘煜辉', school: 'E', style: '中国宏观', emoji: '🏯' },
  { id: 34, name: '林园', school: 'F', style: '消费龙头', emoji: '🍷' },
  { id: 35, name: '但斌', school: 'F', style: '茅台派', emoji: '🥃' },
  { id: 36, name: '段永平', school: 'F', style: '好公司好价格', emoji: '🎮' },
  { id: 37, name: '冯柳', school: 'F', style: '逆向困境', emoji: '🧗' },
  { id: 38, name: '张坤', school: 'F', style: '消费核心', emoji: '🛒' },
  { id: 39, name: '葛卫东', school: 'F', style: '期货/股票', emoji: '🐲' },
  { id: 40, name: '徐翔', school: 'F', style: '短线游资', emoji: '⚔️' },
  { id: 41, name: '赵丹阳', school: 'F', style: '价值成长', emoji: '🌱' },
  { id: 42, name: '邱国鹭', school: 'F', style: '行业轮动', emoji: '🔄' },
  { id: 43, name: '董承非', school: 'F', style: '均衡配置', emoji: '⚖️' },
  { id: 44, name: '谢治宇', school: 'F', style: '成长优选', emoji: '💎' },
  { id: 45, name: '朱少醒', school: 'F', style: '长期成长', emoji: '🌳' },
  { id: 46, name: '刘格菘', school: 'F', style: '科技成长', emoji: '🚀' },
  { id: 47, name: '蔡嵩松', school: 'F', style: '半导体', emoji: '💡' },
  { id: 48, name: '丘栋荣', school: 'F', style: '低估值策略', emoji: '🔍' },
  { id: 49, name: '傅鹏博', school: 'F', style: '均衡成长', emoji: '🌈' },
  { id: 50, name: '曹名长', school: 'F', style: '深度价值', emoji: '⛏️' },
  { id: 51, name: '萧楠', school: 'F', style: '消费深耕', emoji: '🍜' },
  { id: 52, name: '周蔚文', school: 'F', style: '周期成长', emoji: '🔁' },
  { id: 53, name: '陈光明', school: 'F', style: '价值发现', emoji: '🔦' },
  { id: 54, name: '裘国根', school: 'F', style: '价值投机', emoji: '🎪' },
  { id: 55, name: '王亚伟', school: 'F', style: '事件驱动', emoji: '🎆' },
  { id: 56, name: '吕俊', school: 'F', style: '宏观配置', emoji: '🗺️' },
  { id: 57, name: '林鹏', school: 'F', style: '基本面动量', emoji: '🦁' },
  { id: 58, name: 'Cliff Asness', school: 'G', style: 'AQR因子', emoji: '🧬' },
  { id: 59, name: 'DeLong', school: 'G', style: '行为因子', emoji: '🧠' },
  { id: 60, name: '蔡向阳', school: 'G', style: '量化多因子', emoji: '📐' },
  { id: 61, name: '刘钊', school: 'G', style: '统计套利', emoji: '📉' },
  { id: 62, name: '黄仁勋', school: 'H', style: 'AI芯片', emoji: '🤖' },
  { id: 63, name: '马斯克', school: 'H', style: '颠覆创新', emoji: '🚀' },
  { id: 64, name: 'Sam Altman', school: 'H', style: 'AI平台', emoji: '🤯' },
  { id: 65, name: 'Saylor', school: 'H', style: '数字资产', emoji: '₿' },
]

// ==================== 卡通大师头像组件 ====================
function MasterAvatar({ master, verdict, size = 'sm' }) {
  const borderColors = {
    bullish: 'border-red-400 shadow-red-200',
    bearish: 'border-green-400 shadow-green-200',
    neutral: 'border-gray-300 shadow-gray-100',
    null: 'border-gray-200',
  }
  const bgColors = {
    bullish: 'bg-red-50',
    bearish: 'bg-green-50',
    neutral: 'bg-gray-50',
    null: 'bg-gray-50',
  }
  const sizeClass = size === 'lg' ? 'w-10 h-10 text-lg' : 'w-7 h-7 text-sm'
  
  return (
    <div className="flex flex-col items-center gap-0.5 group" title={`${master.name} - ${master.style}`}>
      <div className={`${sizeClass} rounded-xl border-2 ${borderColors[verdict] || borderColors.null} ${bgColors[verdict] || bgColors.null} flex items-center justify-center transition-all duration-300 ${verdict ? 'shadow-md scale-105' : ''}`}>
        <span className={size === 'lg' ? 'text-base' : 'text-xs'}>{master.emoji}</span>
      </div>
      <span className="text-[7px] md:text-[8px] text-gray-500 text-center leading-tight truncate w-full max-w-[36px]">
        {master.name.length > 4 ? master.name.slice(0, 3) + '..' : master.name}
      </span>
    </div>
  )
}

// ==================== 雷达图SVG ====================
function RadarChart({ dimensions }) {
  if (!dimensions || dimensions.length === 0) return null
  const cx = 80, cy = 80, r = 55
  const n = dimensions.length
  const points = dimensions.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const val = (d.score / 100) * r
    return { x: cx + val * Math.cos(angle), y: cy + val * Math.sin(angle) }
  })
  const polygon = points.map(p => `${p.x},${p.y}`).join(' ')
  const outerPoints = dimensions.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full">
      {[0.33, 0.66, 1].map(scale => (
        <polygon key={scale} fill="none" stroke="#E5E7EB" strokeWidth="0.5"
          points={outerPoints.map(p => `${cx + (p.x - cx) * scale},${cy + (p.y - cy) * scale}`).join(' ')} />
      ))}
      {outerPoints.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="0.5" />
      ))}
      <polygon fill="rgba(81,60,200,0.15)" stroke="#513CC8" strokeWidth="1.5" points={polygon} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#513CC8" />
      ))}
      {dimensions.map((d, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2
        const lx = cx + (r + 14) * Math.cos(angle)
        const ly = cy + (r + 14) * Math.sin(angle)
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            className="text-[7px] fill-gray-500">{d.name}{d.score}</text>
        )
      })}
    </svg>
  )
}

// ==================== 研判过程步骤组件 ====================
function AnalysisSteps({ steps, currentStep }) {
  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const isActive = i === currentStep
        const isDone = i < currentStep
        return (
          <div key={i} className={`flex items-start gap-2.5 p-2 rounded-lg transition-all duration-300 ${isActive ? 'bg-[#F0EDFA] border border-[#513CC8]/20' : isDone ? 'bg-gray-50' : ''}`}>
            <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
              isDone ? 'bg-[#513CC8] text-white' : isActive ? 'bg-[#513CC8]/20 text-[#513CC8] animate-pulse' : 'bg-gray-200 text-gray-400'
            }`}>
              {isDone ? '✓' : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${isActive ? 'text-[#513CC8]' : isDone ? 'text-gray-700' : 'text-gray-400'}`}>{step.title}</span>
                {isActive && <Loader2 size={10} className="animate-spin text-[#513CC8]" />}
              </div>
              {(isDone || isActive) && step.detail && (
                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{step.detail}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ==================== 历史记录卡片 ====================
function HistoryCard({ record, onClick }) {
  const scoreColor = record.overall_score >= 65 ? 'text-red-500' : record.overall_score >= 45 ? 'text-amber-500' : 'text-green-500'
  const verdictBg = record.verdict === '看多' ? 'bg-red-50 text-red-600' : record.verdict === '看空' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
  return (
    <div onClick={onClick} className="flex-shrink-0 w-36 p-2.5 rounded-xl border border-gray-100 bg-white hover:border-[#513CC8]/30 hover:shadow-md cursor-pointer transition-all group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-800 truncate">{record.stock_name || record.code}</span>
        <span className={`text-xs font-bold ${scoreColor}`}>{record.overall_score}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{record.code}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${verdictBg}`}>{record.verdict}</span>
      </div>
      <div className="text-[9px] text-gray-400 mt-1">{record.time}</div>
    </div>
  )
}

// ==================== 主组件 ====================
export default function MasterJudgePage() {
  const [stockCode, setStockCode] = useState('')
  const [stockName, setStockName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(-1)
  const [steps, setSteps] = useState([])
  const [result, setResult] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [verdicts, setVerdicts] = useState({})
  const [history, setHistory] = useState([])
  const [stockInfo, setStockInfo] = useState(null)

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('master_judge_history')
      if (saved) setHistory(JSON.parse(saved))
    } catch (e) {}
  }, [])

  const saveHistory = (record) => {
    const newHistory = [record, ...history.filter(h => h.code !== record.code)].slice(0, 20)
    setHistory(newHistory)
    localStorage.setItem('master_judge_history', JSON.stringify(newHistory))
  }

  const loadHistory = (record) => {
    setStockCode(record.code)
    setResult(record)
    setStockName(record.stock_name || record.code)
    setStockInfo(record.stockInfo || null)
    // Rebuild verdicts from counts
    const bullCount = record.bull_count || 30
    const bearCount = record.bear_count || 20
    const shuffled = [...MASTERS].sort(() => 0.5 - Math.random())
    const newVerdicts = {}
    let b = 0, br = 0
    shuffled.forEach(m => {
      if (b < bullCount) { newVerdicts[m.id] = 'bullish'; b++ }
      else if (br < bearCount) { newVerdicts[m.id] = 'bearish'; br++ }
      else { newVerdicts[m.id] = 'neutral' }
    })
    setVerdicts(newVerdicts)
  }

  // Main analysis function
  const runAnalysis = async () => {
    const code = stockCode.replace(/\D/g, '')
    if (!code || code.length !== 6) {
      toast.error('请输入6位股票代码')
      return
    }

    setAnalyzing(true)
    setProgress(0)
    setTimeline([])
    setVerdicts({})
    setResult(null)
    setStockInfo(null)
    setCurrentStep(0)

    const analysisSteps = [
      { title: '数据采集', detail: `正在获取 ${code} 的实时行情、K线数据...` },
      { title: 'AI模型调用', detail: '调用DeepSeek大模型进行多维度深度分析...' },
      { title: '8维度评估', detail: '估值/趋势/资金/基本面/情绪/技术/行业/风险...' },
      { title: '大师评审', detail: '65位投资大师基于各自流派进行独立判断...' },
      { title: '汇总结论', detail: '计算综合评分、生成核心结论和投资建议...' },
    ]
    setSteps(analysisSteps)

    const addTimeline = (event) => setTimeline(prev => [...prev, event])

    try {
      // Step 1: Data collection
      addTimeline({ time: '00:00', phase: '数据采集', type: 'info', content: `开始采集 ${code} 市场数据...` })
      setProgress(10)
      await new Promise(r => setTimeout(r, 400))

      // Step 2: AI analysis
      setCurrentStep(1)
      setProgress(20)
      addTimeline({ time: '00:02', phase: 'AI模型调用', type: 'info', content: '向服务器发起AI研判请求...' })

      const res = await masterJudgeAnalyze({ code })
      const analysisResult = res?.data?.data || res?.data

      if (!analysisResult || analysisResult.code === -1) {
        throw new Error(analysisResult?.message || 'AI分析请求失败')
      }

      // Step 3: Dimensions
      setCurrentStep(2)
      setProgress(50)
      setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, detail: `AI模型分析完成，综合评分 ${analysisResult.overall_score}/100` } : s))
      addTimeline({ time: '00:10', phase: '维度评估', type: analysisResult.verdict === '看多' ? 'bullish' : analysisResult.verdict === '看空' ? 'bearish' : 'neutral',
        content: `8维度评估完成：综合评分 ${analysisResult.overall_score}/100` })
      await new Promise(r => setTimeout(r, 300))

      // Step 4: Master voting
      setCurrentStep(3)
      setProgress(60)
      addTimeline({ time: '00:12', phase: '评审投票', type: 'info', content: '65位投资大师开始逐一亮灯...' })

      const bullCount = analysisResult.bull_count || 30
      const bearCount = analysisResult.bear_count || 20
      const neutralCount = 65 - bullCount - bearCount

      const shuffled = [...MASTERS].sort(() => Math.random() - 0.5)
      let bulls = 0, bears = 0
      
      for (let i = 0; i < shuffled.length; i++) {
        let v
        if (bulls < bullCount && (bears >= bearCount || Math.random() < bullCount / 65)) {
          v = 'bullish'; bulls++
        } else if (bears < bearCount) {
          v = 'bearish'; bears++
        } else {
          v = 'neutral'
        }
        setVerdicts(prev => ({ ...prev, [shuffled[i].id]: v }))
        setProgress(60 + Math.floor((i / 65) * 30))
        await new Promise(r => setTimeout(r, 40))
      }

      addTimeline({ time: '00:20', phase: '投票完成', type: 'info', 
        content: `看多 ${bullCount} / 看空 ${bearCount} / 中性 ${neutralCount}` })

      // Step 5: Final
      setCurrentStep(4)
      setProgress(95)
      await new Promise(r => setTimeout(r, 300))

      setProgress(100)
      setCurrentStep(5)
      setResult(analysisResult)
      if (analysisResult.stock_name) setStockName(analysisResult.stock_name)
      
      // Save stock info for display
      const info = {
        name: analysisResult.stock_name || code,
        code: code,
        price: analysisResult.target_price?.base || '—',
        verdict: analysisResult.verdict,
      }
      setStockInfo(info)

      addTimeline({ time: '00:22', phase: '最终结论', type: analysisResult.verdict === '看多' ? 'bullish' : 'bearish',
        content: analysisResult.core_conclusion })

      // Save to history
      saveHistory({
        code,
        stock_name: analysisResult.stock_name || code,
        overall_score: analysisResult.overall_score,
        verdict: analysisResult.verdict,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        ...analysisResult,
        stockInfo: info,
      })

    } catch (err) {
      console.error('Analysis failed:', err)
      const errMsg = err?.response?.data?.message || err.message || '分析失败，请检查AI配置'
      toast.error(errMsg)
      addTimeline({ time: '—', phase: '错误', type: 'neutral', content: errMsg })
    }
    setAnalyzing(false)
  }

  // Group masters by verdict for result display
  const bullMasters = MASTERS.filter(m => verdicts[m.id] === 'bullish')
  const bearMasters = MASTERS.filter(m => verdicts[m.id] === 'bearish')
  const neutralMasters = MASTERS.filter(m => verdicts[m.id] === 'neutral')

  return (
    <div className="p-2 md:p-3 space-y-2 md:space-y-3" style={{ background: '#F8F9FC' }}>
      {/* Header + Search */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base md:text-xl font-bold gradient-text">大师研判</h1>
          <p className="text-[9px] md:text-[10px] text-gray-400">65位投资大师 · AI多维度深度分析</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={stockCode} onChange={e => setStockCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runAnalysis()}
              placeholder="输入股票代码" disabled={analyzing}
              className="pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-[#513CC8] focus:ring-1 focus:ring-[#513CC8]/20 focus:outline-none w-32 md:w-40" />
          </div>
          <button onClick={runAnalysis} disabled={analyzing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1 hover:shadow-lg transition disabled:opacity-60"
            style={{ background: '#513CC8' }}>
            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
            {analyzing ? '分析中' : '研判'}
          </button>
        </div>
      </div>

      {/* History Cards Row */}
      {history.length > 0 && !analyzing && !result && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <History size={12} className="text-gray-400" />
            <span className="text-[10px] text-gray-400 font-medium">历史记录</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {history.map((record, i) => (
              <HistoryCard key={i} record={record} onClick={() => loadHistory(record)} />
            ))}
          </div>
        </div>
      )}

      {/* Analysis Progress - Detailed Steps */}
      {analyzing && (
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">研判进行中</span>
            <span className="text-xs font-bold" style={{ color: '#513CC8' }}>{progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #513CC8, #6B5AD5)' }} />
          </div>
          <AnalysisSteps steps={steps} currentStep={currentStep} />
        </div>
      )}

      {/* ==================== RESULT SECTION (one screen) ==================== */}
      {result && (
        <div className="space-y-2">
          {/* TOP: Stock Basic Info Bar */}
          <div className="glass-card p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-sm md:text-base font-bold text-gray-800">{result.stock_name || stockCode}</span>
                <span className="text-[10px] text-gray-400 ml-2">{stockCode}</span>
              </div>
              {result.target_price && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-500">基准价 <b className="text-gray-800">{result.target_price.base || '—'}</b></span>
                  <span className="text-red-500">乐观 {result.target_price.bull || '—'}</span>
                  <span className="text-green-500">悲观 {result.target_price.bear || '—'}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                result.verdict === '看多' ? 'bg-red-50 text-red-600' : result.verdict === '看空' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {result.verdict === '看多' ? '🔴 看多' : result.verdict === '看空' ? '🟢 看空' : '⚪ 中性'}
              </div>
              <div className="text-center">
                <span className="text-lg font-bold" style={{ color: '#513CC8' }}>{result.overall_score}</span>
                <span className="text-[9px] text-gray-400">/100</span>
              </div>
              <button onClick={() => { setResult(null); setVerdicts({}); setTimeline([]) }}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* MIDDLE: Analysis Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            {/* Radar + Dimension Scores */}
            <div className="col-span-1 md:col-span-3 glass-card p-2.5">
              <h4 className="text-[10px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                <BarChart3 size={11} style={{ color: '#513CC8' }} /> 多维度分析
              </h4>
              <div className="w-full max-w-[140px] mx-auto aspect-square">
                <RadarChart dimensions={result.dimensions || []} />
              </div>
              <div className="space-y-1 mt-1">
                {(result.dimensions || []).map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[8px] text-gray-500 w-7 text-right">{d.name}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: d.score >= 70 ? '#EF4444' : d.score >= 50 ? '#F59E0B' : '#22C55E' }} />
                    </div>
                    <span className="text-[8px] font-bold text-gray-500 w-4">{d.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment + Ring Charts */}
            <div className="col-span-1 md:col-span-3 glass-card p-2.5">
              <h4 className="text-[10px] font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <Activity size={11} style={{ color: '#513CC8' }} /> 情绪温度
              </h4>
              <div className="flex justify-around items-center mb-2">
                {[
                  { label: '情绪', score: result.dimensions?.find(d => d.name === '情绪')?.score || 50 },
                  { label: '资金', score: result.dimensions?.find(d => d.name === '资金')?.score || 50 },
                  { label: '风险', score: result.dimensions?.find(d => d.name === '风险')?.score || 50 },
                ].map((t, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-5 h-16 rounded-full border border-gray-200 relative overflow-hidden bg-gray-50">
                      <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-1000"
                        style={{ height: `${t.score}%`, background: t.score >= 70 ? '#EF4444' : t.score >= 40 ? '#F59E0B' : '#22C55E' }} />
                    </div>
                    <span className="text-[8px] font-bold mt-0.5" style={{ color: t.score >= 70 ? '#EF4444' : t.score >= 40 ? '#F59E0B' : '#22C55E' }}>{t.score}</span>
                    <span className="text-[7px] text-gray-400">{t.label}</span>
                  </div>
                ))}
              </div>
              {/* Vote summary rings */}
              <div className="flex justify-around items-center pt-2 border-t border-gray-100">
                {[
                  { value: result.bull_count || 0, label: '看多', color: '#EF4444' },
                  { value: result.bear_count || 0, label: '看空', color: '#22C55E' },
                  { value: result.confidence || 0, label: '置信度', color: '#513CC8' },
                ].map((r, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <svg viewBox="0 0 40 40" className="w-9 h-9">
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                      <circle cx="20" cy="20" r="16" fill="none" stroke={r.color} strokeWidth="3"
                        strokeDasharray={`${(r.value / (i === 2 ? 100 : 65)) * 100.5} 100.5`}
                        strokeLinecap="round" transform="rotate(-90 20 20)" />
                      <text x="20" y="20" textAnchor="middle" dominantBaseline="middle"
                        className="text-[8px] font-bold" fill={r.color}>{r.value}</text>
                    </svg>
                    <span className="text-[7px] text-gray-400">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="col-span-1 md:col-span-3 glass-card p-2.5">
              <h4 className="text-[10px] font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <Clock size={11} style={{ color: '#513CC8' }} /> 决议过程
              </h4>
              <div className="relative pl-4 space-y-1.5 max-h-48 overflow-y-auto">
                <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-gradient-to-b from-[#513CC8] to-gray-200" />
                {timeline.map((event, i) => (
                  <div key={i} className="relative flex items-start gap-2">
                    <div className={`absolute -left-2.5 w-2 h-2 rounded-full border border-white ${
                      event.type === 'bullish' ? 'bg-red-500' : event.type === 'bearish' ? 'bg-green-500' :
                      event.type === 'info' ? 'bg-[#513CC8]' : 'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] text-gray-400 font-mono">{event.time}</span>
                      <span className="text-[8px] font-medium text-gray-600 ml-1">{event.phase}</span>
                      <p className="text-[9px] text-gray-600 leading-tight">{event.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risks + Catalysts */}
            <div className="col-span-1 md:col-span-3 glass-card p-2.5">
              <div className="space-y-2">
                <div>
                  <h4 className="text-[10px] font-semibold text-red-600 mb-1 flex items-center gap-1">
                    <Shield size={10} /> 核心风险
                  </h4>
                  <div className="space-y-1">
                    {(result.key_risks || []).map((risk, i) => (
                      <div key={i} className="flex items-start gap-1.5 p-1.5 rounded bg-red-50/60">
                        <span className="text-[9px] text-red-400 mt-px">⚠</span>
                        <span className="text-[9px] text-gray-700 leading-tight">{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-semibold text-[#513CC8] mb-1 flex items-center gap-1">
                    <Zap size={10} /> 催化剂
                  </h4>
                  <div className="space-y-1">
                    {(result.catalysts || []).map((cat, i) => (
                      <div key={i} className="flex items-start gap-1.5 p-1.5 rounded bg-[#F8F6FF]">
                        <span className="text-[9px] text-[#513CC8] mt-px">★</span>
                        <span className="text-[9px] text-gray-700 leading-tight">{cat}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-1 border-t border-gray-100 flex flex-wrap gap-2">
                  <span className="text-[8px] text-gray-400">周期：<b className="text-gray-600">{result.investment_horizon || '—'}</b></span>
                  <span className="text-[8px] text-gray-400">置信：<b className="text-gray-600">{result.confidence}%</b></span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM: 65 Masters Vote Panel (Left=Bull, Center=Neutral, Right=Bear) */}
          <div className="glass-card p-2.5 md:p-3">
            <h4 className="text-[10px] font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
              <Users size={11} style={{ color: '#513CC8' }} /> 评审席 · 65位投资大师投票结果
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {/* Bullish Column */}
              <div className="rounded-xl p-2 bg-red-50/50 border border-red-100">
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  <TrendingUp size={10} className="text-red-500" />
                  <span className="text-[9px] font-bold text-red-600">看多 {bullMasters.length}</span>
                </div>
                <div className="flex flex-wrap justify-center gap-1">
                  {bullMasters.map(m => (
                    <MasterAvatar key={m.id} master={m} verdict="bullish" />
                  ))}
                </div>
              </div>
              {/* Neutral Column */}
              <div className="rounded-xl p-2 bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  <Minus size={10} className="text-gray-500" />
                  <span className="text-[9px] font-bold text-gray-600">中性 {neutralMasters.length}</span>
                </div>
                <div className="flex flex-wrap justify-center gap-1">
                  {neutralMasters.map(m => (
                    <MasterAvatar key={m.id} master={m} verdict="neutral" />
                  ))}
                </div>
              </div>
              {/* Bearish Column */}
              <div className="rounded-xl p-2 bg-green-50/50 border border-green-100">
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  <TrendingDown size={10} className="text-green-500" />
                  <span className="text-[9px] font-bold text-green-600">看空 {bearMasters.length}</span>
                </div>
                <div className="flex flex-wrap justify-center gap-1">
                  {bearMasters.map(m => (
                    <MasterAvatar key={m.id} master={m} verdict="bearish" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Core Conclusion Footer */}
          <div className="glass-card p-2.5 bg-[#F8F6FF] border border-[#E8E0FF]">
            <p className="text-xs text-gray-700 leading-relaxed text-center font-medium">
              📋 {result.core_conclusion}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!analyzing && !result && (
        <div className="glass-card p-6 md:p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: '#F0EDFA' }}>
            <Lightbulb size={24} style={{ color: '#513CC8' }} />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-1.5">输入股票代码开始研判</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            AI模型模拟65位投资大师，从估值、趋势、资金、基本面、情绪、技术、行业、风险8个维度深度研判
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {['600519', '000858', '300750', '002594'].map(code => (
              <button key={code} onClick={() => setStockCode(code)}
                className="px-2.5 py-1 rounded-lg text-[10px] border border-gray-200 text-gray-500 hover:border-[#513CC8] hover:text-[#513CC8] hover:bg-[#F0EDFA] transition">
                {code}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
