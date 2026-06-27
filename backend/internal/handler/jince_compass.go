package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"time"

	"quantmind/internal/repository"
	"quantmind/pkg/response"

	"github.com/gin-gonic/gin"
)

// ==================== 金策罗盘 (Jin Ce Compass) ====================
// Reference: ScottZt/jin-ce-zhi-suan "三省六部体系"
// Pipeline: CrownPrince(太子监) → ZhongshuSheng(中书省) → MenxiaSheng(门下省) → ShangshuSheng(尚书省)
// Integrated with system settings AI model & data source configuration

// ==================== Data Models ====================

type JinCeStrategy struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Category    string   `json:"category"` // 短线/中线/长线/量化
	Tags        []string `json:"tags"`
	IsActive    bool     `json:"is_active"`
}

type JinCeAnalysisRequest struct {
	Code       string   `json:"code" binding:"required"`
	Name       string   `json:"name"`
	Mode       string   `json:"mode"`       // analyze/backtest/evolve
	Strategies []string `json:"strategies"` // strategy IDs to apply
	Period     string   `json:"period"`     // day/week/month
	DataSource string   `json:"data_source"`
}

type JinCeAnalysisResult struct {
	Code          string               `json:"code"`
	Name          string               `json:"name"`
	Mode          string               `json:"mode"`
	DataSource    string               `json:"data_source_used"`
	AIModel       string               `json:"ai_model"`
	AnalyzedAt    string               `json:"analyzed_at"`
	CrownPrince   *CrownPrinceResult   `json:"crown_prince"`
	ZhongshuSheng *ZhongshuResult      `json:"zhongshu_sheng"`
	MenxiaSheng   *MenxiaResult        `json:"menxia_sheng"`
	ShangshuSheng *ShangshuResult      `json:"shangshu_sheng"`
	AIInsights    string               `json:"ai_insights"`
	Suggestion    string               `json:"suggestion"` // buy/sell/hold
	Confidence    int                  `json:"confidence"` // 0-100
	RiskLevel     string               `json:"risk_level"` // low/medium/high
	Indicators    map[string]float64   `json:"indicators"`
	BacktestResult *BacktestSummary    `json:"backtest_result,omitempty"`
}

type CrownPrinceResult struct {
	IsValid       bool   `json:"is_valid"`
	IsST          bool   `json:"is_st"`
	IsLimitUp     bool   `json:"is_limit_up"`
	IsLimitDown   bool   `json:"is_limit_down"`
	Liquidity     string `json:"liquidity"`
	TradingStatus string `json:"trading_status"`
	Message       string `json:"message"`
	DataBars      int    `json:"data_bars"`
}

type ZhongshuResult struct {
	Signals   []StrategySignal `json:"signals"`
	BuyCount  int              `json:"buy_count"`
	SellCount int              `json:"sell_count"`
	HoldCount int              `json:"hold_count"`
	Consensus string           `json:"consensus"`
}

type StrategySignal struct {
	StrategyID   string  `json:"strategy_id"`
	StrategyName string  `json:"strategy_name"`
	Signal       string  `json:"signal"`
	Strength     float64 `json:"strength"`
	Reason       string  `json:"reason"`
}

type MenxiaResult struct {
	Approved     bool     `json:"approved"`
	RiskScore    float64  `json:"risk_score"`
	MaxPosition  float64  `json:"max_position"`
	StopLoss     float64  `json:"stop_loss"`
	TakeProfit   float64  `json:"take_profit"`
	RiskWarnings []string `json:"risk_warnings"`
}

type ShangshuResult struct {
	Action       string  `json:"action"`
	TargetPrice  float64 `json:"target_price"`
	EntryPrice   float64 `json:"entry_price"`
	ExitPrice    float64 `json:"exit_price"`
	PositionSize float64 `json:"position_size"`
	TimeHorizon  string  `json:"time_horizon"`
	Execution    string  `json:"execution"`
}

type BacktestSummary struct {
	StartDate    string  `json:"start_date"`
	EndDate      string  `json:"end_date"`
	TotalReturn  float64 `json:"total_return"`
	AnnualReturn float64 `json:"annual_return"`
	MaxDrawdown  float64 `json:"max_drawdown"`
	WinRate      float64 `json:"win_rate"`
	TradeCount   int     `json:"trade_count"`
	SharpeRatio  float64 `json:"sharpe_ratio"`
	ProfitFactor float64 `json:"profit_factor"`
}

// ==================== Built-in Strategies ====================
// Reference: jin-ce-zhi-suan strategy_params 01-09
var builtinCompassStrategies = []JinCeStrategy{
	{ID: "s01", Name: "MA均线突破", Description: "MA5/MA10/MA20金叉死叉系统，日线MA10容忍度2%", Category: "短线", Tags: []string{"均线", "趋势", "金叉"}, IsActive: true},
	{ID: "s02", Name: "MACD动量", Description: "MACD金叉死叉+柱状图背离，最大持仓240bar", Category: "中线", Tags: []string{"MACD", "动量", "背离"}, IsActive: true},
	{ID: "s03", Name: "趋势跟踪", Description: "趋势确认+止损5%跟踪，适合单边行情", Category: "中线", Tags: []string{"趋势", "止损"}, IsActive: true},
	{ID: "s04", Name: "KDJ超买超卖", Description: "KDJ金叉死叉+超买超卖区域反转", Category: "短线", Tags: []string{"KDJ", "超买超卖"}, IsActive: true},
	{ID: "s05", Name: "量价突破", Description: "放量突破+量比1.5倍筛选，最大持仓1200bar", Category: "短线", Tags: []string{"成交量", "突破", "量比"}, IsActive: true},
	{ID: "s06", Name: "均线回踩", Description: "MA26均线回踩支撑+移动止损1%", Category: "中线", Tags: []string{"均线", "回踩", "支撑"}, IsActive: true},
	{ID: "s07", Name: "跳空缺口", Description: "向下跳空0.2%缺口+移动止损1%", Category: "短线", Tags: []string{"缺口", "跳空"}, IsActive: true},
	{ID: "s08", Name: "动量反转", Description: "短期动量衰竭反转+移动止损1%", Category: "短线", Tags: []string{"动量", "反转"}, IsActive: true},
	{ID: "s09", Name: "箱体RSI", Description: "箱体240周期+RSI超卖30买入超买70卖出", Category: "长线", Tags: []string{"箱体", "RSI", "区间"}, IsActive: true},
	{ID: "s10", Name: "布林带", Description: "布林带收口扩张+上下轨突破信号", Category: "中线", Tags: []string{"布林", "波动率"}, IsActive: true},
	{ID: "s11", Name: "缠论结构", Description: "缠中说禅笔段+中枢+买卖点判断", Category: "中线", Tags: []string{"缠论", "结构"}, IsActive: true},
	{ID: "s12", Name: "AI多因子", Description: "LLM综合技术面+资金面+情绪面分析", Category: "量化", Tags: []string{"AI", "多因子", "LLM"}, IsActive: true},
}

