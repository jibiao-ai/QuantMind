package main

import (
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"quantmind/internal/config"
	"quantmind/internal/handler"
	"quantmind/internal/middleware"
	"quantmind/internal/mq"
	"quantmind/internal/repository"
	"quantmind/pkg/logger"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Init
	logger.Init()
	cfg := config.Load()
	middleware.SetJWTSecret(cfg.JWTSecret)
	repository.InitDB(cfg)

	// Migrate Tushare dashboard models (龙虎榜/涨跌停/连板/竞价/资金流向)
	handler.AutoMigrateDashboardModels(repository.DB)
	handler.AutoMigrateDecisionModels(repository.DB)

	// Migrate Tushare broadcast models (股市播报/财务数据)
	handler.AutoMigrateBroadcastModels(repository.DB)

	mq.InitRabbitMQ(cfg)
	defer mq.Close()

	// Seed demo market data for past 7 days
	handler.SeedDemoMarketData()

	// Seed 小樊精选 preset categories and stocks
	handler.SeedXiaofanPresets()

	// Start AI Stock Pick hourly scheduler
	handler.StartAIStockPickScheduler()

	// Start Hot Money daily data collection scheduler
	handler.StartHotMoneyScheduler()

	// Backfill recent dragon tiger data on startup (past 5 trading days)
	go handler.BackfillHotMoneyData(5)

	// Start AkShare Python microservice as fallback data source
	go startAkShareService()

	// Gin
	if cfg.GinMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	h := handler.New()

	// Public routes
	r.POST("/api/login", h.Login)

	// Authenticated routes
	auth := r.Group("/api")
	auth.Use(middleware.AuthMiddleware())
	auth.Use(middleware.AuditMiddleware())
	{
		// Profile
		auth.GET("/profile", h.GetProfile)
		auth.GET("/dashboard", h.GetDashboardEnhanced)

		// Market Data
		auth.GET("/market/sentiment", h.GetMarketSentiment)
		auth.GET("/market/sector-heat", h.GetSectorHeat)
		auth.GET("/market/limit-up", h.GetLimitUpBoard)
		auth.GET("/market/dragon-tiger", h.GetDragonTiger)
		auth.GET("/market/board-ladder", h.GetBoardLadder)
		auth.GET("/market/quote", h.GetStockQuote)
		auth.GET("/market/kline", h.GetKLine)
		auth.GET("/market/sectors", h.GetSectorList)
		auth.POST("/market/fetch", h.FetchMarketData)
		auth.GET("/market/trend", h.GetTrendChart)
		auth.GET("/market/trend5day", h.GetTrendChart5Day)
		auth.GET("/market/chip", h.GetChipDistribution)
		auth.GET("/market/fund-flow", h.GetStockFundFlow)
		auth.GET("/market/concept-heat", h.GetConceptHeat)
		auth.GET("/market/limit-details", h.GetLimitUpDownDetails)
		auth.GET("/market/sector-fund-flow", h.GetSectorFundFlow)
		auth.GET("/market/realtime-stats", h.GetRealTimeStats)
		auth.GET("/market/dragon-tiger-hotmoney", h.GetDragonTigerHotMoney)
		auth.GET("/market/hot-list", h.GetMarketHotList)
		auth.GET("/market/kline-realtime", h.GetKLineRealtime)
		auth.GET("/market/guba", h.GetGubaDiscussion)

		// Tushare-backed dashboard data (落库+历史查询+刷新)
		auth.GET("/market/ts-dragon-tiger", h.GetTsDragonTiger)       // 龙虎榜游资
		auth.GET("/market/ts-limit-up", h.GetTsLimitUpList)           // 涨停榜
		auth.GET("/market/ts-limit-stats", h.GetTsLimitStats)         // 涨跌停+炸板统计
		auth.GET("/market/ts-limit-step", h.GetTsLimitStep)           // 连板天梯
		auth.GET("/market/ts-auction", h.GetTsStkAuction)             // 集合竞价
		auth.GET("/market/ts-moneyflow", h.GetTsMoneyflow)            // 资金流向
		auth.GET("/market/ts-realtime-stats", h.GetTsRealTimeStats)   // Tushare实时统计

		// 看板大屏 - 大盘速览+涨跌分布+情绪温度
		auth.GET("/market/dashboard-overview", h.GetDashboardOverview) // 大盘速览(指数/涨跌分布/情绪)

		// 股市播报 & 财务播报
		auth.GET("/market/broadcast", h.GetBroadcastMarket)           // 股市播报(ST/港通/盘前/公司)
		auth.GET("/market/broadcast-finance", h.GetBroadcastFinance)  // 财务播报(利润/资产/现金流/预告/快报/审计/主营/指标)
		auth.GET("/market/broadcast-search", h.GetBroadcastSearch)    // 股票搜索(快速搜索用)

		// 游资打板专题
		auth.GET("/market/hotmoney-board", h.GetHotMoneyBoard)        // 游资打板(滚动播报+游资列表)
		auth.GET("/market/hotmoney-detail", h.GetHotMoneyDetail)      // 游资个股详情(选中个股后)
		auth.GET("/market/hotmoney-dates", h.GetHotMoneyDates)        // 游资数据可用日期
		auth.POST("/market/hotmoney-backfill", h.HotMoneyBackfill)    // 游资数据回补(管理员手动触发)

		// AI Stock Pick (杨永兴隔夜套利法)
		auth.GET("/market/ai-stock-picks", h.GetAIStockPicks)
		auth.GET("/market/ai-stock-picks/batches", h.GetAIStockPickBatches)
		auth.POST("/market/ai-stock-picks/run", h.RunAIStockPick)
		auth.GET("/market/ai-stock-picks/detail", h.GetAIStockPickDetail)
		auth.GET("/market/ai-stock-picks/stats", h.GetAIStockPickStats)

		// AI买卖决策
		auth.POST("/decision/analyze", h.AnalyzeStock)
		auth.POST("/decision/master-judge", h.MasterJudgeAnalyze)
		auth.GET("/decision/history", h.GetStockDecisionHistory)
		auth.GET("/decision/market-review", h.GetMarketReviewAPI)
		auth.POST("/decision/market-review", h.RunMarketReview)
		auth.GET("/decision/push-configs", h.GetPushConfigs)
		auth.PUT("/decision/push-configs/:channel", h.UpdatePushConfig)
		auth.POST("/decision/push-test/:channel", h.TestPushNotification)
		auth.GET("/decision/news", h.GetStockNews)

		// 金策罗盘 (Jin Ce Compass)
		auth.GET("/compass/strategies", h.GetJinCeStrategies)
		auth.POST("/compass/analyze", h.RunJinCeAnalysis)
		auth.GET("/compass/history", h.GetJinCeHistory)
		auth.GET("/compass/kline", h.GetCompassKline)
		auth.POST("/compass/evolve", h.RunCompassEvolution)

		// Today's stock picks (all users can read)
		auth.GET("/stock-picks/today", h.GetTodayPicks)

		// 小樊精选 (Xiaofan Select)
		auth.GET("/xiaofan/categories", h.GetXiaofanCategories)
		auth.POST("/xiaofan/categories", h.CreateXiaofanCategory)
		auth.PUT("/xiaofan/categories/:id", h.UpdateXiaofanCategory)
		auth.DELETE("/xiaofan/categories/:id", h.DeleteXiaofanCategory)
		auth.GET("/xiaofan/categories/:id/stocks", h.GetXiaofanCategoryStocks)
		auth.POST("/xiaofan/categories/:id/stocks", h.AddXiaofanStock)
		auth.POST("/xiaofan/categories/:id/stocks/batch", h.BatchAddXiaofanStocks)
		auth.DELETE("/xiaofan/stocks/:stockId", h.RemoveXiaofanStock)

		// 数据服务代理 (Data Service Proxy - mootdx/tencent/akshare/cninfo/eastmoney)
		auth.GET("/data/quote", h.GetDataQuote)
		auth.GET("/data/kline", h.GetDataKline)
		auth.GET("/data/minute", h.GetDataMinute)
		auth.GET("/data/research", h.GetDataResearch)
		auth.GET("/data/news", h.GetDataNews)
		auth.GET("/data/guba", h.GetDataGuba)
		auth.GET("/data/f10", h.GetDataF10)
		auth.GET("/data/announce", h.GetDataAnnounce)
		auth.GET("/data/validate-stock", h.ValidateStockCode)

		// Watchlist
		auth.GET("/watchlist", h.GetWatchlist)
		auth.POST("/watchlist", h.AddWatchlistItem)
		auth.DELETE("/watchlist/:code", h.RemoveWatchlistItem)
		auth.GET("/watchlist/quotes", h.GetWatchlistQuotes)

		// Agents
		auth.GET("/agents", h.ListAgents)
		auth.GET("/agents/:id", h.GetAgent)
		auth.POST("/agents", h.CreateAgent)
		auth.PUT("/agents/:id", h.UpdateAgent)
		auth.DELETE("/agents/:id", h.DeleteAgent)

		// Skills
		auth.GET("/skills", h.ListSkills)
		auth.GET("/agents/:id/skills", h.GetAgentSkills)
		auth.POST("/agent-skills", h.BindAgentSkill)

		// Conversations & Chat
		auth.GET("/conversations", h.ListConversations)
		auth.POST("/conversations", h.CreateConversation)
		auth.DELETE("/conversations/:id", h.DeleteConversation)
		auth.GET("/conversations/:id/messages", h.GetMessages)
		auth.POST("/conversations/:id/messages", h.SendMessage)

		// AI Providers
		auth.GET("/ai-providers", h.ListAIProviders)
		auth.PUT("/ai-providers/:id", h.UpdateAIProvider)
		auth.POST("/ai-providers/:id/test", h.TestAIProvider)
		auth.POST("/ai-providers", h.CreateAIProvider)

		// Strategies
		auth.GET("/strategies", h.GetStrategyList)
		auth.GET("/strategy-signals", h.GetStrategySignals)

		// Admin routes – must use `admin.` not `auth.` so AdminMiddleware is applied
		admin := auth.Group("")
		admin.Use(middleware.AdminMiddleware())
		{
			admin.GET("/users", h.ListUsers)
			admin.POST("/users", h.CreateUser)
			admin.PUT("/users/:id", h.UpdateUser)
			admin.DELETE("/users/:id", h.DeleteUser)
			admin.GET("/audit-logs", h.GetAuditLogs)

			// System settings (admin only)
			admin.GET("/settings", h.GetSystemSettings)
			admin.PUT("/settings", h.UpdateSystemSettings)

			// Stock picks management (admin only)
			admin.GET("/stock-picks", h.ListStockPicks)
			admin.POST("/stock-picks", h.CreateStockPick)
			admin.PUT("/stock-picks/:id", h.UpdateStockPick)
			admin.DELETE("/stock-picks/:id", h.DeleteStockPick)
		}
	}

	// Serve frontend static files from ../frontend/dist
	distPath := "../frontend/dist"
	if _, err := os.Stat(distPath); err != nil {
		// Try relative to executable
		execDir, _ := os.Executable()
		distPath = filepath.Join(filepath.Dir(execDir), "..", "frontend", "dist")
	}
	if _, err := os.Stat(distPath); err == nil {
		log.Printf("Serving frontend from: %s", distPath)
		r.Use(func(c *gin.Context) {
			// Skip API routes
			if strings.HasPrefix(c.Request.URL.Path, "/api") {
				c.Next()
				return
			}
			// Try to serve static file
			filePath := filepath.Join(distPath, c.Request.URL.Path)
			if _, err := os.Stat(filePath); err == nil && !isDir(filePath) {
				c.File(filePath)
				c.Abort()
				return
			}
			// Fallback to index.html for SPA routing
			c.File(filepath.Join(distPath, "index.html"))
			c.Abort()
		})
	} else {
		log.Printf("Frontend dist not found at %s, serving API only", distPath)
	}

	log.Printf("QuantMind Server starting on port %s", cfg.ServerPort)
	r.Run(":" + cfg.ServerPort)
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// startAkShareService checks AkShare service connectivity.
// In Docker mode (AKSHARE_SERVICE_URL is set), it only verifies the service is reachable.
// In local dev mode, it starts the Python microservice as a subprocess.
func startAkShareService() {
	// Determine the AkShare service URL
	akshareURL := os.Getenv("AKSHARE_SERVICE_URL")
	if akshareURL == "" {
		akshareURL = "http://127.0.0.1:9090"
	}

	client := &http.Client{Timeout: 5 * time.Second}

	// Check if service is already reachable (Docker container or already running)
	for attempt := 0; attempt < 10; attempt++ {
		if resp, err := client.Get(akshareURL + "/health"); err == nil {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode == 200 {
				if strings.Contains(string(body), "\"akshare_available\":true") || strings.Contains(string(body), "\"akshare_available\": true") {
					log.Printf("[AkShare] Service is ready at %s (akshare available)", akshareURL)
					return
				}
				log.Printf("[AkShare] Service at %s running but akshare not available", akshareURL)
				return
			}
		}
		// If AKSHARE_SERVICE_URL is explicitly set (Docker mode), just wait and retry
		if os.Getenv("AKSHARE_SERVICE_URL") != "" {
			log.Printf("[AkShare] Waiting for Docker service at %s (attempt %d/10)...", akshareURL, attempt+1)
			time.Sleep(3 * time.Second)
			continue
		}
		// Local dev mode: break out and try to start subprocess
		break
	}

	// If AKSHARE_SERVICE_URL is set (Docker mode), service should be managed externally
	if os.Getenv("AKSHARE_SERVICE_URL") != "" {
		log.Printf("[AkShare] WARNING: Docker service at %s not reachable after 30s. Check docker-compose logs.", akshareURL)
		return
	}

	// === Local dev mode: start AkShare as subprocess ===
	scriptPaths := []string{
		"../backend/akshare_service/main.py",
		"./akshare_service/main.py",
		"backend/akshare_service/main.py",
	}

	var scriptPath string
	for _, p := range scriptPaths {
		if _, err := os.Stat(p); err == nil {
			scriptPath = p
			break
		}
	}

	if scriptPath == "" {
		log.Println("[AkShare] Service script not found, skipping AkShare fallback")
		return
	}

	// Auto-install akshare dependencies before starting
	log.Println("[AkShare] Installing Python dependencies (akshare, pandas)...")
	installCmd := exec.Command("pip3", "install", "--quiet", "--disable-pip-version-check", "akshare", "pandas")
	installCmd.Stdout = os.Stdout
	installCmd.Stderr = os.Stderr
	if err := installCmd.Run(); err != nil {
		log.Printf("[AkShare] WARNING: pip install failed: %v (will try to start anyway)", err)
		installCmd2 := exec.Command("pip", "install", "--quiet", "--disable-pip-version-check", "akshare", "pandas")
		installCmd2.Stdout = os.Stdout
		installCmd2.Stderr = os.Stderr
		if err2 := installCmd2.Run(); err2 != nil {
			log.Printf("[AkShare] WARNING: pip install also failed: %v", err2)
		}
	} else {
		log.Println("[AkShare] Dependencies installed successfully")
	}

	log.Printf("[AkShare] Starting AkShare microservice from: %s", scriptPath)
	cmd := exec.Command("python3", scriptPath)
	cmd.Env = append(os.Environ(), "AKSHARE_PORT=9090")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		log.Printf("[AkShare] Failed to start service: %v", err)
		return
	}

	log.Printf("[AkShare] Service started with PID %d", cmd.Process.Pid)

	// Wait for it to be ready (up to 15 seconds)
	for i := 0; i < 30; i++ {
		time.Sleep(500 * time.Millisecond)
		if resp, err := client.Get(akshareURL + "/health"); err == nil {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode == 200 {
				if strings.Contains(string(body), "\"akshare_available\":true") || strings.Contains(string(body), "\"akshare_available\": true") {
					log.Println("[AkShare] Service is ready and healthy (akshare available)")
					return
				}
				log.Println("[AkShare] WARNING: Service running but akshare library not available")
				return
			}
		}
	}
	log.Println("[AkShare] WARNING: Service started but health check not passing after 15s")
}
