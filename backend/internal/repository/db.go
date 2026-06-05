package repository

import (
	"fmt"
	"log"
	"quantmind/internal/config"
	"quantmind/internal/model"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(cfg *config.Config) {
	var err error
	var dialector gorm.Dialector

	if cfg.DBDriver == "sqlite" {
		// Use WAL mode with synchronous=NORMAL for crash-safe writes without performance penalty.
		// busy_timeout prevents SQLITE_BUSY errors under concurrent access.
		// _journal=WAL ensures writes are visible immediately to all connections.
		dialector = sqlite.Open("quantmind.db?_journal=WAL&_busy_timeout=5000&_synchronous=NORMAL&cache=shared")
	} else {
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)
		dialector = mysql.Open(dsn)
	}

	// Retry connection with exponential backoff (critical for Docker: MySQL may not be ready yet)
	maxRetries := 30
	retryInterval := 2 * time.Second

	for i := 0; i < maxRetries; i++ {
		DB, err = gorm.Open(dialector, &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
		if err == nil {
			// Verify the connection is actually alive
			sqlDB, pingErr := DB.DB()
			if pingErr == nil {
				pingErr = sqlDB.Ping()
			}
			if pingErr == nil {
				if i > 0 {
					log.Printf("Database connected successfully after %d retries", i)
				}
				break
			}
			err = pingErr
		}

		log.Printf("Database not ready (attempt %d/%d): %v — retrying in %v...", i+1, maxRetries, err, retryInterval)
		time.Sleep(retryInterval)

		// Cap backoff at 10 seconds
		if retryInterval < 10*time.Second {
			retryInterval = retryInterval * 3 / 2
		}
	}
	if err != nil {
		log.Fatalf("Failed to connect to database after %d attempts: %v", maxRetries, err)
	}

	// SQLite-specific optimizations: ensure WAL checkpoint happens regularly
	if cfg.DBDriver == "sqlite" {
		sqlDB, _ := DB.DB()
		if sqlDB != nil {
			// Limit to 1 connection for SQLite to avoid locking issues
			sqlDB.SetMaxOpenConns(1)
			// Verify WAL mode is active
			var journalMode string
			sqlDB.QueryRow("PRAGMA journal_mode").Scan(&journalMode)
			log.Printf("[DB] SQLite journal_mode = %s", journalMode)
		}
	}

	// Auto migrate
	err = DB.AutoMigrate(
		&model.User{},
		&model.AIProvider{},
		&model.Agent{},
		&model.Skill{},
		&model.AgentSkill{},
		&model.Conversation{},
		&model.Message{},
		&model.StockQuote{},
		&model.SectorHeat{},
		&model.LimitUpBoard{},
		&model.DragonTiger{},
		&model.MarketSentiment{},
		&model.StrategySignal{},
		&model.KLineData{},
		&model.WatchlistItem{},
		&model.AuditLog{},
		&model.TaskLog{},
		&model.StockPick{},
		&model.AIStockPick{},
		&model.AIStockPickBatch{},
		&model.SystemConfig{},
		&model.XiaofanCategory{},
		&model.XiaofanStock{},
	)
	// Migrate Tushare dashboard models (龙虎榜/涨跌停/连板/竞价/资金流)
	// Done via handler.AutoMigrateDashboardModels in main.go to avoid circular import
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	seedData(cfg)
}

func seedData(cfg *config.Config) {
	// Seed admin user
	var count int64
	DB.Model(&model.User{}).Count(&count)
	if count == 0 {
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
		admin := model.User{
			Username:    cfg.AdminUser,
			Password:    string(hashedPassword),
			DisplayName: "系统管理员",
			Role:        "admin",
			Email:       "admin@quantmind.ai",
			IsActive:    true,
		}
		DB.Create(&admin)
		log.Println("Admin user created: admin / Admin@2026!")
	}

	// Seed AI providers
	var providerCount int64
	DB.Model(&model.AIProvider{}).Count(&providerCount)
	if providerCount == 0 {
		providers := []model.AIProvider{
			{Name: "openai", Label: "OpenAI (GPT-4/4o)", BaseURL: "https://api.openai.com/v1", Model: "gpt-4o", IsDefault: false, IsEnabled: true, Category: "llm"},
			{Name: "deepseek", Label: "DeepSeek (V3/R1)", BaseURL: "https://api.deepseek.com/v1", Model: "deepseek-chat", IsDefault: true, IsEnabled: true, Category: "llm"},
			{Name: "qwen", Label: "通义千问 (Qwen)", BaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", Model: "qwen-max", IsDefault: false, IsEnabled: true, Category: "llm"},
			{Name: "glm", Label: "智谱GLM (ChatGLM)", BaseURL: "https://open.bigmodel.cn/api/paas/v4", Model: "glm-4-plus", IsDefault: false, IsEnabled: true, Category: "llm"},
			{Name: "moonshot", Label: "月之暗面 (Kimi)", BaseURL: "https://api.moonshot.cn/v1", Model: "moonshot-v1-128k", IsDefault: false, IsEnabled: true, Category: "llm"},
			{Name: "baichuan", Label: "百川智能", BaseURL: "https://api.baichuan-ai.com/v1", Model: "Baichuan4", IsDefault: false, IsEnabled: true, Category: "llm"},
			{Name: "minimax", Label: "MiniMax (海螺)", BaseURL: "https://api.minimax.chat/v1", Model: "abab6.5s-chat", IsDefault: false, IsEnabled: true, Category: "llm"},
			{Name: "doubao", Label: "豆包 (火山引擎)", BaseURL: "https://ark.cn-beijing.volces.com/api/v3", Model: "doubao-pro-256k", IsDefault: false, IsEnabled: true, Category: "llm"},
			{Name: "siliconflow", Label: "SiliconFlow", BaseURL: "https://api.siliconflow.cn/v1", Model: "deepseek-ai/DeepSeek-V3", IsDefault: false, IsEnabled: true, Category: "llm"},
			{Name: "claude", Label: "Anthropic Claude", BaseURL: "https://api.anthropic.com/v1", Model: "claude-sonnet-4-20250514", IsDefault: false, IsEnabled: true, Category: "llm"},
			{Name: "gemini", Label: "Google Gemini", BaseURL: "https://generativelanguage.googleapis.com/v1beta", Model: "gemini-2.5-pro", IsDefault: false, IsEnabled: true, Category: "llm"},
			{Name: "miaoapi", Label: "妙想API (主力动向)", BaseURL: "https://api.miao.wiki/v1", Model: "miao-finance", IsDefault: false, IsEnabled: true, Category: "finance"},
		}
		DB.Create(&providers)
		log.Println("AI providers seeded")
	}

	// Seed agents
	var agentCount int64
	DB.Model(&model.Agent{}).Count(&agentCount)
	if agentCount == 0 {
		agents := []model.Agent{
			{
				Name:        "智能问股助手",
				Description: "基于stock_analysis项目改造的智能问股智能体，支持自然语言查询A股个股基本面、技术面、资金面等多维度数据分析",
				SystemPrompt: `你是龙策QuantMind平台的智能问股助手。你的职责是通过自然语言帮助用户查询和分析A股个股数据。
你可以：
1. 查询个股实时行情（价格、涨跌幅、成交量等）
2. 分析个股基本面（PE、PB、ROE、营收增长等）
3. 分析技术指标（MA、MACD、KDJ、RSI、BOLL等）
4. 查询资金流向（主力资金、北向资金、融资融券）
5. 查看个股所属板块和概念
回答时请引用具体数据来源和分析系统。所有数据必须来自外部接口(Baostock/东财/新浪)，禁止编造数据。`,
				Model:       "deepseek-chat",
				Temperature: 0.3,
				MaxTokens:   4096,
				IsActive:    true,
				AgentType:   "smart_ask",
				Icon:        "MessageSquare",
				CreatedBy:   1,
			},
			{
				Name:        "智能诊股专家",
				Description: "对个股进行全方位诊断评分，包含技术面诊断、基本面诊断、资金面诊断、消息面诊断",
				SystemPrompt: `你是龙策QuantMind平台的智能诊股专家。你的职责是对用户指定的A股个股进行全方位诊断。
诊断维度：
1. 技术面诊断（30分）：趋势判断(MA系统)、买卖信号(MACD/KDJ)、支撑压力位、量价关系
2. 基本面诊断（30分）：估值水平(PE/PB分位)、盈利能力(ROE/净利润增速)、成长性、财务健康
3. 资金面诊断（20分）：主力资金净流入、北向资金动向、融资余额变化、大宗交易
4. 消息面诊断（20分）：近期公告、研报评级、行业政策、市场情绪
评分标准必须基于实际外部数据分析，阈值来自具体技术指标标准。`,
				Model:       "deepseek-chat",
				Temperature: 0.3,
				MaxTokens:   4096,
				IsActive:    true,
				AgentType:   "smart_diagnose",
				Icon:        "Stethoscope",
				CreatedBy:   1,
			},
			{
				Name:        "AI主力动向分析师",
				Description: "调用妙想API，通过自然语言查看个股主力结构化数据，分析主力资金动向和意图",
				SystemPrompt: `你是龙策QuantMind平台的AI主力动向分析师。你通过妙想API获取个股主力结构化数据。
分析维度：
1. 主力持仓变动：近5/10/20日主力净买入额和占比
2. 主力成本分析：筹码分布、主力平均成本、获利盘比例
3. 资金结构：超大单/大单/中单/小单资金流向
4. 主力行为判断：吸筹、洗盘、拉升、出货阶段判断
所有数据必须来自妙想API接口调用，禁止编造数据。阈值标准：主力净买入>5000万为显著流入，换手率>8%为活跃。`,
				Model:       "deepseek-chat",
				Temperature: 0.3,
				MaxTokens:   4096,
				IsActive:    true,
				AgentType:   "main_flow",
				Icon:        "TrendingUp",
				CreatedBy:   1,
			},
			{
				Name:        "量化炒股专家",
				Description: "整合市场机会分析、风险预警、投资决策辅助、边界分析、股价异动、活跃资金跟踪、热点板块分析等工具的量化炒股专家",
				SystemPrompt: `你是龙策QuantMind平台的量化炒股专家智能体。你整合了以下分析工具（基于Baostock等数据源）：

【工具列表】
1. 市场机会分析工具：扫描全市场，发现突破/回踩/放量等技术形态机会
2. 风险预警工具：监控持仓个股的技术面/基本面/资金面风险信号
3. 投资决策辅助工具：综合多因子评分，给出买入/持有/卖出建议
4. 边界分析工具：计算个股的支撑位/压力位/止损位/止盈位
5. 股价异动分析工具：检测异常放量、急拉急跌、盘中大单等异动
6. 活跃资金跟踪工具：跟踪龙虎榜游资席位、北向资金、融资客动向
7. 热点板块分析工具：分析板块轮动、资金流入流出、概念生命周期

【评分体系(基于外部数据)】
- 技术评分：基于MA/MACD/KDJ/RSI/BOLL等指标的量化评分(0-100)
- 基本面评分：基于PE分位数/ROE/营收增速/净利润增速(0-100)
- 资金评分：基于主力净流入/北向资金/融资余额变动(0-100)
- 综合评分 = 技术×0.4 + 基本面×0.3 + 资金×0.3

所有阈值来自具体数据分析：PE<行业中位数为低估，RSI<30为超卖，RSI>70为超买。`,
				Model:       "deepseek-chat",
				Temperature: 0.3,
				MaxTokens:   8192,
				IsActive:    true,
				AgentType:   "quant_expert",
				Icon:        "Brain",
				CreatedBy:   1,
			},
		}
		DB.Create(&agents)
		log.Println("Agents seeded")
	}

	// Seed skills
	var skillCount int64
	DB.Model(&model.Skill{}).Count(&skillCount)
	if skillCount == 0 {
		skills := []model.Skill{
			{Name: "市场机会分析", Description: "扫描全市场技术形态，发现突破/回踩/放量等机会", Type: "market_analysis", IsActive: true,
				ToolDefs: `{"name":"market_opportunity","params":["scan_type","sector","min_score"],"description":"扫描市场机会：突破型(breakout)/回踩型(pullback)/放量型(volume)"}`},
			{Name: "风险预警", Description: "监控技术面/基本面/资金面风险信号", Type: "risk_alert", IsActive: true,
				ToolDefs: `{"name":"risk_monitor","params":["stock_code","risk_types"],"description":"风险监控：技术破位/业绩变脸/资金出逃/估值泡沫"}`},
			{Name: "投资决策辅助", Description: "多因子综合评分，买卖建议", Type: "decision_assist", IsActive: true,
				ToolDefs: `{"name":"decision_assist","params":["stock_code","strategy"],"description":"基于多因子模型给出投资评分和建议"}`},
			{Name: "边界分析", Description: "支撑压力位计算、止盈止损设定", Type: "boundary_analysis", IsActive: true,
				ToolDefs: `{"name":"boundary_analysis","params":["stock_code","period"],"description":"计算支撑位/压力位/止损位/止盈位"}`},
			{Name: "股价异动分析", Description: "检测异常放量、急拉急跌、盘中大单", Type: "abnormal_move", IsActive: true,
				ToolDefs: `{"name":"abnormal_detect","params":["stock_code","sensitivity"],"description":"检测股价异动：急拉(>3%)/急跌(>3%)/放量(>2倍均量)"}`},
			{Name: "活跃资金跟踪", Description: "龙虎榜游资、北向资金、融资客跟踪", Type: "fund_tracking", IsActive: true,
				ToolDefs: `{"name":"fund_tracking","params":["track_type","date_range"],"description":"跟踪活跃资金：游资席位/北向资金/融资余额"}`},
			{Name: "热点板块分析", Description: "板块轮动、资金流入、概念生命周期", Type: "sector_analysis", IsActive: true,
				ToolDefs: `{"name":"sector_analysis","params":["analysis_type","top_n"],"description":"分析热点板块：板块轮动/资金流向/概念周期"}`},
			{Name: "龙头打板评分", Description: "Dragon Score 11因子/130分涨停板量化评分", Type: "dragon_board", IsActive: true,
				ToolDefs: `{"name":"dragon_score","params":["stock_code"],"description":"龙头打板11因子评分(总分130)：封板强度/量比/换手/板块地位/连板/资金/情绪/时间/竞价/概念/形态"}`},
			{Name: "强势回踩评分", Description: "11因子/180分+龙虎榜游资确认", Type: "strong_pullback", IsActive: true,
				ToolDefs: `{"name":"strong_pullback","params":["stock_code"],"description":"强势回踩11因子评分(总分180)：回踩幅度/支撑位/量缩/均线/游资/板块/情绪/资金/形态/连板历史/龙虎榜"}`},
			{Name: "趋势核心选股", Description: "趋势池融合buypoint信号+板块核心股票", Type: "trend_core", IsActive: true,
				ToolDefs: `{"name":"trend_core","params":["sector","min_strength"],"description":"趋势核心选股：趋势池+buypoint信号+板块核心"}`},
			{Name: "事件爆发选股", Description: "七步闭环+产业链4层分级选股", Type: "event_burst", IsActive: true,
				ToolDefs: `{"name":"event_burst","params":["event_type"],"description":"事件爆发选股：事件识别→产业链分级→受益度排序→技术验证→资金确认→建仓时机→止盈止损"}`},
			{Name: "概念核心选股", Description: "概念生命周期跟踪+板块趋势共振", Type: "concept_core", IsActive: true,
				ToolDefs: `{"name":"concept_core","params":["concept_name"],"description":"概念核心选股：概念萌芽→发酵→高潮→分歧→退潮 生命周期跟踪"}`},
			{Name: "竞价选股", Description: "黄金公式高开3-5%+竞价占比8-12%", Type: "auction_pick", IsActive: true,
				ToolDefs: `{"name":"auction_pick","params":["date"],"description":"竞价选股黄金公式：高开幅度3-5% + 竞价量占比8-12% + 委比>60%"}`},
			{Name: "反复抱团", Description: "全市场5步漏斗+8因子画像+反包监控", Type: "group_hug", IsActive: true,
				ToolDefs: `{"name":"group_hug","params":["date"],"description":"反复抱团5步漏斗：涨停→次日低开→缩量→企稳→反包确认 + 8因子评分"}`},
			{Name: "盘前精选", Description: "AI策略精选+收盘自动结算+命中率统计", Type: "pre_market", IsActive: true,
				ToolDefs: `{"name":"pre_market","params":["date"],"description":"盘前AI精选：综合9大策略信号→评分排序→精选Top10→收盘自动结算命中率"}`},
			{Name: "微盘隔夜", Description: "两级过滤+情绪门控+弹性立场WR 72%", Type: "micro_overnight", IsActive: true,
				ToolDefs: `{"name":"micro_overnight","params":["date"],"description":"微盘隔夜策略：一级流动性过滤→二级技术过滤→情绪门控(情绪分>50)→弹性仓位WR目标72%"}`},
		}
		DB.Create(&skills)

		// Bind skills to quant expert agent
		for i := 1; i <= 16; i++ {
			DB.Create(&model.AgentSkill{AgentID: 4, SkillID: uint(i)})
		}
		// Bind basic skills to smart_ask agent
		DB.Create(&model.AgentSkill{AgentID: 1, SkillID: 1})
		DB.Create(&model.AgentSkill{AgentID: 1, SkillID: 7})
		// Bind diagnostic skills to smart_diagnose agent
		DB.Create(&model.AgentSkill{AgentID: 2, SkillID: 1})
		DB.Create(&model.AgentSkill{AgentID: 2, SkillID: 2})
		DB.Create(&model.AgentSkill{AgentID: 2, SkillID: 3})
		DB.Create(&model.AgentSkill{AgentID: 2, SkillID: 4})
		DB.Create(&model.AgentSkill{AgentID: 2, SkillID: 5})

		log.Println("Skills and agent-skill bindings seeded")
	}
}