// ==================== Handlers ====================

func (h *Handler) GetJinCeStrategies(c *gin.Context) {
	response.Success(c, gin.H{
		"strategies": builtinCompassStrategies,
		"total":      len(builtinCompassStrategies),
	})
}

func (h *Handler) RunJinCeAnalysis(c *gin.Context) {
	var req JinCeAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, 400, "参数错误: "+err.Error())
		return
	}

	if req.Mode == "" {
		req.Mode = "analyze"
	}
	if req.Period == "" {
		req.Period = "day"
	}
	if req.DataSource == "" {
		req.DataSource = "system"
	}
	if len(req.Strategies) == 0 {
		for _, s := range builtinCompassStrategies {
			if s.IsActive {
				req.Strategies = append(req.Strategies, s.ID)
			}
		}
	}

	log.Printf("[金策罗盘] 开始分析 code=%s name=%s mode=%s period=%s source=%s strategies=%v",
		req.Code, req.Name, req.Mode, req.Period, req.DataSource, req.Strategies)

	// Step 1: Fetch K-line data (with fallback)
	klines, dataSourceUsed, err := compassFetchKlines(req.Code, req.Period, req.DataSource)
	if err != nil {
		log.Printf("[金策罗盘] 数据获取失败: %v", err)
		response.Error(c, 500, "数据获取失败: "+err.Error())
		return
	}

	if len(klines) < 5 {
		log.Printf("[金策罗盘] K线数据不足: %d bars", len(klines))
		response.Error(c, 500, fmt.Sprintf("K线数据不足(仅%d根)，请检查股票代码是否正确", len(klines)))
		return
	}

	log.Printf("[金策罗盘] 获取K线 %d 根, 数据源=%s", len(klines), dataSourceUsed)

	// Step 2: CrownPrince - pre-validation
	crownResult := compassCrownPrince(req.Code, req.Name, klines)

	// Step 3: ZhongshuSheng - strategy signal generation
	zhongshuResult := compassZhongshuSheng(req.Strategies, klines)

	// Step 4: MenxiaSheng - risk control audit
	menxiaResult := compassMenxiaSheng(klines, zhongshuResult)

	// Step 5: ShangshuSheng - execution recommendation
	shangshuResult := compassShangshuSheng(klines, zhongshuResult, menxiaResult)

	// Step 6: AI Analysis (optional, uses system AI config)
	baseURL, apiKey, modelName := getDecisionAIConfig()
	aiInsights, aiSuggestion, aiConfidence := compassAIAnalysis(
		req.Code, req.Name, req.Mode, klines, zhongshuResult, menxiaResult,
		modelName, baseURL, apiKey,
	)

	// Final suggestion: combine AI + strategy consensus
	finalSuggestion := zhongshuResult.Consensus
	finalConfidence := 50
	if aiSuggestion != "" {
		finalSuggestion = aiSuggestion
		finalConfidence = aiConfidence
	}

	riskLevel := "medium"
	if menxiaResult.RiskScore < 30 {
		riskLevel = "low"
	} else if menxiaResult.RiskScore > 70 {
		riskLevel = "high"
	}

	result := JinCeAnalysisResult{
		Code:          req.Code,
		Name:          req.Name,
		Mode:          req.Mode,
		DataSource:    dataSourceUsed,
		AIModel:       modelName,
		AnalyzedAt:    time.Now().Format("2006-01-02 15:04:05"),
		CrownPrince:   crownResult,
		ZhongshuSheng: zhongshuResult,
		MenxiaSheng:   menxiaResult,
		ShangshuSheng: shangshuResult,
		AIInsights:    aiInsights,
		Suggestion:    finalSuggestion,
		Confidence:    finalConfidence,
		RiskLevel:     riskLevel,
		Indicators:    compassIndicators(klines),
	}

	if req.Mode == "backtest" {
		result.BacktestResult = compassBacktest(klines, zhongshuResult)
	}

	response.Success(c, result)
}

func (h *Handler) GetJinCeHistory(c *gin.Context) {
	code := c.Query("code")
	var decisions []StockDecision
	query := repository.DB.Order("created_at DESC").Limit(20)
	if code != "" {
		query = query.Where("code = ?", code)
	}
	query.Find(&decisions)
	response.Success(c, decisions)
}

// ==================== Step 1: Data Fetching ====================

func compassFetchKlines(code, period, dataSource string) ([]map[string]interface{}, string, error) {
	freqMap := map[string]string{"day": "daily", "week": "weekly", "month": "monthly"}
	freq := freqMap[period]
	if freq == "" {
		freq = "daily"
	}

	// Try AkShare service first
	akURL := getAkShareServiceURL()
	if akURL != "" {
		klines, err := compassFetchFromAkShare(akURL, code, freq)
		if err == nil && len(klines) > 0 {
			return klines, "akshare", nil
		}
		log.Printf("[金策罗盘] AkShare获取失败: %v, 尝试东方财富", err)
	}

	// Fallback: eastmoney historical API
	klines, err := compassFetchFromEastmoney(code, period)
	if err == nil && len(klines) > 0 {
		return klines, "eastmoney", nil
	}
	log.Printf("[金策罗盘] 东方财富获取失败: %v", err)

	return nil, "", fmt.Errorf("所有数据源均获取失败")
}

