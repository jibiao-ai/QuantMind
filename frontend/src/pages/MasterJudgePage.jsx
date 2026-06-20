import { useState, useEffect, useCallback, useRef } from 'react'
import { getSystemSettings, getDataQuote, getDataKline } from '../services/api'
import { 
  Search, Loader2, RefreshCw, Lightbulb, TrendingUp, TrendingDown, Minus,
  Clock, BarChart3, Shield, Zap, Users, Globe, Activity, Target
} from 'lucide-react'
import toast from 'react-hot-toast'

// ==================== 65位投资大师数据 ====================
const MASTERS = [
  // A组：价值投资 (6)
  { id: 1, name: '巴菲特', school: 'A', style: '价值投资' },
  { id: 2, name: '芒格', school: 'A', style: '逆向思维' },
  { id: 3, name: '格雷厄姆', school: 'A', style: '安全边际' },
  { id: 4, name: '费雪', school: 'A', style: '成长价值' },
  { id: 5, name: '邓普顿', school: 'A', style: '全球价值' },
  { id: 6, name: '施洛斯', school: 'A', style: '低估值猎手' },
  // B组：科技/VC (9)
  { id: 7, name: 'Andreessen', school: 'B', style: 'VC/科技' },
  { id: 8, name: 'Gurley', school: 'B', style: '成长期投资' },
  { id: 9, name: 'Naval', school: 'B', style: '天使投资' },
  { id: 10, name: '孙正义', school: 'B', style: '科技愿景' },
  { id: 11, name: 'Peter Thiel', school: 'B', style: '垄断创新' },
  { id: 12, name: '张磊', school: 'B', style: '长期结构性' },
  { id: 13, name: 'Gerstner', school: 'B', style: '成长期' },
  { id: 14, name: 'Chamath', school: 'B', style: '科技赋能' },
  { id: 15, name: '徐新', school: 'B', style: '消费科技' },
  // C组：对冲/空头 (7)
  { id: 16, name: '索罗斯', school: 'C', style: '宏观对冲' },
  { id: 17, name: '达里奥', school: 'C', style: '全天候' },
  { id: 18, name: '西蒙斯', school: 'C', style: '量化交易' },
  { id: 19, name: 'Ackman', school: 'C', style: '激进对冲' },
  { id: 20, name: 'Einhorn', school: 'C', style: '价值对冲' },
  { id: 21, name: 'Burry', school: 'C', style: '逆向深度' },
  { id: 22, name: 'Chanos', school: 'C', style: '做空专家' },
  // D组：趋势/动量 (4)
  { id: 23, name: '利弗莫尔', school: 'D', style: '趋势投机' },
  { id: 24, name: "奥尼尔", school: 'D', style: 'CANSLIM' },
  { id: 25, name: '温斯坦', school: 'D', style: '阶段分析' },
  { id: 26, name: '米勒', school: 'D', style: '动量价值' },
  // E组：固收/宏观 (7)
  { id: 27, name: '格罗斯', school: 'E', style: '债券之王' },
  { id: 28, name: '冈拉克', school: 'E', style: '利率博弈' },
  { id: 29, name: '德鲁肯米勒', school: 'E', style: '宏观择时' },
  { id: 30, name: '罗杰斯', school: 'E', style: '商品/宏观' },
  { id: 31, name: '鲍尔森', school: 'E', style: '事件驱动' },
  { id: 32, name: 'Tudor Jones', school: 'E', style: '宏观动量' },
  { id: 33, name: '刘煜辉', school: 'E', style: '中国宏观' },
  // F组：A股实战 (24)
  { id: 34, name: '林园', school: 'F', style: '消费龙头' },
  { id: 35, name: '但斌', school: 'F', style: '茅台派' },
  { id: 36, name: '段永平', school: 'F', style: '好公司好价格' },
  { id: 37, name: '冯柳', school: 'F', style: '逆向困境' },
  { id: 38, name: '张坤', school: 'F', style: '消费核心' },
  { id: 39, name: '葛卫东', school: 'F', style: '期货/股票' },
  { id: 40, name: '徐翔', school: 'F', style: '短线游资' },
  { id: 41, name: '赵丹阳', school: 'F', style: '价值成长' },
  { id: 42, name: '邱国鹭', school: 'F', style: '行业轮动' },
  { id: 43, name: '董承非', school: 'F', style: '均衡配置' },
  { id: 44, name: '谢治宇', school: 'F', style: '成长优选' },
  { id: 45, name: '朱少醒', school: 'F', style: '长期成长' },
  { id: 46, name: '刘格菘', school: 'F', style: '科技成长' },
  { id: 47, name: '蔡嵩松', school: 'F', style: '半导体' },
  { id: 48, name: '丘栋荣', school: 'F', style: '低估值策略' },
  { id: 49, name: '傅鹏博', school: 'F', style: '均衡成长' },
  { id: 50, name: '曹名长', school: 'F', style: '深度价值' },
  { id: 51, name: '萧楠', school: 'F', style: '消费深耕' },
  { id: 52, name: '周蔚文', school: 'F', style: '周期成长' },
  { id: 53, name: '陈光明', school: 'F', style: '价值发现' },
  { id: 54, name: '裘国根', school: 'F', style: '价值投机' },
  { id: 55, name: '王亚伟', school: 'F', style: '事件驱动' },
  { id: 56, name: '吕俊', school: 'F', style: '宏观配置' },
  { id: 57, name: '林鹏', school: 'F', style: '基本面动量' },
  // G组：量化/因子 (4)
  { id: 58, name: 'Cliff Asness', school: 'G', style: 'AQR因子' },
  { id: 59, name: 'DeLong', school: 'G', style: '行为因子' },
  { id: 60, name: '蔡向阳', school: 'G', style: '量化多因子' },
  { id: 61, name: '刘钊', school: 'G', style: '统计套利' },
  // H组：AI/科技CEO (4)
  { id: 62, name: '黄仁勋', school: 'H', style: 'AI芯片' },
  { id: 63, name: '马斯克', school: 'H', style: '颠覆创新' },
  { id: 64, name: 'Sam Altman', school: 'H', style: 'AI平台' },
  { id: 65, name: 'Saylor', school: 'H', style: '数字资产' },
]

