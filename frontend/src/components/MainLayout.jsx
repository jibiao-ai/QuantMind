import useStore from '../store/useStore'
import Sidebar from './Sidebar'
import TodayPicksPopup from './TodayPicksPopup'
import ErrorBoundary from './ErrorBoundary'
import MobileBottomNav from './MobileBottomNav'
import DashboardPage from '../pages/DashboardPage'
import RealtimePage from '../pages/RealtimePage'
// import ChatPage from '../pages/ChatPage'  // AI智能体已隐藏
// import StrategiesPage from '../pages/StrategiesPage'  // 策略中心已隐藏
// import SignalsPage from '../pages/SignalsPage'  // 策略信号已隐藏
// import AgentsPage from '../pages/AgentsPage'  // 智能体管理已隐藏
// import AIModelsPage from '../pages/AIModelsPage'  // AI模型管理已隐藏
import UsersPage from '../pages/UsersPage'
import AuditLogPage from '../pages/AuditLogPage'
import SettingsPage from '../pages/SettingsPage'
import WatchlistPage from '../pages/WatchlistPage'
import HotListPage from '../pages/HotListPage'
import StockPickPage from '../pages/StockPickPage'
import AIStockPickPage from '../pages/AIStockPickPage'
import BroadcastPage from '../pages/BroadcastPage'
import HotMoneyBoardPage from '../pages/HotMoneyBoardPage'
import StockDecisionPage from '../pages/StockDecisionPage'
import MasterJudgePage from '../pages/MasterJudgePage'
import XiaofanSelectPage from '../pages/XiaofanSelectPage'
import { Menu } from 'lucide-react'

const pageMap = {
  'dashboard': DashboardPage,
  'realtime': RealtimePage,
  'broadcast': BroadcastPage,
  'hotmoney-board': HotMoneyBoardPage,
  'stock-decision': StockDecisionPage,
  'master-judge': MasterJudgePage,
  'watchlist': WatchlistPage,
  'hot-list': HotListPage,
  'ai-stock-pick': AIStockPickPage,
  'xiaofan-select': XiaofanSelectPage,
  // === AI智能体功能已隐藏（暂时关闭） ===
  // 'smart-ask': () => <ChatPage agentType="smart_ask" />,
  // 'smart-diagnose': () => <ChatPage agentType="smart_diagnose" />,
  // 'main-flow': () => <ChatPage agentType="main_flow" />,
  // 'quant-expert': () => <ChatPage agentType="quant_expert" />,
  // === 策略中心功能已隐藏（暂时关闭） ===
  // 'strategies': StrategiesPage,
  // 'signals': SignalsPage,
  'stock-picks': StockPickPage,
  // === 智能体/AI模型管理已隐藏（暂时关闭） ===
  // 'agents': AgentsPage,
  // 'ai-models': AIModelsPage,
  'users': UsersPage,
  'audit-logs': AuditLogPage,
  'settings': SettingsPage,
}

const pageTitles = {
  'dashboard': '看板大屏',
  'realtime': '实时行情',
  'broadcast': '股市播报',
  'hotmoney-board': '游资打板',
  'stock-decision': '买卖决策',
  'master-judge': '大师研判',
  'watchlist': '自选个股',
  'hot-list': '市场热榜',
  'ai-stock-pick': '隔夜套利',
  'xiaofan-select': '小樊精选',
  'stock-picks': '今日推荐',
  'users': '用户管理',
  'audit-logs': '审计日志',
  'settings': '系统设置',
}

export default function MainLayout() {
  const { currentPage, toggleMobileMenu } = useStore()
  const PageComponent = pageMap[currentPage] || DashboardPage

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center px-3 py-2.5 border-b border-gray-200 bg-white/95 backdrop-blur-md sticky top-0 z-30">
          <button 
            onClick={toggleMobileMenu}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:text-[#513CC8] hover:bg-[#F0EDFA] transition flex-shrink-0"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 flex items-center justify-center gap-1.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: '#513CC8' }}>
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 5C9.9 5 5 9.9 5 16s4.9 11 11 11c2.4 0 4.7-.8 6.5-2.1l2.6 2.6c.4.4 1.1.4 1.6 0 .4-.4.4-1.1 0-1.6l-2.6-2.6C25.2 21.5 27 18.9 27 16c0-6.1-4.9-11-11-11z" fill="none" stroke="white" strokeWidth="2.2"/>
                <path d="M18 10l-4 6.5h3l-1 5.5 4.5-7h-3l1-5z" fill="white"/>
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: '#513CC8' }}>
              {pageTitles[currentPage] || 'QuantMind'}
            </span>
          </div>
          <div className="w-9 h-9 flex-shrink-0" /> {/* Symmetric spacer matching menu button */}
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <ErrorBoundary>
            <PageComponent />
          </ErrorBoundary>
        </div>
      </div>
      <MobileBottomNav />
      <TodayPicksPopup />
    </div>
  )
}
