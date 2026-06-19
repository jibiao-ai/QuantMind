import { useState, useEffect } from 'react'
import { getStockQuote, getTrendChart, getChipDistribution, getStockFundFlow } from '../services/api'
import { Search, TrendingUp, RefreshCw, Database, BarChart3, Activity } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, Cell } from 'recharts'
import toast from 'react-hot-toast'

const SOURCES = [
  { key: 'eastmoney', label: '东方财富', color: '#513CC8' },
  { key: 'sina', label: '新浪财经', color: '#EF4444' },
  { key: 'tencent', label: '腾讯财经', color: '#3B82F6' },
]

export default function RealtimePage() {
  const [code, setCode] = useState('')
  const [source, setSource] = useState('eastmoney')
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchHistory, setSearchHistory] = useState([])
  const [trendData, setTrendData] = useState(null)
  const [chipData, setChipData] = useState(null)
  const [fundFlowData, setFundFlowData] = useState(null)
  const [activeTab, setActiveTab] = useState('trend')

  const fetchQuote = async () => {
    if (!code) { toast.error('请输入股票代码'); return }
    const cleanCode = code.replace(/\D/g, '')
    setLoading(true)
    try {
      const res = await getStockQuote({ code: cleanCode, source })
      if (res.code === 0) {
        setQuote(res.data)
        setSearchHistory(prev => {
          const filtered = prev.filter(h => h.code !== res.data.code)
          return [{ code: res.data.code, name: res.data.name }, ...filtered].slice(0, 10)
        })
        // Fetch trend chart and chip distribution in parallel
        fetchTrendAndChip(cleanCode)
      } else {
        toast.error(res.message)
      }
    } catch (e) {
      toast.error('获取行情失败')
    }
    setLoading(false)
  }

  const fetchTrendAndChip = async (stockCode) => {
    try {
      const [trendRes, chipRes, fundRes] = await Promise.all([
        getTrendChart({ code: stockCode }).catch(() => null),
        getChipDistribution({ code: stockCode }).catch(() => null),
        getStockFundFlow({ code: stockCode }).catch(() => null),
      ])
      if (trendRes?.code === 0) setTrendData(trendRes.data)
      if (chipRes?.code === 0) setChipData(chipRes.data)
      if (fundRes?.code === 0) setFundFlowData(fundRes.data)
    } catch (e) {
      console.error('获取趋势/筹码数据失败', e)
    }
  }

  const tooltipStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }

  return (
    <div className="p-2 md:p-4 space-y-3 md:space-y-4 min-h-screen" style={{ background: '#F8F9FC' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">实时行情</h1>
          <p className="text-xs text-gray-400 mt-1">默认东方财富接口 · 支持分时趋势图 · 筹码分布 · 资金流向</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchQuote()}
              placeholder="输入股票代码 如 600519、000001、300750"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#513CC8] focus:ring-2 focus:ring-[#513CC8]/10 focus:outline-none text-sm"
            />
          </div>
          
          {/* Source Tabs */}
          <div className="flex gap-1">
            {SOURCES.map(s => (
              <button key={s.key} onClick={() => setSource(s.key)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                  source === s.key
                    ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200'
                }`}
                style={source === s.key ? { background: s.color } : {}}>
                {s.label}
              </button>
            ))}
          </div>

          <button onClick={fetchQuote} disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition hover:shadow-lg"
            style={{ background: '#513CC8', boxShadow: '0 2px 8px rgba(81,60,200,0.3)' }}>
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
            查询行情
          </button>
        </div>

        {searchHistory.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-gray-400">最近查询:</span>
            {searchHistory.map(h => (
              <button key={h.code} onClick={() => { setCode(h.code); }}
                className="px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 transition border border-gray-200">
                {h.name} {h.code}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quote Display */}
      {quote && (
        <div className="glass-card p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">{quote.name || '---'}</h2>
                <span className="text-gray-400">{quote.code}</span>
                <span className="px-2 py-0.5 rounded text-xs font-medium" 
                  style={{ background: SOURCES.find(s => s.key === source)?.color + '10', color: SOURCES.find(s => s.key === source)?.color }}>
                  {SOURCES.find(s => s.key === source)?.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={`text-4xl font-bold ${quote.change >= 0 ? 'stock-up' : 'stock-down'}`}>
                  {quote.price?.toFixed(2) || '---'}
                </span>
                <span className={`text-lg ${quote.change >= 0 ? 'stock-up' : 'stock-down'}`}>
                  {quote.change >= 0 ? '+' : ''}{quote.change?.toFixed(2)}
                </span>
                <span className={`text-lg ${quote.change_pct >= 0 ? 'stock-up' : 'stock-down'}`}>
                  ({quote.change_pct >= 0 ? '+' : ''}{quote.change_pct?.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>数据来源: {SOURCES.find(s => s.key === source)?.label}</p>
              <p>日期: {quote.trade_date}</p>
              <p className="flex items-center gap-1 justify-end mt-1 text-[#513CC8]">
                <Database size={12} /> 已存储至数据库
              </p>
            </div>
          </div>

          {/* Quote Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: '今开', value: quote.open?.toFixed(2), color: quote.open >= quote.pre_close ? '#EF4444' : '#22C55E' },
              { label: '最高', value: quote.high?.toFixed(2), color: '#EF4444' },
              { label: '最低', value: quote.low?.toFixed(2), color: '#22C55E' },
              { label: '昨收', value: quote.pre_close?.toFixed(2), color: '#9CA3AF' },
              { label: '成交量', value: quote.volume ? (quote.volume / 10000).toFixed(0) + '万手' : '---', color: '#3B82F6' },
              { label: '成交额', value: quote.amount ? (quote.amount / 100000000).toFixed(2) + '亿' : '---', color: '#F59E0B' },
              { label: '换手率', value: quote.turnover ? quote.turnover.toFixed(2) + '%' : '---', color: '#513CC8' },
              { label: '市值', value: quote.market_cap ? (quote.market_cap / 100000000).toFixed(0) + '亿' : '---', color: '#EC4899' },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className="text-sm font-semibold" style={{ color: item.color }}>{item.value || '---'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend Chart + Chip Distribution */}
      {quote && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
            {[
              { key: 'trend', label: '分时走势', icon: TrendingUp },
              { key: 'chip', label: '资金流向(筹码)', icon: BarChart3 },
              { key: 'fundflow', label: '主力/散户资金', icon: Activity },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                  activeTab === tab.key
                    ? 'text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200'
                }`}
                style={activeTab === tab.key ? { background: '#513CC8' } : {}}>
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Trend Tab */}
          {activeTab === 'trend' && trendData && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  当日分时走势 · {trendData.name || quote.name}
                </h3>
                <span className="text-xs text-gray-400">{trendData.trends?.length || 0} 个数据点</span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData.trends || []}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#513CC8" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#513CC8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="time" tick={{fontSize: 10, fill: '#9CA3AF'}}
                    tickFormatter={v => v?.split(' ')?.[1]?.slice(0, 5) || v}
                    interval={Math.floor((trendData.trends?.length || 1) / 8)} />
                  <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} 
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    tickFormatter={v => typeof v === 'number' ? v.toFixed(2) : v} />
                  {trendData.pre_close > 0 && (
                    <ReferenceLine y={trendData.pre_close} stroke="#9CA3AF" strokeDasharray="3 3" 
                      label={{ value: `昨收 ${trendData.pre_close.toFixed(2)}`, fontSize: 10, fill: '#9CA3AF' }} />
                  )}
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v, name) => {
                      if (name === 'price') return [typeof v === 'number' ? v.toFixed(2) : v, '价格']
                      if (name === 'avg') return [typeof v === 'number' ? v.toFixed(2) : v, '均价']
                      return [v, name]
                    }}
                    labelFormatter={l => l?.split(' ')?.[1] || l} />
                  <Area type="monotone" dataKey="price" stroke="#513CC8" fill="url(#trendGrad)" 
                    strokeWidth={1.5} dot={false} name="price" />
                  <Area type="monotone" dataKey="avg" stroke="#F59E0B" fill="none" 
                    strokeWidth={1} strokeDasharray="4 2" dot={false} name="avg" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'trend' && !trendData && (
            <div className="text-center py-12 text-gray-400 text-sm">
              <TrendingUp size={32} className="mx-auto mb-2 opacity-50" />
              暂无分时数据（非交易时段或数据源暂不可用）
            </div>
          )}

          {/* Chip/Fund Flow Tab */}
          {activeTab === 'chip' && chipData && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  资金流向趋势（近期） · 单位：万元
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chipData.klines || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickFormatter={v => v?.slice(5)} />
                  <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} tickFormatter={v => typeof v === 'number' ? (v/10000).toFixed(0) + '万' : v} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v, name) => {
                      const label = { main_net: '主力净流入', retail_net: '散户净流入' }[name] || name
                      return [typeof v === 'number' ? v.toFixed(0) + '万' : v, label]
                    }} />
                  <Bar dataKey="main_net" name="main_net" radius={[4,4,0,0]}>
                    {(chipData.klines || []).map((entry, i) => (
                      <Cell key={i} fill={entry.main_net >= 0 ? '#EF4444' : '#22C55E'} />
                    ))}
                  </Bar>
                  <Bar dataKey="retail_net" name="retail_net" radius={[4,4,0,0]}>
                    {(chipData.klines || []).map((entry, i) => (
                      <Cell key={i} fill={entry.retail_net >= 0 ? '#F59E0B' : '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 text-xs mt-2">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-500"></span>主力净流入</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-500"></span>主力净流出</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-yellow-500"></span>散户净流入</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-blue-500"></span>散户净流出</span>
              </div>
            </div>
          )}

          {activeTab === 'chip' && !chipData && (
            <div className="text-center py-12 text-gray-400 text-sm">
              <BarChart3 size={32} className="mx-auto mb-2 opacity-50" />
              暂无资金流向数据
            </div>
          )}

          {/* Fund Flow Detail Tab */}
          {activeTab === 'fundflow' && fundFlowData && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  主力/散户资金分时（近5日） · 单位：元
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fundFlowData.klines || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF'}} tickFormatter={v => v?.slice(5)} />
                  <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} 
                    tickFormatter={v => typeof v === 'number' ? (v / 100000000).toFixed(1) + '亿' : v} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v, name) => {
                      const labels = { main_net: '主力净额', retail_net: '散户净额', super_big: '超大单', big: '大单', mid: '中单' }
                      return [typeof v === 'number' ? (v / 100000000).toFixed(2) + '亿' : v, labels[name] || name]
                    }} />
                  <Bar dataKey="main_net" name="main_net" stackId="a" radius={[2,2,0,0]}>
                    {(fundFlowData.klines || []).map((entry, i) => (
                      <Cell key={i} fill={entry.main_net >= 0 ? '#EF4444' : '#22C55E'} />
                    ))}
                  </Bar>
                  <Bar dataKey="retail_net" name="retail_net" stackId="b" radius={[2,2,0,0]}>
                    {(fundFlowData.klines || []).map((entry, i) => (
                      <Cell key={i} fill={entry.retail_net >= 0 ? '#F59E0B' : '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 text-xs mt-2">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-500"></span>主力净流入</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-500"></span>主力净流出</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-yellow-500"></span>散户净流入</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-blue-500"></span>散户净流出</span>
              </div>
            </div>
          )}

          {activeTab === 'fundflow' && !fundFlowData && (
            <div className="text-center py-12 text-gray-400 text-sm">
              <Activity size={32} className="mx-auto mb-2 opacity-50" />
              暂无资金分时数据
            </div>
          )}
        </div>
      )}

      {/* Quick Access */}
      {!quote && (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#F0EDFA' }}>
            <TrendingUp size={32} style={{ color: '#513CC8' }} />
          </div>
          <h3 className="text-lg text-gray-700 mb-2 font-medium">输入股票代码查询实时行情</h3>
          <p className="text-sm text-gray-400 mb-6">默认使用东方财富接口，支持分时走势图和筹码分布图</p>
          <div className="flex justify-center gap-3 flex-wrap">
            {[
              { code: '600519', name: '贵州茅台' },
              { code: '000001', name: '平安银行' },
              { code: '300750', name: '宁德时代' },
              { code: '600036', name: '招商银行' },
              { code: '002594', name: '比亚迪' },
              { code: '688981', name: '中芯国际' },
            ].map(s => (
              <button key={s.code} onClick={() => setCode(s.code)}
                className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 transition border border-gray-200 hover:border-gray-300 shadow-sm">
                {s.name} <span className="text-gray-400">{s.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
