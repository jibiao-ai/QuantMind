package handler

import (
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"quantmind/internal/model"
	"quantmind/internal/repository"
)

// ==================== 小樊精选 - 分类管理 ====================

// getUserID safely extracts user_id from gin context
func getUserID(c *gin.Context) (uint, error) {
	val, exists := c.Get("user_id")
	if !exists {
		log.Printf("[Xiaofan] ERROR: user_id not found in context, keys: %v", c.Keys)
		return 0, fmt.Errorf("user_id not found in context")
	}
	log.Printf("[Xiaofan] DEBUG: user_id raw value=%v, type=%T", val, val)

	switch v := val.(type) {
	case uint:
		return v, nil
	case int:
		return uint(v), nil
	case int64:
		return uint(v), nil
	case uint64:
		return uint(v), nil
	case float64:
		return uint(v), nil
	default:
		log.Printf("[Xiaofan] ERROR: user_id unexpected type: %T, value: %v", val, val)
		return 0, fmt.Errorf("user_id unexpected type: %T", val)
	}
}

// GetXiaofanCategories - 获取所有分类（含股票列表）
func (h *Handler) GetXiaofanCategories(c *gin.Context) {
	log.Printf("[Xiaofan] GetXiaofanCategories called")

	var categories []model.XiaofanCategory
	result := repository.DB.Preload("Stocks").Order("sort_order ASC, id ASC").Find(&categories)
	if result.Error != nil {
		log.Printf("[Xiaofan] ERROR: GetCategories DB query failed: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": fmt.Sprintf("获取分类失败: %v", result.Error)})
		return
	}

	log.Printf("[Xiaofan] GetCategories success: %d categories found", len(categories))
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": categories})
}

// CreateXiaofanCategory - 创建分类
func (h *Handler) CreateXiaofanCategory(c *gin.Context) {
	log.Printf("[Xiaofan] CreateXiaofanCategory called")

	var req struct {
		Name      string `json:"name" binding:"required"`
		SortOrder int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[Xiaofan] ERROR: CreateCategory bind failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": fmt.Sprintf("参数解析失败: %v", err)})
		return
	}

	log.Printf("[Xiaofan] CreateCategory request: name=%s, sort_order=%d", req.Name, req.SortOrder)

	userID, err := getUserID(c)
	if err != nil {
		log.Printf("[Xiaofan] ERROR: CreateCategory getUserID failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": fmt.Sprintf("获取用户信息失败: %v", err)})
		return
	}

	log.Printf("[Xiaofan] CreateCategory userID=%d, creating category...", userID)

	category := model.XiaofanCategory{
		Name:      req.Name,
		SortOrder: req.SortOrder,
		UserID:    userID,
	}

	if err := repository.DB.Create(&category).Error; err != nil {
		log.Printf("[Xiaofan] ERROR: CreateCategory DB.Create failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": fmt.Sprintf("创建分类失败: %v", err)})
		return
	}

	log.Printf("[Xiaofan] CreateCategory success: id=%d, name=%s", category.ID, category.Name)
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": category, "message": "创建成功"})
}

// UpdateXiaofanCategory - 更新分类
func (h *Handler) UpdateXiaofanCategory(c *gin.Context) {
	log.Printf("[Xiaofan] UpdateXiaofanCategory called, param id=%s", c.Param("id"))

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": "无效ID"})
		return
	}

	var req struct {
		Name      string `json:"name"`
		SortOrder int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[Xiaofan] ERROR: UpdateCategory bind failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": fmt.Sprintf("参数错误: %v", err)})
		return
	}

	var category model.XiaofanCategory
	if err := repository.DB.First(&category, id).Error; err != nil {
		log.Printf("[Xiaofan] ERROR: UpdateCategory not found id=%d: %v", id, err)
		c.JSON(http.StatusNotFound, gin.H{"code": -1, "error": "分类不存在"})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.SortOrder >= 0 {
		updates["sort_order"] = req.SortOrder
	}

	if err := repository.DB.Model(&category).Updates(updates).Error; err != nil {
		log.Printf("[Xiaofan] ERROR: UpdateCategory DB.Updates failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": fmt.Sprintf("更新失败: %v", err)})
		return
	}

	log.Printf("[Xiaofan] UpdateCategory success: id=%d", id)
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": category, "message": "更新成功"})
}

// DeleteXiaofanCategory - 删除分类（含其中的股票）
func (h *Handler) DeleteXiaofanCategory(c *gin.Context) {
	log.Printf("[Xiaofan] DeleteXiaofanCategory called, param id=%s", c.Param("id"))

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": "无效ID"})
		return
	}

	// 删除分类下的所有股票
	if err := repository.DB.Where("category_id = ?", id).Delete(&model.XiaofanStock{}).Error; err != nil {
		log.Printf("[Xiaofan] WARN: DeleteCategory delete stocks failed for category %d: %v", id, err)
	}
	// 删除分类
	if err := repository.DB.Delete(&model.XiaofanCategory{}, id).Error; err != nil {
		log.Printf("[Xiaofan] ERROR: DeleteCategory failed id=%d: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": fmt.Sprintf("删除失败: %v", err)})
		return
	}

	log.Printf("[Xiaofan] DeleteCategory success: id=%d", id)
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "删除成功"})
}