const SCHOOL_LABELS = {
  A: '价值投资', B: '科技/VC', C: '对冲/空头', D: '趋势/动量',
  E: '固收/宏观', F: 'A股实战', G: '量化/因子', H: 'AI/科技CEO'
}

// ==================== 评审灯组件 ====================
function JuryLamp({ master, verdict }) {
  // verdict: 'bullish'|'bearish'|'neutral'|null
  const colors = {
    bullish: { bg: '#FEE2E2', lamp: '#EF4444', glow: 'rgba(239,68,68,0.4)' },
    bearish: { bg: '#DCFCE7', lamp: '#22C55E', glow: 'rgba(34,197,94,0.4)' },
    neutral: { bg: '#F3F4F6', lamp: '#9CA3AF', glow: 'rgba(156,163,175,0.2)' },
    null: { bg: '#F9FAFB', lamp: '#E5E7EB', glow: 'none' },
  }
  const c = colors[verdict] || colors.null
  
  return (
    <div className="flex flex-col items-center gap-0.5 group" title={`${master.name} - ${master.style}`}>
      <div className="w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center transition-all duration-500"
        style={{ 
          background: c.lamp,
          boxShadow: verdict ? `0 0 8px ${c.glow}` : 'none',
        }}>
        {verdict && <div className="w-2 h-2 rounded-full bg-white/60" />}
      </div>
      <span className="text-[8px] md:text-[9px] text-gray-500 text-center leading-tight truncate w-full max-w-[40px]">
        {master.name}
      </span>
    </div>
  )
}

// ==================== 雷达图SVG ====================
function RadarChart({ dimensions }) {
  const cx = 100, cy = 100, r = 75
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
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Grid */}
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <polygon key={scale} fill="none" stroke="#E5E7EB" strokeWidth="0.5"
          points={outerPoints.map(p => `${cx + (p.x - cx) * scale},${cy + (p.y - cy) * scale}`).join(' ')} />
      ))}
      {/* Axes */}
      {outerPoints.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="0.5" />
      ))}
      {/* Data */}
      <polygon fill="rgba(81,60,200,0.15)" stroke="#513CC8" strokeWidth="1.5" points={polygon} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#513CC8" />
      ))}
      {/* Labels */}
      {dimensions.map((d, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2
        const lx = cx + (r + 18) * Math.cos(angle)
        const ly = cy + (r + 18) * Math.sin(angle)
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            className="text-[8px] fill-gray-600">{d.name}</text>
        )
      })}
    </svg>
  )
}

