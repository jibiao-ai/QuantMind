import useStore from '../store/useStore'
import Sidebar from './Sidebar'
import TodayPicksPopup from './TodayPicksPopup'
import ErrorBoundary from './ErrorBoundary'
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
import XiaofanSelectPage from '../pages/XiaofanSelectPage'

const pageMap = {
  'dashboard': DashboardPage,
  'realtime': RealtimePage,
  'broadcast': BroadcastPage,
  'hotmoney-board': HotMoneyBoardPage,
  'stock-decision': StockDecisionPage,
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

export default function MainLayout() {
  const { currentPage } = useStore()
  const PageComponent = pageMap[currentPage] || DashboardPage

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <ErrorBoundary>
            <PageComponent />
          </ErrorBoundary>
        </div>
      </div>
      <TodayPicksPopup />
    </div>
  )
}
