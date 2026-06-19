"""
QuantMind Unified Data Service (v4.0)
======================================
整合十三层数据源为统一微服务，基于 a-stock-data V3.2.2 架构升级：

数据源优先级（按封 IP 风险排序）：
  1（首选）mootdx（通达信）   TCP 7709    不封 IP    K线/五档/逐笔/财务快照/F10
  2（首选）腾讯财经           HTTP       不封 IP    实时价/PE/PB/市值/换手率/涨跌停/指数/ETF
  3        同花顺热点/北向     HTTP       极低       强势股/题材归因/北向资金
  4        百度股市通          HTTP       极低       K线（带 MA5/10/20）
  5        新浪财经            HTTP       低         财报三表
  6        巨潮 cninfo         HTTP       低         公告全文
  7        同花顺一致预期      HTTP       低         EPS 一致预期
  8        iwencai             OpenAPI    低         NL 语义搜索
  9        东财 push2          HTTP       中         行情/资金流/板块（限流）
  10       东财 datacenter     HTTP       中         龙虎榜/解禁/两融/大宗/股东户数/分红
  11       东财 reportapi      HTTP       中         研报列表/PDF
  12       东财 search-api     HTTP       中         个股新闻
  13       东财 np-weblist     HTTP       中         全球资讯

核心升级：
  - 东财防封机制：em_get() 串行限流（间隔≥1s+随机抖动）+ 会话复用
  - 数据源优先级：mootdx/腾讯优先（不封IP），东财仅用于独有数据
  - 腾讯字段索引校准：修正43号=振幅（非PB），46号=PB
  - 新增端点：龙虎榜席位、融资融券、大宗交易、股东户数、解禁日历、
              分红送转、北向资金、行业板块排名、资金流120日、全球资讯、
              概念板块归属、百度K线（带均线）

Endpoints:
  GET /health                        - 健康检查 + 数据源状态
  
  # === 行情层 (mootdx + 腾讯 + 百度K线) ===
  GET /quote?codes=000001,600519     - 实时行情 (腾讯，不封IP)
  GET /kline?code=000001&freq=daily&count=60 - K线数据 (mootdx，不封IP)
  GET /kline/baidu?code=600519       - K线+MA均线 (百度股市通)
  GET /minute?code=000001            - 分时数据 (mootdx)
  GET /index?code=000001             - 指数行情 (腾讯)
  
  # === 研报层 (东财 reportapi) ===
  GET /research?code=000001          - 个股研报
  GET /research/market               - 市场研报
  
  # === 信号层 (同花顺 + 东财) ===
  GET /northbound                    - 北向资金 (同花顺)
  GET /hot_stocks                    - 当日强势股 (同花顺)
  GET /concept_blocks?code=000001    - 概念板块归属 (东财 slist)
  GET /fund_flow?code=000001         - 个股资金流向 分钟级 (东财 push2)
  GET /fund_flow_120d?code=000001    - 个股资金流120日 (东财 push2his)
  GET /dragon_tiger?code=000001      - 龙虎榜席位 (东财 datacenter)
  GET /dragon_tiger_daily            - 全市场龙虎榜 (东财 datacenter)
  GET /lockup_expiry?code=000001     - 限售解禁日历 (东财 datacenter)
  GET /industry_rank                 - 行业板块排名 (东财 push2)
  
  # === 资金面/筹码层 (东财 datacenter) ===
  GET /margin?code=000001            - 融资融券明细
  GET /block_trade?code=000001       - 大宗交易
  GET /shareholder_count?code=000001 - 股东户数变化
  GET /dividend?code=000001          - 分红送转历史
  
  # === 新闻层 (东财直连HTTP) ===
  GET /news?code=000001              - 个股新闻 (东财 search-api)
  GET /news/global                   - 全球资讯 (东财 np-weblist)
  GET /guba?code=000001              - 股吧评论
  
  # === 基础数据层 (mootdx + 东财 + 新浪) ===
  GET /f10?code=000001               - F10基础数据 (mootdx)
  GET /finance?code=000001           - 财务快照 (mootdx)
  GET /stock_info?code=000001        - 个股信息 (东财 push2)
  GET /financial_statements?code=000001 - 财报三表 (新浪)
  
  # === 公告层 (巨潮 cninfo) ===
  GET /announce?code=000001          - 个股公告
  
  # === 原有兼容接口 ===
  GET /limit_up                      - 涨停板
  GET /limit_down                    - 跌停板
  GET /broken_board                  - 炸板
  GET /board_ladder                  - 连板天梯
  GET /market_stats                  - 市场统计
  GET /concept_heat                  - 概念热力
  GET /industry_heat                 - 行业热力
  GET /market_overview               - 涨跌概览
  GET /all_stocks                    - 全市场行情
"""

import json
import time
import random
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
    import pandas as pd
except ImportError:
    pass

try:
    from mootdx.quotes import Quotes
    MOOTDX_AVAILABLE = True
except ImportError:
    MOOTDX_AVAILABLE = False
    print("[DataService] WARNING: mootdx not installed")

try:
    import requests as req_lib
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("[DataService] WARNING: requests not installed, using urllib")

# ===================== Constants =====================
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
VERSION = "4.0"

