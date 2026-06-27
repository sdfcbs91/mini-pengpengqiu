/**
 * 预设图形数据配置（静态化）
 *
 * 所有图形数据均为不可变常量，使用 Object.freeze 冻结以：
 * 1. 防止运行时意外修改
 * 2. 便于引擎优化（V8 对冻结对象有更好的内联缓存）
 * 3. 集中管理，方便后续维护和扩展
 *
 * 适配网格：GRID_COLS = 8（可用列 1~6，共 6 列）、GRID_ROWS = 8（行 0~7，第 0 行为顶部空弹跳区）
 *
 * 共 3 类预设图形：
 * - ROW_PATTERNS: 单行图形（用于每轮新增砖块行）
 * - MULTI_ROW_TEMPLATES: 多行图形（用于关卡初始化布局，6 列宽）
 * - LEVEL_TEMPLATES: 关卡模板（用于特定关卡的精心设计地形，6 列 × 8 行）
 */

// =====================================================================
// 一、单行图形（10 个）
// 每个数组是 col 索引（可用列范围 1~6）
// 用于每轮新增砖块行时随机选取的列分布模式
// =====================================================================
export const ROW_PATTERNS = Object.freeze([
    // ① 满行（一字横档）
    Object.freeze([1, 2, 3, 4, 5, 6]),
    // ② 左半行（左侧城墙）
    Object.freeze([1, 2, 3]),
    // ③ 右半行（右侧城墙）
    Object.freeze([4, 5, 6]),
    // ④ 中央块（中间一段连排）
    Object.freeze([2, 3, 4, 5]),
    // ⑤ 双侧夹击（左右各 2 列，中间走廊）
    Object.freeze([1, 2, 5, 6]),
    // ⑥ 梳齿（奇数列）
    Object.freeze([1, 3, 5]),
    // ⑦ 梳齿（偶数列）
    Object.freeze([2, 4, 6]),
    // ⑧ 中间单开口（碗状，第4列开口）
    Object.freeze([1, 2, 3, 5, 6]),
    // ⑨ 双小开口（W 形，第2、5列开口）
    Object.freeze([1, 3, 4, 6]),
    // ⑩ 阶梯（间隔分布）
    Object.freeze([1, 2, 4, 6]),
]);

// =====================================================================
// 二、多行图形模板（10 个）
// 每个模板为 6 列宽（对应可用列 1~6），4~5 行
// 0 = 空, 1 = 普通砖块
// 设计原则：左右对称、便于球弹跳穿越
// 用于关卡初始化时铺设初始砖块布局
// =====================================================================
export const MULTI_ROW_TEMPLATES = Object.freeze([
    // ① 实心方阵（满铺，最简单）
    Object.freeze([
        Object.freeze([1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1]),
    ]),
    // ② 回字形（外框包围空心）
    Object.freeze([
        Object.freeze([1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 0, 0, 0, 0, 1]),
        Object.freeze([1, 0, 0, 0, 0, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1]),
    ]),
    // ③ 双层回字（外框 + 内框）
    Object.freeze([
        Object.freeze([1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 0, 0, 0, 0, 1]),
        Object.freeze([1, 0, 1, 1, 0, 1]),
        Object.freeze([1, 0, 0, 0, 0, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1]),
    ]),
    // ④ 十字形（横竖中轴）
    Object.freeze([
        Object.freeze([0, 0, 1, 1, 0, 0]),
        Object.freeze([0, 0, 1, 1, 0, 0]),
        Object.freeze([1, 1, 1, 1, 1, 1]),
        Object.freeze([0, 0, 1, 1, 0, 0]),
        Object.freeze([0, 0, 1, 1, 0, 0]),
    ]),
    // ⑤ T 字形（顶横 + 中竖）
    Object.freeze([
        Object.freeze([1, 1, 1, 1, 1, 1]),
        Object.freeze([0, 0, 1, 1, 0, 0]),
        Object.freeze([0, 0, 1, 1, 0, 0]),
        Object.freeze([0, 0, 1, 1, 0, 0]),
        Object.freeze([0, 0, 1, 1, 0, 0]),
    ]),
    // ⑥ H 字形（双侧 + 中央横档）
    Object.freeze([
        Object.freeze([1, 1, 0, 0, 1, 1]),
        Object.freeze([1, 1, 0, 0, 1, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 1, 0, 0, 1, 1]),
        Object.freeze([1, 1, 0, 0, 1, 1]),
    ]),
    // ⑦ 双方块（左右两个小块）
    Object.freeze([
        Object.freeze([1, 1, 0, 0, 1, 1]),
        Object.freeze([1, 0, 0, 0, 0, 1]),
        Object.freeze([1, 0, 0, 0, 0, 1]),
        Object.freeze([1, 1, 0, 0, 1, 1]),
    ]),
    // ⑧ 漏斗（上宽下窄）
    Object.freeze([
        Object.freeze([1, 1, 1, 1, 1, 1]),
        Object.freeze([0, 1, 1, 1, 1, 0]),
        Object.freeze([0, 0, 1, 1, 0, 0]),
        Object.freeze([0, 0, 1, 1, 0, 0]),
    ]),
    // ⑨ 反漏斗（上窄下宽）
    Object.freeze([
        Object.freeze([0, 0, 1, 1, 0, 0]),
        Object.freeze([0, 0, 1, 1, 0, 0]),
        Object.freeze([0, 1, 1, 1, 1, 0]),
        Object.freeze([1, 1, 1, 1, 1, 1]),
    ]),
    // ⑩ 棋盘格（交错分布）
    Object.freeze([
        Object.freeze([1, 0, 1, 0, 1, 0]),
        Object.freeze([0, 1, 0, 1, 0, 1]),
        Object.freeze([1, 0, 1, 0, 1, 0]),
        Object.freeze([0, 1, 0, 1, 0, 1]),
        Object.freeze([1, 0, 1, 0, 1, 0]),
    ]),
]);

