package model

import (
	"time"

	"gorm.io/gorm"
)

// User model
type User struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Username    string         `gorm:"uniqueIndex;size:100;not null" json:"username"`
	Password    string         `gorm:"size:255;not null" json:"-"`
	Email       string         `gorm:"size:255" json:"email"`
	DisplayName string         `gorm:"size:100" json:"display_name"`
	Role        string         `gorm:"size:20;default:user" json:"role"`
	Avatar      string         `gorm:"size:500" json:"avatar"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// AIProvider model - supports multiple model providers configured via UI
type AIProvider struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Label     string    `gorm:"size:200" json:"label"`
	APIKey    string    `gorm:"size:500" json:"api_key"`
	BaseURL   string    `gorm:"size:500" json:"base_url"`
	Model     string    `gorm:"size:200" json:"model"`
	IsDefault bool      `gorm:"default:false" json:"is_default"`
	IsEnabled bool      `gorm:"default:true" json:"is_enabled"`
	Category  string    `gorm:"size:50;default:llm" json:"category"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Agent model - Hermes-style AI agents
type Agent struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"size:200;not null" json:"name"`
	Description  string    `gorm:"type:text" json:"description"`
	SystemPrompt string    `gorm:"type:text" json:"system_prompt"`
	Model        string    `gorm:"size:200" json:"model"`
	Temperature  float64   `gorm:"default:0.7" json:"temperature"`
	MaxTokens    int       `gorm:"default:4096" json:"max_tokens"`
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	AgentType    string    `gorm:"size:50" json:"agent_type"` // smart_ask, smart_diagnose, quant_expert, main_flow, etc.
	Icon         string    `gorm:"size:100" json:"icon"`
	CreatedBy    uint      `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Skill model - skills bound to agents
type Skill struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:200;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	Type        string    `gorm:"size:50" json:"type"` // market_analysis, risk_alert, decision_assist, etc.
	Config      string    `gorm:"type:text" json:"config"`
	ToolDefs    string    `gorm:"type:text" json:"tool_defs"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// AgentSkill join table
type AgentSkill struct {
	ID      uint `gorm:"primaryKey" json:"id"`
	AgentID uint `gorm:"index" json:"agent_id"`
	SkillID uint `gorm:"index" json:"skill_id"`
}

// Conversation model
type Conversation struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Title     string    `gorm:"size:500" json:"title"`
	UserID    uint      `gorm:"index" json:"user_id"`
	AgentID   uint      `gorm:"index" json:"agent_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Message model
type Message struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ConversationID uint      `gorm:"index" json:"conversation_id"`
	Role           string    `gorm:"size:20" json:"role"`
	Content        string    `gorm:"type:longtext" json:"content"`
	TokensUsed     int       `json:"tokens_used"`
	ToolCalls      string    `gorm:"type:text" json:"tool_calls"`
	CreatedAt      time.Time `json:"created_at"`
}

