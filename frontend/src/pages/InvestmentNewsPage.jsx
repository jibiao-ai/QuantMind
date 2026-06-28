import { useState, useEffect, useCallback } from 'react'
import { 
  Newspaper, RefreshCw, Calendar, ChevronRight, ExternalLink, 
  Sparkles, Globe, Cpu, Bot, Car, Zap, Heart, Rocket, Shield, 
  Monitor, Smartphone, TrendingUp, Atom, Clock, AlertCircle
} from 'lucide-react'
import { getInvestmentNews, getInvestmentHighlights, getNewsDates, refreshInvestmentNews } from '../services/api'

// Track definitions with icons and colors
const TRACKS = [
  { key: 'ai', label: 'AI/大模型', icon: Sparkles, color: '#8B5CF6', bg: '#F5F3FF' },
  { key: 'semi', label: '半导体/芯片', icon: Cpu, color: '#EC4899', bg: '#FDF2F8' },
  { key: 'robot', label: '机器人/自动化', icon: Bot, color: '#06B6D4', bg: '#ECFEFF' },
  { key: 'auto', label: '汽车/新能源车', icon: Car, color: '#10B981', bg: '#ECFDF5' },
  { key: 'energy', label: '能源/新能源', icon: Zap, color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'bio', label: '生物医药/健康', icon: Heart, color: '#EF4444', bg: '#FEF2F2' },
  { key: 'space', label: '航天/太空', icon: Rocket, color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'security', label: '网络安全', icon: Shield, color: '#6366F1', bg: '#EEF2FF' },
  { key: 'tech', label: '科技/互联网', icon: Monitor, color: '#0EA5E9', bg: '#F0F9FF' },
  { key: 'consumer', label: '消费电子/数码', icon: Smartphone, color: '#F97316', bg: '#FFF7ED' },
  { key: 'macro', label: '财经/宏观', icon: TrendingUp, color: '#14B8A6', bg: '#F0FDFA' },
  { key: 'science', label: '科学/前沿', icon: Atom, color: '#A855F7', bg: '#FAF5FF' },
]

