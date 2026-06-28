package handler

import (
	"crypto/md5"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"quantmind/internal/repository"
	"quantmind/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ==================== Models ====================

type InvestmentNews struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Track      string    `gorm:"size:50;index" json:"track"`
	TrackName  string    `gorm:"size:100" json:"track_name"`
	Source     string    `gorm:"size:100" json:"source"`
	Title      string    `gorm:"size:500" json:"title"`
	TitleCN    string    `gorm:"size:500" json:"title_cn"`
	Link       string    `gorm:"size:1000" json:"link"`
	Summary    string    `gorm:"type:text" json:"summary"`
	PubDate    time.Time `gorm:"index" json:"pub_date"`
	FetchDate  string    `gorm:"size:20;index" json:"fetch_date"`
	Hash       string    `gorm:"size:64;uniqueIndex" json:"hash"`
	CreatedAt  time.Time `json:"created_at"`
}

type InvestmentHighlight struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Track     string    `gorm:"size:50;index" json:"track"`
	TrackName string    `gorm:"size:100" json:"track_name"`
	Content   string    `gorm:"type:text" json:"content"`
	FetchDate string    `gorm:"size:20;index" json:"fetch_date"`
	CreatedAt time.Time `json:"created_at"`
}

func AutoMigrateNewsModels(db *gorm.DB) {
	db.AutoMigrate(&InvestmentNews{}, &InvestmentHighlight{})
}

// ==================== Track Definitions ====================

type newsTrack struct {
	Key    string `json:"key"`
	Name   string `json:"name"`
	Accent string `json:"accent"`
	Icon   string `json:"icon"`
}

type newsSource struct {
	Name string
	Hint string
	URL  string
}

var newsTracks = []newsTrack{
	{Key: "ai", Name: "AI/大模型", Accent: "#ff5a1f", Icon: "Brain"},
	{Key: "semi", Name: "半导体/芯片", Accent: "#22d3ee", Icon: "Cpu"},
	{Key: "robot", Name: "机器人/自动化", Accent: "#14b8a6", Icon: "Bot"},
	{Key: "auto", Name: "汽车/新能源车", Accent: "#fb7185", Icon: "Car"},
	{Key: "energy", Name: "能源/新能源", Accent: "#84cc16", Icon: "Zap"},
	{Key: "bio", Name: "生物医药/健康", Accent: "#ec4899", Icon: "Heart"},
	{Key: "space", Name: "航天/太空", Accent: "#8b5cf6", Icon: "Rocket"},
	{Key: "security", Name: "网络安全", Accent: "#ef4444", Icon: "Shield"},
	{Key: "tech", Name: "科技/互联网", Accent: "#3b82f6", Icon: "Globe"},
	{Key: "consumer", Name: "消费电子/数码", Accent: "#a855f7", Icon: "Smartphone"},
	{Key: "macro", Name: "财经/宏观", Accent: "#eab308", Icon: "TrendingUp"},
	{Key: "science", Name: "科学/前沿", Accent: "#38bdf8", Icon: "Atom"},
}

