import useStore from '../store/useStore'
import { LayoutDashboard, TrendingUp, Star, Brain, Flame } from 'lucide-react'

const navItems = [
  { key: 'dashboard', label: '看板', icon: LayoutDashboard },
  { key: 'realtime', label: '行情', icon: TrendingUp },
  { key: 'watchlist', label: '自选', icon: Star },
  { key: 'stock-decision', label: '决策', icon: Brain },
  { key: 'hot-list', label: '热榜', icon: Flame },
]

export default function MobileBottomNav() {
  const { currentPage, setCurrentPage } = useStore()

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around px-1 py-1.5">
        {navItems.map(item => {
          const Icon = item.icon
          const active = currentPage === item.key
          return (
            <button 
              key={item.key}
              onClick={() => setCurrentPage(item.key)}
              className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-all min-w-[52px]
                ${active ? 'text-[#513CC8]' : 'text-gray-400 active:text-gray-600'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[10px] mt-0.5 leading-tight ${active ? 'font-semibold' : 'font-normal'}`}>
                {item.label}
              </span>
              {active && (
                <div className="absolute -bottom-0.5 w-5 h-0.5 rounded-full" style={{ background: '#513CC8' }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