export default function InvestmentNewsPage() {
  const [activeTrack, setActiveTrack] = useState('ai')
  const [news, setNews] = useState([])
  const [highlights, setHighlights] = useState([])
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [highlightsLoading, setHighlightsLoading] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Load available dates on mount
  useEffect(() => {
    loadDates()
  }, [])

  // Load news and highlights when track or date changes
  useEffect(() => {
    loadNews()
    loadHighlights()
  }, [activeTrack, selectedDate])

  const loadDates = async () => {
    try {
      const res = await getNewsDates()
      if (res.code === 0 && res.data) {
        setDates(res.data.dates || [])
      }
    } catch (err) {
      console.error('Failed to load dates:', err)
    }
  }

  const loadNews = async () => {
    setLoading(true)
    try {
      const params = { track: activeTrack }
      if (selectedDate) params.date = selectedDate
      const res = await getInvestmentNews(params)
      if (res.code === 0 && res.data) {
        setNews(res.data.news || [])
      }
    } catch (err) {
      console.error('Failed to load news:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadHighlights = async () => {
    setHighlightsLoading(true)
    try {
      const params = { track: activeTrack }
      if (selectedDate) params.date = selectedDate
      const res = await getInvestmentHighlights(params)
      if (res.code === 0 && res.data) {
        // highlights is a map: { track: ["highlight1", "highlight2", ...] }
        const trackHighlights = res.data.highlights?.[activeTrack] || []
        setHighlights(trackHighlights.map(content => ({ content })))
      }
    } catch (err) {
      console.error('Failed to load highlights:', err)
    } finally {
      setHighlightsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await refreshInvestmentNews()
      if (res.code === 0) {
        // Reload after refresh
        await Promise.all([loadNews(), loadHighlights(), loadDates()])
      }
    } catch (err) {
      console.error('Failed to refresh:', err)
    } finally {
      setRefreshing(false)
    }
  }

  const currentTrack = TRACKS.find(t => t.key === activeTrack)
  const TrackIcon = currentTrack?.icon || Globe

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const d = new Date(timeStr)
    const now = new Date()
    const diffMs = now - d
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffHours < 1) return '刚刚'
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return d.toLocaleDateString('zh-CN')
  }

  return (
    <div className="min-h-screen p-3 md:p-6" style={{ background: '#F8F9FC' }}>
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: 'linear-gradient(135deg, #513CC8, #7C3AED)' }}>
              <Newspaper size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-gray-900">投资资讯</h1>
              <p className="text-xs text-gray-500">全球12大赛道 · AI智能摘要 · 实时追踪</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Date picker */}
            <div className="relative">
              <button 
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-[#513CC8] transition"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(81,60,200,0.1)' }}
              >
                <Calendar size={14} />
                <span>{selectedDate || '最新'}</span>
              </button>
              {showDatePicker && dates.length > 0 && (
                <div className="absolute right-0 top-full mt-1 z-50 rounded-xl shadow-xl border border-gray-100 overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(20px)', minWidth: '160px' }}>
                  <button 
                    onClick={() => { setSelectedDate(''); setShowDatePicker(false) }}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#F0EDFA] transition ${!selectedDate ? 'text-[#513CC8] font-medium' : 'text-gray-600'}`}
                  >
                    最新资讯
                  </button>
                  {dates.map(d => (
                    <button key={d} onClick={() => { setSelectedDate(d); setShowDatePicker(false) }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#F0EDFA] transition ${selectedDate === d ? 'text-[#513CC8] font-medium' : 'text-gray-600'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Refresh button */}
            <button 
              onClick={handleRefresh} 
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white font-medium transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #513CC8, #7C3AED)' }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{refreshing ? '刷新中...' : '刷新资讯'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Track Tabs - Horizontal scrollable */}
      <div className="mb-4 md:mb-6 -mx-3 md:mx-0 px-3 md:px-0">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TRACKS.map(track => {
            const Icon = track.icon
            const isActive = activeTrack === track.key
            return (
              <button
                key={track.key}
                onClick={() => setActiveTrack(track.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0
                  ${isActive ? 'text-white shadow-md scale-[1.02]' : 'text-gray-600 hover:text-gray-900'}`}
                style={isActive 
                  ? { background: `linear-gradient(135deg, ${track.color}, ${track.color}dd)`, boxShadow: `0 4px 14px ${track.color}40` }
                  : { background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.05)' }}
              >
                <Icon size={14} />
                <span>{track.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left: Highlights Panel */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl p-4 md:p-5 border border-white/60 shadow-sm"
            style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: currentTrack?.bg, color: currentTrack?.color }}>
                <TrackIcon size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">今日要点</h2>
                <p className="text-[10px] text-gray-400">AI 智能摘要</p>
              </div>
              <Sparkles size={14} className="ml-auto text-[#513CC8] opacity-60" />
            </div>

            {highlightsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 bg-gray-200 rounded w-full mb-1.5"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : highlights.length > 0 ? (
              <div className="space-y-3">
                {highlights.map((h, idx) => (
                  <div key={idx} className="flex gap-2.5 group">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                      style={{ background: idx < 2 ? currentTrack?.color : '#94A3B8' }}>
                      {idx + 1}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed group-hover:text-gray-900 transition">
                      {h.content || h.Content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">暂无要点数据</p>
                <p className="text-xs text-gray-300 mt-1">点击「刷新资讯」获取最新内容</p>
              </div>
            )}

            {/* Source badges */}
            {highlights.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-1.5">数据来源</p>
                <div className="flex flex-wrap gap-1">
                  {getTrackSources(activeTrack).slice(0, 5).map(src => (
                    <span key={src} className="px-2 py-0.5 rounded-full text-[10px] text-gray-500"
                      style={{ background: 'rgba(81,60,200,0.05)' }}>
                      {src}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: News List */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl p-4 md:p-5 border border-white/60 shadow-sm"
            style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe size={16} style={{ color: currentTrack?.color }} />
                <h2 className="text-sm font-bold text-gray-900">{currentTrack?.label} 资讯</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full text-gray-400"
                  style={{ background: 'rgba(0,0,0,0.03)' }}>
                  {news.length} 条
                </span>
              </div>
              {loading && <RefreshCw size={14} className="animate-spin text-[#513CC8]" />}
            </div>

            {loading && news.length === 0 ? (
              <div className="space-y-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="animate-pulse p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <div className="h-4 bg-gray-200 rounded w-4/5 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-full mb-1"></div>
                    <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : news.length > 0 ? (
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {news.map((item, idx) => (
                  <NewsCard key={item.id || idx} item={item} trackColor={currentTrack?.color} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Newspaper size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">暂无资讯</p>
                <p className="text-xs text-gray-300 mt-1">点击「刷新资讯」从RSS源获取最新内容</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close date picker */}
      {showDatePicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
      )}
    </div>
  )
}

// News card component
function NewsCard({ item, trackColor }) {
  const title = item.title_zh || item.title_cn || item.title || ''
  const originalTitle = item.title_original || item.title_en || ''
  const source = item.source || ''
  const publishedAt = item.published_at || item.created_at || ''
  const link = item.link || item.url || ''
  const summary = item.summary || ''

  return (
    <a 
      href={link} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block p-3 md:p-4 rounded-xl transition-all duration-200 hover:shadow-md group cursor-pointer"
      style={{ background: 'rgba(248,249,252,0.6)', border: '1px solid rgba(0,0,0,0.03)' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-1 h-full min-h-[40px] rounded-full opacity-60"
          style={{ background: trackColor }} />
        <div className="flex-1 min-w-0">
          {/* Chinese title */}
          <h3 className="text-sm font-medium text-gray-800 leading-snug mb-1 group-hover:text-[#513CC8] transition line-clamp-2">
            {title}
          </h3>
          {/* Original title (if different) */}
          {originalTitle && originalTitle !== title && (
            <p className="text-xs text-gray-400 mb-1.5 line-clamp-1 italic">
              {originalTitle}
            </p>
          )}
          {/* Summary */}
          {summary && (
            <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">
              {summary}
            </p>
          )}
          {/* Meta info */}
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            {source && (
              <span className="flex items-center gap-1">
                <Globe size={10} />
                {source}
              </span>
            )}
            {publishedAt && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {formatTimeDisplay(publishedAt)}
              </span>
            )}
            <ExternalLink size={10} className="ml-auto opacity-0 group-hover:opacity-100 transition text-[#513CC8]" />
          </div>
        </div>
      </div>
    </a>
  )
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return ''
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return timeStr
  const now = new Date()
  const diffMs = now - d
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffHours < 1) return '刚刚'
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return `${d.getMonth()+1}/${d.getDate()}`
}

// Get source names for each track
function getTrackSources(track) {
  const sourceMap = {
    ai: ['OpenAI', 'Google Research', 'Hugging Face', '量子位', '机器之心', '智东西', 'MIT Tech Review'],
    semi: ['DIGITIMES', 'SemiAnalysis', 'IEEE Spectrum', 'EE Times', 'Semiconductor Eng.'],
    robot: ['The Robot Report', 'IEEE Robotics'],
    auto: ['Electrek', 'InsideEVs'],
    energy: ['CleanTechnica', '国际能源网'],
    bio: ['STAT News', 'Endpoints'],
    space: ['SpaceNews', 'NASA'],
    security: ['Krebs on Security', 'BleepingComputer'],
    tech: ['TechCrunch', 'The Verge', 'Ars Technica', '虎嗅', '36氪'],
    consumer: ['The Verge Tech', 'Ars Technica'],
    macro: ['FT', 'CNBC', '华尔街见闻'],
    science: ['Nature News', 'Science Daily'],
  }
  return sourceMap[track] || []
}
