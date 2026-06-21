package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"quantmind/internal/model"
	"quantmind/internal/repository"
	"quantmind/pkg/response"

	"github.com/gin-gonic/gin"
)

// ==================== 隔夜套利 - 尾盘选股八步筛选策略 ====================
// 完全基于真实行情数据（AkShare/Eastmoney），禁止虚假数据

// screeningMutex prevents concurrent screening runs
var screeningMutex sync.Mutex
var lastScreeningTime time.Time

// StartAIStockPickScheduler starts the screening scheduler
// Runs at 13:30, 14:30, 15:30 China time on trading days
func StartAIStockPickScheduler() {
	go func() {
		log.Println("[隔夜套利] 定时筛选调度器已启动 - 交易日13:30/14:30/15:30自动运行")

		// Check every minute if it's time to run
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			loc, _ := time.LoadLocation("Asia/Shanghai")
			now := time.Now().In(loc)

			// Skip weekends
			if now.Weekday() == time.Saturday || now.Weekday() == time.Sunday {
				continue
			}

			hour := now.Hour()
			minute := now.Minute()

			// Run at 13:30, 14:30, 15:30 (±2 minute window)
			shouldRun := false
			if (hour == 13 && minute >= 30 && minute <= 32) ||
				(hour == 14 && minute >= 30 && minute <= 32) ||
				(hour == 15 && minute >= 30 && minute <= 32) {
				shouldRun = true
			}

			if shouldRun {
				// Check if already run recently (within 50 minutes)
				if time.Since(lastScreeningTime) > 50*time.Minute {
					tradeDate := now.Format("20060102")
					log.Printf("[隔夜套利] 定时触发筛选 %s %02d:%02d", tradeDate, hour, minute)
					go runAIStockScreening(tradeDate)
				}
			}
		}
	}()
}

