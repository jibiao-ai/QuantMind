package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ==================== 数据服务代理 - Data Service Proxy ====================
// Proxies requests to the unified Python data service (mootdx + tencent + akshare + cninfo + eastmoney)

var dataServiceClient = &http.Client{Timeout: 30 * time.Second}

// proxyToDataService forwards request to the Python data service and returns JSON response
func proxyToDataService(c *gin.Context, path string, params map[string]string) {
	baseURL := getAkShareServiceURL()
	reqURL := fmt.Sprintf("%s%s", baseURL, path)

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": "创建请求失败"})
		return
	}

	q := req.URL.Query()
	for k, v := range params {
		if v != "" {
			q.Set(k, v)
		}
	}
	req.URL.RawQuery = q.Encode()

	resp, err := dataServiceClient.Do(req)
	if err != nil {
		log.Printf("[DataProxy] Request to %s failed: %v", reqURL, err)
		c.JSON(http.StatusServiceUnavailable, gin.H{"code": -1, "error": "数据服务不可用"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": "读取响应失败"})
		return
	}

	var result interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": "解析响应失败"})
		return
	}

	c.JSON(resp.StatusCode, result)
}

// GetDataQuote - 获取实时行情 (Tencent + mootdx)
func (h *Handler) GetDataQuote(c *gin.Context) {
	proxyToDataService(c, "/quote", map[string]string{
		"codes": c.Query("codes"),
	})
}

// GetDataKline - 获取K线数据 (mootdx)
// Frontend sends period: day/week/month/year, Python expects freq: daily/weekly/monthly
func (h *Handler) GetDataKline(c *gin.Context) {
	period := c.Query("period")
	count := c.Query("count")

	// Map frontend period names to Python service freq names
	freqMap := map[string]string{
		"day":   "daily",
		"week":  "weekly",
		"month": "monthly",
		"year":  "monthly", // no yearly in mootdx, use monthly with larger count
		// Also support direct freq names for backward compatibility
		"daily":   "daily",
		"weekly":  "weekly",
		"monthly": "monthly",
	}

	freq := freqMap[period]
	if freq == "" {
		freq = "daily" // default
	}

	// For year period, use monthly with larger count to cover ~5 years
	if period == "year" && (count == "" || count == "60") {
		count = "120" // 120 months = 10 years of monthly data
	}

	proxyToDataService(c, "/kline", map[string]string{
		"code":  c.Query("code"),
		"freq":  freq,
		"count": count,
	})
}

// GetDataMinute - 获取分时数据 (mootdx)
func (h *Handler) GetDataMinute(c *gin.Context) {
	proxyToDataService(c, "/minute", map[string]string{
		"code": c.Query("code"),
	})
}

// GetDataResearch - 获取研报数据 (eastmoney)
func (h *Handler) GetDataResearch(c *gin.Context) {
	proxyToDataService(c, "/research", map[string]string{
		"code":      c.Query("code"),
		"page_size": c.Query("page_size"),
		"page":      c.Query("page"),
	})
}

// GetDataNews - 获取新闻数据 (akshare)
func (h *Handler) GetDataNews(c *gin.Context) {
	proxyToDataService(c, "/news", map[string]string{
		"code": c.Query("code"),
	})
}

// GetDataGuba - 获取股吧讨论 (eastmoney)
func (h *Handler) GetDataGuba(c *gin.Context) {
	proxyToDataService(c, "/guba", map[string]string{
		"code":      c.Query("code"),
		"page":      c.Query("page"),
		"page_size": c.Query("page_size"),
	})
}

// GetDataF10 - 获取F10基础数据 (mootdx finance)
func (h *Handler) GetDataF10(c *gin.Context) {
	proxyToDataService(c, "/f10", map[string]string{
		"code": c.Query("code"),
	})
}

// GetDataAnnounce - 获取公告数据 (cninfo 巨潮资讯)
func (h *Handler) GetDataAnnounce(c *gin.Context) {
	proxyToDataService(c, "/announce", map[string]string{
		"code":      c.Query("code"),
		"page_size": c.Query("page_size"),
		"page":      c.Query("page"),
	})
}

// ValidateStockCode - 验证股票代码并返回真实名称
// 调用腾讯/通达信接口验证代码有效性
func (h *Handler) ValidateStockCode(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": "股票代码不能为空"})
		return
	}

	log.Printf("[DataProxy] ValidateStockCode: code=%s", code)

	baseURL := getAkShareServiceURL()
	reqURL := fmt.Sprintf("%s/quote?codes=%s", baseURL, code)

	resp, err := dataServiceClient.Get(reqURL)
	if err != nil {
		log.Printf("[DataProxy] ValidateStock request failed: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{"code": -1, "error": "数据服务不可用", "valid": false})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": "读取响应失败", "valid": false})
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": "解析响应失败", "valid": false})
		return
	}

	// Check if quote data contains valid name
	if data, ok := result["data"]; ok {
		if quotes, ok := data.([]interface{}); ok && len(quotes) > 0 {
			if q, ok := quotes[0].(map[string]interface{}); ok {
				name, _ := q["name"].(string)
				price, _ := q["price"].(float64)
				if name != "" && name != "---" && price > 0 {
					log.Printf("[DataProxy] ValidateStock success: code=%s, name=%s", code, name)
					c.JSON(http.StatusOK, gin.H{"code": 0, "valid": true, "name": name, "price": price})
					return
				}
			}
		}
		// Also handle single quote object
		if q, ok := data.(map[string]interface{}); ok {
			name, _ := q["name"].(string)
			price, _ := q["price"].(float64)
			if name != "" && name != "---" && price > 0 {
				log.Printf("[DataProxy] ValidateStock success: code=%s, name=%s", code, name)
				c.JSON(http.StatusOK, gin.H{"code": 0, "valid": true, "name": name, "price": price})
				return
			}
		}
	}

	log.Printf("[DataProxy] ValidateStock invalid: code=%s", code)
	c.JSON(http.StatusOK, gin.H{"code": 0, "valid": false, "error": "无效的股票代码"})
}
