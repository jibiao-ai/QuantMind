"""
QuantMind Unified Data Service (v3.0)
=====================================
整合五层数据源为统一微服务：

1. 行情层: mootdx (通达信协议) + 腾讯财经 (qt.gtimg.cn)
2. 研报层: 东方财富 (eastmoney) + akshare + iwencai
3. 新闻层: akshare (stock_news_em) + mootdx
4. 基础数据层: mootdx finance/F10
5. 公告层: 巨潮资讯 (cninfo) + mootdx

Endpoints:
  GET /health                    - 健康检查
  
  # === 行情层 (mootdx + 腾讯) ===
  GET /quote?codes=000001,600519 - 实时行情 (腾讯)
  GET /kline?code=000001&freq=daily&count=60 - K线数据 (mootdx)
  GET /minute?code=000001        - 分时数据 (mootdx)
  GET /index?code=000001         - 指数行情
  
  # === 研报层 (东财 + akshare) ===
  GET /research?code=000001      - 个股研报
  GET /research/market           - 市场研报
  
  # === 新闻层 (akshare + 东财) ===
  GET /news?code=000001          - 个股新闻
  GET /news/market               - 市场新闻
  GET /guba?code=000001          - 股吧评论
  
  # === 基础数据层 (mootdx F10) ===
  GET /f10?code=000001           - F10基础数据
  GET /finance?code=000001       - 财务数据
  
  # === 公告层 (巨潮资讯 + mootdx) ===
  GET /announce?code=000001      - 个股公告
  GET /announce/market           - 市场公告
  
  # === 原有接口保持兼容 ===
  GET /limit_up                  - 涨停板
  GET /limit_down                - 跌停板
  GET /broken_board              - 炸板
  GET /board_ladder              - 连板天梯
  GET /market_stats              - 市场统计
  GET /concept_heat              - 概念热力
  GET /industry_heat             - 行业热力
  GET /market_overview           - 涨跌概览
  GET /all_stocks                - 全市场行情
  GET /dragon_tiger              - 龙虎榜
"""

import json
import time
import traceback
import threading
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import urllib.request
import sys
import os

# ===================== Dependencies =====================
try:
    import akshare as ak
    import pandas as pd
    AKSHARE_AVAILABLE = True
except ImportError:
    AKSHARE_AVAILABLE = False
    print("[DataService] WARNING: akshare not installed")

try:
    from mootdx.quotes import Quotes
    MOOTDX_AVAILABLE = True
except ImportError:
    MOOTDX_AVAILABLE = False
    print("[DataService] WARNING: mootdx not installed")

# ===================== Cache System =====================
_cache = {}
CACHE_TTL = {
    'realtime': 30,     # 实时行情 30秒
    'kline': 300,       # K线 5分钟
    'news': 600,        # 新闻 10分钟
    'research': 1800,   # 研报 30分钟
    'f10': 3600,        # F10 1小时
    'announce': 1800,   # 公告 30分钟
    'default': 300,     # 默认 5分钟
}

def cache_get(key, category='default'):
    if key in _cache:
        data, ts = _cache[key]
        ttl = CACHE_TTL.get(category, CACHE_TTL['default'])
        if time.time() - ts < ttl:
            return data
    return None

def cache_set(key, data):
    _cache[key] = (data, time.time())


# ===================== mootdx Client =====================
_mootdx_client = None
_mootdx_lock = threading.Lock()

def get_mootdx_client():
    """Get or create mootdx client (thread-safe singleton)"""
    global _mootdx_client
    if not MOOTDX_AVAILABLE:
        return None
    with _mootdx_lock:
        if _mootdx_client is None:
            try:
                _mootdx_client = Quotes.factory(market='std', timeout=10)
                print("[DataService] mootdx client initialized")
            except Exception as e:
                print(f"[DataService] mootdx init error: {e}")
                return None
    return _mootdx_client


# ===================== 1. 行情层 (mootdx + 腾讯) =====================

