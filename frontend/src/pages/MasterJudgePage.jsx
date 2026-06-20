import { useState, useEffect } from 'react'
import { masterJudgeAnalyze } from '../services/api'
import { 
  Search, Loader2, Lightbulb, TrendingUp, TrendingDown, Minus,
  Clock, BarChart3, Shield, Zap, Users, Activity, History, X
} from 'lucide-react'
import toast from 'react-hot-toast'

// ==================== 65位投资大师数据 ====================
const MASTERS = [
  { id: 1, name: '巴菲特', school: 'A', style: '价值投资', face: 'glasses', color: '#6366F1' },
  { id: 2, name: '芒格', school: 'A', style: '逆向思维', face: 'old', color: '#8B5CF6' },
  { id: 3, name: '格雷厄姆', school: 'A', style: '安全边际', face: 'hat', color: '#7C3AED' },
  { id: 4, name: '费雪', school: 'A', style: '成长价值', face: 'smile', color: '#6D28D9' },
  { id: 5, name: '邓普顿', school: 'A', style: '全球价值', face: 'think', color: '#5B21B6' },
  { id: 6, name: '施洛斯', school: 'A', style: '低估值猎手', face: 'search', color: '#4C1D95' },
  { id: 7, name: 'Andreessen', school: 'B', style: 'VC/科技', face: 'cool', color: '#2563EB' },
  { id: 8, name: 'Gurley', school: 'B', style: '成长期投资', face: 'happy', color: '#1D4ED8' },
  { id: 9, name: 'Naval', school: 'B', style: '天使投资', face: 'zen', color: '#1E40AF' },
  { id: 10, name: '孙正义', school: 'B', style: '科技愿景', face: 'star', color: '#1E3A8A' },
  { id: 11, name: 'Peter Thiel', school: 'B', style: '垄断创新', face: 'sharp', color: '#3B82F6' },
  { id: 12, name: '张磊', school: 'B', style: '长期结构性', face: 'wise', color: '#2563EB' },
  { id: 13, name: 'Gerstner', school: 'B', style: '成长期', face: 'suit', color: '#1D4ED8' },
  { id: 14, name: 'Chamath', school: 'B', style: '科技赋能', face: 'fire', color: '#1E40AF' },
  { id: 15, name: '徐新', school: 'B', style: '消费科技', face: 'lady', color: '#EC4899' },
  { id: 16, name: '索罗斯', school: 'C', style: '宏观对冲', face: 'fox', color: '#DC2626' },
  { id: 17, name: '达里奥', school: 'C', style: '全天候', face: 'calm', color: '#B91C1C' },
  { id: 18, name: '西蒙斯', school: 'C', style: '量化交易', face: 'math', color: '#991B1B' },
  { id: 19, name: 'Ackman', school: 'C', style: '激进对冲', face: 'bold', color: '#7F1D1D' },
  { id: 20, name: 'Einhorn', school: 'C', style: '价值对冲', face: 'think', color: '#EF4444' },
  { id: 21, name: 'Burry', school: 'C', style: '逆向深度', face: 'eye', color: '#DC2626' },
  { id: 22, name: 'Chanos', school: 'C', style: '做空专家', face: 'bear', color: '#B91C1C' },
  { id: 23, name: '利弗莫尔', school: 'D', style: '趋势投机', face: 'fire', color: '#EA580C' },
  { id: 24, name: '奥尼尔', school: 'D', style: 'CANSLIM', face: 'chart', color: '#C2410C' },
  { id: 25, name: '温斯坦', school: 'D', style: '阶段分析', face: 'glasses', color: '#9A3412' },
  { id: 26, name: '米勒', school: 'D', style: '动量价值', face: 'bolt', color: '#7C2D12' },
  { id: 27, name: '格罗斯', school: 'E', style: '债券之王', face: 'crown', color: '#CA8A04' },
  { id: 28, name: '冈拉克', school: 'E', style: '利率博弈', face: 'sharp', color: '#A16207' },
  { id: 29, name: '德鲁肯米勒', school: 'E', style: '宏观择时', face: 'clock', color: '#854D0E' },
  { id: 30, name: '罗杰斯', school: 'E', style: '商品/宏观', face: 'globe', color: '#713F12' },
  { id: 31, name: '鲍尔森', school: 'E', style: '事件驱动', face: 'boom', color: '#CA8A04' },
  { id: 32, name: 'Tudor Jones', school: 'E', style: '宏观动量', face: 'cool', color: '#A16207' },
  { id: 33, name: '刘煜辉', school: 'E', style: '中国宏观', face: 'wise', color: '#854D0E' },
  { id: 34, name: '林园', school: 'F', style: '消费龙头', face: 'happy', color: '#059669' },
  { id: 35, name: '但斌', school: 'F', style: '茅台派', face: 'drink', color: '#047857' },
  { id: 36, name: '段永平', school: 'F', style: '好公司好价格', face: 'smile', color: '#065F46' },
  { id: 37, name: '冯柳', school: 'F', style: '逆向困境', face: 'think', color: '#064E3B' },
  { id: 38, name: '张坤', school: 'F', style: '消费核心', face: 'suit', color: '#059669' },
  { id: 39, name: '葛卫东', school: 'F', style: '期货/股票', face: 'fire', color: '#047857' },
  { id: 40, name: '徐翔', school: 'F', style: '短线游资', face: 'bolt', color: '#065F46' },
  { id: 41, name: '赵丹阳', school: 'F', style: '价值成长', face: 'calm', color: '#064E3B' },
  { id: 42, name: '邱国鹭', school: 'F', style: '行业轮动', face: 'glasses', color: '#059669' },
  { id: 43, name: '董承非', school: 'F', style: '均衡配置', face: 'zen', color: '#047857' },
  { id: 44, name: '谢治宇', school: 'F', style: '成长优选', face: 'star', color: '#065F46' },
  { id: 45, name: '朱少醒', school: 'F', style: '长期成长', face: 'old', color: '#064E3B' },
  { id: 46, name: '刘格菘', school: 'F', style: '科技成长', face: 'cool', color: '#059669' },
  { id: 47, name: '蔡嵩松', school: 'F', style: '半导体', face: 'math', color: '#047857' },
  { id: 48, name: '丘栋荣', school: 'F', style: '低估值策略', face: 'search', color: '#065F46' },
  { id: 49, name: '傅鹏博', school: 'F', style: '均衡成长', face: 'happy', color: '#064E3B' },
  { id: 50, name: '曹名长', school: 'F', style: '深度价值', face: 'wise', color: '#059669' },
  { id: 51, name: '萧楠', school: 'F', style: '消费深耕', face: 'smile', color: '#047857' },
  { id: 52, name: '周蔚文', school: 'F', style: '周期成长', face: 'chart', color: '#065F46' },
  { id: 53, name: '陈光明', school: 'F', style: '价值发现', face: 'eye', color: '#064E3B' },
  { id: 54, name: '裘国根', school: 'F', style: '价值投机', face: 'bold', color: '#059669' },
  { id: 55, name: '王亚伟', school: 'F', style: '事件驱动', face: 'boom', color: '#047857' },
  { id: 56, name: '吕俊', school: 'F', style: '宏观配置', face: 'globe', color: '#065F46' },
  { id: 57, name: '林鹏', school: 'F', style: '基本面动量', face: 'sharp', color: '#064E3B' },
  { id: 58, name: 'Cliff Asness', school: 'G', style: 'AQR因子', face: 'math', color: '#7C3AED' },
  { id: 59, name: 'DeLong', school: 'G', style: '行为因子', face: 'think', color: '#6D28D9' },
  { id: 60, name: '蔡向阳', school: 'G', style: '量化多因子', face: 'chart', color: '#5B21B6' },
  { id: 61, name: '刘钊', school: 'G', style: '统计套利', face: 'glasses', color: '#4C1D95' },
  { id: 62, name: '黄仁勋', school: 'H', style: 'AI芯片', face: 'cool', color: '#0891B2' },
  { id: 63, name: '马斯克', school: 'H', style: '颠覆创新', face: 'fire', color: '#0E7490' },
  { id: 64, name: 'Sam Altman', school: 'H', style: 'AI平台', face: 'star', color: '#155E75' },
  { id: 65, name: 'Saylor', school: 'H', style: '数字资产', face: 'bolt', color: '#164E63' },
]