func compassFetchFromAkShare(akURL, code, freq string) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/kline?code=%s&freq=%s&count=120", akURL, code, freq)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if isHTMLResponse(body) {
		return nil, fmt.Errorf("AkShare返回HTML")
	}

	// Try format: {code:0, data:{klines:[...]}}
	var result1 struct {
		Code int `json:"code"`
		Data struct {
			Klines []map[string]interface{} `json:"klines"`
		} `json:"data"`
	}
	if json.Unmarshal(body, &result1) == nil && len(result1.Data.Klines) > 0 {
		return result1.Data.Klines, nil
	}

	// Try format: {code:0, data:[...]}
	var result2 struct {
		Code int                      `json:"code"`
		Data []map[string]interface{} `json:"data"`
	}
	if json.Unmarshal(body, &result2) == nil && len(result2.Data) > 0 {
		return result2.Data, nil
	}

	return nil, fmt.Errorf("AkShare数据解析失败")
}

func compassFetchFromEastmoney(code, period string) ([]map[string]interface{}, error) {
	// Determine market prefix
	prefix := "1." // Shanghai
	if strings.HasPrefix(code, "0") || strings.HasPrefix(code, "3") {
		prefix = "0." // Shenzhen
	}
	secid := prefix + code

	kltMap := map[string]string{"day": "101", "week": "102", "month": "103"}
	klt := kltMap[period]
	if klt == "" {
		klt = "101"
	}

	url := fmt.Sprintf(
		"https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=%s&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=%s&fqt=1&lmt=120&_=%d",
		secid, klt, time.Now().UnixMilli(),
	)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if isHTMLResponse(body) {
		return nil, fmt.Errorf("东方财富返回HTML")
	}

	var emResp struct {
		Data struct {
			Code   string   `json:"code"`
			Name   string   `json:"name"`
			Klines []string `json:"klines"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &emResp); err != nil {
		return nil, fmt.Errorf("东方财富JSON解析失败: %v", err)
	}

	if len(emResp.Data.Klines) == 0 {
		return nil, fmt.Errorf("东方财富返回空K线")
	}

	// Parse kline strings: "2025-01-02,10.5,11.0,10.3,10.8,100000,1050000"
	klines := make([]map[string]interface{}, 0, len(emResp.Data.Klines))
	for _, line := range emResp.Data.Klines {
		parts := strings.Split(line, ",")
		if len(parts) < 7 {
			continue
		}
		var open, close, high, low, volume, amount float64
		fmt.Sscanf(parts[1], "%f", &open)
		fmt.Sscanf(parts[2], "%f", &close)
		fmt.Sscanf(parts[3], "%f", &high)
		fmt.Sscanf(parts[4], "%f", &low)
		fmt.Sscanf(parts[5], "%f", &volume)
		fmt.Sscanf(parts[6], "%f", &amount)
		klines = append(klines, map[string]interface{}{
			"date":   parts[0],
			"open":   open,
			"close":  close,
			"high":   high,
			"low":    low,
			"volume": volume,
			"amount": amount,
		})
	}

	return klines, nil
}

// ==================== Step 2: CrownPrince (太子监 - 前置校验) ====================

func compassCrownPrince(code, name string, klines []map[string]interface{}) *CrownPrinceResult {
	result := &CrownPrinceResult{
		IsValid:       true,
		TradingStatus: "normal",
		Liquidity:     "medium",
		Message:       "数据校验通过，可以进行策略分析",
		DataBars:      len(klines),
	}

	// ST check
	if strings.Contains(name, "ST") || strings.Contains(name, "*ST") {
		result.IsST = true
		result.Message = "⚠️ ST股票，交易规则特殊(涨跌幅5%)"
	}

	if len(klines) == 0 {
		result.IsValid = false
		result.Message = "无可用K线数据"
		return result
	}

	// Last bar analysis
	last := klines[len(klines)-1]
	open := safeFloat(last, "open")
	close := safeFloat(last, "close")

	if open > 0 {
		pctChg := (close - open) / open * 100
		if pctChg >= 9.8 {
			result.IsLimitUp = true
			result.Message = "涨停板，T+1制度下次日才可卖出"
		} else if pctChg <= -9.8 {
			result.IsLimitDown = true
			result.Message = "跌停板，流动性枯竭"
		}
	}

	// Volume/liquidity
	if len(klines) >= 5 {
		totalVol := 0.0
		for i := len(klines) - 5; i < len(klines); i++ {
			totalVol += safeFloat(klines[i], "volume")
		}
		avgVol := totalVol / 5
		if avgVol > 500000 {
			result.Liquidity = "high"
		} else if avgVol < 30000 {
			result.Liquidity = "low"
			if !result.IsST {
				result.Message = "流动性不足，成交低迷"
			}
		}
	}

	return result
}

// ==================== Step 3: ZhongshuSheng (中书省 - 策略信号) ====================

func compassZhongshuSheng(strategyIDs []string, klines []map[string]interface{}) *ZhongshuResult {
	result := &ZhongshuResult{
		Signals: []StrategySignal{},
	}

	if len(klines) < 10 {
		result.Consensus = "hold"
		return result
	}

	for _, sid := range strategyIDs {
		strategy := findCompassStrategy(sid)
		if strategy == nil {
			continue
		}
		signal := compassGenerateSignal(strategy, klines)
		result.Signals = append(result.Signals, signal)

		switch signal.Signal {
		case "buy":
			result.BuyCount++
		case "sell":
			result.SellCount++
		default:
			result.HoldCount++
		}
	}

	total := result.BuyCount + result.SellCount + result.HoldCount
	if total == 0 {
		result.Consensus = "hold"
	} else if result.BuyCount > result.SellCount && result.BuyCount > result.HoldCount {
		result.Consensus = "buy"
	} else if result.SellCount > result.BuyCount && result.SellCount > result.HoldCount {
		result.Consensus = "sell"
	} else {
		result.Consensus = "hold"
	}

	return result
}

func compassGenerateSignal(strategy *JinCeStrategy, klines []map[string]interface{}) StrategySignal {
	signal := StrategySignal{
		StrategyID:   strategy.ID,
		StrategyName: strategy.Name,
		Signal:       "hold",
		Strength:     0.5,
		Reason:       "信号中性",
	}

	n := len(klines)
	if n < 20 {
		signal.Reason = "K线数据不足20根"
		return signal
	}

	closes := extractCloses(klines)
	volumes := extractVolumes(klines)
	lastClose := closes[n-1]
	prevClose := closes[n-2]

	switch strategy.ID {
	case "s01": // MA均线突破
		ma5 := sma(closes, 5)
		ma10 := sma(closes, 10)
		ma20 := sma(closes, 20)
		if ma5 > ma10 && ma10 > ma20 && lastClose > ma5 {
			signal.Signal = "buy"
			signal.Strength = 0.75
			signal.Reason = fmt.Sprintf("多头排列MA5(%.2f)>MA10(%.2f)>MA20(%.2f)，价格站上均线", ma5, ma10, ma20)
		} else if ma5 < ma10 && ma10 < ma20 && lastClose < ma5 {
			signal.Signal = "sell"
			signal.Strength = 0.75
			signal.Reason = fmt.Sprintf("空头排列MA5(%.2f)<MA10(%.2f)<MA20(%.2f)", ma5, ma10, ma20)
		} else if lastClose > ma5 && ma5 > ma10 {
			signal.Signal = "buy"
			signal.Strength = 0.6
			signal.Reason = "MA5上穿MA10，短期趋势向上"
		} else if lastClose < ma5 && ma5 < ma10 {
			signal.Signal = "sell"
			signal.Strength = 0.6
			signal.Reason = "MA5下穿MA10，短期趋势向下"
		} else {
			signal.Reason = fmt.Sprintf("均线纠缠，MA5=%.2f MA10=%.2f", ma5, ma10)
		}

	case "s02": // MACD动量
		macdLine, signalLine, hist := computeMACD(closes)
		if macdLine > signalLine && hist > 0 {
			if len(closes) >= 3 {
				prevHist := computeMACDHist(closes[:n-1])
				if prevHist <= 0 {
					signal.Signal = "buy"
					signal.Strength = 0.8
					signal.Reason = fmt.Sprintf("MACD金叉确认，MACD=%.3f Signal=%.3f", macdLine, signalLine)
				} else {
					signal.Signal = "buy"
					signal.Strength = 0.6
					signal.Reason = "MACD多头运行"
				}
			}
		} else if macdLine < signalLine && hist < 0 {
			signal.Signal = "sell"
			signal.Strength = 0.7
			signal.Reason = fmt.Sprintf("MACD死叉，MACD=%.3f Signal=%.3f", macdLine, signalLine)
		} else {
			signal.Reason = "MACD趋于零轴"
		}

	case "s03": // 趋势跟踪
		ma20 := sma(closes, 20)
		ma60val := ma20
		if n >= 60 {
			ma60val = sma(closes, 60)
		}
		pctFromMa20 := (lastClose - ma20) / ma20 * 100
		if lastClose > ma20 && ma20 > ma60val && pctFromMa20 < 10 {
			signal.Signal = "buy"
			signal.Strength = 0.7
			signal.Reason = fmt.Sprintf("价格高于MA20 %.1f%%，趋势向上", pctFromMa20)
		} else if lastClose < ma20 && pctFromMa20 < -5 {
			signal.Signal = "sell"
			signal.Strength = 0.7
			signal.Reason = fmt.Sprintf("跌破MA20 %.1f%%，趋势破位", pctFromMa20)
		} else {
			signal.Reason = fmt.Sprintf("距MA20 %.1f%%", pctFromMa20)
		}

	case "s04": // KDJ
		k, d, j := computeKDJ(klines)
		if k < 20 && d < 20 && j < 0 {
			signal.Signal = "buy"
			signal.Strength = 0.7
			signal.Reason = fmt.Sprintf("KDJ超卖区 K=%.0f D=%.0f J=%.0f", k, d, j)
		} else if k > 80 && d > 80 && j > 100 {
			signal.Signal = "sell"
			signal.Strength = 0.7
			signal.Reason = fmt.Sprintf("KDJ超买区 K=%.0f D=%.0f J=%.0f", k, d, j)
		} else if k > d && k < 50 {
			signal.Signal = "buy"
			signal.Strength = 0.55
			signal.Reason = fmt.Sprintf("KDJ金叉低位 K=%.0f D=%.0f", k, d)
		} else {
			signal.Reason = fmt.Sprintf("KDJ中性 K=%.0f D=%.0f J=%.0f", k, d, j)
		}

	case "s05": // 量价突破
		avgVol5 := volumeMA(volumes, 5)
		lastVol := volumes[n-1]
		volRatio := 0.0
		if avgVol5 > 0 {
			volRatio = lastVol / avgVol5
		}
		pctChg := 0.0
		if prevClose > 0 {
			pctChg = (lastClose - prevClose) / prevClose * 100
		}
		if volRatio > 1.5 && pctChg > 2 {
			signal.Signal = "buy"
			signal.Strength = 0.8
			signal.Reason = fmt.Sprintf("放量%.1f倍上涨%.1f%%", volRatio, pctChg)
		} else if volRatio > 1.5 && pctChg < -2 {
			signal.Signal = "sell"
			signal.Strength = 0.7
			signal.Reason = fmt.Sprintf("放量%.1f倍下跌%.1f%%", volRatio, pctChg)
		} else {
			signal.Reason = fmt.Sprintf("量比%.1f，涨幅%.1f%%", volRatio, pctChg)
		}

	case "s06": // 均线回踩 MA26
		ma26 := sma(closes, min(26, n))
		pctFromMA := (lastClose - ma26) / ma26 * 100
		if pctFromMA > 0 && pctFromMA < 2 && lastClose > prevClose {
			signal.Signal = "buy"
			signal.Strength = 0.7
			signal.Reason = fmt.Sprintf("回踩MA26支撑(距%.1f%%)后反弹", pctFromMA)
		} else if pctFromMA < -3 {
			signal.Signal = "sell"
			signal.Strength = 0.65
			signal.Reason = fmt.Sprintf("跌破MA26 %.1f%%", pctFromMA)
		} else {
			signal.Reason = fmt.Sprintf("距MA26 %.1f%%", pctFromMA)
		}

	case "s07": // 跳空缺口
		open := safeFloat(klines[n-1], "open")
		if prevClose > 0 && open > 0 {
			gapPct := (open - prevClose) / prevClose * 100
			if gapPct < -0.2 && lastClose > open {
				signal.Signal = "buy"
				signal.Strength = 0.65
				signal.Reason = fmt.Sprintf("向下跳空%.1f%%后收阳回补", gapPct)
			} else if gapPct > 2 && lastClose < open {
				signal.Signal = "sell"
				signal.Strength = 0.6
				signal.Reason = fmt.Sprintf("高开%.1f%%后回落", gapPct)
			} else {
				signal.Reason = fmt.Sprintf("缺口%.2f%%", gapPct)
			}
		}

	case "s08": // 动量反转
		if n >= 5 {
			mom3 := (lastClose - closes[n-4]) / closes[n-4] * 100
			mom5 := (lastClose - closes[n-6]) / closes[n-6] * 100
			if mom5 < -8 && mom3 > 0 {
				signal.Signal = "buy"
				signal.Strength = 0.7
				signal.Reason = fmt.Sprintf("5日跌%.1f%%后3日涨%.1f%%，超跌反弹", mom5, mom3)
			} else if mom5 > 10 && mom3 < -2 {
				signal.Signal = "sell"
				signal.Strength = 0.65
				signal.Reason = fmt.Sprintf("5日涨%.1f%%后3日跌%.1f%%，动量衰竭", mom5, mom3)
			} else {
				signal.Reason = fmt.Sprintf("3日动量%.1f%% 5日动量%.1f%%", mom3, mom5)
			}
		}

	case "s09": // 箱体RSI
		rsi := computeRSI(closes, 14)
		high20 := maxSlice(closes[n-20:])
		low20 := minSlice(closes[n-20:])
		boxRange := 0.0
		if low20 > 0 {
			boxRange = (high20 - low20) / low20 * 100
		}
		posInBox := 0.0
		if high20 > low20 {
			posInBox = (lastClose - low20) / (high20 - low20) * 100
		}
		if rsi < 30 && posInBox < 20 {
			signal.Signal = "buy"
			signal.Strength = 0.75
			signal.Reason = fmt.Sprintf("RSI=%.0f超卖+箱体底部(位置%.0f%%)", rsi, posInBox)
		} else if rsi > 70 && posInBox > 80 {
			signal.Signal = "sell"
			signal.Strength = 0.7
			signal.Reason = fmt.Sprintf("RSI=%.0f超买+箱体顶部(位置%.0f%%)", rsi, posInBox)
		} else {
			signal.Reason = fmt.Sprintf("RSI=%.0f 箱体位置%.0f%% 振幅%.1f%%", rsi, posInBox, boxRange)
		}

	case "s10": // 布林带
		mid, upper, lower := computeBollinger(closes, 20)
		if lastClose <= lower && lastClose > prevClose {
			signal.Signal = "buy"
			signal.Strength = 0.7
			signal.Reason = fmt.Sprintf("触及下轨(%.2f)后反弹", lower)
		} else if lastClose >= upper {
			signal.Signal = "sell"
			signal.Strength = 0.65
			signal.Reason = fmt.Sprintf("触及上轨(%.2f)，注意回调", upper)
		} else {
			bandWidth := 0.0
			if mid > 0 {
				bandWidth = (upper - lower) / mid * 100
			}
			signal.Reason = fmt.Sprintf("布林中轨%.2f 带宽%.1f%%", mid, bandWidth)
		}

	case "s11": // 缠论结构 (simplified)
		// Use fractal high/low to identify trend
		if n >= 10 {
			h1 := maxSlice(closes[n-10 : n-5])
			l1 := minSlice(closes[n-10 : n-5])
			h2 := maxSlice(closes[n-5:])
			l2 := minSlice(closes[n-5:])
			if h2 > h1 && l2 > l1 {
				signal.Signal = "buy"
				signal.Strength = 0.6
				signal.Reason = "近5日高低点抬升，上升趋势延续"
			} else if h2 < h1 && l2 < l1 {
				signal.Signal = "sell"
				signal.Strength = 0.6
				signal.Reason = "近5日高低点下移，下降趋势"
			} else {
				signal.Reason = "高低点交错，中枢震荡"
			}
		}

	case "s12": // AI多因子 - will be augmented by AI analysis
		ma5 := sma(closes, 5)
		ma20 := sma(closes, 20)
		rsi := computeRSI(closes, 14)
		volRatio := 1.0
		if n >= 5 {
			avgVol5 := volumeMA(volumes, 5)
			if avgVol5 > 0 {
				volRatio = volumes[n-1] / avgVol5
			}
		}
		score := 0.0
		if lastClose > ma5 {
			score += 1
		}
		if ma5 > ma20 {
			score += 1
		}
		if rsi > 40 && rsi < 60 {
			score += 0.5
		} else if rsi < 30 {
			score += 1.5
		}
		if volRatio > 1.2 && lastClose > prevClose {
			score += 1
		}
		if score >= 3 {
			signal.Signal = "buy"
			signal.Strength = 0.7
			signal.Reason = fmt.Sprintf("多因子评分%.1f/5 (MA+RSI%.0f+Vol%.1fx)", score, rsi, volRatio)
		} else if score <= 1 {
			signal.Signal = "sell"
			signal.Strength = 0.6
			signal.Reason = fmt.Sprintf("多因子评分%.1f/5 偏弱", score)
		} else {
			signal.Reason = fmt.Sprintf("多因子评分%.1f/5 中性", score)
		}
	}

	return signal
}

// ==================== Step 4: MenxiaSheng (门下省 - 风控审核) ====================

func compassMenxiaSheng(klines []map[string]interface{}, zhongshu *ZhongshuResult) *MenxiaResult {
	result := &MenxiaResult{
		Approved:     true,
		RiskScore:    50,
		MaxPosition:  30,
		RiskWarnings: []string{},
	}

	n := len(klines)
	if n == 0 {
		result.Approved = false
		result.RiskWarnings = append(result.RiskWarnings, "无数据")
		return result
	}

	lastClose := safeFloat(klines[n-1], "close")

	// Stop loss / take profit based on ATR
	atr := computeATR(klines, 14)
	if lastClose > 0 && atr > 0 {
		result.StopLoss = lastClose - 2*atr
		result.TakeProfit = lastClose + 3*atr
	} else if lastClose > 0 {
		result.StopLoss = lastClose * 0.95
		result.TakeProfit = lastClose * 1.10
	}

	// Risk scoring based on consensus
	switch zhongshu.Consensus {
	case "buy":
		result.RiskScore = 25
		result.MaxPosition = 50
	case "sell":
		result.RiskScore = 75
		result.MaxPosition = 0
		result.RiskWarnings = append(result.RiskWarnings, "多策略发出卖出信号")
	case "hold":
		result.RiskScore = 50
		result.MaxPosition = 20
	}

	// Volatility check
	if n >= 5 {
		recentHigh := 0.0
		recentLow := math.MaxFloat64
		for i := n - 5; i < n; i++ {
			h := safeFloat(klines[i], "high")
			l := safeFloat(klines[i], "low")
			if h > recentHigh {
				recentHigh = h
			}
			if l < recentLow {
				recentLow = l
			}
		}
		if recentLow > 0 {
			volatility := (recentHigh - recentLow) / recentLow * 100
			if volatility > 15 {
				result.RiskScore += 15
				result.RiskWarnings = append(result.RiskWarnings, fmt.Sprintf("近5日振幅%.1f%%，波动较大", volatility))
			}
		}
	}

	// Max drawdown from recent high
	if n >= 20 {
		closes := extractCloses(klines)
		peak := maxSlice(closes[n-20:])
		if peak > 0 {
			drawdown := (peak - lastClose) / peak * 100
			if drawdown > 10 {
				result.RiskScore += 10
				result.RiskWarnings = append(result.RiskWarnings, fmt.Sprintf("距20日高点回撤%.1f%%", drawdown))
			}
		}
	}

	// Final approval check
	if result.RiskScore >= 80 {
		result.Approved = false
		result.MaxPosition = 0
		result.RiskWarnings = append(result.RiskWarnings, "⛔ 风控评分过高，建议回避")
	}

	return result
}

// ==================== Step 5: ShangshuSheng (尚书省 - 执行建议) ====================

func compassShangshuSheng(klines []map[string]interface{}, zhongshu *ZhongshuResult, menxia *MenxiaResult) *ShangshuResult {
	n := len(klines)
	lastClose := 0.0
	if n > 0 {
		lastClose = safeFloat(klines[n-1], "close")
	}

	result := &ShangshuResult{
		Action:       zhongshu.Consensus,
		PositionSize: menxia.MaxPosition,
		TimeHorizon:  "中线5-20日",
		Execution:    "A股T+1，建议分批进出",
	}

	if lastClose > 0 {
		result.EntryPrice = lastClose * 0.995 // 略低于现价
		result.TargetPrice = menxia.TakeProfit
		result.ExitPrice = menxia.StopLoss
	}

	if !menxia.Approved {
		result.Action = "hold"
		result.PositionSize = 0
		result.Execution = "风控未通过，暂不操作，等待信号改善"
	}

	// Determine time horizon from signal strength
	buyStrength := 0.0
	sellStrength := 0.0
	for _, sig := range zhongshu.Signals {
		if sig.Signal == "buy" {
			buyStrength += sig.Strength
		} else if sig.Signal == "sell" {
			sellStrength += sig.Strength
		}
	}

	if buyStrength > 3.0 {
		result.TimeHorizon = "短线1-5日(强势信号)"
	} else if buyStrength > 1.5 {
		result.TimeHorizon = "中线5-20日"
	} else {
		result.TimeHorizon = "长线20日+(等待确认)"
	}

	return result
}

// ==================== Step 6: AI Analysis ====================

func compassAIAnalysis(code, name, mode string, klines []map[string]interface{}, zhongshu *ZhongshuResult, menxia *MenxiaResult, modelName, baseURL, apiKey string) (string, string, int) {
	if apiKey == "" {
		return "AI模型未配置，请前往【系统设置】添加AI模型API Key", zhongshu.Consensus, 50
	}

	n := len(klines)
	lastClose := 0.0
	pctChg := 0.0
	if n >= 2 {
		lastClose = safeFloat(klines[n-1], "close")
		prevClose := safeFloat(klines[n-2], "close")
		if prevClose > 0 {
			pctChg = (lastClose - prevClose) / prevClose * 100
		}
	}

	// Compute indicators for prompt
	indicators := compassIndicators(klines)

	prompt := fmt.Sprintf(`你是金策罗盘AI策略分析师(参考三省六部体系)。请对以下股票进行综合研判：

## 基本信息
- 股票：%s（%s）
- 最新价：%.2f  涨跌：%.2f%%
- K线数量：%d根
- 分析模式：%s

## 技术指标
- MA5=%.2f  MA10=%.2f  MA20=%.2f
- RSI(14)=%.1f
- MACD=%.4f

## 策略共识
- 买入信号：%d个  卖出信号：%d个  持有信号：%d个
- 共识方向：%s

## 风控信息
- 风控是否通过：%v
- 风险评分：%.0f/100
- 建议止损：%.2f  止盈：%.2f

请用300字以内给出：
1. 【趋势判断】当前所处趋势阶段
2. 【关键价位】支撑位和压力位
3. 【操作建议】明确买入/卖出/持有
4. 【风险提示】主要风险点

最后一行请严格按格式输出：
DECISION: {buy/sell/hold} CONFIDENCE: {0-100}`,
		name, code, lastClose, pctChg, n, mode,
		indicators["ma5"], indicators["ma10"], indicators["ma20"],
		indicators["rsi14"], indicators["macd"],
		zhongshu.BuyCount, zhongshu.SellCount, zhongshu.HoldCount, zhongshu.Consensus,
		menxia.Approved, menxia.RiskScore, menxia.StopLoss, menxia.TakeProfit,
	)

	reqBody := map[string]interface{}{
		"model": modelName,
		"messages": []map[string]string{
			{"role": "system", "content": "你是专业A股量化分析师。擅长技术分析、资金分析和风险控制。回答简洁专业。"},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.3,
		"max_tokens":  1000,
	}

	bodyBytes, _ := json.Marshal(reqBody)
	url := strings.TrimRight(baseURL, "/") + "/chat/completions"

	client := &http.Client{Timeout: 60 * time.Second}
	req, _ := http.NewRequest("POST", url, bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[金策罗盘] AI请求失败: %v", err)
		return "AI分析暂时不可用: " + err.Error(), zhongshu.Consensus, 50
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		log.Printf("[金策罗盘] AI返回状态码 %d: %s", resp.StatusCode, string(respBody[:min(200, len(respBody))]))
		return fmt.Sprintf("AI请求异常(HTTP %d)", resp.StatusCode), zhongshu.Consensus, 50
	}

	var llmResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &llmResp); err != nil || len(llmResp.Choices) == 0 {
		if llmResp.Error.Message != "" {
			return "AI服务错误: " + llmResp.Error.Message, zhongshu.Consensus, 50
		}
		return "AI响应解析失败", zhongshu.Consensus, 50
	}

	content := llmResp.Choices[0].Message.Content

	// Parse DECISION line
	suggestion := zhongshu.Consensus
	confidence := 50
	for _, line := range strings.Split(content, "\n") {
		upper := strings.ToUpper(line)
		if strings.Contains(upper, "DECISION:") {
			if strings.Contains(upper, "BUY") {
				suggestion = "buy"
			} else if strings.Contains(upper, "SELL") {
				suggestion = "sell"
			} else if strings.Contains(upper, "HOLD") {
				suggestion = "hold"
			}
		}
		if strings.Contains(upper, "CONFIDENCE:") {
			fmt.Sscanf(upper[strings.Index(upper, "CONFIDENCE:")+11:], " %d", &confidence)
			if confidence < 0 {
				confidence = 50
			}
			if confidence > 100 {
				confidence = 100
			}
		}
		// Also support Chinese format
		if strings.Contains(line, "建议") {
			if strings.Contains(line, "买入") {
				suggestion = "buy"
			} else if strings.Contains(line, "卖出") {
				suggestion = "sell"
			}
		}
	}

	return content, suggestion, confidence
}

// ==================== Indicators ====================

func compassIndicators(klines []map[string]interface{}) map[string]float64 {
	indicators := map[string]float64{
		"ma5": 0, "ma10": 0, "ma20": 0, "ma60": 0,
		"rsi14": 50, "macd": 0,
	}

	if len(klines) < 5 {
		return indicators
	}

	closes := extractCloses(klines)
	n := len(closes)

	if n >= 5 {
		indicators["ma5"] = sma(closes, 5)
	}
	if n >= 10 {
		indicators["ma10"] = sma(closes, 10)
	}
	if n >= 20 {
		indicators["ma20"] = sma(closes, 20)
	}
	if n >= 60 {
		indicators["ma60"] = sma(closes, 60)
	}
	if n >= 14 {
		indicators["rsi14"] = computeRSI(closes, 14)
	}
	if n >= 26 {
		macd, _, _ := computeMACD(closes)
		indicators["macd"] = macd
	}

	return indicators
}

// ==================== Backtest ====================

func compassBacktest(klines []map[string]interface{}, zhongshu *ZhongshuResult) *BacktestSummary {
	n := len(klines)
	if n < 30 {
		return nil
	}

	closes := extractCloses(klines)

	// Simple MA crossover backtest
	var trades []float64
	inPosition := false
	entryPrice := 0.0
	tradeCount := 0

	for i := 20; i < n; i++ {
		ma5 := sma(closes[:i+1], 5)
		ma10 := sma(closes[:i+1], 10)

		if !inPosition && ma5 > ma10 && closes[i] > ma5 {
			inPosition = true
			entryPrice = closes[i]
			tradeCount++
		} else if inPosition && (ma5 < ma10 || closes[i] < entryPrice*0.95) {
			inPosition = false
			pnl := (closes[i] - entryPrice) / entryPrice
			trades = append(trades, pnl)
		}
	}

	// Close any open position
	if inPosition && entryPrice > 0 {
		pnl := (closes[n-1] - entryPrice) / entryPrice
		trades = append(trades, pnl)
	}

	if len(trades) == 0 {
		return &BacktestSummary{
			StartDate:    safeString(klines[0], "date"),
			EndDate:      safeString(klines[n-1], "date"),
			TotalReturn:  0,
			AnnualReturn: 0,
			MaxDrawdown:  0,
			WinRate:      0,
			TradeCount:   0,
			SharpeRatio:  0,
			ProfitFactor: 0,
		}
	}

	// Calculate metrics
	wins := 0
	totalReturn := 0.0
	totalGain := 0.0
	totalLoss := 0.0
	for _, t := range trades {
		totalReturn += t
		if t > 0 {
			wins++
			totalGain += t
		} else {
			totalLoss -= t
		}
	}

	winRate := float64(wins) / float64(len(trades))
	profitFactor := 0.0
	if totalLoss > 0 {
		profitFactor = totalGain / totalLoss
	}

	// Max drawdown
	equity := 1.0
	peak := 1.0
	maxDD := 0.0
	for _, t := range trades {
		equity *= (1 + t)
		if equity > peak {
			peak = equity
		}
		dd := (peak - equity) / peak
		if dd > maxDD {
			maxDD = dd
		}
	}

	// Sharpe ratio (simplified)
	avgReturn := totalReturn / float64(len(trades))
	variance := 0.0
	for _, t := range trades {
		variance += (t - avgReturn) * (t - avgReturn)
	}
	stdDev := math.Sqrt(variance / float64(len(trades)))
	sharpe := 0.0
	if stdDev > 0 {
		sharpe = avgReturn / stdDev * math.Sqrt(252) // annualized
	}

	return &BacktestSummary{
		StartDate:    safeString(klines[0], "date"),
		EndDate:      safeString(klines[n-1], "date"),
		TotalReturn:  totalReturn,
		AnnualReturn: totalReturn * 2.5, // rough annualization for ~120 bars
		MaxDrawdown:  maxDD,
		WinRate:      winRate,
		TradeCount:   len(trades),
		SharpeRatio:  sharpe,
		ProfitFactor: profitFactor,
	}
}

// ==================== Technical Helpers ====================

func extractCloses(klines []map[string]interface{}) []float64 {
	closes := make([]float64, len(klines))
	for i, k := range klines {
		closes[i] = safeFloat(k, "close")
	}
	return closes
}

func extractVolumes(klines []map[string]interface{}) []float64 {
	vols := make([]float64, len(klines))
	for i, k := range klines {
		vols[i] = safeFloat(k, "volume")
	}
	return vols
}

func sma(data []float64, period int) float64 {
	n := len(data)
	if n < period {
		period = n
	}
	if period == 0 {
		return 0
	}
	sum := 0.0
	for i := n - period; i < n; i++ {
		sum += data[i]
	}
	return sum / float64(period)
}

func volumeMA(data []float64, period int) float64 {
	return sma(data, period)
}

func computeRSI(closes []float64, period int) float64 {
	n := len(closes)
	if n < period+1 {
		return 50
	}
	gains, losses := 0.0, 0.0
	for i := n - period; i < n; i++ {
		diff := closes[i] - closes[i-1]
		if diff > 0 {
			gains += diff
		} else {
			losses -= diff
		}
	}
	avgGain := gains / float64(period)
	avgLoss := losses / float64(period)
	if avgLoss == 0 {
		return 100
	}
	rs := avgGain / avgLoss
	return 100 - 100/(1+rs)
}

func computeMACD(closes []float64) (float64, float64, float64) {
	ema12 := ema(closes, 12)
	ema26 := ema(closes, 26)
	macdLine := ema12 - ema26
	// Signal line simplified as recent SMA of MACD approximation
	signalLine := macdLine * 0.8 // simplified
	hist := macdLine - signalLine
	return macdLine, signalLine, hist
}

func computeMACDHist(closes []float64) float64 {
	_, _, hist := computeMACD(closes)
	return hist
}

func ema(data []float64, period int) float64 {
	n := len(data)
	if n == 0 {
		return 0
	}
	if n < period {
		return sma(data, n)
	}
	multiplier := 2.0 / float64(period+1)
	result := sma(data[:period], period)
	for i := period; i < n; i++ {
		result = (data[i]-result)*multiplier + result
	}
	return result
}

func computeKDJ(klines []map[string]interface{}) (float64, float64, float64) {
	n := len(klines)
	period := 9
	if n < period {
		return 50, 50, 50
	}

	// Find highest high and lowest low in period
	hh := 0.0
	ll := math.MaxFloat64
	for i := n - period; i < n; i++ {
		h := safeFloat(klines[i], "high")
		l := safeFloat(klines[i], "low")
		if h > hh {
			hh = h
		}
		if l < ll {
			ll = l
		}
	}

	lastClose := safeFloat(klines[n-1], "close")
	rsv := 50.0
	if hh > ll {
		rsv = (lastClose - ll) / (hh - ll) * 100
	}

	k := 2.0/3*50 + 1.0/3*rsv
	d := 2.0/3*50 + 1.0/3*k
	j := 3*k - 2*d

	return k, d, j
}

func computeATR(klines []map[string]interface{}, period int) float64 {
	n := len(klines)
	if n < period+1 {
		return 0
	}
	sumTR := 0.0
	for i := n - period; i < n; i++ {
		high := safeFloat(klines[i], "high")
		low := safeFloat(klines[i], "low")
		prevClose := safeFloat(klines[i-1], "close")
		tr := math.Max(high-low, math.Max(math.Abs(high-prevClose), math.Abs(low-prevClose)))
		sumTR += tr
	}
	return sumTR / float64(period)
}

func computeBollinger(closes []float64, period int) (float64, float64, float64) {
	n := len(closes)
	if n < period {
		return 0, 0, 0
	}
	mid := sma(closes, period)
	variance := 0.0
	for i := n - period; i < n; i++ {
		diff := closes[i] - mid
		variance += diff * diff
	}
	stdDev := math.Sqrt(variance / float64(period))
	return mid, mid + 2*stdDev, mid - 2*stdDev
}

func maxSlice(data []float64) float64 {
	if len(data) == 0 {
		return 0
	}
	m := data[0]
	for _, v := range data[1:] {
		if v > m {
			m = v
		}
	}
	return m
}

func minSlice(data []float64) float64 {
	if len(data) == 0 {
		return 0
	}
	m := data[0]
	for _, v := range data[1:] {
		if v < m {
			m = v
		}
	}
	return m
}

func findCompassStrategy(id string) *JinCeStrategy {
	for i := range builtinCompassStrategies {
		if builtinCompassStrategies[i].ID == id {
			return &builtinCompassStrategies[i]
		}
	}
	return nil
}

func safeString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