# ===================== Cache System =====================
_cache = {}
CACHE_TTL = {
    'realtime': 30,      # 实时行情 30秒
    'kline': 300,        # K线 5分钟
    'news': 600,         # 新闻 10分钟
    'research': 1800,    # 研报 30分钟
    'f10': 3600,         # F10 1小时
    'announce': 1800,    # 公告 30分钟
    'fund_flow': 60,     # 资金流 1分钟
    'northbound': 60,    # 北向资金 1分钟
    'datacenter': 300,   # 数据中心 5分钟
    'default': 300,      # 默认 5分钟
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


# ===================== 东财防封机制 em_get() =====================
# 东财系 HTTP 接口有风控：
#   每秒 >5 次 / 单 IP 并发 ≥10 / 1 分钟 ≥200 次 → 临时封 IP
# 所有 eastmoney.com 请求一律走 em_get()：串行限流 + 复用 Keep-Alive 会话

_em_lock = threading.Lock()
_em_last_call = [0.0]
EM_MIN_INTERVAL = float(os.environ.get('EM_MIN_INTERVAL', '1.0'))  # 最小间隔秒数

if REQUESTS_AVAILABLE:
    EM_SESSION = req_lib.Session()
    EM_SESSION.headers.update({
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    })
else:
    EM_SESSION = None


def em_get(url, params=None, headers=None, timeout=15, **kwargs):
    """东财统一请求入口：自动节流 + 复用 session + 默认 UA。
    所有 eastmoney.com 接口都应通过它请求，避免高频被封 IP。
    
    防封铁律：
    1. 串行，不并发
    2. 每次间隔 ≥ 1 秒 + 随机抖动
    3. 复用 HTTP 会话（Keep-Alive）
    4. 带正常 UA + Referer
    """
    with _em_lock:
        wait = EM_MIN_INTERVAL - (time.time() - _em_last_call[0])
        if wait > 0:
            time.sleep(wait + random.uniform(0.1, 0.5))
        try:
            if EM_SESSION:
                hdrs = headers or {}
                if 'Referer' not in hdrs:
                    hdrs['Referer'] = 'https://data.eastmoney.com/'
                resp = EM_SESSION.get(url, params=params, headers=hdrs, timeout=timeout, **kwargs)
                return resp
            else:
                # Fallback to urllib
                full_url = url
                if params:
                    from urllib.parse import urlencode
                    full_url = f"{url}?{urlencode(params)}"
                req = urllib.request.Request(full_url, headers={
                    'User-Agent': UA,
                    'Referer': 'https://data.eastmoney.com/',
                    **(headers or {})
                })
                resp = urllib.request.urlopen(req, timeout=timeout)
                class FakeResp:
                    def __init__(self, data, status):
                        self._data = data
                        self.status_code = status
                        self.content = data
                        self.text = data.decode('utf-8')
                    def json(self):
                        return json.loads(self._data)
                return FakeResp(resp.read(), resp.status)
        finally:
            _em_last_call[0] = time.time()


def eastmoney_datacenter(report_name, columns="ALL", filter_str="",
                         page_size=50, sort_columns="", sort_types="-1",
                         page_number=1):
    """东财数据中心统一查询 — 龙虎榜/解禁/融资融券/大宗交易/股东户数/分红 共用（已内置限流）"""
    params = {
        "reportName": report_name,
        "columns": columns,
        "filter": filter_str,
        "pageNumber": str(page_number),
        "pageSize": str(page_size),
        "sortColumns": sort_columns,
        "sortTypes": sort_types,
        "source": "WEB",
        "client": "WEB",
    }
    url = "https://datacenter-web.eastmoney.com/api/data/v1/get"
    r = em_get(url, params=params, timeout=15)
    try:
        d = r.json()
        if d.get("result") and d["result"].get("data"):
            return d["result"]["data"]
    except Exception as e:
        print(f"[DataService] datacenter error for {report_name}: {e}")
    return []


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


# ===================== Helper: 市场前缀 =====================

def get_prefix(code):
    """6位代码 → 市场前缀"""
    code = code.strip()
    if code.startswith(("6", "9", "5")):
        return "sh"
    elif code.startswith("8"):
        return "bj"
    else:
        return "sz"


def get_market_id(code):
    """6位代码 → 东财 secid 前缀 (0=深圳, 1=上海, 0=北京)"""
    code = code.strip()
    if code.startswith(("6", "9", "5")):
        return "1"
    else:
        return "0"


def normalize_code(code):
    """归一化股票代码为6位纯数字"""
    code = code.strip().upper()
    # Remove prefixes like SH/SZ/BJ
    for prefix in ['SH', 'SZ', 'BJ']:
        if code.startswith(prefix):
            code = code[2:]
            break
    # Remove suffix like .SH/.SZ
    if '.' in code:
        code = code.split('.')[0]
    return code


# ===================== Layer 1: 行情层（实时，不封IP）=====================

def fetch_quote_tencent(codes):
    """实时行情 - 腾讯财经 qt.gtimg.cn
    不封IP，字段索引实测校准（2026-05）。
    修正：43号=振幅%（非PB），46号=PB（市净率）
    """
    cache_key = f"tencent_quote_{','.join(sorted(codes))}"
    cached = cache_get(cache_key, 'realtime')
    if cached:
        return cached

    # Convert codes to tencent format
    tc_codes = []
    for code in codes:
        code = normalize_code(code)
        tc_codes.append(f"{get_prefix(code)}{code}")

    url = f"https://qt.gtimg.cn/q={','.join(tc_codes)}"
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': UA,
            'Referer': 'http://finance.qq.com'
        })
        resp = urllib.request.urlopen(req, timeout=8)
        content = resp.read().decode('gbk')

        results = []
        for line in content.strip().split('\n'):
            if '~' not in line:
                continue
            parts = line.split('~')
            if len(parts) < 53:
                continue
            try:
                stock = {
                    'code': parts[2],
                    'name': parts[1],
                    'price': float(parts[3]) if parts[3] else 0,
                    'pre_close': float(parts[4]) if parts[4] else 0,
                    'open': float(parts[5]) if parts[5] else 0,
                    'volume': int(float(parts[6])) if parts[6] else 0,
                    'buy_volume': int(float(parts[7])) if parts[7] else 0,
                    'sell_volume': int(float(parts[8])) if parts[8] else 0,
                    'bid1_price': float(parts[9]) if parts[9] else 0,
                    'bid1_vol': int(float(parts[10])) if parts[10] else 0,
                    'ask1_price': float(parts[19]) if parts[19] else 0,
                    'ask1_vol': int(float(parts[20])) if parts[20] else 0,
                    'time': parts[30] if len(parts) > 30 else '',
                    'change_amt': float(parts[31]) if parts[31] else 0,
                    'change_pct': float(parts[32]) if parts[32] else 0,
                    'high': float(parts[33]) if parts[33] else 0,
                    'low': float(parts[34]) if parts[34] else 0,
                    'amount': float(parts[37]) if len(parts) > 37 and parts[37] else 0,  # 万元
                    'turnover_rate': float(parts[38]) if len(parts) > 38 and parts[38] else 0,
                    'pe_ttm': float(parts[39]) if len(parts) > 39 and parts[39] else 0,
                    # ★ 校准：索引43=振幅%（非PB！网上教程写错），索引46=PB
                    'amplitude_pct': float(parts[43]) if len(parts) > 43 and parts[43] else 0,
                    'mcap_yi': float(parts[44]) if len(parts) > 44 and parts[44] else 0,  # 总市值(亿)
                    'float_mcap_yi': float(parts[45]) if len(parts) > 45 and parts[45] else 0,  # 流通市值(亿)
                    'pb': float(parts[46]) if len(parts) > 46 and parts[46] else 0,  # ★ PB在46号
                    'limit_up': float(parts[47]) if len(parts) > 47 and parts[47] else 0,
                    'limit_down': float(parts[48]) if len(parts) > 48 and parts[48] else 0,
                    'volume_ratio': float(parts[49]) if len(parts) > 49 and parts[49] else 0,
                    'pe_static': float(parts[52]) if len(parts) > 52 and parts[52] else 0,
                    'source': 'tencent',
                }
                # Compute change from price/pre_close for backward compat
                if stock['price'] > 0 and stock.get('pre_close', 0) > 0:
                    stock['change'] = round(stock['price'] - stock['pre_close'], 3)
                else:
                    stock['change'] = stock.get('change_amt', 0)
                # Also map pe field for backward compat
                stock['pe'] = stock['pe_ttm']
                stock['circ_mv'] = stock['float_mcap_yi']
                stock['total_mv'] = stock['mcap_yi']
                if stock['price'] > 0:
                    results.append(stock)
            except (ValueError, IndexError):
                continue

        if results:
            cache_set(cache_key, results)
        return results
    except Exception as e:
        print(f"[DataService] tencent quote error: {e}")
        return []