// SystemConfig - system configuration stored in DB
type SystemConfig struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ConfigKey   string    `gorm:"size:100;uniqueIndex;not null" json:"config_key"`
	ConfigValue string    `gorm:"type:text" json:"config_value"`
	Description string    `gorm:"size:500" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// StockQuote - real-time stock data storage
type StockQuote struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Code       string    `gorm:"size:20;index" json:"code"`
	Name       string    `gorm:"size:100" json:"name"`
	Price      float64   `json:"price"`
	Change     float64   `json:"change"`
	ChangePct  float64   `json:"change_pct"`
	Volume     float64   `json:"volume"`
	Amount     float64   `json:"amount"`
	High       float64   `json:"high"`
	Low        float64   `json:"low"`
	Open       float64   `json:"open"`
	Close      float64   `json:"close"`
	PreClose   float64   `json:"pre_close"`
	Turnover   float64   `json:"turnover"`
	PE         float64   `json:"pe"`
	PB         float64   `json:"pb"`
	MarketCap  float64   `json:"market_cap"`
	Source     string    `gorm:"size:50" json:"source"` // sina, tencent, eastmoney, tdx
	TradeDate  string    `gorm:"size:20;index" json:"trade_date"`
	CreatedAt  time.Time `json:"created_at"`
}

// SectorHeat - sector heat map data (板块 + 概念)
type SectorHeat struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Name       string    `gorm:"size:200" json:"name"`
	Code       string    `gorm:"size:20;index" json:"code"`
	Category   string    `gorm:"size:20;index;default:sector" json:"category"` // sector or concept
	ChangePct  float64   `json:"change_pct"`
	Volume     float64   `json:"volume"`
	Amount     float64   `json:"amount"`
	LeadStock  string    `gorm:"size:200" json:"lead_stock"`
	FlowIn     float64   `json:"flow_in"`
	FlowOut    float64   `json:"flow_out"`
	NetFlow    float64   `json:"net_flow"`
	NetPct     float64   `json:"net_pct"`
	TradeDate  string    `gorm:"size:20;index" json:"trade_date"`
	CreatedAt  time.Time `json:"created_at"`
}

// LimitUpBoard - 涨停封板数据
type LimitUpBoard struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Code         string    `gorm:"size:20;index" json:"code"`
	Name         string    `gorm:"size:100" json:"name"`
	Price        float64   `json:"price"`
	ChangePct    float64   `json:"change_pct"`
	LimitType    string    `gorm:"size:20" json:"limit_type"` // limit_up, limit_down, broken
	BoardCount   int       `json:"board_count"`                // 连板数
	FirstTime    string    `gorm:"size:20" json:"first_time"`
	LastTime     string    `gorm:"size:20" json:"last_time"`
	OpenCount    int       `json:"open_count"`     // 开板次数
	Concept      string    `gorm:"type:text" json:"concept"`
	FundAmount   float64   `json:"fund_amount"`
	TradeDate    string    `gorm:"size:20;index" json:"trade_date"`
	CreatedAt    time.Time `json:"created_at"`
}

// DragonTiger - 龙虎榜数据
type DragonTiger struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Code       string    `gorm:"size:20;index" json:"code"`
	Name       string    `gorm:"size:100" json:"name"`
	Reason     string    `gorm:"size:500" json:"reason"`
	BuyTotal   float64   `json:"buy_total"`
	SellTotal  float64   `json:"sell_total"`
	NetAmount  float64   `json:"net_amount"`
	BuyList    string    `gorm:"type:text" json:"buy_list"`
	SellList   string    `gorm:"type:text" json:"sell_list"`
	TradeDate  string    `gorm:"size:20;index" json:"trade_date"`
	CreatedAt  time.Time `json:"created_at"`
}

// MarketSentiment - 市场情绪数据
type MarketSentiment struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	Score           float64   `json:"score"`            // 情绪分 0-100
	LimitUpCount    int       `json:"limit_up_count"`   // 涨停数
	LimitDownCount  int       `json:"limit_down_count"` // 跌停数
	BrokenCount     int       `json:"broken_count"`     // 炸板数
	HighestBoard    int       `json:"highest_board"`    // 最高连板
	TotalAmount     float64   `json:"total_amount"`     // 总成交额(万亿)
	UpCount         int       `json:"up_count"`
	DownCount       int       `json:"down_count"`
	FlatCount       int       `json:"flat_count"`
	TradeDate       string    `gorm:"size:20;uniqueIndex" json:"trade_date"`
	CreatedAt       time.Time `json:"created_at"`
}

// StrategySignal - 策略信号
type StrategySignal struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	StrategyName string    `gorm:"size:100;index" json:"strategy_name"`
	Code         string    `gorm:"size:20;index" json:"code"`
	Name         string    `gorm:"size:100" json:"name"`
	Signal       string    `gorm:"size:20" json:"signal"` // buy, sell, hold
	Score        float64   `json:"score"`
	Factors      string    `gorm:"type:text" json:"factors"` // JSON of factor scores
	Reason       string    `gorm:"type:text" json:"reason"`
	TradeDate    string    `gorm:"size:20;index" json:"trade_date"`
	CreatedAt    time.Time `json:"created_at"`
}

// WatchlistItem - 自选股
type WatchlistItem struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"index" json:"user_id"`
	Code      string         `gorm:"size:20;index" json:"code"`
	Name      string         `gorm:"size:100" json:"name"`
	SortOrder int            `gorm:"default:0" json:"sort_order"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// KLineData - K线数据
type KLineData struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Code      string    `gorm:"size:20;index" json:"code"`
	Open      float64   `json:"open"`
	Close     float64   `json:"close"`
	High      float64   `json:"high"`
	Low       float64   `json:"low"`
	Volume    float64   `json:"volume"`
	Amount    float64   `json:"amount"`
	Period    string    `gorm:"size:10" json:"period"` // 1m, 5m, 15m, 30m, 60m, day, week
	TradeDate string    `gorm:"size:20;index" json:"trade_date"`
	CreatedAt time.Time `json:"created_at"`
}

// AuditLog - 审计日志
type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index" json:"user_id"`
	Username  string    `gorm:"size:100" json:"username"`
	Module    string    `gorm:"size:50;index" json:"module"`  // login, agent, market, strategy, data, admin
	Action    string    `gorm:"size:50;index" json:"action"`  // create, read, update, delete, query, execute
	Target    string    `gorm:"size:200" json:"target"`
	Detail    string    `gorm:"type:text" json:"detail"`
	IP        string    `gorm:"size:50" json:"ip"`
	UserAgent string    `gorm:"size:500" json:"user_agent"`
	Status    string    `gorm:"size:20;default:success" json:"status"`
	Duration  int64     `json:"duration"` // ms
	CreatedAt time.Time `json:"created_at"`
}