var newsSources = []newsSource{
	// AI/大模型
	{Name: "OpenAI", Hint: "ai", URL: "https://openai.com/news/rss.xml"},
	{Name: "Google Research", Hint: "ai", URL: "https://research.google/blog/rss/"},
	{Name: "Hugging Face", Hint: "ai", URL: "https://huggingface.co/blog/feed.xml"},
	{Name: "量子位", Hint: "ai", URL: "https://www.qbitai.com/feed"},
	{Name: "MIT Tech Review", Hint: "ai", URL: "https://www.technologyreview.com/topic/artificial-intelligence/feed"},
	{Name: "机器之心", Hint: "ai", URL: "https://wechat2rss.xlab.app/feed/51e92aad2728acdd1fda7314be32b16639353001.xml"},
	{Name: "智东西", Hint: "ai", URL: "https://zhidx.com/rss"},
	// 半导体/芯片
	{Name: "DIGITIMES", Hint: "semi", URL: "https://www.digitimes.com/rss/daily.xml"},
	{Name: "SemiAnalysis", Hint: "semi", URL: "https://semianalysis.substack.com/feed"},
	{Name: "IEEE Spectrum", Hint: "semi", URL: "https://spectrum.ieee.org/feeds/topic/semiconductors.rss"},
	{Name: "EE Times", Hint: "semi", URL: "https://www.eetimes.com/feed/"},
	{Name: "Semiconductor Engineering", Hint: "semi", URL: "https://semiengineering.com/feed/"},
	// 机器人/自动化
	{Name: "The Robot Report", Hint: "robot", URL: "https://www.therobotreport.com/feed/"},
	{Name: "IEEE Robotics", Hint: "robot", URL: "https://spectrum.ieee.org/feeds/topic/robotics.rss"},
	// 汽车/新能源车
	{Name: "Electrek", Hint: "auto", URL: "https://electrek.co/feed/"},
	{Name: "InsideEVs", Hint: "auto", URL: "https://insideevs.com/rss/news/"},
	// 能源/新能源
	{Name: "CleanTechnica", Hint: "energy", URL: "https://cleantechnica.com/feed/"},
	// 生物医药/健康
	{Name: "STAT News", Hint: "bio", URL: "https://www.statnews.com/feed/"},
	{Name: "Endpoints", Hint: "bio", URL: "https://endpts.com/feed/"},
	// 航天/太空
	{Name: "SpaceNews", Hint: "space", URL: "https://spacenews.com/feed/"},
	{Name: "NASA", Hint: "space", URL: "https://www.nasa.gov/news-release/feed/"},
	// 网络安全
	{Name: "Krebs on Security", Hint: "security", URL: "https://krebsonsecurity.com/feed/"},
	{Name: "BleepingComputer", Hint: "security", URL: "https://www.bleepingcomputer.com/feed/"},
	// 科技/互联网
	{Name: "TechCrunch", Hint: "tech", URL: "https://techcrunch.com/feed/"},
	{Name: "The Verge", Hint: "tech", URL: "https://www.theverge.com/rss/index.xml"},
	{Name: "Ars Technica", Hint: "tech", URL: "https://feeds.arstechnica.com/arstechnica/index"},
	{Name: "36氪", Hint: "tech", URL: "https://36kr.com/feed"},
	{Name: "虎嗅", Hint: "tech", URL: "https://www.huxiu.com/rss/0.xml"},
	// 消费电子/数码
	{Name: "The Verge Tech", Hint: "consumer", URL: "https://www.theverge.com/rss/tech/index.xml"},
	// 财经/宏观
	{Name: "CNBC", Hint: "macro", URL: "https://www.cnbc.com/id/100003114/device/rss/rss.html"},
	{Name: "FT", Hint: "macro", URL: "https://www.ft.com/rss/home"},
	{Name: "华尔街见闻", Hint: "macro", URL: "https://wallstreetcn.com/rss"},
	// 科学/前沿
	{Name: "Nature News", Hint: "science", URL: "https://www.nature.com/nature.rss"},
	{Name: "Science Daily", Hint: "science", URL: "https://www.sciencedaily.com/rss/all.xml"},
}

// ==================== RSS Parsing ====================

type rssItem struct {
	Title   string
	Link    string
	PubDate time.Time
	Source  string
	Track   string
}

type rssFeed struct {
	Channel struct {
		Items []struct {
			Title   string `xml:"title"`
			Link    string `xml:"link"`
			PubDate string `xml:"pubDate"`
		} `xml:"item"`
	} `xml:"channel"`
}

type atomFeed struct {
	Entries []struct {
		Title string `xml:"title"`
		Link  struct {
			Href string `xml:"href,attr"`
		} `xml:"link"`
		Updated   string `xml:"updated"`
		Published string `xml:"published"`
	} `xml:"entry"`
}