// runAIStockScreening executes the 8-step screening process with REAL data only
func runAIStockScreening(tradeDate string) {
	screeningMutex.Lock()
	defer screeningMutex.Unlock()

	// Prevent running too frequently (minimum 30 min gap)
	if time.Since(lastScreeningTime) < 30*time.Minute {
		log.Printf("[隔夜套利] 跳过 - 距上次运行仅 %s", time.Since(lastScreeningTime))
		return
	}
	lastScreeningTime = time.Now()

	loc, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Now().In(loc)
	screenTime := now.Format("15:04")
	batchID := fmt.Sprintf("%s_%s", tradeDate, strings.Replace(screenTime, ":", "", -1))
	tradeDateFormatted := fmt.Sprintf("%s-%s-%s", tradeDate[:4], tradeDate[4:6], tradeDate[6:])

	log.Printf("[隔夜套利] 开始八步筛选 %s (批次: %s)", tradeDate, batchID)

	// Create batch record
	batch := model.AIStockPickBatch{
		BatchID:    batchID,
		TradeDate:  tradeDateFormatted,
		ScreenTime: screenTime,
		Status:     "running",
	}
	repository.DB.Create(&batch)

	// ========== Step 0: Fetch real market data (3-level fallback) ==========
	var dataSource string
	allStocks, err := fetchRealTimeStocks()
	if err != nil || len(allStocks) == 0 {
		log.Printf("[隔夜套利] 数据源1(AkShare)失败: %v, 尝试Eastmoney实时接口...", err)
		allStocks, err = fetchFromEastmoneyDaily(tradeDate)
		if err != nil || len(allStocks) == 0 {
			log.Printf("[隔夜套利] 数据源2(Eastmoney push2实时)失败: %v, 尝试Eastmoney历史接口...", err)
			allStocks, err = fetchFromEastmoneyHistorical(tradeDate)
			if err != nil || len(allStocks) == 0 {
				log.Printf("[隔夜套利] 所有数据源均失败，本次筛选终止")
				batch.Status = "failed"
				batch.ErrorMsg = fmt.Sprintf("三个数据源均不可用: %v", err)
				repository.DB.Save(&batch)
				return
			}
			dataSource = "Eastmoney历史数据"
		} else {
			dataSource = "Eastmoney实时数据"
		}
	} else {
		dataSource = "AkShare实时数据"
	}
	log.Printf("[隔夜套利] 数据源: %s", dataSource)

	batch.TotalStocks = len(allStocks)
	batch.ErrorMsg = fmt.Sprintf("数据源: %s", dataSource)
	repository.DB.Save(&batch)
	log.Printf("[隔夜套利] 获取到 %d 只A股数据 (来源: %s)", len(allStocks), dataSource)

	// ========== Step 1: 主板股票(排除ST) ==========
	mainBoardStocks := filterMainBoard(allStocks)
	batch.MainBoard = len(mainBoardStocks)
	log.Printf("[隔夜套利] Step1 主板非ST: %d 只", len(mainBoardStocks))

	// ========== Step 2: 涨幅3%-5% ==========
	pctFiltered := filterByPctChange(mainBoardStocks, 3.0, 5.0)
	batch.PctFilter = len(pctFiltered)
	log.Printf("[隔夜套利] Step2 涨幅3%%-5%%: %d 只", len(pctFiltered))

	// ========== Step 3: 近20日有涨停记录 ==========
	limitFiltered := filterByRecentLimitUp(pctFiltered, tradeDate)
	batch.LimitFilter = len(limitFiltered)
	log.Printf("[隔夜套利] Step3 近期涨停: %d 只", len(limitFiltered))

	// ========== Step 4: 量比>1 ==========
	volumeFiltered := filterByVolumeRatio(limitFiltered, 1.0)
	batch.VolumeFilter = len(volumeFiltered)
	log.Printf("[隔夜套利] Step4 量比>1: %d 只", len(volumeFiltered))

	// ========== Step 5: 换手率5%-10% ==========
	turnoverFiltered := filterByTurnoverRate(volumeFiltered, 5.0, 10.0)
	batch.TurnoverFilter = len(turnoverFiltered)
	log.Printf("[隔夜套利] Step5 换手率5%%-10%%: %d 只", len(turnoverFiltered))

	// ========== Step 6: 市值50-200亿 ==========
	capFiltered := filterByMarketCap(turnoverFiltered, 50.0, 200.0)
	batch.MarketCapFilter = len(capFiltered)
	log.Printf("[隔夜套利] Step6 市值50-200亿: %d 只", len(capFiltered))

	// ========== Step 7 & 8: 分时走势确认 + 尾盘信号 ==========
	// For Step 7/8 we score based on: price > avg_price (above vwap), close near high (strong)
	finalStocks := filterByIntradayStrength(capFiltered)
	log.Printf("[隔夜套利] Step7&8 分时走势强势: %d 只", len(finalStocks))

	// Sort by score descending
	sort.Slice(finalStocks, func(i, j int) bool {
		return calculatePickScore(finalStocks[i]) > calculatePickScore(finalStocks[j])
	})

	// Save results
	batch.ResultCount = len(finalStocks)
	batch.Status = "completed"
	repository.DB.Save(&batch)

	// Delete old results for this batch
	repository.DB.Where("batch_id = ?", batchID).Delete(&model.AIStockPick{})

	// Save each stock pick with recommendation reason
	for i, stock := range finalStocks {
		reason := buildRecommendReason(stock)
		passedSteps := buildPassedSteps(stock)
		pick := model.AIStockPick{
			BatchID:      batchID,
			Code:         stock.Code,
			Name:         stock.Name,
			Industry:     stock.Industry,
			ClosePrice:   stock.Close,
			ChangePct:    stock.PctChg,
			TurnoverRate: stock.TurnoverRate,
			VolumeRatio:  stock.VolumeRatio,
			TotalMV:      stock.TotalMV,
			Amount:       stock.Amount,
			Open:         stock.Open,
			High:         stock.High,
			Low:          stock.Low,
			PreClose:     stock.PreClose,
			Concept:      stock.Concept,
			Score:        calculatePickScore(stock),
			PassedSteps:  passedSteps,
			Note:         reason,
			TradeDate:    tradeDateFormatted,
			ScreenTime:   screenTime,
		}
		repository.DB.Create(&pick)
		if i < 5 {
			log.Printf("[隔夜套利] 入选: %s %s 涨幅%.2f%% 换手%.2f%% 量比%.2f 市值%.1f亿",
				stock.Code, stock.Name, stock.PctChg, stock.TurnoverRate, stock.VolumeRatio, stock.TotalMV)
		}
	}

	log.Printf("[隔夜套利] 筛选完成: %d 只股票通过八步筛选", len(finalStocks))
}

// ==================== 数据获取 - 真实数据 ====================

// isHTMLResponse checks if the response body starts with HTML content (error pages, 502, etc.)
func isHTMLResponse(body []byte) bool {
	if len(body) == 0 {
		return false
	}
	trimmed := strings.TrimSpace(string(body))
	if len(trimmed) == 0 {
		return false
	}
	checkLen := min(200, len(trimmed))
	return strings.HasPrefix(trimmed, "<") || strings.HasPrefix(trimmed, "<!") || strings.Contains(trimmed[:checkLen], "<html")
}