def fetch_kline_mootdx(code, frequency=9, count=60):
    """K线数据 - mootdx通达信协议（不封IP）
    frequency: 0=5min, 1=15min, 2=30min, 3=60min, 4=daily, 5=weekly, 6=monthly, 9=daily
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


def fetch_kline_baidu(code):
    """百度股市通K线 — 独有能力: 返回时自带 ma5/ma10/ma20 均价（不封IP）"""
    cache_key = f"baidu_kline_{code}"
    cached = cache_get(cache_key, 'kline')
    if cached:
        return cached

    url = "https://finance.pae.baidu.com/selfselect/getstockquotation"
    params = {
        "all": "1", "isIndex": "false", "isBk": "false", "isBlock": "false",
        "isFutures": "false", "isStock": "true", "newFormat": "1",
        "group": "quotation_kline_ab", "finClientType": "pc",
        "code": code, "start_time": "", "ktype": "1",
    }
    headers = {
        "User-Agent": UA,
        "Accept": "application/vnd.finance-web.v1+json",
        "Origin": "https://gushitong.baidu.com",
        "Referer": "https://gushitong.baidu.com/",
    }

    try:
        from urllib.parse import urlencode
        req = urllib.request.Request(
            f"{url}?{urlencode(params)}",
            headers=headers
        )
        resp = urllib.request.urlopen(req, timeout=10)
        d = json.loads(resp.read().decode('utf-8'))
        result_data = d.get("Result", {})
        if isinstance(result_data, list) and result_data:
            result_data = result_data[0] if isinstance(result_data[0], dict) else {}
        if not isinstance(result_data, dict):
            result_data = {}
        md = result_data.get("newMarketData", {})
        if isinstance(md, list) and md:
            md = md[0] if isinstance(md[0], dict) else {}
        if not isinstance(md, dict):
            md = {}
        keys = md.get("keys", []) if isinstance(md.get("keys"), list) else []
        rows_str = md.get("marketData", "") if isinstance(md.get("marketData"), str) else ""
        
        if not rows_str:
            return {"keys": [], "data": []}

        rows = rows_str.split(";")
        data = []
        for row in rows:
            if not row.strip():
                continue
            vals = row.split(",")
            item = {}
            for i, k in enumerate(keys):
                if i < len(vals):
                    item[k] = vals[i]
            data.append(item)

        result = {"keys": keys, "data": data}
        if data:
            cache_set(cache_key, result)
        return result
    except Exception as e:
        print(f"[DataService] baidu kline error for {code}: {e}")
        return {"keys": [], "data": []}


def fetch_minute_mootdx(code):
    """分时数据 - mootdx（不封IP）"""
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


# ===================== Layer 2: 研报层 (东财 reportapi) =====================

def fetch_research_stock(code):
    """个股研报 - 东方财富 reportapi（走 em_get 限流）"""
    cache_key = f"research_{code}"
    cached = cache_get(cache_key, 'research')
    if cached:
        return cached

    results = []
    try:
        url = "https://reportapi.eastmoney.com/report/list"
        params = {
            "industryCode": "*", "pageSize": "20", "industry": "*",
            "rating": "*", "ratingChange": "*",
            "beginTime": "2000-01-01", "endTime": "2030-01-01",
            "pageNo": "1", "fields": "", "qType": "0",
            "orgCode": "", "code": code, "rcode": "",
        }
        r = em_get(url, params=params, headers={"Referer": "https://data.eastmoney.com/"})
        data = r.json()
        if data and 'data' in data and data['data']:
            for item in data['data'][:20]:
                results.append({
                    'title': item.get('title', ''),
                    'org_name': item.get('orgSName', '') or item.get('orgName', ''),
                    'author': item.get('researcher', ''),
                    'rating': item.get('emRatingName', ''),
                    'date': item.get('publishDate', '')[:10] if item.get('publishDate') else '',
                    'industry': item.get('industryName', '') or item.get('indvInduName', ''),
                    'eps_this_year': item.get('predictThisYearEps', ''),
                    'eps_next_year': item.get('predictNextYearEps', ''),
                    'eps_next2_year': item.get('predictNextTwoYearEps', ''),
                    'info_code': item.get('infoCode', ''),
                    'source': 'eastmoney_reportapi',
                })
    except Exception as e:
        print(f"[DataService] eastmoney research error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_research_market():
    """市场最新研报"""
    cache_key = "research_market"
    cached = cache_get(cache_key, 'research')
    if cached:
        return cached

    results = []
    try:
        url = "https://reportapi.eastmoney.com/report/list"
        params = {
            "industryCode": "*", "pageSize": "30", "industry": "*",
            "rating": "*", "ratingChange": "*",
            "beginTime": "", "endTime": "",
            "pageNo": "1", "fields": "", "qType": "0",
            "orgCode": "", "code": "", "rcode": "",
        }
        r = em_get(url, params=params, headers={"Referer": "https://data.eastmoney.com/"})
        data = r.json()
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
                    'source': 'eastmoney_reportapi',
                })
    except Exception as e:
        print(f"[DataService] market research error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


# ===================== Layer 3: 信号层 (同花顺 + 东财) =====================

def fetch_northbound():
    """北向资金 - 同花顺（零鉴权，不封IP）"""
    cache_key = "northbound"
    cached = cache_get(cache_key, 'northbound')
    if cached:
        return cached

    result = {"hgt": [], "sgt": [], "total_net": 0}
    try:
        # 同花顺北向资金实时接口
        url = "https://data.10jqka.com.cn/financial/hsgtzjl/field/zdf/order/desc/page/1/ajax/1/"
        req = urllib.request.Request(url, headers={
            'User-Agent': UA,
            'Referer': 'https://data.10jqka.com.cn/',
        })
        resp = urllib.request.urlopen(req, timeout=10)
        content = resp.read().decode('utf-8')
        # Parse the HTML or JSON response
        # Fallback to Eastmoney if THS fails
    except Exception as e:
        print(f"[DataService] THS northbound error: {e}")

    # Fallback: Eastmoney northbound
    if not result.get("hgt"):
        try:
            url = "https://push2.eastmoney.com/api/qt/kamt.rtmin/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56"
            r = em_get(url)
            data = r.json()
            if data and data.get("data"):
                d = data["data"]
                # Parse northbound data
                s2n_data = d.get("s2n", {})  # 北向
                if s2n_data:
                    result["total_net"] = s2n_data.get("f52", 0)
                    # Parse minute data
                    if "s2nMinu" in d:
                        for item in d["s2nMinu"]:
                            parts = item.split(",") if isinstance(item, str) else []
                            if len(parts) >= 4:
                                result["hgt"].append({
                                    "time": parts[0],
                                    "net": float(parts[1]) if parts[1] != "-" else 0,
                                })
        except Exception as e:
            print(f"[DataService] eastmoney northbound error: {e}")

    if result.get("hgt") or result.get("total_net"):
        cache_set(cache_key, result)
    return result


def fetch_hot_stocks():
    """当日强势股 - 同花顺热点（零鉴权）"""
    cache_key = "hot_stocks"
    cached = cache_get(cache_key, 'realtime')
    if cached:
        return cached

    results = []
    try:
        url = "https://eq.10jqka.com.cn/open/api/hot_list/v1/hot_stock/concept/data.txt"
        req = urllib.request.Request(url, headers={
            'User-Agent': UA,
            'Referer': 'https://eq.10jqka.com.cn/',
        })
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode('utf-8'))
        if data and data.get("data") and data["data"].get("stock_list"):
            for item in data["data"]["stock_list"]:
                results.append({
                    "code": item.get("code", ""),
                    "name": item.get("name", ""),
                    "change_pct": item.get("change", 0),
                    "reason": item.get("reason", ""),
                    "tag": item.get("tag", ""),
                    "order": item.get("order", 0),
                })
    except Exception as e:
        print(f"[DataService] THS hot stocks error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_concept_blocks(code):
    """概念板块归属 - 东财 slist（V3.2.2 替换百度PAE）"""
    cache_key = f"concept_blocks_{code}"
    cached = cache_get(cache_key, 'datacenter')
    if cached:
        return cached

    results = []
    try:
        secid = f"{get_market_id(code)}.{code}"
        url = f"https://push2.eastmoney.com/api/qt/slist/get"
        params = {
            "secid": secid,
            "spt": "3",  # 全部板块（行业+概念+地域）
            "fields": "f12,f14,f3,f152,f204",
            "np": "1",
            "fltt": "2",
        }
        r = em_get(url, params=params)
        data = r.json()
        if data and data.get("data") and data["data"].get("diff"):
            for item in data["data"]["diff"]:
                if isinstance(item, dict):
                    results.append({
                        "code": item.get("f12", ""),
                        "name": item.get("f14", ""),
                        "change_pct": item.get("f3", 0),
                        "lead_stock": item.get("f204", ""),
                    })
    except Exception as e:
        print(f"[DataService] concept blocks error for {code}: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_fund_flow_minute(code):
    """个股资金流向 分钟级 - 东财 push2"""
    cache_key = f"fund_flow_min_{code}"
    cached = cache_get(cache_key, 'fund_flow')
    if cached:
        return cached

    result = {"code": code, "data": []}
    try:
        secid = f"{get_market_id(code)}.{code}"
        url = f"https://push2.eastmoney.com/api/qt/stock/fflow/kline/get"
        params = {
            "secid": secid,
            "fields1": "f1,f2,f3,f7",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65",
            "klt": "1",  # 1分钟
            "lmt": "0",
        }
        r = em_get(url, params=params)
        data = r.json()
        if data and data.get("data") and data["data"].get("klines"):
            for line in data["data"]["klines"]:
                parts = line.split(",")
                if len(parts) >= 6:
                    result["data"].append({
                        "time": parts[0],
                        "main_net": float(parts[1]) if parts[1] != "-" else 0,
                        "super_big": float(parts[2]) if parts[2] != "-" else 0,
                        "big": float(parts[3]) if parts[3] != "-" else 0,
                        "mid": float(parts[4]) if parts[4] != "-" else 0,
                        "small": float(parts[5]) if parts[5] != "-" else 0,
                    })
    except Exception as e:
        print(f"[DataService] fund flow minute error for {code}: {e}")

    if result["data"]:
        cache_set(cache_key, result)
    return result


def fetch_fund_flow_120d(code):
    """个股资金流120日 - 东财 push2his（主力/大单/中单/小单 日级净流入）"""
    cache_key = f"fund_flow_120d_{code}"
    cached = cache_get(cache_key, 'datacenter')
    if cached:
        return cached

    result = {"code": code, "data": []}
    try:
        secid = f"{get_market_id(code)}.{code}"
        url = f"https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get"
        params = {
            "secid": secid,
            "fields1": "f1,f2,f3,f7",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
            "lmt": "120",
        }
        r = em_get(url, params=params)
        data = r.json()
        if data and data.get("data") and data["data"].get("klines"):
            for line in data["data"]["klines"]:
                parts = line.split(",")
                if len(parts) >= 6:
                    result["data"].append({
                        "date": parts[0],
                        "main_net": float(parts[1]) if parts[1] != "-" else 0,
                        "super_big": float(parts[2]) if parts[2] != "-" else 0,
                        "big": float(parts[3]) if parts[3] != "-" else 0,
                        "mid": float(parts[4]) if parts[4] != "-" else 0,
                        "small": float(parts[5]) if parts[5] != "-" else 0,
                    })
    except Exception as e:
        print(f"[DataService] fund flow 120d error for {code}: {e}")

    if result["data"]:
        cache_set(cache_key, result)
    return result


def fetch_dragon_tiger_stock(code):
    """龙虎榜席位 - 东财 datacenter（上榜记录 + 买卖席位TOP5 + 机构动向）"""
    cache_key = f"dragon_tiger_{code}"
    cached = cache_get(cache_key, 'datacenter')
    if cached:
        return cached

    results = []
    try:
        # 查询个股龙虎榜记录
        filter_str = f'(SECURITY_CODE="{code}")'
        data = eastmoney_datacenter(
            "RPT_DAILYBILLBOARD_DETAILSNEW",
            columns="ALL",
            filter_str=filter_str,
            page_size=20,
            sort_columns="TRADE_DATE",
            sort_types="-1"
        )
        for item in data:
            record = {
                "trade_date": item.get("TRADE_DATE", "")[:10] if item.get("TRADE_DATE") else "",
                "code": item.get("SECURITY_CODE", ""),
                "name": item.get("SECURITY_NAME_ABBR", ""),
                "reason": item.get("EXPLANATION", ""),
                "close_price": item.get("CLOSE_PRICE", 0),
                "change_pct": item.get("CHANGE_RATE", 0),
                "buy_total": item.get("BUY_TOTAL_AMT", 0),
                "sell_total": item.get("SELL_TOTAL_AMT", 0),
                "net_amount": (item.get("BUY_TOTAL_AMT", 0) or 0) - (item.get("SELL_TOTAL_AMT", 0) or 0),
                "turnover_rate": item.get("TURNOVERRATE", 0),
            }
            results.append(record)

        # 获取买卖席位明细
        if results:
            time.sleep(0.3)  # 额外间隔
            buy_filter = f'(SECURITY_CODE="{code}")(OPERATEDIRECTION="BUY")'
            buy_seats = eastmoney_datacenter(
                "RPT_BILLBOARD_DAILYDETAILSBUY",
                filter_str=buy_filter,
                page_size=20,
                sort_columns="TRADE_DATE,BUY_AMOUNT",
                sort_types="-1,-1"
            )
            sell_filter = f'(SECURITY_CODE="{code}")(OPERATEDIRECTION="SELL")'
            sell_seats = eastmoney_datacenter(
                "RPT_BILLBOARD_DAILYDETAILSSELL",
                filter_str=sell_filter,
                page_size=20,
                sort_columns="TRADE_DATE,SELL_AMOUNT",
                sort_types="-1,-1"
            )
            # Attach seats to results
            for r in results:
                r["buy_seats"] = [
                    {"name": s.get("BUYER_NAME", ""), "amount": s.get("BUY_AMOUNT", 0)}
                    for s in buy_seats if s.get("TRADE_DATE", "")[:10] == r["trade_date"]
                ][:5]
                r["sell_seats"] = [
                    {"name": s.get("SELLER_NAME", ""), "amount": s.get("SELL_AMOUNT", 0)}
                    for s in sell_seats if s.get("TRADE_DATE", "")[:10] == r["trade_date"]
                ][:5]

    except Exception as e:
        print(f"[DataService] dragon tiger error for {code}: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_dragon_tiger_daily(date=None):
    """全市场龙虎榜 - 每日全市场上榜股票 + 净买额排名"""
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    cache_key = f"dragon_tiger_daily_{date}"
    cached = cache_get(cache_key, 'datacenter')
    if cached:
        return cached

    results = []
    try:
        filter_str = f"(TRADE_DATE='{date}')"
        data = eastmoney_datacenter(
            "RPT_DAILYBILLBOARD_DETAILSNEW",
            columns="ALL",
            filter_str=filter_str,
            page_size=50,
            sort_columns="BUY_TOTAL_AMT",
            sort_types="-1"
        )
        for item in data:
            results.append({
                "code": item.get("SECURITY_CODE", ""),
                "name": item.get("SECURITY_NAME_ABBR", ""),
                "reason": item.get("EXPLANATION", ""),
                "close_price": item.get("CLOSE_PRICE", 0),
                "change_pct": item.get("CHANGE_RATE", 0),
                "buy_total": item.get("BUY_TOTAL_AMT", 0),
                "sell_total": item.get("SELL_TOTAL_AMT", 0),
                "net_amount": (item.get("BUY_TOTAL_AMT", 0) or 0) - (item.get("SELL_TOTAL_AMT", 0) or 0),
                "turnover_rate": item.get("TURNOVERRATE", 0),
                "trade_date": date,
            })
    except Exception as e:
        print(f"[DataService] dragon tiger daily error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_lockup_expiry(code):
    """限售解禁日历 - 历史解禁 + 未来90天待解禁"""
    cache_key = f"lockup_{code}"
    cached = cache_get(cache_key, 'datacenter')
    if cached:
        return cached

    results = {"history": [], "upcoming": []}
    try:
        # 历史解禁
        filter_str = f'(SECURITY_CODE="{code}")'
        data = eastmoney_datacenter(
            "RPT_CUSTOM_LIFT_BANDETAILS",
            filter_str=filter_str,
            page_size=30,
            sort_columns="FREE_DATE",
            sort_types="-1"
        )
        now = datetime.now()
        for item in data:
            free_date = item.get("FREE_DATE", "")[:10] if item.get("FREE_DATE") else ""
            record = {
                "free_date": free_date,
                "free_shares": item.get("FREE_SHARES_TOTAL", 0),
                "free_market_value": item.get("FREE_MARKET_VALUE", 0),
                "free_ratio": item.get("FREE_RATIO", 0),
                "holder_name": item.get("HOLDER_NAME", ""),
            }
            if free_date:
                try:
                    fd = datetime.strptime(free_date, "%Y-%m-%d")
                    if fd >= now:
                        results["upcoming"].append(record)
                    else:
                        results["history"].append(record)
                except:
                    results["history"].append(record)
            else:
                results["history"].append(record)
    except Exception as e:
        print(f"[DataService] lockup expiry error for {code}: {e}")

    if results["history"] or results["upcoming"]:
        cache_set(cache_key, results)
    return results


def fetch_industry_rank():
    """行业板块排名 - 东财 push2（行业涨跌/上涨下跌家数）"""
    cache_key = "industry_rank"
    cached = cache_get(cache_key, 'datacenter')
    if cached:
        return cached

    results = []
    try:
        # 直接拼接URL避免参数编码问题
        url = "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f8,f12,f14,f104,f105,f128,f136,f204,f205"
        r = em_get(url)
        data = r.json()
        if data and data.get("data") and data["data"].get("diff"):
            for item in data["data"]["diff"]:
                if isinstance(item, dict):
                    results.append({
                        "code": item.get("f12", ""),
                        "name": item.get("f14", ""),
                        "change_pct": item.get("f3", 0),
                        "turnover_rate": item.get("f8", 0),
                        "up_count": item.get("f104", 0),
                        "down_count": item.get("f105", 0),
                        "lead_stock": item.get("f204", ""),
                        "lead_change": item.get("f205", 0) if item.get("f205") else 0,
                    })
    except Exception as e:
        print(f"[DataService] industry rank error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


# ===================== Layer 4: 资金面/筹码层 (东财 datacenter) =====================

def fetch_margin(code):
    """融资融券明细 - 日级融资余额/买入/偿还 + 融券"""
    cache_key = f"margin_{code}"
    cached = cache_get(cache_key, 'datacenter')
    if cached:
        return cached

    results = []
    try:
        filter_str = f'(SECURITY_CODE="{code}")'
        data = eastmoney_datacenter(
            "RPTA_WEB_RZRQ_GGMX",
            filter_str=filter_str,
            page_size=30,
            sort_columns="DIM_DATE",
            sort_types="-1"
        )
        for item in data:
            results.append({
                "date": item.get("DIM_DATE", "")[:10] if item.get("DIM_DATE") else "",
                "rz_balance": item.get("RZYE", 0),         # 融资余额
                "rz_buy": item.get("RZMRE", 0),            # 融资买入额
                "rz_repay": item.get("RZCHE", 0),          # 融资偿还额
                "rq_balance": item.get("RQYE", 0),         # 融券余额
                "rq_sell": item.get("RQMCL", 0),           # 融券卖出量
                "rq_repay": item.get("RQCHL", 0),          # 融券偿还量
                "rz_rq_balance": item.get("RZRQYE", 0),    # 融资融券余额
            })
    except Exception as e:
        print(f"[DataService] margin error for {code}: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_block_trade(code):
    """大宗交易 - 成交价/量 + 买卖方营业部 + 溢价率"""
    cache_key = f"block_trade_{code}"
    cached = cache_get(cache_key, 'datacenter')
    if cached:
        return cached

    results = []
    try:
        filter_str = f'(SECURITY_CODE="{code}")'
        data = eastmoney_datacenter(
            "RPT_BLOCKTRADE_DETAILSNEW",
            filter_str=filter_str,
            page_size=30,
            sort_columns="TRADE_DATE",
            sort_types="-1"
        )
        for item in data:
            close_price = item.get("CLOSE_PRICE", 0) or 0
            deal_price = item.get("DEAL_PRICE", 0) or 0
            premium_rate = 0
            if close_price > 0 and deal_price > 0:
                premium_rate = round((deal_price - close_price) / close_price * 100, 2)
            results.append({
                "trade_date": item.get("TRADE_DATE", "")[:10] if item.get("TRADE_DATE") else "",
                "deal_price": deal_price,
                "deal_volume": item.get("DEAL_VOLUME", 0),
                "deal_amount": item.get("DEAL_AMOUNT", 0),
                "close_price": close_price,
                "premium_rate": premium_rate,
                "buyer": item.get("BUYER_NAME", ""),
                "seller": item.get("SELLER_NAME", ""),
                "change_pct": item.get("D1_CLOSE_ADJCHRATE", 0),
            })
    except Exception as e:
        print(f"[DataService] block trade error for {code}: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_shareholder_count(code):
    """股东户数变化 - 季度股东户数 + 环比变化 + 户均持股"""
    cache_key = f"shareholder_{code}"
    cached = cache_get(cache_key, 'datacenter')
    if cached:
        return cached

    results = []
    try:
        filter_str = f'(SECURITY_CODE="{code}")'
        data = eastmoney_datacenter(
            "RPT_HOLDERNUM_DIAG",
            filter_str=filter_str,
            page_size=20,
            sort_columns="END_DATE",
            sort_types="-1"
        )
        for item in data:
            results.append({
                "end_date": item.get("END_DATE", "")[:10] if item.get("END_DATE") else "",
                "holder_num": item.get("HOLDER_NUM", 0),
                "holder_num_change": item.get("HOLDER_NUM_CHANGE", 0),
                "holder_num_change_rate": item.get("HOLDER_NUM_CHANGE_RATE", 0),
                "avg_shares": item.get("AVG_FREE_SHARES", 0),
                "avg_market_value": item.get("AVG_MARKET_CAP", 0),
                "total_market_cap": item.get("TOTAL_MARKET_CAP", 0),
            })
    except Exception as e:
        print(f"[DataService] shareholder count error for {code}: {e}")

    if results:
        cache_set(cache_key, results)
    return results


def fetch_dividend(code):
    """分红送转历史 - 每股派息/送股/转增 + 进度状态"""
    cache_key = f"dividend_{code}"
    cached = cache_get(cache_key, 'datacenter')
    if cached:
        return cached

    results = []
    try:
        filter_str = f'(SECURITY_CODE="{code}")'
        data = eastmoney_datacenter(
            "RPT_SHAREBONUS_DET",
            filter_str=filter_str,
            page_size=30,
            sort_columns="EX_DIVIDEND_DATE",
            sort_types="-1"
        )
        for item in data:
            results.append({
                "report_date": item.get("REPORT_DATE", "")[:10] if item.get("REPORT_DATE") else "",
                "plan_content": item.get("ASSIGN_DETAIL", ""),
                "bonus_per_share": item.get("PRETAX_BONUS_RMB", 0),  # 每股派息
                "transfer_per_share": item.get("TRANSFER_RATIO", 0),  # 每股转增
                "bonus_ratio": item.get("BONUS_RATIO", 0),  # 每股送股
                "ex_date": item.get("EX_DIVIDEND_DATE", "")[:10] if item.get("EX_DIVIDEND_DATE") else "",
                "record_date": item.get("EQUITY_RECORD_DATE", "")[:10] if item.get("EQUITY_RECORD_DATE") else "",
                "progress": item.get("IMPL_STATUS", ""),
            })
    except Exception as e:
        print(f"[DataService] dividend error for {code}: {e}")

    if results:
        cache_set(cache_key, results)
    return results


# ===================== Layer 5: 新闻层 (东财直连HTTP) =====================

def fetch_news_stock(code):
    """个股新闻 - 东财 search-api-web（V3.2.1 修复）"""
    cache_key = f"news_{code}"
    cached = cache_get(cache_key, 'news')
    if cached:
        return cached

    results = []
    try:
        url = "https://search-api-web.eastmoney.com/search/jsonp"
        params = {
            "cb": "jQuery_callback",
            "param": json.dumps({
                "uid": "",
                "keyword": code,
                "type": ["cmsArticleWebOld"],
                "client": "web",
                "clientType": "web",
                "clientVersion": "curr",
                "param": {"cmsArticleWebOld": {"searchScope": "default", "sort": "default", "pageIndex": 1, "pageSize": 20}}
            }),
        }
        r = em_get(url, params=params, headers={
            "Referer": "https://so.eastmoney.com/",
        })
        text = r.text
        # Strip JSONP wrapper
        if "jQuery_callback(" in text:
            text = text[text.index("(") + 1:text.rindex(")")]
        data = json.loads(text)
        
        # V3.2.1 fix: cmsArticleWebOld is directly the article list
        articles = []
        if data.get("result") and data["result"].get("cmsArticleWebOld"):
            cms_data = data["result"]["cmsArticleWebOld"]
            if isinstance(cms_data, list):
                articles = cms_data
            elif isinstance(cms_data, dict) and cms_data.get("list"):
                articles = cms_data["list"]
        
        for item in articles[:20]:
            results.append({
                "title": item.get("title", ""),
                "content": item.get("content", "")[:200] if item.get("content") else "",
                "time": item.get("date", "") or item.get("showTime", ""),
                "source": item.get("mediaName", "") or "东财",
                "url": item.get("url", ""),
            })
    except Exception as e:
        print(f"[DataService] stock news error for {code}: {e}")

    # Fallback: akshare
    if not results and AKSHARE_AVAILABLE:
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
        except:
            pass

    if results:
        cache_set(cache_key, results)
    return results


def fetch_news_global():
    """全球资讯 - 东财 np-weblist（7×24 财经快讯，替代财联社）"""
    cache_key = "news_global"
    cached = cache_get(cache_key, 'news')
    if cached:
        return cached

    results = []
    try:
        url = "https://np-weblist.eastmoney.com/comm/web/getNewsByColumns"
        params = {
            "columns": "102",
            "client": "web",
            "biz": "web_724",
            "req_trace": str(int(time.time() * 1000)),
            "pageSize": "30",
            "page": "0",
        }
        r = em_get(url, params=params, headers={
            "Referer": "https://kuaixun.eastmoney.com/",
        })
        data = r.json()
        if data and data.get("data") and data["data"].get("list"):
            for item in data["data"]["list"]:
                results.append({
                    "title": item.get("title", ""),
                    "content": item.get("digest", "") or item.get("content", "")[:200],
                    "time": item.get("showTime", "") or item.get("displayTime", ""),
                    "source": "东财全球资讯",
                    "url": item.get("url_unique", "") or item.get("url_w", ""),
                })
    except Exception as e:
        print(f"[DataService] global news error: {e}")

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
        r = em_get(url, headers={"Referer": f"http://guba.eastmoney.com/list,{code}.html"})
        data = r.json()
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

    if results:
        cache_set(cache_key, results)
    return results


# ===================== Layer 6: 基础数据层 (mootdx + 东财 + 新浪) =====================

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
                'total_shares': float(row.get('zongguben', 0)),
                'circ_shares': float(row.get('liutongguben', 0)),
                'total_assets': float(row.get('zongzichan', 0)),
                'net_assets': float(row.get('jingzichan', 0)),
                'revenue': float(row.get('zhuyingshouru', 0)),
                'profit': float(row.get('jinglirun', 0)),
                'eps': float(row.get('meigujingzichan', 0)),
                'ipo_date': str(int(row.get('ipo_date', 0))),
                'shareholders': int(row.get('gudongrenshu', 0)),
                'undistributed': float(row.get('weifenpeilirun', 0)),
                'operating_profit': float(row.get('yingyelirun', 0)),
                'cash_flow': float(row.get('jingyingxianjinliu', 0)),
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


def fetch_stock_info_em(code):
    """东财个股信息 - 行业/总股本/流通股/市值/上市日期 (push2)"""
    cache_key = f"stock_info_{code}"
    cached = cache_get(cache_key, 'f10')
    if cached:
        return cached

    result = {}
    try:
        secid = f"{get_market_id(code)}.{code}"
        url = "https://push2.eastmoney.com/api/qt/stock/get"
        params = {
            "secid": secid,
            "fields": "f57,f58,f107,f162,f163,f167,f168,f169,f170,f171,f173,f174,f175,f176,f177,f178,f179,f180,f181,f182,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192,f193",
            "invt": "2",
        }
        r = em_get(url, params=params)
        data = r.json()
        if data and data.get("data"):
            d = data["data"]
            result = {
                "code": d.get("f57", code),
                "name": d.get("f58", ""),
                "industry": d.get("f107", ""),
                "total_shares": d.get("f183", 0),
                "float_shares": d.get("f184", 0),
                "total_mv": d.get("f187", 0),
                "float_mv": d.get("f185", 0),
                "pe_ttm": d.get("f162", 0),
                "pe_static": d.get("f163", 0),
                "pb": d.get("f167", 0),
                "roe": d.get("f173", 0),
                "gross_margin": d.get("f174", 0),
                "net_margin": d.get("f175", 0),
                "listing_date": d.get("f189", ""),
                "source": "eastmoney_push2",
            }
    except Exception as e:
        print(f"[DataService] stock info error for {code}: {e}")

    if result:
        cache_set(cache_key, result)
    return result


def fetch_financial_statements(code):
    """新浪财报三表 - 资产负债表/利润表/现金流量表（V3.2.1 修复）"""
    cache_key = f"fin_stmt_{code}"
    cached = cache_get(cache_key, 'f10')
    if cached:
        return cached

    result = {"balance_sheet": [], "income_statement": [], "cash_flow": []}
    
    # 新浪接口
    statements = {
        "balance_sheet": "balancesheet",
        "income_statement": "income", 
        "cash_flow": "cashflow",
    }
    
    for key, report_type in statements.items():
        try:
            url = f"https://quotes.sina.cn/cn/api/openapi.php/CompanyFinanceService.get{report_type.capitalize()}?paperCode={code}&source=gjzb&type=0&reportType=0"
            req = urllib.request.Request(url, headers={
                'User-Agent': UA,
                'Referer': 'https://finance.sina.com.cn',
            })
            resp = urllib.request.urlopen(req, timeout=10)
            data = json.loads(resp.read().decode('utf-8'))
            
            # V3.2.1: 新浪结构是 result.data.report_list
            if data and data.get("result") and data["result"].get("data"):
                report_list = data["result"]["data"].get("report_list", {})
                if isinstance(report_list, dict):
                    for period, period_data in list(report_list.items())[:4]:
                        items = period_data.get("data", []) if isinstance(period_data, dict) else []
                        entry = {"period": period, "items": []}
                        for item in items:
                            if isinstance(item, dict):
                                entry["items"].append({
                                    "name": item.get("item_title", ""),
                                    "value": item.get("item_value", ""),
                                })
                        result[key].append(entry)
        except Exception as e:
            print(f"[DataService] sina {key} error for {code}: {e}")

    if any(result[k] for k in result):
        cache_set(cache_key, result)
    return result


# ===================== Layer 7: 公告层 (巨潮 cninfo) =====================

# cninfo orgId 映射缓存
_cninfo_org_map = {}
_cninfo_org_lock = threading.Lock()


def _cninfo_orgid(code):
    """动态查询巨潮 orgId（V3.2.2 修复 #19）"""
    global _cninfo_org_map
    if code in _cninfo_org_map:
        return _cninfo_org_map[code]
    
    with _cninfo_org_lock:
        if not _cninfo_org_map:
            # 尝试加载官方映射表
            try:
                url = "http://www.cninfo.com.cn/new/data/szse_stock.json"
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                resp = urllib.request.urlopen(req, timeout=10)
                data = json.loads(resp.read().decode('utf-8'))
                if data and data.get("stockList"):
                    for item in data["stockList"]:
                        _cninfo_org_map[item.get("code", "")] = item.get("orgId", "")
                    print(f"[DataService] cninfo orgId map loaded: {len(_cninfo_org_map)} stocks")
            except Exception as e:
                print(f"[DataService] cninfo orgId map load failed: {e}")
    
    # Fallback: 硬编码猜测
    if code not in _cninfo_org_map:
        _cninfo_org_map[code] = f"gssx0{code}"
    return _cninfo_org_map.get(code, f"gssx0{code}")