func fetchRSSFeed(source newsSource, since time.Time) []rssItem {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", source.URL, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "QuantMind/2.0 NewsBot")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[News] fetch failed %s: %v", source.Name, err)
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return nil
	}

	var items []rssItem

	// Try RSS 2.0
	var rss rssFeed
	if err := xml.Unmarshal(body, &rss); err == nil && len(rss.Channel.Items) > 0 {
		for _, item := range rss.Channel.Items {
			if item.Title == "" {
				continue
			}
			pubDate := parseDate(item.PubDate)
			if pubDate.Before(since) {
				continue
			}
			items = append(items, rssItem{
				Title:   strings.TrimSpace(item.Title),
				Link:    strings.TrimSpace(item.Link),
				PubDate: pubDate,
				Source:  source.Name,
				Track:   source.Hint,
			})
		}
		return items
	}

	// Try Atom
	var atom atomFeed
	if err := xml.Unmarshal(body, &atom); err == nil && len(atom.Entries) > 0 {
		for _, entry := range atom.Entries {
			if entry.Title == "" {
				continue
			}
			dateStr := entry.Updated
			if dateStr == "" {
				dateStr = entry.Published
			}
			pubDate := parseDate(dateStr)
			if pubDate.Before(since) {
				continue
			}
			items = append(items, rssItem{
				Title:   strings.TrimSpace(entry.Title),
				Link:    strings.TrimSpace(entry.Link.Href),
				PubDate: pubDate,
				Source:  source.Name,
				Track:   source.Hint,
			})
		}
	}

	return items
}

func parseDate(dateStr string) time.Time {
	formats := []string{
		time.RFC1123Z,
		time.RFC1123,
		time.RFC3339,
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05-07:00",
		"Mon, 02 Jan 2006 15:04:05 MST",
		"Mon, 2 Jan 2006 15:04:05 -0700",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, dateStr); err == nil {
			return t
		}
	}
	return time.Now()
}

func newsHash(title, link string) string {
	h := md5.Sum([]byte(title + "|" + link))
	return fmt.Sprintf("%x", h)
}

// ==================== AI Translation & Summary ====================

func (h *Handler) translateAndSummarize(titles []string, trackName string) ([]string, string) {
	if len(titles) == 0 {
		return nil, ""
	}

	baseURL, apiKey, model := getDecisionAIConfig()
	if apiKey == "" {
		// No AI configured, return titles as-is
		cn := make([]string, len(titles))
		for i, t := range titles {
			cn[i] = t
		}
		return cn, ""
	}

	// Build prompt for translation + highlights
	titleList := ""
	for i, t := range titles {
		if i >= 20 {
			break
		}
		titleList += fmt.Sprintf("%d. %s\n", i+1, t)
	}

	prompt := fmt.Sprintf(`你是投资资讯翻译助手。以下是"%s"赛道的最新新闻标题列表：

%s

请完成两个任务：
1. 将所有英文标题翻译为简洁中文（已有中文的保留原文），输出为JSON数组格式，key为"translations"
2. 从中提炼3-5条今日要点摘要（中文），关注核心公司、关键数据、行业趋势，输出为JSON数组格式，key为"highlights"

输出纯JSON格式（不要markdown代码块）：
{"translations": ["标题1中文", "标题2中文", ...], "highlights": ["要点1", "要点2", ...]}`, trackName, titleList)

	result := callLLMForNews(baseURL, apiKey, model, prompt)
	if result == "" {
		cn := make([]string, len(titles))
		for i, t := range titles {
			cn[i] = t
		}
		return cn, ""
	}

	// Parse JSON response
	translations, highlights := parseNewsAIResponse(result, titles)
	return translations, highlights
}