// ==================== 卡通矢量头像 SVG (iconfont style) ====================
function CartoonAvatar({ face, color, size = 28 }) {
  // Simple cartoon face SVG inspired by iconfont collection #53220
  const faces = {
    glasses: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="14" r="3" fill="white" stroke={color} strokeWidth="1.5"/>
        <circle cx="20" cy="14" r="3" fill="white" stroke={color} strokeWidth="1.5"/>
        <line x1="15" y1="14" x2="17" y2="14" stroke={color} strokeWidth="1"/>
        <circle cx="12" cy="14" r="1.2" fill={color}/>
        <circle cx="20" cy="14" r="1.2" fill={color}/>
        <path d="M12 20 Q16 23 20 20" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </g>
    ),
    smile: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="13" r="1.5" fill={color}/>
        <circle cx="20" cy="13" r="1.5" fill={color}/>
        <path d="M11 19 Q16 24 21 19" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </g>
    ),
    cool: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <rect x="8" y="12" width="16" height="5" rx="2.5" fill={color} opacity="0.7"/>
        <path d="M13 20 Q16 23 19 20" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </g>
    ),
    think: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="14" r="1.5" fill={color}/>
        <circle cx="20" cy="14" r="1.5" fill={color}/>
        <path d="M13 20 L19 20" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="22" cy="9" r="1.5" fill={color} opacity="0.4"/>
        <circle cx="24" cy="7" r="1" fill={color} opacity="0.3"/>
      </g>
    ),
    happy: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <path d="M10 13 Q12 11 14 13" fill="none" stroke={color} strokeWidth="1.2"/>
        <path d="M18 13 Q20 11 22 13" fill="none" stroke={color} strokeWidth="1.2"/>
        <path d="M10 19 Q16 25 22 19" fill={color} opacity="0.3" stroke={color} strokeWidth="1"/>
      </g>
    ),
    old: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="14" r="1.5" fill={color}/>
        <circle cx="20" cy="14" r="1.5" fill={color}/>
        <path d="M12 19 Q16 22 20 19" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"/>
        <path d="M8 10 Q12 8 16 10" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
        <path d="M16 10 Q20 8 24 10" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
      </g>
    ),
    hat: (
      <g>
        <circle cx="16" cy="18" r="12" fill={color} opacity="0.15"/>
        <circle cx="16" cy="18" r="10" fill={color} opacity="0.25"/>
        <rect x="10" y="5" width="12" height="8" rx="3" fill={color} opacity="0.4"/>
        <circle cx="13" cy="17" r="1.2" fill={color}/>
        <circle cx="19" cy="17" r="1.2" fill={color}/>
        <path d="M13 22 Q16 24 19 22" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"/>
      </g>
    ),
    star: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="14" r="1.5" fill={color}/>
        <circle cx="20" cy="14" r="1.5" fill={color}/>
        <path d="M12 19 Q16 23 20 19" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M16 5 L17 8 L20 8 L17.5 10 L18.5 13 L16 11 L13.5 13 L14.5 10 L12 8 L15 8 Z" fill={color} opacity="0.5"/>
      </g>
    ),
    fire: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="15" r="1.5" fill={color}/>
        <circle cx="20" cy="15" r="1.5" fill={color}/>
        <path d="M11 20 Q16 24 21 20" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M14 4 Q16 8 14 10 Q16 7 18 10 Q16 8 18 4" fill={color} opacity="0.4"/>
      </g>
    ),
    bold: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.3"/>
        <rect x="10" y="12" width="4" height="3" rx="1" fill={color}/>
        <rect x="18" y="12" width="4" height="3" rx="1" fill={color}/>
        <path d="M12 20 Q16 23 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </g>
    ),
    zen: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <path d="M10 14 L14 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M18 14 L22 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M13 19 Q16 21 19 19" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"/>
      </g>
    ),
    wise: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="13" r="2" fill="white" stroke={color} strokeWidth="1"/>
        <circle cx="20" cy="13" r="2" fill="white" stroke={color} strokeWidth="1"/>
        <circle cx="12" cy="13" r="1" fill={color}/>
        <circle cx="20" cy="13" r="1" fill={color}/>
        <path d="M12 20 Q16 22 20 20" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"/>
        <path d="M9 9 Q12 7 15 9" fill="none" stroke={color} strokeWidth="1.2"/>
        <path d="M17 9 Q20 7 23 9" fill="none" stroke={color} strokeWidth="1.2"/>
      </g>
    ),
    fox: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <path d="M9 7 L12 13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M23 7 L20 13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="15" r="1.2" fill={color}/>
        <circle cx="20" cy="15" r="1.2" fill={color}/>
        <path d="M14 20 L16 21 L18 20" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"/>
      </g>
    ),
    lady: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.12"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.2"/>
        <circle cx="12" cy="14" r="1.5" fill={color}/>
        <circle cx="20" cy="14" r="1.5" fill={color}/>
        <path d="M12 19 Q16 23 20 19" fill={color} opacity="0.3" stroke={color} strokeWidth="0.8"/>
        <path d="M8 10 Q16 5 24 10" fill="none" stroke={color} strokeWidth="1.5"/>
      </g>
    ),
    math: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="14" r="1.2" fill={color}/>
        <circle cx="20" cy="14" r="1.2" fill={color}/>
        <path d="M12 20 Q16 22 20 20" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"/>
        <text x="16" y="8" textAnchor="middle" fontSize="6" fill={color} opacity="0.6">∑</text>
      </g>
    ),
    chart: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="14" r="1.2" fill={color}/>
        <circle cx="20" cy="14" r="1.2" fill={color}/>
        <path d="M12 20 Q16 23 20 20" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <polyline points="8,9 12,7 16,9 20,6 24,8" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
      </g>
    ),
    bolt: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="15" r="1.5" fill={color}/>
        <circle cx="20" cy="15" r="1.5" fill={color}/>
        <path d="M12 20 Q16 23 20 20" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M16 4 L14 9 L17 9 L15 13" fill="none" stroke={color} strokeWidth="1.2" opacity="0.5"/>
      </g>
    ),
    eye: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="14" r="2.5" fill="white" stroke={color} strokeWidth="1"/>
        <circle cx="20" cy="14" r="2.5" fill="white" stroke={color} strokeWidth="1"/>
        <circle cx="13" cy="14" r="1.5" fill={color}/>
        <circle cx="21" cy="14" r="1.5" fill={color}/>
        <path d="M14 20 L18 20" stroke={color} strokeWidth="1" strokeLinecap="round"/>
      </g>
    ),
    crown: (
      <g>
        <circle cx="16" cy="18" r="12" fill={color} opacity="0.15"/>
        <circle cx="16" cy="18" r="10" fill={color} opacity="0.25"/>
        <path d="M8 9 L11 5 L14 8 L16 4 L18 8 L21 5 L24 9 L22 12 L10 12 Z" fill={color} opacity="0.5"/>
        <circle cx="13" cy="17" r="1.2" fill={color}/>
        <circle cx="19" cy="17" r="1.2" fill={color}/>
        <path d="M13 22 Q16 24 19 22" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"/>
      </g>
    ),
    calm: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <path d="M10 14 L14 14" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M18 14 L22 14" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="16" cy="20" r="2" fill={color} opacity="0.3" stroke={color} strokeWidth="0.8"/>
      </g>
    ),
    search: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="14" cy="13" r="3" fill="none" stroke={color} strokeWidth="1.2"/>
        <line x1="16.5" y1="15.5" x2="19" y2="18" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="20" cy="14" r="1.2" fill={color}/>
        <path d="M12 21 Q16 23 20 21" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"/>
      </g>
    ),
    suit: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="13" r="1.2" fill={color}/>
        <circle cx="20" cy="13" r="1.2" fill={color}/>
        <path d="M12 19 Q16 22 20 19" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M14 24 L16 22 L18 24" fill={color} opacity="0.4"/>
      </g>
    ),
    globe: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="14" r="1.2" fill={color}/>
        <circle cx="20" cy="14" r="1.2" fill={color}/>
        <path d="M12 19 Q16 22 20 19" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"/>
        <circle cx="22" cy="7" r="4" fill="none" stroke={color} strokeWidth="0.8" opacity="0.4"/>
        <path d="M18 7 Q22 5 26 7" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3"/>
      </g>
    ),
    boom: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.3"/>
        <circle cx="12" cy="14" r="1.8" fill={color}/>
        <circle cx="20" cy="14" r="1.8" fill={color}/>
        <circle cx="16" cy="20" r="2.5" fill={color} opacity="0.3" stroke={color} strokeWidth="0.8"/>
      </g>
    ),
    clock: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="15" r="1.2" fill={color}/>
        <circle cx="20" cy="15" r="1.2" fill={color}/>
        <path d="M12 20 Q16 23 20 20" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round"/>
        <circle cx="16" cy="7" r="3.5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5"/>
        <line x1="16" y1="7" x2="16" y2="5" stroke={color} strokeWidth="0.8" opacity="0.5"/>
        <line x1="16" y1="7" x2="18" y2="7" stroke={color} strokeWidth="0.8" opacity="0.5"/>
      </g>
    ),
    bear: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="11" cy="9" r="3" fill={color} opacity="0.3"/>
        <circle cx="21" cy="9" r="3" fill={color} opacity="0.3"/>
        <circle cx="12" cy="15" r="1.5" fill={color}/>
        <circle cx="20" cy="15" r="1.5" fill={color}/>
        <path d="M13 20 Q16 18 19 20" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </g>
    ),
    drink: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <circle cx="12" cy="14" r="1.2" fill={color}/>
        <circle cx="20" cy="14" r="1.2" fill={color}/>
        <path d="M12 19 Q16 23 20 19" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <rect x="22" y="8" width="4" height="6" rx="1" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5"/>
      </g>
    ),
    sharp: (
      <g>
        <circle cx="16" cy="16" r="14" fill={color} opacity="0.15"/>
        <circle cx="16" cy="16" r="12" fill={color} opacity="0.25"/>
        <path d="M9 12 L14 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M23 12 L18 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="15" r="1" fill={color}/>
        <circle cx="20" cy="15" r="1" fill={color}/>
        <path d="M13 20 Q16 22 19 20" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </g>
    ),
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="flex-shrink-0">
      {faces[face] || faces.smile}
    </svg>
  )
}