def fetch_announce_stock(code):
    """个股公告 - 巨潮资讯 cninfo.com.cn"""
    cache_key = f"announce_{code}"
    cached = cache_get(cache_key, 'announce')
    if cached:
        return cached

    results = []
    
    try:
        url = "http://www.cninfo.com.cn/new/hisAnnouncement/query"
        data_str = f"pageNum=1&pageSize=15&column=szse&tabName=fulltext&plate=&stock={code}&searchkey=&secid=&category=&trade=&seDate=&sortName=&sortType=&isHLtitle=true"
        
        req = urllib.request.Request(url, data=data_str.encode('utf-8'), headers={
            'User-Agent': UA,
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
                    'url': f"http://www.cninfo.com.cn/new/disclosure/detail?annoId={ann.get('announcementId', '')}",
                    'source': 'cninfo',
                })
    except Exception as e:
        print(f"[DataService] cninfo announce error for {code}: {e}")

    # Fallback: 东财公告
    if not results:
        try:
            url = f"https://np-anotice-stock.eastmoney.com/api/security/ann?page_index=1&page_size=15&ann_type=A&client_source=web&stock_list={code}"
            r = em_get(url)
            data = r.json()
            if data and 'data' in data and 'list' in data['data']:
                for item in data['data']['list']:
                    results.append({
                        'title': item.get('title', ''),
                        'time': item.get('display_time', ''),
                        'type': ','.join(item.get('columns', [])) if item.get('columns') else '',
                        'url': f"https://data.eastmoney.com/notices/detail/{code}/{item.get('art_code', '')}.html",
                        'source': 'eastmoney',
                    })
        except Exception as e:
            print(f"[DataService] eastmoney announce fallback error: {e}")

    if results:
        cache_set(cache_key, results)
    return results


