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
func (h *Handler) GetDataKline(c *gin.Context) {
	proxyToDataService(c, "/kline", map[string]string{
		"code":   c.Query("code"),
		"period": c.Query("period"),
		"count":  c.Query("count"),
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
