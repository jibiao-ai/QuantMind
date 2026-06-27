import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (username, password) => api.post('/login', { username, password })

// Dashboard
export const getDashboard = (params) => api.get('/dashboard', { params })
export const getProfile = () => api.get('/profile')

// Market
export const getMarketSentiment = (params) => api.get('/market/sentiment', { params })
export const getSectorHeat = (params) => api.get('/market/sector-heat', { params })
export const getLimitUpBoard = (params) => api.get('/market/limit-up', { params })
export const getDragonTiger = (params) => api.get('/market/dragon-tiger', { params })
export const getBoardLadder = (params) => api.get('/market/board-ladder', { params })
export const getStockQuote = (params) => api.get('/market/quote', { params })
export const getKLine = (params) => api.get('/market/kline', { params })
export const getSectorList = (params) => api.get('/market/sectors', { params })
export const getTrendChart = (params) => api.get('/market/trend', { params })
export const getTrendChart5Day = (params) => api.get('/market/trend5day', { params })
export const getChipDistribution = (params) => api.get('/market/chip', { params })
export const getStockFundFlow = (params) => api.get('/market/fund-flow', { params })
export const getConceptHeat = (params) => api.get('/market/concept-heat', { params })
export const getLimitUpDownDetails = (params) => api.get('/market/limit-details', { params })
export const getSectorFundFlow = (params) => api.get('/market/sector-fund-flow', { params })
export const getRealTimeStats = () => api.get('/market/realtime-stats')
export const getDragonTigerHotMoney = (params) => api.get('/market/dragon-tiger-hotmoney', { params })
export const getMarketHotList = (params) => api.get('/market/hot-list', { params })
export const getKLineRealtime = (params) => api.get('/market/kline-realtime', { params })
export const getGubaDiscussion = (params) => api.get('/market/guba', { params })

// Tushare-backed dashboard data (落库+历史查询+刷新)
export const getTsDragonTiger = (params) => api.get('/market/ts-dragon-tiger', { params })
export const getTsLimitUpList = (params) => api.get('/market/ts-limit-up', { params })
export const getTsLimitStats = (params) => api.get('/market/ts-limit-stats', { params })
export const getTsLimitStep = (params) => api.get('/market/ts-limit-step', { params })
export const getTsStkAuction = (params) => api.get('/market/ts-auction', { params })
export const getTsMoneyflow = (params) => api.get('/market/ts-moneyflow', { params })
export const getTsRealTimeStats = (params) => api.get('/market/ts-realtime-stats', { params })

// Watchlist
export const getWatchlist = () => api.get('/watchlist')
export const addWatchlistItem = (data) => api.post('/watchlist', data)
export const removeWatchlistItem = (code) => api.delete(`/watchlist/${code}`)
export const getWatchlistQuotes = () => api.get('/watchlist/quotes')

// Agents
export const listAgents = () => api.get('/agents')
export const getAgent = (id) => api.get(`/agents/${id}`)
export const createAgent = (data) => api.post('/agents', data)
export const updateAgent = (id, data) => api.put(`/agents/${id}`, data)
export const deleteAgent = (id) => api.delete(`/agents/${id}`)

// Skills
export const listSkills = () => api.get('/skills')
export const getAgentSkills = (id) => api.get(`/agents/${id}/skills`)
export const bindAgentSkill = (data) => api.post('/agent-skills', data)

// Conversations
export const listConversations = () => api.get('/conversations')
export const createConversation = (data) => api.post('/conversations', data)
export const deleteConversation = (id) => api.delete(`/conversations/${id}`)
export const getMessages = (id) => api.get(`/conversations/${id}/messages`)
export const sendMessage = (id, content) => api.post(`/conversations/${id}/messages`, { content })

// AI Providers
export const listAIProviders = () => api.get('/ai-providers')
export const updateAIProvider = (id, data) => api.put(`/ai-providers/${id}`, data)
export const testAIProvider = (id) => api.post(`/ai-providers/${id}/test`)
export const createAIProvider = (data) => api.post('/ai-providers', data)

// Strategies
export const getStrategyList = () => api.get('/strategies')
export const getStrategySignals = (params) => api.get('/strategy-signals', { params })

// Users
export const listUsers = () => api.get('/users')
export const createUser = (data) => api.post('/users', data)
export const updateUser = (id, data) => api.put(`/users/${id}`, data)
export const deleteUser = (id) => api.delete(`/users/${id}`)

// Audit
export const getAuditLogs = (params) => api.get('/audit-logs', { params })