# ===================== 保持原有接口兼容 =====================

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
    """涨停板"""
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
    """跌停板"""
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
    """炸板"""
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
    """连板天梯"""
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
    """概念热力"""
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
                "code": str(row.get('板块代码', '')),
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
    """行业热力"""
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
                "code": str(row.get('板块代码', '')),
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
    """涨跌概览"""
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
    """全市场行情"""
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
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        date_str = get_trade_date(params.get('trade_date', [None])[0] or params.get('date', [None])[0])

        try:
            # ===== Health =====
            if path == '/health':
                self.send_json({
                    "status": "ok",
                    "version": VERSION,
                    "mootdx": MOOTDX_AVAILABLE,
                    "akshare": AKSHARE_AVAILABLE,
                    "requests": REQUESTS_AVAILABLE,
                    "em_min_interval": EM_MIN_INTERVAL,
                    "data_sources": [
                        "mootdx(通达信/TCP)", "腾讯财经", "同花顺", "百度股市通",
                        "新浪财经", "巨潮cninfo", "同花顺一致预期", "iwencai",
                        "东财push2", "东财datacenter", "东财reportapi",
                        "东财search-api", "东财np-weblist"
                    ],
                    "total_sources": 13,
                    "architecture": "七层数据架构 · 27+端点 · 13数据源 · 东财防封em_get()",
                })

            # ===== Layer 1: 行情层 =====
            elif path == '/quote':
                codes = params.get('codes', [''])[0].split(',')
                codes = [c.strip() for c in codes if c.strip()]
                if not codes:
                    self.send_json({"code": -1, "error": "missing codes"}, 400)
                    return
                data = fetch_quote_tencent(codes)
                self.send_json({"code": 0, "data": data, "source": "tencent", "note": "索引43=振幅%(已校准),46=PB"})

            elif path == '/kline':
                code = params.get('code', [''])[0]
                freq_map = {'5min': 0, '15min': 1, '30min': 2, '60min': 3, 'daily': 9, 'weekly': 5, 'monthly': 6}
                freq = freq_map.get(params.get('freq', ['daily'])[0], 9)
                count = int(params.get('count', ['60'])[0])
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_kline_mootdx(code, freq, count)
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "mootdx"})

            elif path == '/kline/baidu':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_kline_baidu(code)
                self.send_json({"code": 0, "data": data, "source": "baidu", "note": "自带MA5/MA10/MA20均线"})

            elif path == '/minute':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_minute_mootdx(code)
                self.send_json({"code": 0, "data": data, "source": "mootdx"})

            # ===== Layer 2: 研报层 =====
            elif path == '/research':
                code = params.get('code', [''])[0]
                if code:
                    data = fetch_research_stock(code)
                else:
                    data = fetch_research_market()
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_reportapi"})

            elif path == '/research/market':
                data = fetch_research_market()
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_reportapi"})

            # ===== Layer 3: 信号层 =====
            elif path == '/northbound':
                data = fetch_northbound()
                self.send_json({"code": 0, "data": data, "source": "ths+eastmoney"})

            elif path == '/hot_stocks':
                data = fetch_hot_stocks()
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "ths"})

            elif path == '/concept_blocks':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_concept_blocks(code)
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_slist"})

            elif path == '/fund_flow':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_fund_flow_minute(code)
                self.send_json({"code": 0, "data": data, "source": "eastmoney_push2"})

            elif path == '/fund_flow_120d':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_fund_flow_120d(code)
                self.send_json({"code": 0, "data": data, "source": "eastmoney_push2his"})

            elif path == '/dragon_tiger':
                code = params.get('code', [''])[0]
                if code:
                    data = fetch_dragon_tiger_stock(code)
                else:
                    data = fetch_dragon_tiger_daily(params.get('date', [None])[0])
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_datacenter"})

            elif path == '/dragon_tiger_daily':
                date = params.get('date', [None])[0]
                data = fetch_dragon_tiger_daily(date)
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_datacenter"})

            elif path == '/lockup_expiry':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_lockup_expiry(code)
                self.send_json({"code": 0, "data": data, "source": "eastmoney_datacenter"})

            elif path == '/industry_rank':
                data = fetch_industry_rank()
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_push2"})

            # ===== Layer 4: 资金面/筹码层 =====
            elif path == '/margin':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_margin(code)
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_datacenter"})

            elif path == '/block_trade':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_block_trade(code)
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_datacenter"})

            elif path == '/shareholder_count':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_shareholder_count(code)
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_datacenter"})

            elif path == '/dividend':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_dividend(code)
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_datacenter"})

            # ===== Layer 5: 新闻层 =====
            elif path == '/news':
                code = params.get('code', [''])[0]
                if code:
                    data = fetch_news_stock(code)
                else:
                    data = fetch_news_global()
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney"})

            elif path == '/news/market' or path == '/news/global':
                data = fetch_news_global()
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney_np-weblist"})

            elif path == '/guba':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_guba(code)
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "eastmoney"})

            # ===== Layer 6: 基础数据层 =====
            elif path == '/f10' or path == '/finance':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_f10(code)
                self.send_json({"code": 0, "data": data, "source": "mootdx"})

            elif path == '/stock_info':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_stock_info_em(code)
                self.send_json({"code": 0, "data": data, "source": "eastmoney_push2"})

            elif path == '/financial_statements':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_financial_statements(code)
                self.send_json({"code": 0, "data": data, "source": "sina"})

            # ===== Layer 7: 公告层 =====
            elif path == '/announce':
                code = params.get('code', [''])[0]
                if not code:
                    self.send_json({"code": -1, "error": "missing code"}, 400)
                    return
                data = fetch_announce_stock(code)
                self.send_json({"code": 0, "data": data, "count": len(data), "source": "cninfo"})

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
                self.send_json({"error": "Not found", "version": VERSION, "endpoints": [
                    "/health",
                    "# 行情层(不封IP)", "/quote", "/kline", "/kline/baidu", "/minute",
                    "# 研报层", "/research", "/research/market",
                    "# 信号层", "/northbound", "/hot_stocks", "/concept_blocks",
                    "/fund_flow", "/fund_flow_120d", "/dragon_tiger", "/dragon_tiger_daily",
                    "/lockup_expiry", "/industry_rank",
                    "# 资金面", "/margin", "/block_trade", "/shareholder_count", "/dividend",
                    "# 新闻层", "/news", "/news/global", "/guba",
                    "# 基础数据", "/f10", "/finance", "/stock_info", "/financial_statements",
                    "# 公告层", "/announce",
                    "# 兼容接口", "/limit_up", "/limit_down", "/broken_board", "/board_ladder",
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
    print(f"╔══════════════════════════════════════════════════════════════╗")
    print(f"║  QuantMind Data Service v{VERSION}                              ║")
    print(f"║  七层架构 · 27+ 端点 · 13 数据源 · 东财防封 em_get()       ║")
    print(f"╠══════════════════════════════════════════════════════════════╣")
    print(f"║  Port: {port}                                                 ║")
    print(f"║  mootdx: {'✓ available ' if MOOTDX_AVAILABLE else '✗ unavailable'}                                  ║")
    print(f"║  akshare: {'✓ available ' if AKSHARE_AVAILABLE else '✗ unavailable'}                                 ║")
    print(f"║  requests: {'✓ available' if REQUESTS_AVAILABLE else '✗ unavailable'}                                 ║")
    print(f"║  em_get interval: {EM_MIN_INTERVAL}s                                    ║")
    print(f"╠══════════════════════════════════════════════════════════════╣")
    print(f"║  数据源优先级:                                              ║")
    print(f"║  1. mootdx(TCP) + 腾讯(HTTP) — 不封IP，优先用              ║")
    print(f"║  2. 同花顺 + 百度 + 新浪 + 巨潮 — 低风险                   ║")
    print(f"║  3. 东财(push2/datacenter/reportapi/search/np) — 限流防封   ║")
    print(f"╚══════════════════════════════════════════════════════════════╝")
    sys.stdout.flush()
    server.serve_forever()


if __name__ == '__main__':
    main()