// ==================== 温度计组件 ====================
function Thermometer({ score, label }) {
  const fillPct = Math.min(100, Math.max(0, score))
  const color = score >= 70 ? '#EF4444' : score >= 40 ? '#F59E0B' : '#22C55E'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-6 h-24 rounded-full border-2 border-gray-200 relative overflow-hidden bg-gray-50">
        <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-1000"
          style={{ height: `${fillPct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color }}>{score}</span>
      <span className="text-[9px] text-gray-400">{label}</span>
    </div>
  )
}

// ==================== 环形图组件 ====================
function RingChart({ value, max = 100, label, color = '#513CC8' }) {
  const pct = (value / max) * 100
  const circumference = 2 * Math.PI * 36
  const strokeDash = (pct / 100) * circumference
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <circle cx="40" cy="40" r="36" fill="none" stroke="#F3F4F6" strokeWidth="6" />
        <circle cx="40" cy="40" r="36" fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round" transform="rotate(-90 40 40)"
          className="transition-all duration-1000" />
        <text x="40" y="40" textAnchor="middle" dominantBaseline="middle"
          className="text-xs font-bold" fill={color}>{value}</text>
      </svg>
      <span className="text-[10px] text-gray-500 mt-0.5">{label}</span>
    </div>
  )
}

// ==================== 时间线组件 ====================
function Timeline({ events }) {
  return (
    <div className="relative pl-6 space-y-3">
      <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#513CC8] to-gray-200" />
      {events.map((event, i) => (
        <div key={i} className="relative flex items-start gap-3">
          <div className={`absolute -left-3.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
            event.type === 'bullish' ? 'bg-red-500' :
            event.type === 'bearish' ? 'bg-green-500' :
            event.type === 'info' ? 'bg-[#513CC8]' : 'bg-gray-400'
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-mono">{event.time}</span>
              <span className="text-[10px] font-medium text-gray-600">{event.phase}</span>
            </div>
            <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{event.content}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ==================== 主组件 ====================
export default function MasterJudgePage() {
  const [stockCode, setStockCode] = useState('')
  const [stockName, setStockName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('')
  const [result, setResult] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [verdicts, setVerdicts] = useState({}) // { masterId: 'bullish'|'bearish'|'neutral' }
  const apiRef = useRef(null)

  // Load AI settings
  const getAIConfig = async () => {
    try {
      const res = await getSystemSettings()
      if (res?.data?.code === 0) {
        const settings = res.data.data || {}
        return {
          baseUrl: settings.ai_decision_base_url || 'https://api.deepseek.com/v1',
          apiKey: settings.ai_decision_api_key || '',
          model: settings.ai_decision_model || 'deepseek-chat',
        }
      }
    } catch (e) { console.error('Load AI config failed:', e) }
    return { baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' }
  }

  // Simulate master analysis with AI
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
    setPhase('获取数据...')

    const addTimeline = (event) => setTimeline(prev => [...prev, event])

    try {
      // Phase 1: Fetch stock data
      addTimeline({ time: '00:00', phase: '数据采集', type: 'info', content: `开始采集 ${code} 市场数据...` })
      setProgress(5)

      const [quoteRes, klineRes] = await Promise.allSettled([
        getDataQuote({ codes: code }),
        getDataKline({ code, period: 'day', count: 60 }),
      ])

      const quote = quoteRes.status === 'fulfilled' && quoteRes.value?.code === 0
        ? (Array.isArray(quoteRes.value.data) ? quoteRes.value.data[0] : quoteRes.value.data?.quotes?.[0]) : null
      const klines = klineRes.status === 'fulfilled' && klineRes.value?.code === 0
        ? (klineRes.value.data?.klines || klineRes.value.data || []) : []

      if (quote) setStockName(quote.name || code)
      setProgress(15)
      addTimeline({ time: '00:02', phase: '数据就绪', type: 'info', content: `行情数据获取完成：现价 ${quote?.price || '—'}，涨跌 ${quote?.change_pct?.toFixed(2) || '—'}%` })

      // Phase 2: AI Analysis
      setPhase('AI深度分析...')
      const config = await getAIConfig()
      if (!config.apiKey) {
        toast.error('请先在系统设置中配置AI模型API Key')
        setAnalyzing(false)
        return
      }

      setProgress(25)
      addTimeline({ time: '00:05', phase: 'AI研判', type: 'info', content: `调用 ${config.model} 进行多维度深度分析...` })

      // Build prompt
      const stockInfo = quote 
        ? `股票：${quote.name}(${code})，现价：${quote.price}，涨跌幅：${quote.change_pct?.toFixed(2)}%，市盈率PE：${quote.pe || '—'}，市净率PB：${quote.pb || '—'}，换手率：${quote.turnover_rate || '—'}%，成交量：${quote.volume || '—'}`
        : `股票代码：${code}`
      const klineInfo = klines.length > 0 
        ? `近60日K线概要：最高${Math.max(...klines.map(k => k.high)).toFixed(2)}，最低${Math.min(...klines.map(k => k.low)).toFixed(2)}，近5日均价${(klines.slice(-5).reduce((s, k) => s + k.close, 0) / 5).toFixed(2)}`
        : ''

      const prompt = `你是一个专业的A股分析系统。请对以下股票进行全面的投资研判分析。

${stockInfo}
${klineInfo}

请严格按照以下JSON格式返回分析结果（只返回JSON，不要其他内容）：
{
  "stock_name": "股票名称",
  "overall_score": 65,
  "verdict": "看多|看空|中性",
  "core_conclusion": "一句话核心结论",
  "dimensions": [
    {"name": "估值", "score": 70, "comment": "简短评价"},
    {"name": "趋势", "score": 60, "comment": "简短评价"},
    {"name": "资金", "score": 55, "comment": "简短评价"},
    {"name": "基本面", "score": 75, "comment": "简短评价"},
    {"name": "情绪", "score": 50, "comment": "简短评价"},
    {"name": "技术", "score": 65, "comment": "简短评价"},
    {"name": "行业", "score": 70, "comment": "简短评价"},
    {"name": "风险", "score": 45, "comment": "简短评价"}
  ],
  "bull_count": 38,
  "bear_count": 18,
  "neutral_count": 9,
  "key_risks": ["风险1", "风险2", "风险3"],
  "catalysts": ["催化剂1", "催化剂2"],
  "target_price": {"bull": 0, "base": 0, "bear": 0},
  "investment_horizon": "短期|中期|长期",
  "confidence": 75
}`

      // Call AI API
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })

      setProgress(60)
      
      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`)
      }

      const aiData = await response.json()
      const content = aiData.choices?.[0]?.message?.content || ''
      
      // Parse JSON from response
      let analysisResult
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        analysisResult = JSON.parse(jsonMatch ? jsonMatch[0] : content)
      } catch (e) {
        throw new Error('AI返回格式解析失败')
      }

      setProgress(75)
      addTimeline({ time: '00:15', phase: 'AI分析完成', type: analysisResult.verdict === '看多' ? 'bullish' : analysisResult.verdict === '看空' ? 'bearish' : 'neutral',
        content: `AI综合评分 ${analysisResult.overall_score}/100，结论：${analysisResult.verdict}` })

      // Phase 3: Simulate 65 masters voting
      setPhase('大师评审中...')
      addTimeline({ time: '00:18', phase: '评审席就位', type: 'info', content: '65位投资大师开始逐一亮灯...' })

      const bullCount = analysisResult.bull_count || 30
      const bearCount = analysisResult.bear_count || 20
      const neutralCount = 65 - bullCount - bearCount

      // Animate verdicts
      const shuffled = [...MASTERS].sort(() => Math.random() - 0.5)
      let bulls = 0, bears = 0, neutrals = 0
      
      for (let i = 0; i < shuffled.length; i++) {
        let v
        if (bulls < bullCount && (bears >= bearCount || Math.random() < bullCount / 65)) {
          v = 'bullish'; bulls++
        } else if (bears < bearCount && (bulls >= bullCount || Math.random() < bearCount / 65)) {
          v = 'bearish'; bears++
        } else {
          v = 'neutral'; neutrals++
        }
        
        setVerdicts(prev => ({ ...prev, [shuffled[i].id]: v }))
        setProgress(75 + Math.floor((i / 65) * 20))
        await new Promise(r => setTimeout(r, 50))
      }

      setProgress(95)
      addTimeline({ time: '00:25', phase: '投票完成', type: 'info', 
        content: `看多 ${bullCount} 票 / 看空 ${bearCount} 票 / 中性 ${neutralCount} 票` })

      // Phase 4: Final result
      setProgress(100)
      setPhase('分析完成')
      setResult(analysisResult)
      if (analysisResult.stock_name) setStockName(analysisResult.stock_name)
      
      addTimeline({ time: '00:28', phase: '最终结论', type: analysisResult.verdict === '看多' ? 'bullish' : analysisResult.verdict === '看空' ? 'bearish' : 'neutral',
        content: analysisResult.core_conclusion })

    } catch (err) {
      console.error('Analysis failed:', err)
      toast.error(err.message || '分析失败，请检查AI配置')
      addTimeline({ time: '—', phase: '错误', type: 'neutral', content: err.message || '分析异常终止' })
    }
    setAnalyzing(false)
  }

  return (
    <div className="p-2 md:p-4 space-y-3 md:space-y-4 min-h-screen" style={{ background: '#F8F9FC' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg md:text-2xl font-bold gradient-text">大师研判</h1>
          <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">65位投资大师 · AI多维度深度分析 · 参考UZI-Skill</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={stockCode} onChange={e => setStockCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runAnalysis()}
              placeholder="输入股票代码" disabled={analyzing}
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#513CC8] focus:ring-1 focus:ring-[#513CC8]/20 focus:outline-none w-36 md:w-44" />
          </div>
          <button onClick={runAnalysis} disabled={analyzing}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white flex items-center gap-1.5 hover:shadow-lg transition disabled:opacity-60"
            style={{ background: '#513CC8' }}>
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
            {analyzing ? '分析中...' : '开始研判'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {analyzing && (
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-600 font-medium">{phase}</span>
            <span className="text-xs font-bold" style={{ color: '#513CC8' }}>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #513CC8, #6B5AD5)' }} />
          </div>
        </div>
      )}

      {/* 评审席 - 65盏灯 */}
      {(analyzing || result) && (
        <div className="glass-card p-3 md:p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-800">
            <Users size={16} style={{ color: '#513CC8' }} /> 评审席 · 65位投资大师
          </h3>
          <div className="grid grid-cols-10 sm:grid-cols-13 md:grid-cols-16 lg:grid-cols-20 gap-2 md:gap-3">
            {MASTERS.map(master => (
              <JuryLamp key={master.id} master={master} verdict={verdicts[master.id] || null} />
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-[10px] text-gray-500">看多 {Object.values(verdicts).filter(v => v === 'bullish').length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-[10px] text-gray-500">看空 {Object.values(verdicts).filter(v => v === 'bearish').length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-[10px] text-gray-500">中性 {Object.values(verdicts).filter(v => v === 'neutral').length}</span>
            </div>
          </div>
        </div>
      )}

      {/* 结果区域 */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* 综合评分 + 核心结论 */}
          <div className="col-span-1 md:col-span-4 glass-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-800">
              <Target size={16} style={{ color: '#513CC8' }} /> 综合评分
            </h3>
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" 
                    stroke={result.overall_score >= 65 ? '#EF4444' : result.overall_score >= 45 ? '#F59E0B' : '#22C55E'} 
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(result.overall_score / 100) * 264} 264`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold" style={{ color: '#513CC8' }}>{result.overall_score}</span>
                  <span className="text-[9px] text-gray-400">/ 100</span>
                </div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${result.verdict === '看多' ? 'text-red-500' : result.verdict === '看空' ? 'text-green-500' : 'text-gray-500'}`}>
                  {result.verdict === '看多' ? '🔴 看多' : result.verdict === '看空' ? '🟢 看空' : '⚪ 中性'}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">置信度 {result.confidence}%</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#F8F6FF] border border-[#E8E0FF]">
              <p className="text-xs text-gray-700 leading-relaxed font-medium">{result.core_conclusion}</p>
            </div>
            {/* Target Price */}
            {result.target_price && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center p-2 rounded-lg bg-red-50">
                  <p className="text-[9px] text-gray-400">乐观</p>
                  <p className="text-sm font-bold text-red-500">{result.target_price.bull || '—'}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-gray-50">
                  <p className="text-[9px] text-gray-400">基准</p>
                  <p className="text-sm font-bold text-gray-700">{result.target_price.base || '—'}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-green-50">
                  <p className="text-[9px] text-gray-400">悲观</p>
                  <p className="text-sm font-bold text-green-500">{result.target_price.bear || '—'}</p>
                </div>
              </div>
            )}
          </div>

          {/* 维度雷达图 */}
          <div className="col-span-1 md:col-span-4 glass-card p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-gray-800">
              <BarChart3 size={16} style={{ color: '#513CC8' }} /> 多维度分析
            </h3>
            <div className="w-full aspect-square max-w-[220px] mx-auto">
              <RadarChart dimensions={result.dimensions || []} />
            </div>
            {/* Dimension bars */}
            <div className="space-y-1.5 mt-2">
              {(result.dimensions || []).map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-10 text-right">{d.name}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${d.score}%`, background: d.score >= 70 ? '#EF4444' : d.score >= 50 ? '#F59E0B' : '#22C55E' }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-600 w-6">{d.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 温度计 + 环形图 */}
          <div className="col-span-1 md:col-span-4 glass-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-800">
              <Activity size={16} style={{ color: '#513CC8' }} /> 情绪温度
            </h3>
            <div className="flex items-end justify-around mb-4">
              <Thermometer score={result.dimensions?.find(d => d.name === '情绪')?.score || 50} label="市场情绪" />
              <Thermometer score={result.dimensions?.find(d => d.name === '资金')?.score || 50} label="资金热度" />
              <Thermometer score={result.dimensions?.find(d => d.name === '风险')?.score || 50} label="风险水平" />
            </div>
            <div className="flex items-center justify-around pt-3 border-t border-gray-100">
              <RingChart value={result.bull_count || 0} max={65} label="看多票数" color="#EF4444" />
              <RingChart value={result.bear_count || 0} max={65} label="看空票数" color="#22C55E" />
              <RingChart value={result.confidence || 0} max={100} label="置信度" color="#513CC8" />
            </div>
          </div>
        </div>
      )}

      {/* 风险与催化剂 + 时间线 */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* 时间线 */}
          <div className="col-span-1 md:col-span-5 glass-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-800">
              <Clock size={16} style={{ color: '#513CC8' }} /> 决议过程时间线
            </h3>
            <Timeline events={timeline} />
          </div>

          {/* 风险 & 催化剂 */}
          <div className="col-span-1 md:col-span-7 glass-card p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-red-600">
                  <Shield size={13} /> 核心风险
                </h4>
                <div className="space-y-1.5">
                  {(result.key_risks || []).map((risk, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-50/60">
                      <span className="text-[10px] font-bold text-red-400 mt-0.5">!</span>
                      <span className="text-xs text-gray-700">{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-[#513CC8]">
                  <Zap size={13} /> 催化剂
                </h4>
                <div className="space-y-1.5">
                  {(result.catalysts || []).map((cat, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#F8F6FF]">
                      <span className="text-[10px] font-bold text-[#513CC8] mt-0.5">★</span>
                      <span className="text-xs text-gray-700">{cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Investment Info */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 flex-wrap">
              <span className="text-[10px] text-gray-400">投资周期：<b className="text-gray-700">{result.investment_horizon || '—'}</b></span>
              <span className="text-[10px] text-gray-400">模型：<b className="text-gray-700">{result.model || 'DeepSeek'}</b></span>
              <span className="text-[10px] text-gray-400">数据源：通达信 + 腾讯 + 东财</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analyzing && !result && (
        <div className="glass-card p-8 md:p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: '#F0EDFA' }}>
            <Lightbulb size={28} style={{ color: '#513CC8' }} />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">输入股票代码开始研判</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            系统将调用AI模型，模拟65位投资大师的分析视角，从估值、趋势、资金、基本面、情绪、技术、行业、风险8个维度进行深度研判，给出综合评分和买卖建议。
          </p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            {['600519', '000858', '300750', '002594'].map(code => (
              <button key={code} onClick={() => { setStockCode(code) }}
                className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:border-[#513CC8] hover:text-[#513CC8] hover:bg-[#F0EDFA] transition">
                {code}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