// =====================================================================
// 三、关卡模板（12 个）
// 每个模板是 8 行 × 6 列的地图（row0=空顶部弹跳区 + row1~7=砖块区）
// 0=空(通道), 1=普通砖块, 2=高HP砖块
// 用于特定关卡（每5关）的精心设计地形
// =====================================================================
export const LEVEL_TEMPLATES = Object.freeze([
    // ① 金字塔：中央通道（第2列），向下变宽
    Object.freeze({
        name: '金字塔',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 0, 0, 1, 0, 0]),
            Object.freeze([0, 1, 0, 1, 1, 0]),
            Object.freeze([0, 1, 0, 1, 1, 0]),
            Object.freeze([1, 1, 0, 2, 2, 1]),
            Object.freeze([1, 2, 0, 2, 1, 1]),
            Object.freeze([2, 1, 0, 1, 2, 1]),
            Object.freeze([2, 2, 0, 1, 2, 2]),
        ]),
    }),
    // ② 城墙：两侧城墙，中央门洞（第2、3列）
    Object.freeze({
        name: '城墙',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([2, 2, 0, 0, 2, 2]),
            Object.freeze([2, 1, 0, 0, 1, 2]),
            Object.freeze([1, 1, 0, 0, 1, 1]),
            Object.freeze([1, 1, 0, 0, 1, 1]),
            Object.freeze([2, 2, 0, 0, 2, 2]),
            Object.freeze([1, 1, 0, 0, 1, 1]),
            Object.freeze([1, 1, 0, 0, 1, 1]),
        ]),
    }),
    // ③ 漏斗：上宽下窄再展开
    Object.freeze({
        name: '漏斗',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 1, 1, 1, 1, 1]),
            Object.freeze([0, 1, 2, 2, 1, 0]),
            Object.freeze([0, 0, 1, 1, 0, 0]),
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 1, 1, 1, 1, 0]),
            Object.freeze([1, 1, 2, 2, 1, 1]),
            Object.freeze([2, 2, 1, 1, 2, 2]),
        ]),
    }),
    // ④ 螺旋阶梯：斜向交错
    Object.freeze({
        name: '螺旋阶梯',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 0, 1, 1, 1, 1]),
            Object.freeze([0, 0, 0, 1, 2, 1]),
            Object.freeze([1, 1, 1, 1, 0, 0]),
            Object.freeze([2, 1, 1, 0, 0, 0]),
            Object.freeze([0, 0, 1, 1, 1, 1]),
            Object.freeze([0, 0, 0, 1, 2, 1]),
            Object.freeze([1, 1, 1, 1, 0, 0]),
        ]),
    }),
    // ⑤ 口袋陷阱：多个封闭口袋
    Object.freeze({
        name: '口袋陷阱',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 0, 1, 1, 0, 1]),
            Object.freeze([1, 0, 0, 0, 0, 1]),
            Object.freeze([2, 2, 0, 0, 2, 2]),
            Object.freeze([1, 0, 0, 0, 0, 1]),
            Object.freeze([1, 0, 1, 1, 0, 1]),
            Object.freeze([1, 0, 0, 0, 0, 1]),
            Object.freeze([2, 2, 1, 1, 2, 2]),
        ]),
    }),
    // ⑥ 棋盘密布：间隔排列
    Object.freeze({
        name: '棋盘密布',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 0, 2, 0, 2, 0]),
            Object.freeze([0, 1, 0, 1, 0, 1]),
            Object.freeze([2, 0, 1, 0, 1, 0]),
            Object.freeze([0, 2, 0, 2, 0, 2]),
            Object.freeze([1, 0, 2, 0, 2, 0]),
            Object.freeze([0, 1, 0, 1, 0, 1]),
            Object.freeze([2, 0, 1, 0, 1, 0]),
        ]),
    }),
    // ⑦ 双翼展开：中央空，两侧对称
    Object.freeze({
        name: '双翼展开',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 1, 0, 0, 1, 0]),
            Object.freeze([1, 2, 0, 0, 2, 1]),
            Object.freeze([2, 1, 0, 0, 1, 2]),
            Object.freeze([1, 2, 0, 0, 2, 1]),
            Object.freeze([2, 1, 0, 0, 1, 2]),
            Object.freeze([1, 0, 0, 0, 0, 1]),
            Object.freeze([2, 1, 0, 0, 1, 2]),
        ]),
    }),
    // ⑧ 回旋镖：弧形布局
    Object.freeze({
        name: '回旋镖',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 1, 1, 1, 1, 0]),
            Object.freeze([1, 2, 0, 0, 2, 1]),
            Object.freeze([1, 2, 0, 0, 2, 1]),
            Object.freeze([2, 1, 0, 0, 1, 2]),
            Object.freeze([1, 2, 0, 0, 2, 1]),
            Object.freeze([0, 1, 2, 2, 1, 0]),
            Object.freeze([0, 0, 1, 1, 0, 0]),
        ]),
    }),
    // ⑨ 迷宫：多拐弯通道
    Object.freeze({
        name: '迷宫',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 1, 0, 1, 1, 1]),
            Object.freeze([0, 0, 0, 1, 0, 0]),
            Object.freeze([1, 1, 1, 1, 0, 1]),
            Object.freeze([0, 0, 0, 0, 0, 1]),
            Object.freeze([1, 1, 1, 1, 1, 0]),
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 2, 1, 1, 2, 1]),
        ]),
    }),
    // ⑩ 心形：浪漫造型，中间通道
    Object.freeze({
        name: '心形',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 1, 0, 0, 1, 0]),
            Object.freeze([1, 2, 1, 1, 2, 1]),
            Object.freeze([1, 1, 2, 2, 1, 1]),
            Object.freeze([1, 1, 1, 1, 1, 1]),
            Object.freeze([0, 1, 2, 2, 1, 0]),
            Object.freeze([0, 0, 1, 1, 0, 0]),
            Object.freeze([0, 0, 0, 0, 0, 0]),
        ]),
    }),
    // ⑪ 锯齿山脉：锯齿形顶部 + 底部密集
    Object.freeze({
        name: '锯齿山脉',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([2, 0, 0, 2, 0, 0]),
            Object.freeze([1, 2, 0, 1, 0, 2]),
            Object.freeze([1, 1, 0, 1, 0, 1]),
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 1, 1, 0, 1, 1]),
            Object.freeze([2, 1, 2, 0, 2, 1]),
            Object.freeze([1, 2, 1, 0, 1, 2]),
        ]),
    }),
    // ⑫ 对角线：加粗的左上到右下对角线带
    Object.freeze({
        name: '对角线',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0]),
            Object.freeze([2, 1, 1, 0, 0, 0]),
            Object.freeze([1, 2, 1, 0, 0, 0]),
            Object.freeze([1, 1, 2, 1, 0, 0]),
            Object.freeze([0, 1, 1, 2, 1, 0]),
            Object.freeze([0, 0, 1, 1, 2, 1]),
            Object.freeze([0, 0, 0, 1, 1, 2]),
            Object.freeze([0, 0, 0, 0, 1, 1]),
        ]),
    }),
]);

/**
 * 多行图形模板名称（与 MULTI_ROW_TEMPLATES 一一对应，用于关卡地图名称记录）
 */
export const MULTI_ROW_TEMPLATE_NAMES = Object.freeze([
    '实心方阵', // ①
    '回字形',   // ②
    '双层回字', // ③
    '十字形',   // ④
    'T字形',    // ⑤
    'H字形',    // ⑥
    '双方块',   // ⑦
    '漏斗',     // ⑧
    '反漏斗',   // ⑨
    '棋盘格',   // ⑩
]);

/** 单行图形总数 */
export const ROW_PATTERN_COUNT = ROW_PATTERNS.length;       // 10
/** 多行图形总数 */
export const MULTI_ROW_TEMPLATE_COUNT = MULTI_ROW_TEMPLATES.length; // 10
/** 关卡模板总数 */
export const LEVEL_TEMPLATE_COUNT = LEVEL_TEMPLATES.length; // 12
/** 所有预设图形总数 */
export const TOTAL_PATTERN_COUNT = ROW_PATTERN_COUNT + MULTI_ROW_TEMPLATE_COUNT + LEVEL_TEMPLATE_COUNT; // 32