// StockPick - 今日推荐股票 (admin推送给所有用户)
type StockPick struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	Code          string         `gorm:"size:20;not null" json:"code"`
	Name          string         `gorm:"size:100" json:"name"`
	AttentionLow  float64        `json:"attention_low"`  // 建议关注区间 - 下限
	AttentionHigh float64        `json:"attention_high"` // 建议关注区间 - 上限
	TargetLow     float64        `json:"target_low"`     // 目标区间 - 下限
	TargetHigh    float64        `json:"target_high"`    // 目标区间 - 上限
	Reason        string         `gorm:"type:text" json:"reason"`
	PickDate      string         `gorm:"size:20;index" json:"pick_date"`
	CreatedBy     uint           `json:"created_by"`
	IsActive      bool           `gorm:"default:true" json:"is_active"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TaskLog - async task log
type TaskLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	TaskID    string    `gorm:"size:100;uniqueIndex" json:"task_id"`
	Type      string    `gorm:"size:50" json:"type"`
	Status    string    `gorm:"size:20" json:"status"`
	Input     string    `gorm:"type:text" json:"input"`
	Output    string    `gorm:"type:text" json:"output"`
	Error     string    `gorm:"type:text" json:"error"`
	UserID    uint      `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// AIStockPick - AI筛选股票结果 (杨永兴隔夜套利法八步筛选)
type AIStockPick struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	BatchID      string    `gorm:"size:50;index" json:"batch_id"`        // 批次ID: 20260416_1430
	Code         string    `gorm:"size:20;index" json:"code"`            // 股票代码
	Name         string    `gorm:"size:100" json:"name"`                 // 股票名称
	Industry     string    `gorm:"size:100" json:"industry"`             // 所属行业
	ClosePrice   float64   `json:"close_price"`                          // 收盘价
	ChangePct    float64   `json:"change_pct"`                           // 涨幅%
	TurnoverRate float64   `json:"turnover_rate"`                        // 换手率%
	VolumeRatio  float64   `json:"volume_ratio"`                         // 量比
	TotalMV      float64   `json:"total_mv"`                             // 总市值(亿)
	Amount       float64   `json:"amount"`                               // 成交额(亿)
	Open         float64   `json:"open"`                                 // 开盘价
	High         float64   `json:"high"`                                 // 最高价
	Low          float64   `json:"low"`                                  // 最低价
	PreClose     float64   `json:"pre_close"`                            // 昨收
	Concept      string    `gorm:"size:500" json:"concept"`              // 所属概念
	Score        float64   `json:"score"`                                // 综合评分
	PassedSteps  string    `gorm:"size:50" json:"passed_steps"`          // 通过的步骤 e.g. "1,2,3,4,5,6"
	Note         string    `gorm:"type:text" json:"note"`                // 筛选备注
	TradeDate    string    `gorm:"size:20;index" json:"trade_date"`      // 交易日期
	ScreenTime   string    `gorm:"size:20" json:"screen_time"`           // 筛选时间 HH:MM
	CreatedAt    time.Time `json:"created_at"`
}

// XiaofanCategory - 小樊精选分类
type XiaofanCategory struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"size:200;not null" json:"name"`       // 分类名称（支持中文）
	SortOrder int            `gorm:"default:0" json:"sort_order"`         // 排序序号
	UserID    uint           `gorm:"index" json:"user_id"`                // 创建用户
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Stocks    []XiaofanStock `gorm:"foreignKey:CategoryID" json:"stocks,omitempty"`
}

// XiaofanStock - 小樊精选股票
type XiaofanStock struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	CategoryID uint           `gorm:"index;not null" json:"category_id"`  // 所属分类
	Code       string         `gorm:"size:20;not null" json:"code"`       // 股票代码
	Name       string         `gorm:"size:100" json:"name"`               // 股票名称
	Note       string         `gorm:"size:500" json:"note"`               // 备注
	SortOrder  int            `gorm:"default:0" json:"sort_order"`        // 排序
	UserID     uint           `gorm:"index" json:"user_id"`               // 添加用户
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

// AIStockPickBatch - AI筛选批次记录
type AIStockPickBatch struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	BatchID        string    `gorm:"size:50;uniqueIndex" json:"batch_id"`
	TradeDate      string    `gorm:"size:20;index" json:"trade_date"`
	ScreenTime     string    `gorm:"size:20" json:"screen_time"`
	TotalStocks    int       `json:"total_stocks"`       // 全市场股票数
	MainBoard      int       `json:"main_board"`         // 主板股票数
	PctFilter      int       `json:"pct_filter"`         // 涨幅筛选后
	LimitFilter    int       `json:"limit_filter"`       // 涨停筛选后
	VolumeFilter   int       `json:"volume_filter"`      // 量比筛选后
	TurnoverFilter int       `json:"turnover_filter"`    // 换手筛选后
	MarketCapFilter int      `json:"market_cap_filter"`  // 市值筛选后
	ResultCount    int       `json:"result_count"`       // 最终结果数
	Status         string    `gorm:"size:20;default:completed" json:"status"` // running, completed, failed
	ErrorMsg       string    `gorm:"type:text" json:"error_msg"`
	CreatedAt      time.Time `json:"created_at"`
}