// Stock Picks (今日推荐)
export const getTodayPicks = (params) => api.get('/stock-picks/today', { params })
export const listStockPicks = (params) => api.get('/stock-picks', { params })
export const createStockPick = (data) => api.post('/stock-picks', data)
export const updateStockPick = (id, data) => api.put(`/stock-picks/${id}`, data)
export const deleteStockPick = (id) => api.delete(`/stock-picks/${id}`)

// AI Stock Pick (杨永兴隔夜套利法)
export const getAIStockPicks = (params) => api.get('/market/ai-stock-picks', { params })
export const getAIStockPickBatches = (params) => api.get('/market/ai-stock-picks/batches', { params })
export const runAIStockPick = (params) => api.post('/market/ai-stock-picks/run', null, { params })
export const getAIStockPickDetail = (params) => api.get('/market/ai-stock-picks/detail', { params })
export const getAIStockPickStats = () => api.get('/market/ai-stock-picks/stats')

// System Settings
export const getSystemSettings = () => api.get('/settings')
export const updateSystemSettings = (data) => api.put('/settings', data)

// 股市播报 & 财务播报
export const getBroadcastMarket = (params) => api.get('/market/broadcast', { params })
export const getBroadcastFinance = (params) => api.get('/market/broadcast-finance', { params })
export const getBroadcastSearch = (params) => api.get('/market/broadcast-search', { params })

// 看板大屏 - 大盘速览
export const getDashboardOverview = (params) => api.get('/market/dashboard-overview', { params })

// 游资打板
export const getHotMoneyBoard = (params) => api.get('/market/hotmoney-board', { params })
export const getHotMoneyDetail = (params) => api.get('/market/hotmoney-detail', { params })
export const getHotMoneyDates = (params) => api.get('/market/hotmoney-dates', { params })
export const hotMoneyBackfill = (params) => api.post('/market/hotmoney-backfill', null, { params })

// AI买卖决策
export const analyzeStock = (data) => api.post('/decision/analyze', data)
export const masterJudgeAnalyze = (data) => api.post('/decision/master-judge', data)
export const getDecisionHistory = (params) => api.get('/decision/history', { params })
export const getMarketReview = (params) => api.get('/decision/market-review', { params })
export const runMarketReview = () => api.post('/decision/market-review')
export const getPushConfigs = () => api.get('/decision/push-configs')
export const updatePushConfig = (channel, data) => api.put(`/decision/push-configs/${channel}`, data)
export const testPushNotification = (channel) => api.post(`/decision/push-test/${channel}`)
export const getStockNews = (params) => api.get('/decision/news', { params })

// 小樊精选 (Xiaofan Select)
export const getXiaofanCategories = () => api.get('/xiaofan/categories')
export const createXiaofanCategory = (data) => api.post('/xiaofan/categories', data)
export const updateXiaofanCategory = (id, data) => api.put(`/xiaofan/categories/${id}`, data)
export const deleteXiaofanCategory = (id) => api.delete(`/xiaofan/categories/${id}`)
export const getXiaofanCategoryStocks = (id) => api.get(`/xiaofan/categories/${id}/stocks`)
export const addXiaofanStock = (id, data) => api.post(`/xiaofan/categories/${id}/stocks`, data)
export const batchAddXiaofanStocks = (id, data) => api.post(`/xiaofan/categories/${id}/stocks/batch`, data)
export const removeXiaofanStock = (stockId) => api.delete(`/xiaofan/stocks/${stockId}`)

// 数据服务 (Data Service - mootdx/tencent/akshare/cninfo/eastmoney)
export const getDataQuote = (params) => api.get('/data/quote', { params })
export const getDataKline = (params) => api.get('/data/kline', { params })
export const getDataMinute = (params) => api.get('/data/minute', { params })
export const getDataResearch = (params) => api.get('/data/research', { params })
export const getDataNews = (params) => api.get('/data/news', { params })
export const getDataGuba = (params) => api.get('/data/guba', { params })
export const getDataF10 = (params) => api.get('/data/f10', { params })
export const getDataAnnounce = (params) => api.get('/data/announce', { params })
export const validateStockCode = (params) => api.get('/data/validate-stock', { params })

// 金策罗盘 (Jin Ce Compass)
export const getCompassStrategies = () => api.get('/compass/strategies')
export const runCompassAnalysis = (data) => api.post('/compass/analyze', data)
export const getCompassHistory = (params) => api.get('/compass/history', { params })

export default api