def fetch_quote_tencent(codes):
    """实时行情 - 腾讯财经 qt.gtimg.cn
    Works during and after market hours. Returns latest close price after hours.
    """
    cache_key = f"tencent_quote_{','.join(sorted(codes))}"
    cached = cache_get(cache_key, 'realtime')
    if cached:
        return cached

    # Convert codes to tencent format: 000001->sz000001, 600519->sh600519
    tc_codes = []
    for code in codes:
        code = code.strip()
        if code.startswith('6') or code.startswith('5') or code.startswith('9'):
            tc_codes.append(f"sh{code}")
        else:
            tc_codes.append(f"sz{code}")

    url = f"http://qt.gtimg.cn/q={','.join(tc_codes)}"
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'http://finance.qq.com'
        })
        resp = urllib.request.urlopen(req, timeout=8)
        content = resp.read().decode('gbk')

        results = []
        for line in content.strip().split('\n'):
            if '~' not in line:
                continue
            parts = line.split('~')
            if len(parts) < 50:
                continue
            try:
                stock = {
                    'code': parts[2],
                    'name': parts[1],
                    'price': float(parts[3]) if parts[3] else 0,
                    'pre_close': float(parts[4]) if parts[4] else 0,
                    'open': float(parts[5]) if parts[5] else 0,
                    'volume': int(float(parts[6])) if parts[6] else 0,   # 手
                    'buy_volume': int(float(parts[7])) if parts[7] else 0,
                    'sell_volume': int(float(parts[8])) if parts[8] else 0,
                    'bid1_price': float(parts[9]) if parts[9] else 0,
                    'bid1_vol': int(float(parts[10])) if parts[10] else 0,
                    'ask1_price': float(parts[19]) if parts[19] else 0,
                    'ask1_vol': int(float(parts[20])) if parts[20] else 0,
                    'time': parts[30] if len(parts) > 30 else '',
                    'change_pct': float(parts[32]) if parts[32] else 0,
                    'high': float(parts[33]) if parts[33] else 0,
                    'low': float(parts[34]) if parts[34] else 0,
                    'amount': float(parts[37]) if len(parts) > 37 and parts[37] else 0,  # 万元
                    'turnover_rate': float(parts[38]) if len(parts) > 38 and parts[38] else 0,
                    'pe': float(parts[39]) if len(parts) > 39 and parts[39] else 0,
                    'amplitude': float(parts[43]) if len(parts) > 43 and parts[43] else 0,
                    'circ_mv': float(parts[44]) if len(parts) > 44 and parts[44] else 0,  # 亿
                    'total_mv': float(parts[45]) if len(parts) > 45 and parts[45] else 0,  # 亿
                    'pb': float(parts[46]) if len(parts) > 46 and parts[46] else 0,
                    'limit_up': float(parts[47]) if len(parts) > 47 and parts[47] else 0,
                    'limit_down': float(parts[48]) if len(parts) > 48 and parts[48] else 0,
                    'volume_ratio': float(parts[49]) if len(parts) > 49 and parts[49] else 0,
                    'source': 'tencent',
                }
                if stock['price'] > 0:
                    results.append(stock)
            except (ValueError, IndexError) as e:
                continue

        if results:
            cache_set(cache_key, results)
        return results
    except Exception as e:
        print(f"[DataService] tencent quote error: {e}")
        return []


def fetch_kline_mootdx(code, frequency=9, count=60):
    """K线数据 - mootdx通达信协议
    frequency: 0=5min, 1=15min, 2=30min, 3=60min, 4=daily, 5=weekly, 6=monthly, 9=daily, 10=seasonal, 11=yearly
    """
    cache_key = f"kline_{code}_{frequency}_{count}"
    cached = cache_get(cache_key, 'kline')
    if cached:
        return cached

    client = get_mootdx_client()
    if not client:
        return []

    try:
        bars = client.bars(symbol=code, frequency=frequency, offset=count)
        if bars is None or len(bars) == 0:
            return []

        result = []
        for idx, row in bars.iterrows():
            result.append({
                'date': str(idx) if isinstance(idx, str) else idx.strftime('%Y-%m-%d') if hasattr(idx, 'strftime') else str(row.get('datetime', '')),
                'open': float(row.get('open', 0)),
                'close': float(row.get('close', 0)),
                'high': float(row.get('high', 0)),
                'low': float(row.get('low', 0)),
                'volume': float(row.get('volume', 0)),
                'amount': float(row.get('amount', 0)) if 'amount' in row else 0,
            })

        if result:
            cache_set(cache_key, result)
        return result
    except Exception as e:
        print(f"[DataService] mootdx kline error for {code}: {e}")
        return []