func callLLMForNews(baseURL, apiKey, model, prompt string) string {
	payload := fmt.Sprintf(`{"model":"%s","messages":[{"role":"user","content":%q}],"temperature":0.3,"max_tokens":4000}`, model, prompt)

	client := &http.Client{Timeout: 60 * time.Second}
	req, err := http.NewRequest("POST", baseURL+"/chat/completions", strings.NewReader(payload))
	if err != nil {
		return ""
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[News AI] call failed: %v", err)
		return ""
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	bodyStr := string(body)

	// Extract content from response
	contentStart := strings.Index(bodyStr, `"content"`)
	if contentStart == -1 {
		return ""
	}
	// Find the content value
	rest := bodyStr[contentStart+10:]
	// Skip to first quote after colon
	qStart := strings.Index(rest, `"`)
	if qStart == -1 {
		return ""
	}
	rest = rest[qStart+1:]
	// Find closing quote (handle escapes)
	var content strings.Builder
	for i := 0; i < len(rest); i++ {
		if rest[i] == '\\' && i+1 < len(rest) {
			if rest[i+1] == '"' {
				content.WriteByte('"')
				i++
			} else if rest[i+1] == 'n' {
				content.WriteByte('\n')
				i++
			} else if rest[i+1] == '\\' {
				content.WriteByte('\\')
				i++
			} else {
				content.WriteByte(rest[i])
			}
		} else if rest[i] == '"' {
			break
		} else {
			content.WriteByte(rest[i])
		}
	}
	return content.String()
}

func parseNewsAIResponse(result string, origTitles []string) ([]string, string) {
	// Try to find JSON in the response
	jsonStr := result
	if idx := strings.Index(result, "{"); idx >= 0 {
		jsonStr = result[idx:]
	}
	if idx := strings.LastIndex(jsonStr, "}"); idx >= 0 {
		jsonStr = jsonStr[:idx+1]
	}

	translations := make([]string, len(origTitles))
	for i, t := range origTitles {
		translations[i] = t
	}

	// Parse translations array
	if idx := strings.Index(jsonStr, `"translations"`); idx >= 0 {
		arrStart := strings.Index(jsonStr[idx:], "[")
		if arrStart >= 0 {
			arrStr := jsonStr[idx+arrStart:]
			arrEnd := strings.Index(arrStr, "]")
			if arrEnd >= 0 {
				arr := arrStr[1:arrEnd]
				parts := splitJSONArray(arr)
				for i, p := range parts {
					if i < len(translations) && p != "" {
						translations[i] = p
					}
				}
			}
		}
	}

	// Parse highlights
	highlights := ""
	if idx := strings.Index(jsonStr, `"highlights"`); idx >= 0 {
		arrStart := strings.Index(jsonStr[idx:], "[")
		if arrStart >= 0 {
			arrStr := jsonStr[idx+arrStart:]
			arrEnd := strings.Index(arrStr, "]")
			if arrEnd >= 0 {
				arr := arrStr[1:arrEnd]
				parts := splitJSONArray(arr)
				highlights = strings.Join(parts, "||")
			}
		}
	}

	return translations, highlights
}

func splitJSONArray(s string) []string {
	var results []string
	inQuote := false
	start := -1
	for i := 0; i < len(s); i++ {
		if s[i] == '"' && (i == 0 || s[i-1] != '\\') {
			if !inQuote {
				inQuote = true
				start = i + 1
			} else {
				inQuote = false
				if start >= 0 {
					results = append(results, s[start:i])
				}
				start = -1
			}
		}
	}
	return results
}

// ==================== Fetch & Store ====================

func (h *Handler) fetchAndStoreNews() {
	since := time.Now().AddDate(0, 0, -7)
	today := time.Now().Format("2006-01-02")

	log.Printf("[News] Starting news fetch for date %s (past 7 days)", today)

	var mu sync.Mutex
	var wg sync.WaitGroup
	allItems := make(map[string][]rssItem)

	// Fetch all RSS feeds concurrently
	sem := make(chan struct{}, 5) // limit concurrency
	for _, src := range newsSources {
		wg.Add(1)
		go func(s newsSource) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			items := fetchRSSFeed(s, since)
			if len(items) > 0 {
				mu.Lock()
				allItems[s.Hint] = append(allItems[s.Hint], items...)
				mu.Unlock()
				log.Printf("[News] %s: %d items", s.Name, len(items))
			}
		}(src)
	}
	wg.Wait()

	// Process each track
	for _, track := range newsTracks {
		items := allItems[track.Key]
		if len(items) == 0 {
			continue
		}

		// Deduplicate by hash
		seen := make(map[string]bool)
		var unique []rssItem
		for _, item := range items {
			h := newsHash(item.Title, item.Link)
			if !seen[h] {
				seen[h] = true
				unique = append(unique, item)
			}
		}

		// Sort by date descending
		sort.Slice(unique, func(i, j int) bool {
			return unique[i].PubDate.After(unique[j].PubDate)
		})

		// Limit to 20 per track
		if len(unique) > 20 {
			unique = unique[:20]
		}

		// Get titles for AI processing
		titles := make([]string, len(unique))
		for i, item := range unique {
			titles[i] = item.Title
		}

		// Translate and generate highlights
		translations, highlightsStr := h.translateAndSummarize(titles, track.Name)

		// Store news items
		for i, item := range unique {
			hash := newsHash(item.Title, item.Link)
			titleCN := item.Title
			if i < len(translations) {
				titleCN = translations[i]
			}

			news := InvestmentNews{
				Track:     track.Key,
				TrackName: track.Name,
				Source:    item.Source,
				Title:     item.Title,
				TitleCN:   titleCN,
				Link:      item.Link,
				PubDate:   item.PubDate,
				FetchDate: today,
				Hash:      hash,
			}
			// Upsert: create if not exists
			repository.DB.Where("hash = ?", hash).FirstOrCreate(&news)
		}

		// Store highlights
		if highlightsStr != "" {
			highlight := InvestmentHighlight{
				Track:     track.Key,
				TrackName: track.Name,
				Content:   highlightsStr,
				FetchDate: today,
			}
			// Delete old highlight for same track+date, then create new
			repository.DB.Where("track = ? AND fetch_date = ?", track.Key, today).Delete(&InvestmentHighlight{})
			repository.DB.Create(&highlight)
		}

		log.Printf("[News] Track %s: stored %d items", track.Name, len(unique))
	}

	log.Printf("[News] Fetch complete for %s", today)
}