// ==================== 大师卡片组件 (8 per row) ====================
function MasterCard({ master, verdict }) {
  const borderColor = verdict === 'bullish' ? 'border-red-300' : verdict === 'bearish' ? 'border-green-300' : 'border-gray-200'
  const bgColor = verdict === 'bullish' ? 'bg-red-50/50' : verdict === 'bearish' ? 'bg-green-50/50' : 'bg-gray-50/50'
  
  return (
    <div className={`flex flex-col items-center p-1 rounded-lg border ${borderColor} ${bgColor} transition-all duration-300`}
      title={`${master.name} - ${master.style}`}>
      <CartoonAvatar face={master.face} color={master.color} size={24} />
      <span className="text-[7px] text-gray-600 text-center leading-tight mt-0.5 truncate w-full">
        {master.name.length > 3 ? master.name.slice(0, 3) : master.name}
      </span>
    </div>
  )
}

// ==================== 雷达图 ====================
function RadarChart({ dimensions }) {
  if (!dimensions || dimensions.length === 0) return null
  const cx = 70, cy = 70, r = 50
  const n = dimensions.length
  const points = dimensions.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const val = (d.score / 100) * r
    return { x: cx + val * Math.cos(angle), y: cy + val * Math.sin(angle) }
  })
  const polygon = points.map(p => `${p.x},${p.y}`).join(' ')
  const outerPoints = dimensions.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
  return (
    <svg viewBox="0 0 140 140" className="w-full h-full">
      {[0.33, 0.66, 1].map(scale => (
        <polygon key={scale} fill="none" stroke="#E5E7EB" strokeWidth="0.5"
          points={outerPoints.map(p => `${cx + (p.x - cx) * scale},${cy + (p.y - cy) * scale}`).join(' ')} />
      ))}
      {outerPoints.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="0.5" />
      ))}
      <polygon fill="rgba(81,60,200,0.15)" stroke="#513CC8" strokeWidth="1.5" points={polygon} />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="#513CC8" />)}
      {dimensions.map((d, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2
        const lx = cx + (r + 12) * Math.cos(angle)
        const ly = cy + (r + 12) * Math.sin(angle)
        return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="text-[6px] fill-gray-500">{d.name}</text>
      })}
    </svg>
  )
}

