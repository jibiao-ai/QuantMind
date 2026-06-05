package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"quantmind/internal/model"
	"quantmind/internal/repository"
)

// ==================== 小樊精选 - 分类管理 ====================

// GetXiaofanCategories - 获取所有分类（含股票列表）
func (h *Handler) GetXiaofanCategories(c *gin.Context) {
	var categories []model.XiaofanCategory
	result := repository.DB.Preload("Stocks").Order("sort_order ASC, id ASC").Find(&categories)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取分类失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": categories})
}

// CreateXiaofanCategory - 创建分类
func (h *Handler) CreateXiaofanCategory(c *gin.Context) {
	var req struct {
		Name      string `json:"name" binding:"required"`
		SortOrder int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "分类名称不能为空"})
		return
	}

	userID, _ := c.Get("user_id")
	category := model.XiaofanCategory{
		Name:      req.Name,
		SortOrder: req.SortOrder,
		UserID:    userID.(uint),
	}

	if err := repository.DB.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建分类失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": category, "message": "创建成功"})
}

// UpdateXiaofanCategory - 更新分类
func (h *Handler) UpdateXiaofanCategory(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效ID"})
		return
	}

	var req struct {
		Name      string `json:"name"`
		SortOrder int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	var category model.XiaofanCategory
	if err := repository.DB.First(&category, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分类不存在"})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.SortOrder >= 0 {
		updates["sort_order"] = req.SortOrder
	}

	repository.DB.Model(&category).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": category, "message": "更新成功"})
}

// DeleteXiaofanCategory - 删除分类（含其中的股票）
func (h *Handler) DeleteXiaofanCategory(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效ID"})
		return
	}

	// 删除分类下的所有股票
	repository.DB.Where("category_id = ?", id).Delete(&model.XiaofanStock{})
	// 删除分类
	repository.DB.Delete(&model.XiaofanCategory{}, id)

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "删除成功"})
}

// ==================== 小樊精选 - 股票管理 ====================

// AddXiaofanStock - 添加股票到分类
func (h *Handler) AddXiaofanStock(c *gin.Context) {
	categoryID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效分类ID"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
		Name string `json:"name"`
		Note string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "股票代码不能为空"})
		return
	}

	// 检查是否已存在
	var existing model.XiaofanStock
	if repository.DB.Where("category_id = ? AND code = ?", categoryID, req.Code).First(&existing).Error == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "该股票已在此分类中"})
		return
	}

	userID, _ := c.Get("user_id")
	stock := model.XiaofanStock{
		CategoryID: uint(categoryID),
		Code:       req.Code,
		Name:       req.Name,
		Note:       req.Note,
		UserID:     userID.(uint),
	}

	if err := repository.DB.Create(&stock).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "添加股票失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": stock, "message": "添加成功"})
}

// RemoveXiaofanStock - 从分类移除股票
func (h *Handler) RemoveXiaofanStock(c *gin.Context) {
	stockID, err := strconv.Atoi(c.Param("stockId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效ID"})
		return
	}

	repository.DB.Delete(&model.XiaofanStock{}, stockID)
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "移除成功"})
}

// GetXiaofanCategoryStocks - 获取分类下的股票列表
func (h *Handler) GetXiaofanCategoryStocks(c *gin.Context) {
	categoryID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效分类ID"})
		return
	}

	var stocks []model.XiaofanStock
	repository.DB.Where("category_id = ?", categoryID).Order("sort_order ASC, id ASC").Find(&stocks)
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": stocks})
}

// BatchAddXiaofanStocks - 批量添加股票
func (h *Handler) BatchAddXiaofanStocks(c *gin.Context) {
	categoryID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效分类ID"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	userID, _ := c.Get("user_id")
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
			UserID:     userID.(uint),
		}
		repository.DB.Create(&stock)
		added++
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "批量添加完成", "added": added})
}