// ==================== API Handlers ====================

func (h *Handler) GetInvestmentNews(c *gin.Context) {
	track := c.Query("track")    // optional filter
	date := c.Query("date")      // optional: specific date
	page := c.DefaultQuery("page", "1")

	query := repository.DB.Model(&InvestmentNews{}).Order("pub_date DESC")

	if track != "" {
		query = query.Where("track = ?", track)
	}
	if date != "" {
		query = query.Where("fetch_date = ?", date)
	} else {
		// Default: last 7 days
		since := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
		query = query.Where("fetch_date >= ?", since)
	}

	var total int64
	query.Count(&total)

	pageNum := 1
	fmt.Sscanf(page, "%d", &pageNum)
	if pageNum < 1 {
		pageNum = 1
	}
	limit := 50
	offset := (pageNum - 1) * limit

	var news []InvestmentNews
	query.Offset(offset).Limit(limit).Find(&news)

	response.Success(c, gin.H{
		"news":   news,
		"total":  total,
		"page":   pageNum,
		"tracks": newsTracks,
	})
}

func (h *Handler) GetInvestmentHighlights(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	var highlights []InvestmentHighlight
	repository.DB.Where("fetch_date = ?", date).Find(&highlights)

	// If no highlights for today, check yesterday
	if len(highlights) == 0 {
		yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		repository.DB.Where("fetch_date = ?", yesterday).Find(&highlights)
		if len(highlights) > 0 {
			date = yesterday
		}
	}

	// Build response map by track
	highlightMap := make(map[string][]string)
	for _, h := range highlights {
		parts := strings.Split(h.Content, "||")
		highlightMap[h.Track] = parts
	}

	response.Success(c, gin.H{
		"highlights": highlightMap,
		"date":       date,
		"tracks":     newsTracks,
	})
}

func (h *Handler) GetNewsDates(c *gin.Context) {
	var dates []string
	repository.DB.Model(&InvestmentNews{}).Distinct("fetch_date").Order("fetch_date DESC").Limit(30).Pluck("fetch_date", &dates)
	response.Success(c, gin.H{"dates": dates})
}

func (h *Handler) RefreshInvestmentNews(c *gin.Context) {
	go h.fetchAndStoreNews()
	response.Success(c, gin.H{"message": "资讯刷新任务已启动，请稍后查看"})
}

// ==================== Scheduler ====================

func StartNewsScheduler(h *Handler) {
	// Fetch on startup if no data for today
	today := time.Now().Format("2006-01-02")
	var count int64
	repository.DB.Model(&InvestmentNews{}).Where("fetch_date = ?", today).Count(&count)
	if count == 0 {
		log.Println("[News] No data for today, triggering initial fetch...")
		go h.fetchAndStoreNews()
	}

	// Schedule every 4 hours
	go func() {
		ticker := time.NewTicker(4 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			h.fetchAndStoreNews()
		}
	}()
}