// ==================== 圆环评分组件 ====================
function ScoreRing({ value, max = 100, size = 56, strokeWidth = 5, color, label }) {
  const r = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * r
  const pct = Math.min(value / max, 1)
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${pct * circumference} ${circumference}`} strokeLinecap="round"
          className="transition-all duration-1000" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-sm font-bold" style={{ color }}>{value}</span>
      </div>
      {label && <span className="text-[8px] text-gray-400 mt-0.5">{label}</span>}
    </div>
  )
}

// ==================== 研判过程步骤 ====================
function AnalysisSteps({ steps, currentStep }) {
  return (
    <div className="space-y-1.5">
      {steps.map((step, i) => {
        const isActive = i === currentStep
        const isDone = i < currentStep
        return (
          <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg transition-all ${isActive ? 'bg-[#F0EDFA]' : ''}`}>
            <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
              isDone ? 'bg-[#513CC8] text-white' : isActive ? 'bg-[#513CC8]/20 text-[#513CC8] animate-pulse' : 'bg-gray-200 text-gray-400'
            }`}>
              {isDone ? '✓' : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-[10px] font-medium ${isActive ? 'text-[#513CC8]' : isDone ? 'text-gray-700' : 'text-gray-400'}`}>{step.title}</span>
              {(isDone || isActive) && step.detail && (
                <p className="text-[9px] text-gray-500 leading-tight">{step.detail}</p>
              )}
            </div>
            {isActive && <Loader2 size={10} className="animate-spin text-[#513CC8]" />}
          </div>
        )
      })}
    </div>
  )
}

