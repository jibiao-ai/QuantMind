import useStore from '../store/useStore'
import { 
  LayoutDashboard, TrendingUp, Brain, MessageSquare, Stethoscope, 
  Crown, BarChart3, Settings, Users, Shield, ChevronLeft, ChevronRight,
  Activity, Zap, Bot, Database, FileText, LogOut, Star, Flame, Megaphone, Target, Radio, Bookmark
} from 'lucide-react'

const menuItems = [
  { key: 'dashboard', label: '看板大屏', icon: LayoutDashboard, group: '市场总览' },
  { key: 'realtime', label: '实时行情', icon: TrendingUp, group: '市场总览' },
  { key: 'broadcast', label: '股市播报', icon: Radio, group: '市场总览' },
  { key: 'hotmoney-board', label: '游资打板', icon: Zap, group: '市场总览' },
  { key: 'stock-decision', label: '买卖决策', icon: Brain, group: '市场总览' },
  { key: 'watchlist', label: '自选个股', icon: Star, group: '市场总览' },
  { key: 'hot-list', label: '市场热榜', icon: Flame, group: '市场总览' },
  { key: 'ai-stock-pick', label: '隔夜套利', icon: Target, group: '市场总览' },
  { key: 'xiaofan-select', label: '小樊精选', icon: Bookmark, group: '市场总览' },
  // === AI智能体功能已隐藏（暂时关闭） ===
  // { key: 'smart-ask', label: '智能问股', icon: MessageSquare, group: 'AI智能体' },
  // { key: 'smart-diagnose', label: '智能诊股', icon: Stethoscope, group: 'AI智能体' },
  // { key: 'main-flow', label: '主力动向', icon: Activity, group: 'AI智能体' },
  // { key: 'quant-expert', label: '量化专家', icon: Brain, group: 'AI智能体' },
  // === 策略中心功能已隐藏（暂时关闭） ===
  // { key: 'strategies', label: '策略中心', icon: Crown, group: '量化策略' },
  // { key: 'signals', label: '策略信号', icon: Zap, group: '量化策略' },
  { key: 'stock-picks', label: '今日推荐', icon: Megaphone, group: '系统管理', adminOnly: true },
  // === 智能体/AI模型管理已隐藏（暂时关闭） ===
  // { key: 'agents', label: '智能体管理', icon: Bot, group: '系统管理' },
  // { key: 'ai-models', label: 'AI模型管理', icon: Database, group: '系统管理' },
  { key: 'users', label: '用户管理', icon: Users, group: '系统管理' },
  { key: 'audit-logs', label: '审计日志', icon: Shield, group: '系统管理' },
  { key: 'settings', label: '系统设置', icon: Settings, group: '系统管理', adminOnly: true },
]

export default function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed, toggleSidebar, user, logout } = useStore()

  const groups = [...new Set(menuItems.map(i => i.group))]

  return (
    <div className={`h-full flex flex-col border-r border-gray-200 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-56'}`}
      style={{ background: '#FFFFFF' }}>
      
      {/* Logo */}
      <div className="flex items-center p-4 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#513CC8' }}>
          {/* Q + Lightning inline SVG */}
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 5C9.9 5 5 9.9 5 16s4.9 11 11 11c2.4 0 4.7-.8 6.5-2.1l2.6 2.6c.4.4 1.1.4 1.6 0 .4-.4.4-1.1 0-1.6l-2.6-2.6C25.2 21.5 27 18.9 27 16c0-6.1-4.9-11-11-11z" fill="none" stroke="white" strokeWidth="2.2"/>
            <path d="M18 10l-4 6.5h3l-1 5.5 4.5-7h-3l1-5z" fill="white"/>
          </svg>
        </div>
        {!sidebarCollapsed && (
          <div className="ml-3 overflow-hidden">
            <h1 className="text-sm font-bold whitespace-nowrap" style={{ color: '#513CC8' }}>QuantMind <span className="text-[9px] font-normal px-1 py-0.5 rounded" style={{ background: '#F0EDFA', color: '#513CC8' }}>v2.0</span></h1>
            <p className="text-[10px] text-gray-400 whitespace-nowrap">AI量化平台</p>
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-2">
        {groups.map(group => (
          <div key={group}>
            {!sidebarCollapsed && (
              <div className="px-4 py-2 text-[10px] text-gray-400 uppercase tracking-wider font-medium">{group}</div>
            )}
            {menuItems.filter(i => i.group === group).filter(i => !i.adminOnly || user?.role === 'admin').map(item => {
              const Icon = item.icon
              const active = currentPage === item.key
              return (
                <button key={item.key} onClick={() => setCurrentPage(item.key)}
                  className={`w-full flex items-center px-3 py-2.5 mx-1 rounded-lg transition-all text-sm
                    ${active 
                      ? 'text-[#513CC8] font-medium' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                  style={active ? { background: '#F0EDFA', borderLeft: '3px solid #513CC8' } : {}}
                  title={item.label}>
                  <Icon size={18} className={`flex-shrink-0 ${sidebarCollapsed ? 'mx-auto' : ''}`} 
                    style={active ? { color: '#513CC8' } : {}} />
                  {!sidebarCollapsed && <span className="ml-3 whitespace-nowrap">{item.label}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3">
        {!sidebarCollapsed && user && (
          <div className="flex items-center mb-2 px-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-bold"
              style={{ background: '#513CC8' }}>
              {user.display_name?.[0] || user.username?.[0] || 'U'}
            </div>
            <div className="ml-2 overflow-hidden">
              <p className="text-xs text-gray-900 truncate font-medium">{user.display_name || user.username}</p>
              <p className="text-[10px] text-gray-400">{user.role === 'admin' ? '管理员' : '用户'}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button onClick={toggleSidebar} className="flex-1 flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition">
            {sidebarCollapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
          </button>
          {!sidebarCollapsed && (
            <button onClick={logout} className="flex-1 flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition text-xs gap-1">
              <LogOut size={14} /> 退出
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