def fetch_minute_mootdx(code):
    """分时数据 - mootdx"""
    cache_key = f"minute_{code}"
    cached = cache_get(cache_key, 'realtime')
    if cached:
        return cached

    client = get_mootdx_client()
    if not client:
        return []

    try:
        data = client.minute(symbol=code)
        if data is None or len(data) == 0:
            return []
        result = []
        for _, row in data.iterrows():
            result.append({
                'price': float(row.get('price', 0)),
                'vol': int(row.get('vol', 0)),
                'volume': int(row.get('volume', 0)),
            })
        if result:
            cache_set(cache_key, result)
        return result
    except Exception as e:
        print(f"[DataService] mootdx minute error: {e}")
        return []


# ===================== 2. 研报层 (东财 + akshare) =====================

def fetch_research_stock(code):
    """个股研报 - 东方财富研报"""
    cache_key = f"research_{code}"
    cached = cache_get(cache_key, 'research')
    if cached:
        return cached

    if not AKSHARE_AVAILABLE:
        return []

    results = []
    # Method: Use eastmoney stock news which includes research-type articles
    try:
        url = f"https://reportapi.eastmoney.com/report/list?industryCode=&pageSize=10&industry=&rating=&ratingChange=&beginTime=&endTime=&pageNo=1&fields=&qType=0&orgCode=&rcode=&stockCode={code}"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://data.eastmoney.com'
        })
        resp = urllib.request.urlopen(req, timeout=8)
        data = json.loads(resp.read().decode('utf-8'))
        
        if data and 'data' in data and data['data']:
            for item in data['data'][:20]:
                results.append({
                    'title': item.get('title', ''),
                    'org_name': item.get('orgSName', '') or item.get('orgName', ''),
                    'author': item.get('researcher', ''),
                    'rating': item.get('emRatingName', ''),
                    'date': item.get('publishDate', '')[:10] if item.get('publishDate') else '',
                    'industry': item.get('industryName', ''),
                    'summary': item.get('indvInduName', ''),
                    'source': 'eastmoney',
                })
    except Exception as e:
        print(f"[DataService] eastmoney research error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_research_market():
    """市场最新研报 - 东方财富"""
    cache_key = "research_market"
    cached = cache_get(cache_key, 'research')
    if cached:
        return cached

    results = []
    try:
        url = "https://reportapi.eastmoney.com/report/list?industryCode=&pageSize=30&industry=&rating=&ratingChange=&beginTime=&endTime=&pageNo=1&fields=&qType=0&orgCode=&rcode=&stockCode="
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://data.eastmoney.com'
        })
        resp = urllib.request.urlopen(req, timeout=8)
        data = json.loads(resp.read().decode('utf-8'))
        
        if data and 'data' in data and data['data']:
            for item in data['data']:
                results.append({
                    'title': item.get('title', ''),
                    'stock_code': item.get('stockCode', ''),
                    'stock_name': item.get('stockName', ''),
                    'org_name': item.get('orgSName', '') or item.get('orgName', ''),
                    'author': item.get('researcher', ''),
                    'rating': item.get('emRatingName', ''),
                    'date': item.get('publishDate', '')[:10] if item.get('publishDate') else '',
                    'industry': item.get('industryName', ''),
                    'source': 'eastmoney',
                })
    except Exception as e:
        print(f"[DataService] market research error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


# ===================== 3. 新闻层 (akshare + 东财) =====================

def fetch_news_stock(code):
    """个股新闻 - akshare stock_news_em"""
    cache_key = f"news_{code}"
    cached = cache_get(cache_key, 'news')
    if cached:
        return cached

    if not AKSHARE_AVAILABLE:
        return []

    results = []
    try:
        df = ak.stock_news_em(symbol=code)
        if df is not None and len(df) > 0:
            for _, row in df.iterrows():
                results.append({
                    'title': str(row.get('新闻标题', '')),
                    'content': str(row.get('新闻内容', ''))[:200],
                    'time': str(row.get('发布时间', '')),
                    'source': str(row.get('文章来源', '')),
                    'url': str(row.get('新闻链接', '')),
                })
    except Exception as e:
        print(f"[DataService] stock news error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_news_market():
    """市场新闻 - 财经要闻"""
    cache_key = "news_market"
    cached = cache_get(cache_key, 'news')
    if cached:
        return cached

    results = []
    if not AKSHARE_AVAILABLE:
        return results

    try:
        # 财经新闻
        df = ak.stock_news_em(symbol='000001')  # Use index as proxy for market news
        if df is not None and len(df) > 0:
            for _, row in df.iterrows():
                results.append({
                    'title': str(row.get('新闻标题', '')),
                    'content': str(row.get('新闻内容', ''))[:200],
                    'time': str(row.get('发布时间', '')),
                    'source': str(row.get('文章来源', '')),
                    'url': str(row.get('新闻链接', '')),
                })
    except Exception as e:
        print(f"[DataService] market news error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_guba(code):
    """股吧评论 - 东方财富股吧"""
    cache_key = f"guba_{code}"
    cached = cache_get(cache_key, 'news')
    if cached:
        return cached

    results = []
    try:
        url = f"http://guba.eastmoney.com/interface/GetData?path=pcevaluation/list&columns=post_id,post_title,post_content_p_short,post_publish_time,post_source_id,nickName,post_click_count,post_comment_count&sort=post_publish_time&order=desc&ps=20&p=1&code={code}"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Referer': f'http://guba.eastmoney.com/list,{code}.html'
        })
        resp = urllib.request.urlopen(req, timeout=8)
        data = json.loads(resp.read().decode('utf-8'))
        
        if data and 'data' in data and 'list' in data['data']:
            for item in data['data']['list']:
                results.append({
                    'id': item.get('post_id', ''),
                    'title': item.get('post_title', ''),
                    'content': item.get('post_content_p_short', '')[:100],
                    'time': item.get('post_publish_time', ''),
                    'author': item.get('nickName', ''),
                    'views': item.get('post_click_count', 0),
                    'comments': item.get('post_comment_count', 0),
                })
    except Exception as e:
        print(f"[DataService] guba error for {code}: {e}")

    # Fallback: try akshare
    if not results and AKSHARE_AVAILABLE:
        try:
            # Try stock_comment_detail_zlkp_jgcyd_em as alternative
            pass  # Most guba APIs are rate-limited
        except:
            pass

    if results:
        cache_set(cache_key, results)
    return results


# ===================== 4. 基础数据层 (mootdx F10) =====================

def fetch_f10(code):
    """F10基础数据 - mootdx finance"""
    cache_key = f"f10_{code}"
    cached = cache_get(cache_key, 'f10')
    if cached:
        return cached

    client = get_mootdx_client()
    if not client:
        return {}

    result = {}
    try:
        finance = client.finance(symbol=code)
        if finance is not None and len(finance) > 0:
            row = finance.iloc[0]
            result = {
                'code': code,
                'total_shares': float(row.get('zongguben', 0)),        # 总股本
                'circ_shares': float(row.get('liutongguben', 0)),      # 流通股本
                'total_assets': float(row.get('zongzichan', 0)),       # 总资产
                'net_assets': float(row.get('jingzichan', 0)),         # 净资产
                'revenue': float(row.get('zhuyingshouru', 0)),         # 主营收入
                'profit': float(row.get('jinglirun', 0)),              # 净利润
                'eps': float(row.get('meigujingzichan', 0)),           # 每股净资产
                'ipo_date': str(int(row.get('ipo_date', 0))),          # 上市日期
                'shareholders': int(row.get('gudongrenshu', 0)),       # 股东人数
                'undistributed': float(row.get('weifenpeilirun', 0)),  # 未分配利润
                'operating_profit': float(row.get('yingyelirun', 0)),  # 营业利润
                'cash_flow': float(row.get('jingyingxianjinliu', 0)), # 经营现金流
                'province': int(row.get('province', 0)),
                'industry': int(row.get('industry', 0)),
                'updated_date': str(int(row.get('updated_date', 0))),
                'source': 'mootdx',
            }
    except Exception as e:
        print(f"[DataService] mootdx F10 error for {code}: {e}")

    if result:
        cache_set(cache_key, result)
    return result


# ===================== 5. 公告层 (巨潮资讯 + mootdx) =====================

def fetch_announce_stock(code):
    """个股公告 - 巨潮资讯 cninfo.com.cn"""
    cache_key = f"announce_{code}"
    cached = cache_get(cache_key, 'announce')
    if cached:
        return cached

    results = []
    
    # Method 1: 巨潮资讯 API
    try:
        # Determine stock code with market prefix for cninfo
        if code.startswith('6'):
            org_id = ''  # cninfo uses secCode
            plate = 'sh'
        else:
            plate = 'sz'
        
        url = "http://www.cninfo.com.cn/new/hisAnnouncement/query"
        data = f"pageNum=1&pageSize=15&column=szse&tabName=fulltext&plate=&stock={code}&searchkey=&secid=&category=&trade=&seDate=&sortName=&sortType=&isHLtitle=true"
        
        req = urllib.request.Request(url, data=data.encode('utf-8'), headers={
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'http://www.cninfo.com.cn/new/disclosure',
            'Accept': 'application/json',
        })
        resp = urllib.request.urlopen(req, timeout=10)
        result_data = json.loads(resp.read().decode('utf-8'))
        
        if result_data and 'announcements' in result_data:
            for ann in result_data['announcements'][:15]:
                results.append({
                    'title': ann.get('announcementTitle', ''),
                    'time': datetime.fromtimestamp(ann.get('announcementTime', 0)/1000).strftime('%Y-%m-%d') if ann.get('announcementTime') else '',
                    'type': ann.get('announcementTypeName', ''),
                    'url': f"http://www.cninfo.com.cn/new/disclosure/detail?annoId={ann.get('announcementId', '')}" if ann.get('announcementId') else '',
                    'source': 'cninfo',
                })
    except Exception as e:
        print(f"[DataService] cninfo announce error for {code}: {e}")

    # Fallback: eastmoney announcements
    if not results:
        try:
            url = f"https://np-anotice-stock.eastmoney.com/api/security/ann?page_index=1&page_size=15&ann_type=A&client_source=web&stock_list={code}"
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0',
            })
            resp = urllib.request.urlopen(req, timeout=8)
            data = json.loads(resp.read().decode('utf-8'))
            if data and 'data' in data and 'list' in data['data']:
                for item in data['data']['list']:
                    results.append({
                        'title': item.get('title', ''),
                        'time': item.get('display_time', ''),
                        'type': ','.join(item.get('columns', [])) if item.get('columns') else '',
                        'url': f"https://data.eastmoney.com/notices/detail/{code}/{item.get('art_code', '')}.html" if item.get('art_code') else '',
                        'source': 'eastmoney',
                    })
        except Exception as e:
            print(f"[DataService] eastmoney announce fallback error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


# ===================== 保持原有AkShare接口兼容 =====================

def get_trade_date(date_str=None):
    if date_str and len(date_str) == 8:
        return date_str
    if date_str and len(date_str) == 10:
        return date_str.replace('-', '')
    now = datetime.now()
    for i in range(10):
        d = now - timedelta(days=i)
        if d.weekday() < 5:
            return d.strftime('%Y%m%d')
    return now.strftime('%Y%m%d')


def fetch_limit_up(date_str):
    """涨停板 - AkShare"""
    cache_key = f"limit_up_{date_str}"
    cached = cache_get(cache_key)
    if cached:
        return cached
    if not AKSHARE_AVAILABLE:
        return []
    try:
        df = ak.stock_zt_pool_em(date=date_str)
        if df is None or len(df) == 0:
            return []
        stocks = []
        for _, row in df.iterrows():
            stocks.append({
                "code": str(row.get('代码', '')),
                "name": str(row.get('名称', '')),
                "pct_chg": float(row.get('涨跌幅', 0)),
                "close": float(row.get('最新价', 0)),
                "amount": float(row.get('成交额', 0)),
                "turnover_ratio": float(row.get('换手率', 0)),
                "limit_times": int(row.get('连板数', 1)),
                "first_time": str(row.get('首次封板时间', '')),
                "last_time": str(row.get('最后封板时间', '')),
                "open_times": int(row.get('炸板次数', 0)),
                "industry": str(row.get('所属行业', '')),
                "tag": str(row.get('所属行业', '')),
                "status": f"{int(row.get('连板数', 1))}连板" if int(row.get('连板数', 1)) > 1 else "",
            })
        cache_set(cache_key, stocks)
        return stocks
    except Exception as e:
        print(f"[DataService] limit_up error: {e}")
        return []


def fetch_limit_down(date_str):
    cache_key = f"limit_down_{date_str}"
    cached = cache_get(cache_key)
    if cached:
        return cached
    if not AKSHARE_AVAILABLE:
        return []
    try:
        df = ak.stock_zt_pool_dtgc_em(date=date_str)
        if df is None or len(df) == 0:
            return []
        stocks = []
        for _, row in df.iterrows():
            stocks.append({
                "code": str(row.get('代码', '')),
                "name": str(row.get('名称', '')),
                "pct_chg": float(row.get('涨跌幅', 0)),
                "close": float(row.get('最新价', 0)),
                "amount": float(row.get('成交额', 0)),
                "industry": str(row.get('所属行业', '')),
            })
        cache_set(cache_key, stocks)
        return stocks
    except Exception as e:
        print(f"[DataService] limit_down error: {e}")
        return []


def fetch_broken_board(date_str):
    cache_key = f"broken_{date_str}"
    cached = cache_get(cache_key)
    if cached:
        return cached
    if not AKSHARE_AVAILABLE:
        return []
    try:
        df = ak.stock_zt_pool_zbgc_em(date=date_str)
        if df is None or len(df) == 0:
            return []
        stocks = []
        for _, row in df.iterrows():
            stocks.append({
                "code": str(row.get('代码', '')),
                "name": str(row.get('名称', '')),
                "pct_chg": float(row.get('涨跌幅', 0)),
                "close": float(row.get('最新价', 0)),
                "amount": float(row.get('成交额', 0)),
                "open_times": int(row.get('炸板次数', 1)),
                "industry": str(row.get('所属行业', '')),
                "tag": "炸板",
            })
        cache_set(cache_key, stocks)
        return stocks
    except Exception as e:
        print(f"[DataService] broken_board error: {e}")
        return []


def fetch_board_ladder(date_str):
    cache_key = f"ladder_{date_str}"
    cached = cache_get(cache_key)
    if cached:
        return cached
    if not AKSHARE_AVAILABLE:
        return {"ladder": [], "highest_board": 0}
    try:
        df = ak.stock_zt_pool_em(date=date_str)
        if df is None or len(df) == 0:
            return {"ladder": [], "highest_board": 0}
        max_board = int(df['连板数'].max()) if '连板数' in df.columns else 0
        ladder = []
        multi = df[df['连板数'] >= 2] if '连板数' in df.columns else pd.DataFrame()
        if len(multi) > 0:
            for level in sorted(multi['连板数'].unique(), reverse=True):
                level_stocks = multi[multi['连板数'] == level]
                stocks = []
                for _, row in level_stocks.iterrows():
                    stocks.append({
                        "code": str(row.get('代码', '')),
                        "name": str(row.get('名称', '')),
                        "close": float(row.get('最新价', 0) or 0),
                        "pct_chg": float(row.get('涨跌幅', 0) or 0),
                        "amount": float(row.get('成交额', 0) or 0),
                        "tag": str(row.get('所属行业', '')),
                        "status": f"{int(level)}连板",
                    })
                ladder.append({"level": int(level), "count": len(stocks), "stocks": stocks})
        result = {"ladder": ladder, "highest_board": max_board}
        cache_set(cache_key, result)
        return result
    except Exception as e:
        print(f"[DataService] board_ladder error: {e}")
        return {"ladder": [], "highest_board": 0}


def fetch_concept_heat():
    cache_key = "concept_heat"
    cached = cache_get(cache_key)
    if cached:
        return cached
    if not AKSHARE_AVAILABLE:
        return []
    try:
        df = ak.stock_board_concept_name_em()
        if df is None or len(df) == 0:
            return []
        concepts = []
        for _, row in df.head(80).iterrows():
            concepts.append({
                "name": str(row.get('板块名称', '')),
                "change_pct": float(row.get('涨跌幅', 0)),
                "lead_stock": str(row.get('领涨股票', '')),
                "amount": float(row.get('总成交额', 0)),
            })
        concepts.sort(key=lambda x: abs(x['change_pct']), reverse=True)
        cache_set(cache_key, concepts)
        return concepts
    except Exception as e:
        print(f"[DataService] concept_heat error: {e}")
        return []


def fetch_industry_heat():
    cache_key = "industry_heat"
    cached = cache_get(cache_key)
    if cached:
        return cached
    if not AKSHARE_AVAILABLE:
        return []
    try:
        df = ak.stock_board_industry_name_em()
        if df is None or len(df) == 0:
            return []
        sectors = []
        for _, row in df.head(80).iterrows():
            sectors.append({
                "name": str(row.get('板块名称', '')),
                "change_pct": float(row.get('涨跌幅', 0)),
                "lead_stock": str(row.get('领涨股票', '')),
                "amount": float(row.get('总成交额', 0)),
            })
        sectors.sort(key=lambda x: abs(x['change_pct']), reverse=True)
        cache_set(cache_key, sectors)
        return sectors
    except Exception as e:
        print(f"[DataService] industry_heat error: {e}")
        return []


def fetch_market_overview(date_str):
    cache_key = f"overview_{date_str}"
    cached = cache_get(cache_key)
    if cached:
        return cached
    if not AKSHARE_AVAILABLE:
        return {"up_count": 0, "down_count": 0, "flat_count": 0, "total": 0}
    try:
        df = ak.stock_zh_a_spot_em()
        if df is None or len(df) == 0:
            return {"up_count": 0, "down_count": 0, "flat_count": 0, "total": 0}
        pct_col = '涨跌幅' if '涨跌幅' in df.columns else None
        if not pct_col:
            return {"up_count": 0, "down_count": 0, "flat_count": 0, "total": 0}
        df[pct_col] = pd.to_numeric(df[pct_col], errors='coerce')
        df = df.dropna(subset=[pct_col])
        result = {
            "up_count": int((df[pct_col] > 0).sum()),
            "down_count": int((df[pct_col] < 0).sum()),
            "flat_count": int((df[pct_col] == 0).sum()),
            "total": len(df),
            "trade_date": date_str,
        }
        cache_set(cache_key, result)
        return result
    except Exception as e:
        print(f"[DataService] market_overview error: {e}")
        return {"up_count": 0, "down_count": 0, "flat_count": 0, "total": 0}


def fetch_all_stocks():
    """全市场行情 - akshare"""
    cache_key = "all_stocks"
    cached = cache_get(cache_key)
    if cached:
        return cached
    if not AKSHARE_AVAILABLE:
        return []
    try:
        df = ak.stock_zh_a_spot_em()
        if df is None or len(df) == 0:
            return []
        col_map = {'代码': 'code', '名称': 'name', '最新价': 'close', '涨跌幅': 'pct_chg',
                   '成交量': 'volume', '成交额': 'amount', '换手率': 'turnover_rate',
                   '量比': 'volume_ratio', '总市值': 'total_mv', '流通市值': 'circ_mv'}
        result = []
        for _, row in df.iterrows():
            stock = {}
            for cn, en in col_map.items():
                if cn in df.columns:
                    val = row[cn]
                    stock[en] = '' if pd.isna(val) and en in ('code', 'name') else (0 if pd.isna(val) else val)
                else:
                    stock[en] = '' if en in ('code', 'name') else 0
            for k in ['close', 'pct_chg', 'volume', 'amount', 'turnover_rate', 'volume_ratio', 'total_mv', 'circ_mv']:
                try:
                    stock[k] = float(stock.get(k, 0) or 0)
                except:
                    stock[k] = 0.0
            if stock.get('total_mv', 0) > 100000:
                stock['total_mv'] = stock['total_mv'] / 1e8
            if stock.get('circ_mv', 0) > 100000:
                stock['circ_mv'] = stock['circ_mv'] / 1e8
            if stock.get('code') and stock.get('close', 0) > 0:
                result.append(stock)
        if result:
            cache_set(cache_key, result)
        return result
    except Exception as e:
        print(f"[DataService] all_stocks error: {e}")
        return []


# ===================== HTTP Server =====================

class DataServiceHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        sys.stdout.write(f"[DataService] {format%args}\n")
        sys.stdout.flush()

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode('utf-8'))

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        date_str = get_trade_date(params.get('trade_date', [None])[0] or params.get('date', [None])[0])

        try:
            # ===== Health =====
            if path == '/health':
                self.send_json({"status": "ok", "mootdx": MOOTDX_AVAILABLE, "akshare": AKSHARE_AVAILABLE, "version": "3.0"})

            # ===== 行情层 =====
            elif path == '/quote':
                codes = params.get('codes', [''])[0].split(',')
                codes = [c.strip() for c in codes if c.strip()]
                if not codes:
                    self.send_json({"code": -1, "error": "missing codes"}, 400)
                    return
                data = fetch_quote_tencent(codes)
                self.send_json({"code": 0, "data": data})

            elif path == '/kline':
                code = params.get('code', [''])[0]
                freq_map = {'5min': 0, '15min': 1, '30min': 2, '60min': 3, 'daily': 9, 'weekly': 5, 'monthly': 6}
                freq = freq_map.get(params.get('freq', ['daily'])[0], 9)
                count = int(params.get('count', ['60'])[0])
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_kline_mootdx(code, freq, count)
                self.send_json({"code": 0, "data": data, "count": len(data)})

            elif path == '/minute':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_minute_mootdx(code)
                self.send_json({"code": 0, "data": data})

            # ===== 研报层 =====
            elif path == '/research':
                code = params.get('code', [''])[0]
                if code:
                    data = fetch_research_stock(code)
                else:
                    data = fetch_research_market()
                self.send_json({"code": 0, "data": data, "count": len(data)})

            elif path == '/research/market':
                data = fetch_research_market()
                self.send_json({"code": 0, "data": data, "count": len(data)})

            # ===== 新闻层 =====
            elif path == '/news':
                code = params.get('code', [''])[0]
                if code:
                    data = fetch_news_stock(code)
                else:
                    data = fetch_news_market()
                self.send_json({"code": 0, "data": data, "count": len(data)})

            elif path == '/news/market':
                data = fetch_news_market()
                self.send_json({"code": 0, "data": data, "count": len(data)})

            elif path == '/guba':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_guba(code)
                self.send_json({"code": 0, "data": data, "count": len(data)})

            # ===== 基础数据层 =====
            elif path == '/f10' or path == '/finance':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_f10(code)
                self.send_json({"code": 0, "data": data})

            # ===== 公告层 =====
            elif path == '/announce':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_announce_stock(code)
                self.send_json({"code": 0, "data": data, "count": len(data)})

            # ===== 原有兼容接口 =====
            elif path == '/limit_up':
                data = fetch_limit_up(date_str)
                self.send_json({"code": 0, "data": {"stocks": data, "count": len(data), "trade_date": date_str}})

            elif path == '/limit_down':
                data = fetch_limit_down(date_str)
                self.send_json({"code": 0, "data": {"stocks": data, "count": len(data), "trade_date": date_str}})

            elif path == '/broken_board':
                data = fetch_broken_board(date_str)
                self.send_json({"code": 0, "data": {"stocks": data, "count": len(data), "trade_date": date_str}})

            elif path == '/board_ladder':
                data = fetch_board_ladder(date_str)
                self.send_json({"code": 0, "data": {**data, "trade_date": date_str}})

            elif path == '/market_stats':
                up = fetch_limit_up(date_str)
                down = fetch_limit_down(date_str)
                broken = fetch_broken_board(date_str)
                highest = max([s.get('limit_times', 0) for s in up], default=0)
                broken_rate = len(broken) / (len(up) + len(broken)) * 100 if (len(up) + len(broken)) > 0 else 0
                self.send_json({"code": 0, "data": {
                    "trade_date": date_str, "limit_up_count": len(up), "limit_down_count": len(down),
                    "broken_count": len(broken), "highest_board": highest, "broken_rate": round(broken_rate, 1),
                }})

            elif path == '/concept_heat':
                data = fetch_concept_heat()
                self.send_json({"code": 0, "data": {"concepts": data, "count": len(data)}})

            elif path == '/industry_heat':
                data = fetch_industry_heat()
                self.send_json({"code": 0, "data": {"sectors": data, "count": len(data)}})

            elif path == '/market_overview':
                data = fetch_market_overview(date_str)
                self.send_json({"code": 0, "data": data})

            elif path == '/all_stocks':
                data = fetch_all_stocks()
                self.send_json({"code": 0, "data": {"all_stocks": data, "count": len(data)}})

            elif path == '/stock_quote':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_quote_tencent([code])
                if data:
                    self.send_json({"code": 0, "data": data[0]})
                else:
                    self.send_json({"code": -1, "error": "not found"}, 404)

            else:
                self.send_json({"error": "Not found", "version": "3.0", "endpoints": [
                    "/health", "/quote", "/kline", "/minute",
                    "/research", "/research/market", "/news", "/news/market", "/guba",
                    "/f10", "/finance", "/announce",
                    "/limit_up", "/limit_down", "/broken_board", "/board_ladder",
                    "/market_stats", "/concept_heat", "/industry_heat", "/market_overview",
                    "/all_stocks", "/stock_quote"
                ]}, 404)

        except Exception as e:
            print(f"[DataService] Handler error: {e}")
            traceback.print_exc()
            self.send_json({"code": -1, "error": str(e)}, 500)


def main():
    port = int(os.environ.get('AKSHARE_PORT', os.environ.get('DATA_SERVICE_PORT', '9090')))
    server = HTTPServer(('0.0.0.0', port), DataServiceHandler)
    print(f"[DataService v3.0] Starting on port {port}")
    print(f"  mootdx: {'available' if MOOTDX_AVAILABLE else 'NOT available'}")
    print(f"  akshare: {'available' if AKSHARE_AVAILABLE else 'NOT available'}")
    print(f"  Layers: 行情(mootdx+腾讯) | 研报(东财) | 新闻(akshare) | F10(mootdx) | 公告(巨潮)")
    sys.stdout.flush()
    server.serve_forever()


if __name__ == '__main__':
    main()