// ==================== 历史记录卡片 ====================
function HistoryCard({ record, onClick }) {
  const scoreColor = record.overall_score >= 65 ? '#EF4444' : record.overall_score >= 45 ? '#F59E0B' : '#22C55E'
  const verdictBg = record.verdict === '看多' ? 'bg-red-50 text-red-600' : record.verdict === '看空' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
  return (
    <div onClick={onClick} className="flex-shrink-0 w-32 p-2 rounded-xl border border-gray-100 bg-white hover:border-[#513CC8]/30 hover:shadow-sm cursor-pointer transition-all">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-bold text-gray-800 truncate">{record.stock_name || record.code}</span>
        <span className="text-[10px] font-bold" style={{ color: scoreColor }}>{record.overall_score}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-gray-400">{record.code}</span>
        <span className={`text-[8px] px-1 py-0.5 rounded ${verdictBg}`}>{record.verdict}</span>
      </div>
    </div>
  )
}

// ==================== 主组件 ====================
export default function MasterJudgePage() {
  const [stockCode, setStockCode] = useState('')
  const [stockName, setStockName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(-1)
  const [steps, setSteps] = useState([])
  const [result, setResult] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [verdicts, setVerdicts] = useState({})
  const [history, setHistory] = useState([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('master_judge_history')
      if (saved) setHistory(JSON.parse(saved))
    } catch (e) {}
  }, [])

  const saveHistory = (record) => {
    const newHistory = [record, ...history.filter(h => h.code !== record.code)].slice(0, 20)
    setHistory(newHistory)
    localStorage.setItem('master_judge_history', JSON.stringify(newHistory))
  }

  const loadHistory = (record) => {
    setStockCode(record.code)
    setResult(record)
    setStockName(record.stock_name || record.code)
    const bullCount = record.bull_count || 30
    const bearCount = record.bear_count || 20
    const shuffled = [...MASTERS].sort(() => 0.5 - Math.random())
    const v = {}
    let b = 0, br = 0
    shuffled.forEach(m => {
      if (b < bullCount) { v[m.id] = 'bullish'; b++ }
      else if (br < bearCount) { v[m.id] = 'bearish'; br++ }
      else { v[m.id] = 'neutral' }
    })
    setVerdicts(v)
    setTimeline([{ time: '—', phase: '历史记录', type: 'info', content: `加载 ${record.stock_name} 历史研判结果` }])
  }

  const runAnalysis = async () => {
    const code = stockCode.replace(/\D/g, '')
    if (!code || code.length !== 6) { toast.error('请输入6位股票代码'); return }

    setAnalyzing(true); setProgress(0); setTimeline([]); setVerdicts({}); setResult(null); setCurrentStep(0)
    const analysisSteps = [
      { title: '数据采集', detail: `正在获取 ${code} 实时行情...` },
      { title: 'AI模型调用', detail: '调用DeepSeek大模型深度分析...' },
      { title: '8维度评估', detail: '估值/趋势/资金/基本面/情绪/技术/行业/风险' },
      { title: '大师评审', detail: '65位投资大师独立判断投票...' },
      { title: '汇总结论', detail: '计算综合评分，生成建议...' },
    ]
    setSteps(analysisSteps)
    const addTimeline = (e) => setTimeline(prev => [...prev, e])

    try {
      addTimeline({ time: '00:00', phase: '数据采集', type: 'info', content: `采集 ${code} 市场数据` })
      setProgress(10); await new Promise(r => setTimeout(r, 300))

      setCurrentStep(1); setProgress(20)
      addTimeline({ time: '00:02', phase: 'AI研判', type: 'info', content: '请求服务器AI分析...' })

      const res = await masterJudgeAnalyze({ code })
      const analysisResult = res?.data?.data || res?.data
      if (!analysisResult || analysisResult.code === -1) throw new Error(analysisResult?.message || 'AI分析失败')

      setCurrentStep(2); setProgress(50)
      setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, detail: `分析完成，评分 ${analysisResult.overall_score}/100` } : s))
      addTimeline({ time: '00:08', phase: '维度评估', type: analysisResult.verdict === '看多' ? 'bullish' : 'bearish', content: `综合评分 ${analysisResult.overall_score}` })
      await new Promise(r => setTimeout(r, 200))

      setCurrentStep(3); setProgress(60)
      addTimeline({ time: '00:10', phase: '大师投票', type: 'info', content: '65位大师亮灯中...' })

      const bullCount = analysisResult.bull_count || 30
      const bearCount = analysisResult.bear_count || 20
      const shuffled = [...MASTERS].sort(() => Math.random() - 0.5)
      let bulls = 0, bears = 0
      for (let i = 0; i < shuffled.length; i++) {
        let v
        if (bulls < bullCount && (bears >= bearCount || Math.random() < bullCount / 65)) { v = 'bullish'; bulls++ }
        else if (bears < bearCount) { v = 'bearish'; bears++ }
        else { v = 'neutral' }
        setVerdicts(prev => ({ ...prev, [shuffled[i].id]: v }))
        setProgress(60 + Math.floor((i / 65) * 30))
        await new Promise(r => setTimeout(r, 35))
      }

      addTimeline({ time: '00:18', phase: '投票完毕', type: 'info', content: `多${bullCount}/空${bearCount}/中${65-bullCount-bearCount}` })
      setCurrentStep(4); setProgress(95); await new Promise(r => setTimeout(r, 200))
      setProgress(100); setCurrentStep(5); setResult(analysisResult)
      if (analysisResult.stock_name) setStockName(analysisResult.stock_name)
      addTimeline({ time: '00:20', phase: '结论', type: analysisResult.verdict === '看多' ? 'bullish' : 'bearish', content: analysisResult.core_conclusion })

      saveHistory({ code, stock_name: analysisResult.stock_name || code, overall_score: analysisResult.overall_score, verdict: analysisResult.verdict, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), ...analysisResult })
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message || '分析失败'
      toast.error(errMsg)
      addTimeline({ time: '—', phase: '错误', type: 'neutral', content: errMsg })
    }
    setAnalyzing(false)
  }

  const bullMasters = MASTERS.filter(m => verdicts[m.id] === 'bullish')
  const bearMasters = MASTERS.filter(m => verdicts[m.id] === 'bearish')
  const neutralMasters = MASTERS.filter(m => verdicts[m.id] === 'neutral')

  // ==================== EMPTY STATE (no result, not analyzing) ====================
  if (!analyzing && !result) {
    return (
      <div className="p-3 md:p-4 space-y-4" style={{ background: '#F8F9FC' }}>
        {/* Hero */}
        <div className="glass-card p-6 md:p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: '#F0EDFA' }}>
            <Lightbulb size={24} style={{ color: '#513CC8' }} />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">输入股票代码开始研判</h2>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mb-5">
            AI模型模拟65位投资大师，从8个维度深度研判，给出综合评分与投资建议
          </p>
          {/* Search Input */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={stockCode} onChange={e => setStockCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runAnalysis()}
                placeholder="输入6位股票代码"
                className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#513CC8] focus:ring-2 focus:ring-[#513CC8]/20 focus:outline-none w-48 md:w-56" />
            </div>
            <button onClick={runAnalysis}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-1.5 hover:shadow-lg transition"
              style={{ background: '#513CC8' }}>
              <Lightbulb size={14} /> 研判
            </button>
          </div>
          {/* Quick codes */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {['600519', '000858', '300750', '002594', '601318'].map(code => (
              <button key={code} onClick={() => setStockCode(code)}
                className="px-2.5 py-1 rounded-lg text-[10px] border border-gray-200 text-gray-500 hover:border-[#513CC8] hover:text-[#513CC8] hover:bg-[#F0EDFA] transition">
                {code}
              </button>
            ))}
          </div>
        </div>

        {/* History Records */}
        {history.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1">
              <History size={12} className="text-gray-400" />
              <span className="text-[10px] text-gray-500 font-medium">历史研判记录</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {history.map((record, i) => (
                <HistoryCard key={i} record={record} onClick={() => loadHistory(record)} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==================== ANALYZING STATE ====================
  if (analyzing) {
    return (
      <div className="p-3 md:p-4 space-y-3" style={{ background: '#F8F9FC' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold gradient-text">大师研判</h2>
          <span className="text-xs font-bold" style={{ color: '#513CC8' }}>{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #513CC8, #6B5AD5)' }} />
        </div>
        <div className="glass-card p-3">
          <AnalysisSteps steps={steps} currentStep={currentStep} />
        </div>
        {/* Live voting preview */}
        {Object.keys(verdicts).length > 0 && (
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users size={12} style={{ color: '#513CC8' }} />
              <span className="text-[10px] font-medium text-gray-600">评审投票中...</span>
              <span className="text-[9px] text-gray-400">{Object.keys(verdicts).length}/65</span>
            </div>
            <div className="grid grid-cols-16 gap-0.5">
              {MASTERS.slice(0, 32).map(m => (
                <div key={m.id} className={`w-3 h-3 rounded-full transition-all ${
                  verdicts[m.id] === 'bullish' ? 'bg-red-400' : verdicts[m.id] === 'bearish' ? 'bg-green-400' : verdicts[m.id] === 'neutral' ? 'bg-gray-300' : 'bg-gray-100'
                }`} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==================== RESULT STATE (single screen) ====================
  return (
    <div className="p-2 md:p-3 space-y-2" style={{ background: '#F8F9FC' }}>
      {/* TOP: Stock Info + Score Rings */}
      <div className="glass-card p-2.5 md:p-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Left: Stock info */}
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm md:text-base font-bold text-gray-800">{result.stock_name || stockCode}</span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{stockCode}</span>
              </div>
              {result.target_price && (
                <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                  <span className="text-gray-400">目标价</span>
                  <span className="text-red-500">↑{result.target_price.bull || '—'}</span>
                  <span className="text-gray-600">{result.target_price.base || '—'}</span>
                  <span className="text-green-500">↓{result.target_price.bear || '—'}</span>
                </div>
              )}
            </div>
          </div>
          {/* Right: Score rings */}
          <div className="flex items-center gap-3">
            {/* Overall score ring */}
            <div className="relative flex flex-col items-center">
              <svg width={52} height={52} className="-rotate-90">
                <circle cx={26} cy={26} r={21} fill="none" stroke="#F3F4F6" strokeWidth={5} />
                <circle cx={26} cy={26} r={21} fill="none" stroke="#513CC8" strokeWidth={5}
                  strokeDasharray={`${(result.overall_score / 100) * 132} 132`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold" style={{ color: '#513CC8' }}>{result.overall_score}</span>
              </div>
              <span className="text-[8px] text-gray-400 mt-0.5">综合评分</span>
            </div>
            {/* Bull confidence ring */}
            <div className="relative flex flex-col items-center">
              <svg width={44} height={44} className="-rotate-90">
                <circle cx={22} cy={22} r={17} fill="none" stroke="#FEE2E2" strokeWidth={4} />
                <circle cx={22} cy={22} r={17} fill="none" stroke="#EF4444" strokeWidth={4}
                  strokeDasharray={`${((result.bull_count || 0) / 65) * 107} 107`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-red-500">{result.bull_count || 0}</span>
              </div>
              <span className="text-[8px] text-red-400 mt-0.5">看多</span>
            </div>
            {/* Bear confidence ring */}
            <div className="relative flex flex-col items-center">
              <svg width={44} height={44} className="-rotate-90">
                <circle cx={22} cy={22} r={17} fill="none" stroke="#DCFCE7" strokeWidth={4} />
                <circle cx={22} cy={22} r={17} fill="none" stroke="#22C55E" strokeWidth={4}
                  strokeDasharray={`${((result.bear_count || 0) / 65) * 107} 107`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-green-500">{result.bear_count || 0}</span>
              </div>
              <span className="text-[8px] text-green-400 mt-0.5">看空</span>
            </div>
            {/* Verdict text */}
            <div className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
              result.verdict === '看多' ? 'bg-red-50 text-red-600 border border-red-200' : 
              result.verdict === '看空' ? 'bg-green-50 text-green-600 border border-green-200' : 
              'bg-gray-50 text-gray-600 border border-gray-200'
            }`}>
              {result.verdict}
            </div>
            <button onClick={() => { setResult(null); setVerdicts({}); setTimeline([]) }}
              className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={14} /></button>
          </div>
        </div>
      </div>

      {/* MIDDLE 1: Core Conclusion */}
      <div className="glass-card px-3 py-2 bg-[#F8F6FF] border border-[#E8E0FF]">
        <p className="text-xs text-gray-700 text-center font-medium leading-relaxed">
          📋 {result.core_conclusion}
        </p>
      </div>

      {/* MIDDLE 2: 4-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {/* Radar Chart */}
        <div className="glass-card p-2">
          <h4 className="text-[9px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
            <BarChart3 size={10} style={{ color: '#513CC8' }} /> 多维度
          </h4>
          <div className="w-full max-w-[120px] mx-auto aspect-square">
            <RadarChart dimensions={result.dimensions || []} />
          </div>
          <div className="space-y-0.5 mt-1">
            {(result.dimensions || []).map((d, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[7px] text-gray-500 w-6 text-right">{d.name}</span>
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: d.score >= 70 ? '#EF4444' : d.score >= 50 ? '#F59E0B' : '#22C55E' }} />
                </div>
                <span className="text-[7px] font-bold text-gray-500 w-4">{d.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Thermometers */}
        <div className="glass-card p-2">
          <h4 className="text-[9px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
            <Activity size={10} style={{ color: '#513CC8' }} /> 情绪温度
          </h4>
          <div className="flex justify-around items-end py-2">
            {[
              { label: '情绪', key: '情绪' }, { label: '资金', key: '资金' }, { label: '风险', key: '风险' }
            ].map((t, i) => {
              const score = result.dimensions?.find(d => d.name === t.key)?.score || 50
              const color = score >= 70 ? '#EF4444' : score >= 40 ? '#F59E0B' : '#22C55E'
              return (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-4 h-20 rounded-full border border-gray-200 relative overflow-hidden bg-gray-50">
                    <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-1000" style={{ height: `${score}%`, background: color }} />
                  </div>
                  <span className="text-[8px] font-bold mt-0.5" style={{ color }}>{score}</span>
                  <span className="text-[7px] text-gray-400">{t.label}</span>
                </div>
              )
            })}
          </div>
          <div className="pt-1 border-t border-gray-100 text-center">
            <span className="text-[8px] text-gray-400">置信度 <b className="text-[#513CC8]">{result.confidence}%</b></span>
            <span className="text-[8px] text-gray-400 ml-2">周期 <b className="text-gray-600">{result.investment_horizon || '—'}</b></span>
          </div>
        </div>

        {/* Timeline */}
        <div className="glass-card p-2">
          <h4 className="text-[9px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
            <Clock size={10} style={{ color: '#513CC8' }} /> 决议过程
          </h4>
          <div className="relative pl-3 space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
            <div className="absolute left-1 top-0.5 bottom-0.5 w-px bg-gradient-to-b from-[#513CC8] to-gray-200" />
            {timeline.map((event, i) => (
              <div key={i} className="relative">
                <div className={`absolute -left-2 top-1 w-1.5 h-1.5 rounded-full ${
                  event.type === 'bullish' ? 'bg-red-500' : event.type === 'bearish' ? 'bg-green-500' : event.type === 'info' ? 'bg-[#513CC8]' : 'bg-gray-400'
                }`} />
                <p className="text-[8px] text-gray-600 leading-tight pl-1">{event.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Risks + Catalysts */}
        <div className="glass-card p-2">
          <div className="space-y-1.5">
            <div>
              <h4 className="text-[9px] font-semibold text-red-600 mb-0.5 flex items-center gap-0.5">
                <Shield size={9} /> 风险
              </h4>
              {(result.key_risks || []).map((risk, i) => (
                <p key={i} className="text-[8px] text-gray-600 leading-tight pl-2 border-l border-red-200 mb-0.5">{risk}</p>
              ))}
            </div>
            <div>
              <h4 className="text-[9px] font-semibold text-[#513CC8] mb-0.5 flex items-center gap-0.5">
                <Zap size={9} /> 催化剂
              </h4>
              {(result.catalysts || []).map((cat, i) => (
                <p key={i} className="text-[8px] text-gray-600 leading-tight pl-2 border-l border-[#513CC8]/30 mb-0.5">{cat}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM: 65 Masters Vote (3 columns, 8 per row) */}
      <div className="glass-card p-2 md:p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Users size={11} style={{ color: '#513CC8' }} />
          <span className="text-[9px] font-semibold text-gray-600">评审席 · 65位投资大师投票</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {/* Bull column */}
          <div className="rounded-lg p-1.5 bg-red-50/60 border border-red-100">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp size={9} className="text-red-500" />
              <span className="text-[8px] font-bold text-red-600">看多 {bullMasters.length}</span>
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {bullMasters.map(m => <MasterCard key={m.id} master={m} verdict="bullish" />)}
            </div>
          </div>
          {/* Neutral column */}
          <div className="rounded-lg p-1.5 bg-gray-50 border border-gray-100">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Minus size={9} className="text-gray-500" />
              <span className="text-[8px] font-bold text-gray-600">中性 {neutralMasters.length}</span>
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {neutralMasters.map(m => <MasterCard key={m.id} master={m} verdict="neutral" />)}
            </div>
          </div>
          {/* Bear column */}
          <div className="rounded-lg p-1.5 bg-green-50/60 border border-green-100">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingDown size={9} className="text-green-500" />
              <span className="text-[8px] font-bold text-green-600">看空 {bearMasters.length}</span>
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {bearMasters.map(m => <MasterCard key={m.id} master={m} verdict="bearish" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