// ==================== 小樊精选 - 股票管理 ====================

// AddXiaofanStock - 添加股票到分类
func (h *Handler) AddXiaofanStock(c *gin.Context) {
	log.Printf("[Xiaofan] AddXiaofanStock called, param id=%s", c.Param("id"))

	categoryID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": "无效分类ID"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
		Name string `json:"name"`
		Note string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[Xiaofan] ERROR: AddStock bind failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": fmt.Sprintf("参数错误: %v", err)})
		return
	}

	log.Printf("[Xiaofan] AddStock: categoryID=%d, code=%s, name=%s", categoryID, req.Code, req.Name)

	// 检查是否已存在
	var existing model.XiaofanStock
	if repository.DB.Where("category_id = ? AND code = ?", categoryID, req.Code).First(&existing).Error == nil {
		log.Printf("[Xiaofan] AddStock: duplicate stock code=%s in category=%d", req.Code, categoryID)
		c.JSON(http.StatusConflict, gin.H{"code": -1, "error": "该股票已在此分类中"})
		return
	}

	userID, err := getUserID(c)
	if err != nil {
		log.Printf("[Xiaofan] ERROR: AddStock getUserID failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": fmt.Sprintf("获取用户信息失败: %v", err)})
		return
	}

	stock := model.XiaofanStock{
		CategoryID: uint(categoryID),
		Code:       req.Code,
		Name:       req.Name,
		Note:       req.Note,
		UserID:     userID,
	}

	if err := repository.DB.Create(&stock).Error; err != nil {
		log.Printf("[Xiaofan] ERROR: AddStock DB.Create failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": fmt.Sprintf("添加股票失败: %v", err)})
		return
	}

	log.Printf("[Xiaofan] AddStock success: id=%d, code=%s", stock.ID, stock.Code)
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": stock, "message": "添加成功"})
}

// RemoveXiaofanStock - 从分类移除股票
func (h *Handler) RemoveXiaofanStock(c *gin.Context) {
	log.Printf("[Xiaofan] RemoveXiaofanStock called, param stockId=%s", c.Param("stockId"))

	stockID, err := strconv.Atoi(c.Param("stockId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": "无效ID"})
		return
	}

	if err := repository.DB.Delete(&model.XiaofanStock{}, stockID).Error; err != nil {
		log.Printf("[Xiaofan] ERROR: RemoveStock failed id=%d: %v", stockID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": fmt.Sprintf("移除失败: %v", err)})
		return
	}

	log.Printf("[Xiaofan] RemoveStock success: id=%d", stockID)
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "移除成功"})
}

// GetXiaofanCategoryStocks - 获取分类下的股票列表
func (h *Handler) GetXiaofanCategoryStocks(c *gin.Context) {
	log.Printf("[Xiaofan] GetXiaofanCategoryStocks called, param id=%s", c.Param("id"))

	categoryID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": "无效分类ID"})
		return
	}

	var stocks []model.XiaofanStock
	if err := repository.DB.Where("category_id = ?", categoryID).Order("sort_order ASC, id ASC").Find(&stocks).Error; err != nil {
		log.Printf("[Xiaofan] ERROR: GetCategoryStocks failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": fmt.Sprintf("获取股票列表失败: %v", err)})
		return
	}

	log.Printf("[Xiaofan] GetCategoryStocks: categoryID=%d, count=%d", categoryID, len(stocks))
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": stocks})
}

// BatchAddXiaofanStocks - 批量添加股票
func (h *Handler) BatchAddXiaofanStocks(c *gin.Context) {
	log.Printf("[Xiaofan] BatchAddXiaofanStocks called, param id=%s", c.Param("id"))

	categoryID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": "无效分类ID"})
		return
	}

	var req struct {
		Stocks []struct {
			Code string `json:"code"`
			Name string `json:"name"`
			Note string `json:"note"`
		} `json:"stocks" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[Xiaofan] ERROR: BatchAdd bind failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "error": fmt.Sprintf("参数错误: %v", err)})
		return
	}

	userID, err := getUserID(c)
	if err != nil {
		log.Printf("[Xiaofan] ERROR: BatchAdd getUserID failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "error": fmt.Sprintf("获取用户信息失败: %v", err)})
		return
	}

	added := 0
	for _, s := range req.Stocks {
		if s.Code == "" {
			continue
		}
		// Skip duplicates
		var existing model.XiaofanStock
		if repository.DB.Where("category_id = ? AND code = ?", categoryID, s.Code).First(&existing).Error == nil {
			continue
		}
		stock := model.XiaofanStock{
			CategoryID: uint(categoryID),
			Code:       s.Code,
			Name:       s.Name,
			Note:       s.Note,
			UserID:     userID,
		}
		if err := repository.DB.Create(&stock).Error; err != nil {
			log.Printf("[Xiaofan] WARN: BatchAdd create stock %s failed: %v", s.Code, err)
			continue
		}
		added++
	}

	log.Printf("[Xiaofan] BatchAdd success: categoryID=%d, added=%d of %d", categoryID, added, len(req.Stocks))
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "批量添加完成", "added": added})
}