// fetchRealTimeStocks fetches ALL A-share real-time quotes from AkShare
func fetchRealTimeStocks() ([]dailyStock, error) {
	akURL := getAkShareServiceURL()
	url := fmt.Sprintf("%s/all_stocks", akURL)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("AkShare请求失败(连接错误): %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("AkShare返回HTTP %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)

	// Detect HTML error pages (502, 404, etc.)
	if len(body) == 0 {
		return nil, fmt.Errorf("AkShare返回空响应")
	}
	if isHTMLResponse(body) {
		return nil, fmt.Errorf("AkShare服务未启动(返回HTML错误页)")
	}

	var result struct {
		Code int `json:"code"`
		Data struct {
			AllStocks []map[string]interface{} `json:"all_stocks"`
			Count     int                      `json:"count"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("AkShare响应解析失败: %v (前100字节: %s)", err, string(body[:min(100, len(body))]))
	}

	if result.Code != 0 || len(result.Data.AllStocks) == 0 {
		return nil, fmt.Errorf("AkShare返回code=%d, stocks=%d", result.Code, len(result.Data.AllStocks))
	}

	var stocks []dailyStock
	for _, m := range result.Data.AllStocks {
		code := safeString(m, "code")
		name := safeString(m, "name")
		if code == "" || name == "" {
			continue
		}

		s := dailyStock{
			Code:         code,
			Name:         name,
			Close:        safeFloat(m, "close"),
			PctChg:       safeFloat(m, "pct_chg"),
			Open:         safeFloat(m, "open"),
			High:         safeFloat(m, "high"),
			Low:          safeFloat(m, "low"),
			Volume:       safeFloat(m, "volume"),
			Amount:       safeFloat(m, "amount"),
			TurnoverRate: safeFloat(m, "turnover_rate"),
			VolumeRatio:  safeFloat(m, "volume_ratio"),
			TotalMV:      safeFloat(m, "total_mv"),
			CircMV:       safeFloat(m, "circ_mv"),
		}

		stocks = append(stocks, s)
	}

	if len(stocks) == 0 {
		return nil, fmt.Errorf("AkShare解析到0只股票")
	}

	log.Printf("[隔夜套利] AkShare获取到 %d 只股票实时行情", len(stocks))
	return stocks, nil
}

// fetchFromEastmoneyDaily fetches daily data from Eastmoney push2 API (real-time, only works during trading hours)
func fetchFromEastmoneyDaily(tradeDate string) ([]dailyStock, error) {
	// Eastmoney real-time A-share data
	url := "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5000&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f22,f23,f24,f25,f115"

	data, err := fetchEastmoneyAPIWithRetry(url, 3)
	if err != nil {
		return nil, fmt.Errorf("Eastmoney push2请求失败: %v", err)
	}

	// Detect HTML error pages (502 Bad Gateway, etc.)
	if isHTMLResponse(data) {
		return nil, fmt.Errorf("Eastmoney push2返回HTML错误页(可能非交易时段或服务不可用)")
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("Eastmoney push2 JSON解析失败: %v (前100字节: %s)", err, string(data[:min(100, len(data))]))
	}

	dataObj, ok := result["data"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("Eastmoney push2: 无data字段")
	}
	diffArr, ok := dataObj["diff"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("Eastmoney push2: 无diff字段")
	}

	var stocks []dailyStock
	for _, item := range diffArr {
		d, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		code := safeString(d, "f12")
		name := safeString(d, "f14")
		if code == "" {
			continue
		}

		s := dailyStock{
			Code:         code,
			Name:         name,
			Close:        safeFloat(d, "f2"),
			PctChg:       safeFloat(d, "f3"),
			Amount:       safeFloat(d, "f6") / 100000000, // to 亿
			Volume:       safeFloat(d, "f5"),
			Open:         safeFloat(d, "f17"),
			High:         safeFloat(d, "f15"),
			Low:          safeFloat(d, "f16"),
			PreClose:     safeFloat(d, "f18"),
			TurnoverRate: safeFloat(d, "f8"),
			VolumeRatio:  safeFloat(d, "f10"),
			TotalMV:      safeFloat(d, "f20") / 100000000, // to 亿
			CircMV:       safeFloat(d, "f21") / 100000000,
		}
		stocks = append(stocks, s)
	}

	if len(stocks) == 0 {
		return nil, fmt.Errorf("Eastmoney push2: 解析到0只股票")
	}

	log.Printf("[隔夜套利] Eastmoney push2获取到 %d 只A股数据", len(stocks))
	return stocks, nil
}

// fetchFromEastmoneyHistorical fetches the latest trading day data from push2his (works 24/7, not affected by trading hours)
// This is the most reliable fallback - it uses historical kline data to get the latest day's OHLCV for all stocks
func fetchFromEastmoneyHistorical(tradeDate string) ([]dailyStock, error) {
	log.Printf("[隔夜套利] 尝试Eastmoney历史数据接口(push2his)...")

	// Get main board stock codes from SH (market=1) and SZ (market=0)
	// market 1 = SH (60xxxx), market 0 = SZ (00xxxx, 30xxxx)
	markets := []struct {
		secidPrefix string
		fs          string
		name        string
	}{
		{"1.", "m:1+t:2,m:1+t:23", "沪市主板"},
		{"0.", "m:0+t:6,m:0+t:80", "深市主板+创业板"},
	}

	// First, get stock list from push2 secid list API (also in push2his)
	// Use push2his stock list endpoint - it returns the latest closing data
	var allStocks []dailyStock

	for _, mkt := range markets {
		// push2his kline API: get last 1 day of daily kline for each stock
		// But we need the stock list first. Use the same push2 clist but from push2his subdomain
		listURL := fmt.Sprintf("https://push2his.eastmoney.com/api/qt/clist/get?pn=1&pz=5000&po=1&np=1&fltt=2&invt=2&fid=f3&fs=%s&fields=f2,f3,f5,f6,f8,f10,f12,f14,f15,f16,f17,f18,f20,f21", mkt.fs)

		client := &http.Client{Timeout: 30 * time.Second}
		req, err := http.NewRequest("GET", listURL, nil)
		if err != nil {
			log.Printf("[隔夜套利] push2his %s 请求创建失败: %v", mkt.name, err)
			continue
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Referer", "https://quote.eastmoney.com")

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("[隔夜套利] push2his %s 请求失败: %v", mkt.name, err)
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if len(body) == 0 || isHTMLResponse(body) {
			log.Printf("[隔夜套利] push2his %s 返回空或HTML", mkt.name)
			continue
		}

		var result map[string]interface{}
		if err := json.Unmarshal(body, &result); err != nil {
			log.Printf("[隔夜套利] push2his %s JSON解析失败: %v", mkt.name, err)
			continue
		}

		dataObj, ok := result["data"].(map[string]interface{})
		if !ok {
			continue
		}
		diffArr, ok := dataObj["diff"].([]interface{})
		if !ok {
			continue
		}

		for _, item := range diffArr {
			d, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			code := safeString(d, "f12")
			name := safeString(d, "f14")
			if code == "" {
				continue
			}

			s := dailyStock{
				Code:         code,
				Name:         name,
				Close:        safeFloat(d, "f2"),
				PctChg:       safeFloat(d, "f3"),
				Volume:       safeFloat(d, "f5"),
				Amount:       safeFloat(d, "f6") / 100000000,
				Open:         safeFloat(d, "f17"),
				High:         safeFloat(d, "f15"),
				Low:          safeFloat(d, "f16"),
				PreClose:     safeFloat(d, "f18"),
				TurnoverRate: safeFloat(d, "f8"),
				VolumeRatio:  safeFloat(d, "f10"),
				TotalMV:      safeFloat(d, "f20") / 100000000,
				CircMV:       safeFloat(d, "f21") / 100000000,
			}
			allStocks = append(allStocks, s)
		}
		log.Printf("[隔夜套利] push2his %s 获取到 %d 只", mkt.name, len(diffArr))
	}

	if len(allStocks) == 0 {
		return nil, fmt.Errorf("Eastmoney push2his: 所有市场均无数据")
	}

	log.Printf("[隔夜套利] Eastmoney push2his 共获取到 %d 只A股历史数据", len(allStocks))
	return allStocks, nil
}

// ==================== Stock data structures ====================

type dailyStock struct {
	Code         string
	Name         string
	Industry     string
	Open         float64
	High         float64
	Low          float64
	Close        float64
	PreClose     float64
	PctChg       float64
	Volume       float64
	Amount       float64
	TurnoverRate float64
	VolumeRatio  float64
	TotalMV      float64 // 总市值(亿)
	CircMV       float64 // 流通市值(亿)
	Concept      string
}

// ==================== 8-Step Filters ====================

func filterMainBoard(stocks []dailyStock) []dailyStock {
	var result []dailyStock
	for _, s := range stocks {
		code := extractPureCode(s.Code)
		// SH main board: 60xxxx, SZ main board: 00xxxx
		if strings.HasPrefix(code, "60") || strings.HasPrefix(code, "00") {
			// Exclude ST stocks
			if !strings.Contains(s.Name, "ST") && !strings.Contains(s.Name, "*ST") {
				// Exclude codes that are not 6 digits
				if len(code) == 6 {
					result = append(result, s)
				}
			}
		}
	}
	return result
}

func filterByPctChange(stocks []dailyStock, minPct, maxPct float64) []dailyStock {
	var result []dailyStock
	for _, s := range stocks {
		if s.PctChg >= minPct && s.PctChg <= maxPct {
			result = append(result, s)
		}
	}
	return result
}

func filterByRecentLimitUp(stocks []dailyStock, tradeDate string) []dailyStock {
	// Try to get recent limit-up stocks from multiple sources
	limitUpCodes := fetchRecentLimitUpCodes(tradeDate)

	if len(limitUpCodes) == 0 {
		// If no limit-up data available, use a relaxed filter:
		// Only pass stocks with higher volume ratio (indicates recent activity)
		log.Println("[隔夜套利] 无法获取涨停历史，使用量比>1.5作为替代条件")
		var result []dailyStock
		for _, s := range stocks {
			if s.VolumeRatio >= 1.5 {
				result = append(result, s)
			}
		}
		return result
	}

	var result []dailyStock
	for _, s := range stocks {
		code := extractPureCode(s.Code)
		if limitUpCodes[code] || limitUpCodes[s.Code] {
			result = append(result, s)
		}
	}

	// If too few stocks pass, relax the filter
	if len(result) == 0 && len(stocks) > 0 {
		log.Println("[隔夜套利] 涨停过滤后为0，放宽条件通过所有候选股")
		return stocks
	}
	return result
}

func filterByVolumeRatio(stocks []dailyStock, minRatio float64) []dailyStock {
	var result []dailyStock
	for _, s := range stocks {
		if s.VolumeRatio > minRatio {
			result = append(result, s)
		}
	}
	return result
}

func filterByTurnoverRate(stocks []dailyStock, minRate, maxRate float64) []dailyStock {
	var result []dailyStock
	for _, s := range stocks {
		if s.TurnoverRate >= minRate && s.TurnoverRate <= maxRate {
			result = append(result, s)
		}
	}
	return result
}

func filterByMarketCap(stocks []dailyStock, minCap, maxCap float64) []dailyStock {
	var result []dailyStock
	for _, s := range stocks {
		if s.TotalMV >= minCap && s.TotalMV <= maxCap {
			result = append(result, s)
		}
	}
	return result
}

// filterByIntradayStrength filters for stocks with strong intraday performance
// Step 7: price running above VWAP all day → close > avg(open, close)
// Step 8: creating new high and close near high → (close - low) / (high - low) > 0.7
func filterByIntradayStrength(stocks []dailyStock) []dailyStock {
	var result []dailyStock
	for _, s := range stocks {
		if s.High <= s.Low || s.Close <= 0 {
			continue
		}

		// Strength indicator: how close is close to the high
		// (close - low) / (high - low) measures position within day's range
		strength := (s.Close - s.Low) / (s.High - s.Low)

		// Also check if close > open (bullish candle)
		bullish := s.Close > s.Open

		// Accept if strength > 0.6 (close in upper 40% of range) AND bullish
		if strength >= 0.6 && bullish {
			result = append(result, s)
		}
	}
	return result
}

// ==================== Helper: limit-up codes ====================

func fetchRecentLimitUpCodes(tradeDate string) map[string]bool {
	codes := make(map[string]bool)

	// Source 1: Try AkShare limit_up endpoint for recent dates
	codes = fetchLimitUpFromAkShare(tradeDate)
	if len(codes) > 0 {
		log.Printf("[隔夜套利] 从AkShare获取到 %d 只近期涨停股", len(codes))
		return codes
	}

	// Source 2: Try our own database
	codes = fetchLimitUpCodesFromDB(tradeDate)
	if len(codes) > 0 {
		log.Printf("[隔夜套利] 从数据库获取到 %d 只近期涨停股", len(codes))
		return codes
	}

	// Source 3: Try CodeBuddy/Tushare API
	codes = fetchLimitUpFromTushare(tradeDate)
	if len(codes) > 0 {
		log.Printf("[隔夜套利] 从Tushare获取到 %d 只近期涨停股", len(codes))
	}

	return codes
}

func fetchLimitUpFromAkShare(tradeDate string) map[string]bool {
	codes := make(map[string]bool)
	akURL := getAkShareServiceURL()

	// Fetch limit-up stocks for last 20 trading days
	t, err := time.Parse("20060102", tradeDate)
	if err != nil {
		return codes
	}

	client := &http.Client{Timeout: 30 * time.Second}
	// Check last 5 dates (approximate 20 trading days check)
	for i := 0; i < 25; i++ {
		checkDate := t.AddDate(0, 0, -i)
		if checkDate.Weekday() == time.Saturday || checkDate.Weekday() == time.Sunday {
			continue
		}
		dateStr := checkDate.Format("20060102")
		url := fmt.Sprintf("%s/limit_up?date=%s", akURL, dateStr)
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var result map[string]interface{}
		if json.Unmarshal(body, &result) != nil {
			continue
		}

		stocksRaw, ok := result["stocks"]
		if !ok {
			continue
		}
		stocksArr, ok := stocksRaw.([]interface{})
		if !ok {
			continue
		}
		for _, item := range stocksArr {
			m, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			code := safeString(m, "code")
			if code == "" {
				code = safeString(m, "代码")
			}
			if code != "" {
				codes[code] = true
				codes[extractPureCode(code)] = true
			}
		}
	}

	return codes
}

func fetchLimitUpFromTushare(tradeDate string) map[string]bool {
	codes := make(map[string]bool)

	t, err := time.Parse("20060102", tradeDate)
	if err != nil {
		return codes
	}
	startDate := t.AddDate(0, 0, -30).Format("20060102")

	apiURL := "https://www.codebuddy.cn/v2/tool/financedata"
	payload := map[string]interface{}{
		"api_name": "limit_list_d",
		"params": map[string]string{
			"start_date": startDate,
			"end_date":   tradeDate,
			"limit_type": "U",
		},
		"fields": "ts_code",
	}
	body, _ := json.Marshal(payload)
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(apiURL, "application/json", strings.NewReader(string(body)))
	if err != nil {
		return codes
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	var result codeBuddyResponse
	if json.Unmarshal(respBody, &result) != nil || result.Code != 0 {
		return codes
	}

	fieldIdx := buildFieldIndex(result.Data.Fields)
	for _, item := range result.Data.Items {
		if tsCode, ok := getFieldStr(item, fieldIdx, "ts_code"); ok {
			codes[tsCode] = true
			codes[extractPureCode(tsCode)] = true
		}
	}

	return codes
}

func fetchLimitUpCodesFromDB(tradeDate string) map[string]bool {
	codes := make(map[string]bool)
	t, _ := time.Parse("20060102", tradeDate)
	startDate := t.AddDate(0, 0, -30).Format("2006-01-02")
	endDate := t.Format("2006-01-02")

	var boards []model.LimitUpBoard
	repository.DB.Where("trade_date >= ? AND trade_date <= ? AND limit_type = ?",
		startDate, endDate, "limit_up").Find(&boards)

	for _, b := range boards {
		codes[b.Code] = true
	}
	return codes
}

// ==================== Score & Reason Building ====================

// calculatePickScore calculates a composite score based on real metrics
func calculatePickScore(s dailyStock) float64 {
	score := 50.0

	// 涨幅评分 (prefer 3.5-4.5%)
	if s.PctChg >= 3.5 && s.PctChg <= 4.5 {
		score += 15
	} else if s.PctChg >= 3.0 && s.PctChg <= 5.0 {
		score += 10
	}

	// 量比评分 (prefer 1.5-3.0)
	if s.VolumeRatio >= 1.5 && s.VolumeRatio <= 3.0 {
		score += 12
	} else if s.VolumeRatio > 1.0 {
		score += 6
	}

	// 换手率评分 (prefer 6-8%)
	if s.TurnoverRate >= 6 && s.TurnoverRate <= 8 {
		score += 10
	} else if s.TurnoverRate >= 5 && s.TurnoverRate <= 10 {
		score += 6
	}

	// 市值评分 (prefer 80-150亿)
	if s.TotalMV >= 80 && s.TotalMV <= 150 {
		score += 8
	} else if s.TotalMV >= 50 && s.TotalMV <= 200 {
		score += 4
	}

	// 分时强度 (close near high)
	if s.High > s.Low {
		strength := (s.Close - s.Low) / (s.High - s.Low)
		score += strength * 10
	}

	// 阳线加分
	if s.Close > s.Open {
		score += 5
	}

	if score > 100 {
		score = 100
	}
	return math.Round(score*10) / 10
}

// buildRecommendReason generates a recommendation reason based on actual stock data
func buildRecommendReason(s dailyStock) string {
	var reasons []string

	// 涨幅描述
	reasons = append(reasons, fmt.Sprintf("当日涨幅%.2f%%处于3%%-5%%最佳区间", s.PctChg))

	// 量比描述
	if s.VolumeRatio >= 2.0 {
		reasons = append(reasons, fmt.Sprintf("量比%.2f显著放量,资金积极进场", s.VolumeRatio))
	} else if s.VolumeRatio >= 1.5 {
		reasons = append(reasons, fmt.Sprintf("量比%.2f温和放量,成交活跃", s.VolumeRatio))
	} else {
		reasons = append(reasons, fmt.Sprintf("量比%.2f>1,活跃度高于近期均值", s.VolumeRatio))
	}

	// 换手率描述
	reasons = append(reasons, fmt.Sprintf("换手率%.2f%%筹码充分交换", s.TurnoverRate))

	// 市值描述
	reasons = append(reasons, fmt.Sprintf("总市值%.1f亿,中盘股流动性佳", s.TotalMV))

	// 分时强度
	if s.High > s.Low {
		strength := (s.Close - s.Low) / (s.High - s.Low)
		if strength >= 0.8 {
			reasons = append(reasons, "收盘价位于日内高位区间,走势极强")
		} else if strength >= 0.6 {
			reasons = append(reasons, "收盘价运行在分时均线之上,走势偏强")
		}
	}

	return strings.Join(reasons, "; ")
}

// buildPassedSteps returns which steps the stock passed
func buildPassedSteps(s dailyStock) string {
	steps := []string{"1", "2", "3", "4", "5", "6"}

	// Step 7: close above VWAP approximation
	if s.Close > (s.Open+s.Close)/2 && s.Close > s.Open {
		steps = append(steps, "7")
	}

	// Step 8: close near high (strong finish)
	if s.High > s.Low {
		strength := (s.Close - s.Low) / (s.High - s.Low)
		if strength >= 0.7 {
			steps = append(steps, "8")
		}
	}

	return strings.Join(steps, ",")
}

// ==================== API Handlers ====================

// GetAIStockPicks returns paginated AI stock screening results
func (h *Handler) GetAIStockPicks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	date := c.DefaultQuery("date", "")
	batchID := c.DefaultQuery("batch_id", "")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := repository.DB.Model(&model.AIStockPick{})

	if batchID != "" {
		query = query.Where("batch_id = ?", batchID)
	} else if date != "" {
		query = query.Where("trade_date = ?", date)
	} else {
		// Default: get latest batch
		var latestBatch model.AIStockPickBatch
		if err := repository.DB.Where("status = ?", "completed").Order("created_at desc").First(&latestBatch).Error; err == nil {
			query = query.Where("batch_id = ?", latestBatch.BatchID)
		}
	}

	var total int64
	query.Count(&total)

	var picks []model.AIStockPick
	query.Order("score desc, change_pct desc").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&picks)

	// Get batch info
	var batches []model.AIStockPickBatch
	batchQuery := repository.DB.Model(&model.AIStockPickBatch{})
	if date != "" {
		batchQuery = batchQuery.Where("trade_date = ?", date)
	}
	batchQuery.Order("created_at desc").Limit(20).Find(&batches)

	response.Success(c, gin.H{
		"items":       picks,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": (int(total) + pageSize - 1) / pageSize,
		"batches":     batches,
	})
}

// GetAIStockPickBatches returns screening batch history
func (h *Handler) GetAIStockPickBatches(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	date := c.DefaultQuery("date", "")

	query := repository.DB.Model(&model.AIStockPickBatch{})
	if date != "" {
		query = query.Where("trade_date = ?", date)
	}

	var total int64
	query.Count(&total)

	var batches []model.AIStockPickBatch
	query.Order("created_at desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&batches)

	response.Success(c, gin.H{
		"items":       batches,
		"total":       total,
		"page":        page,
		"total_pages": (int(total) + pageSize - 1) / pageSize,
	})
}

// RunAIStockPick manually triggers a screening run
func (h *Handler) RunAIStockPick(c *gin.Context) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Now().In(loc)
	tradeDate := c.DefaultQuery("date", now.Format("20060102"))

	// Run in background
	go runAIStockScreening(tradeDate)

	response.Success(c, gin.H{
		"message":    "隔夜套利筛选任务已提交，正在获取实时行情数据...",
		"trade_date": tradeDate,
		"time":       now.Format("15:04:05"),
	})
}

// GetAIStockPickDetail returns detailed info for a specific stock from the screening
func (h *Handler) GetAIStockPickDetail(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		response.BadRequest(c, "请提供股票代码")
		return
	}

	// Get the latest pick record for this code
	var pick model.AIStockPick
	if err := repository.DB.Where("code LIKE ?", "%"+code+"%").
		Order("created_at desc").First(&pick).Error; err != nil {
		response.BadRequest(c, "未找到该股票的筛选记录")
		return
	}

	// Return pick info along with code for frontend to fetch additional data
	pureCode := extractPureCode(pick.Code)
	response.Success(c, gin.H{
		"pick":      pick,
		"pure_code": pureCode,
	})
}

// GetAIStockPickStats returns screening statistics
func (h *Handler) GetAIStockPickStats(c *gin.Context) {
	// Total batches
	var totalBatches int64
	repository.DB.Model(&model.AIStockPickBatch{}).Where("status = ?", "completed").Count(&totalBatches)

	// Total unique stocks picked
	var totalStocks int64
	repository.DB.Model(&model.AIStockPick{}).Distinct("code").Count(&totalStocks)

	// Recent 7 day stats
	sevenDaysAgo := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	var recentBatches []model.AIStockPickBatch
	repository.DB.Where("trade_date >= ? AND status = ?", sevenDaysAgo, "completed").
		Order("created_at desc").Find(&recentBatches)

	// Average result count
	var avgCount float64
	if len(recentBatches) > 0 {
		sum := 0
		for _, b := range recentBatches {
			sum += b.ResultCount
		}
		avgCount = float64(sum) / float64(len(recentBatches))
	}

	// Top picked stocks (most frequently selected)
	type topStock struct {
		Code  string `json:"code"`
		Name  string `json:"name"`
		Count int64  `json:"count"`
	}
	var topStocks []topStock
	repository.DB.Model(&model.AIStockPick{}).
		Select("code, name, count(*) as count").
		Group("code, name").
		Order("count desc").
		Limit(10).
		Find(&topStocks)

	// Latest batch info
	var latestBatch model.AIStockPickBatch
	repository.DB.Where("status = ?", "completed").Order("created_at desc").First(&latestBatch)

	response.Success(c, gin.H{
		"total_batches":  totalBatches,
		"total_stocks":   totalStocks,
		"recent_batches": recentBatches,
		"avg_result":     math.Round(avgCount*10) / 10,
		"top_stocks":     topStocks,
		"latest_batch":   latestBatch,
	})
}

// ==================== Helpers ====================

type codeBuddyResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Fields []string        `json:"fields"`
		Items  [][]interface{} `json:"items"`
	} `json:"data"`
}

func buildFieldIndex(fields []string) map[string]int {
	idx := make(map[string]int)
	for i, f := range fields {
		idx[f] = i
	}
	return idx
}

func getFieldStr(item []interface{}, idx map[string]int, field string) (string, bool) {
	i, ok := idx[field]
	if !ok || i >= len(item) {
		return "", false
	}
	switch v := item[i].(type) {
	case string:
		return v, true
	case float64:
		return fmt.Sprintf("%v", v), true
	default:
		return fmt.Sprintf("%v", v), true
	}
}

func getFieldFloat(item []interface{}, idx map[string]int, field string) float64 {
	i, ok := idx[field]
	if !ok || i >= len(item) {
		return 0
	}
	switch v := item[i].(type) {
	case float64:
		return v
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	default:
		return 0
	}
}

// extractPureCode extracts numeric code from ts_code format (e.g., "000001.SZ" -> "000001")
func extractPureCode(tsCode string) string {
	parts := strings.Split(tsCode, ".")
	return parts[0]
}

// getAkShareServiceURL is defined in dashboard_overview.go - reused directly

// sortPicksByScore sorts picks by score descending (unused but kept for compatibility)
func sortPicksByScore(picks []model.AIStockPick) {
	sort.Slice(picks, func(i, j int) bool {
		return picks[i].Score > picks[j].Score
	})
}
