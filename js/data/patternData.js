/**
 * 预设图形数据配置（静态化）
 * 
 * 所有图形数据均为不可变常量，使用 Object.freeze 冻结以：
 * 1. 防止运行时意外修改
 * 2. 便于引擎优化（V8 对冻结对象有更好的内联缓存）
 * 3. 集中管理，方便后续维护和扩展
 * 
 * 共 3 类 32 个预设图形：
 * - ROW_PATTERNS: 10 个单行图形（用于每轮新增砖块行）
 * - MULTI_ROW_TEMPLATES: 10 个多行图形（用于关卡初始化布局）
 * - LEVEL_TEMPLATES: 12 个关卡模板（用于特定关卡的精心设计地形）
 */

// =====================================================================
// 一、单行图形（10 个）
// 每个数组是 col 索引（可用列范围 1~10）
// 用于每轮新增砖块行时随机选取的列分布模式
// =====================================================================
export const ROW_PATTERNS = Object.freeze([
    // ① 满行（一字横档）
    Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    // ② 左半行（左侧城墙）
    Object.freeze([1, 2, 3, 4, 5]),
    // ③ 右半行（右侧城墙）
    Object.freeze([6, 7, 8, 9, 10]),
    // ④ 中央块（中间一段连排）
    Object.freeze([3, 4, 5, 6, 7, 8]),
    // ⑤ 双侧夹击（左右各 2 列，中间走廊）
    Object.freeze([1, 2, 9, 10]),
    // ⑥ 梳齿（奇数列）
    Object.freeze([1, 3, 5, 7, 9]),
    // ⑦ 梳齿（偶数列）
    Object.freeze([2, 4, 6, 8, 10]),
    // ⑧ 中间双列开口（碗状）
    Object.freeze([1, 2, 3, 4, 5, 8, 9, 10]),
    // ⑨ 双小开口（W 形）
    Object.freeze([1, 2, 4, 5, 6, 7, 9, 10]),
    // ⑩ 阶梯（两端 + 中央）
    Object.freeze([1, 2, 5, 6, 9, 10]),
]);

// =====================================================================
// 二、多行图形模板（10 个）
// 每个模板是 5 行 × 10 列的二维数组（对应可用列 1~10）
// 0 = 空, 1 = 普通砖块
// 设计原则：所有图形左右对称、便于球弹跳穿越，围合度由低到高
// 用于关卡初始化时铺设初始砖块布局
// =====================================================================
export const MULTI_ROW_TEMPLATES = Object.freeze([
    // ① 实心方阵（满铺，最简单）
    Object.freeze([
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ]),
    // ② 回字形（外框包围空心）— 最经典的弹跳图形
    Object.freeze([
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
        Object.freeze([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
        Object.freeze([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ]),
    // ③ 双层回字（外框 + 内框）
    Object.freeze([
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
        Object.freeze([1, 0, 1, 1, 1, 1, 1, 1, 0, 1]),
        Object.freeze([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ]),
    // ④ 十字形（横竖中轴）— 球可在四个象限弹跳
    Object.freeze([
        Object.freeze([0, 0, 0, 0, 1, 1, 0, 0, 0, 0]),
        Object.freeze([0, 0, 0, 0, 1, 1, 0, 0, 0, 0]),
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        Object.freeze([0, 0, 0, 0, 1, 1, 0, 0, 0, 0]),
        Object.freeze([0, 0, 0, 0, 1, 1, 0, 0, 0, 0]),
    ]),
    // ⑤ T 字形（顶横 + 中竖）
    Object.freeze([
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        Object.freeze([0, 0, 0, 0, 1, 1, 0, 0, 0, 0]),
        Object.freeze([0, 0, 0, 0, 1, 1, 0, 0, 0, 0]),
        Object.freeze([0, 0, 0, 0, 1, 1, 0, 0, 0, 0]),
        Object.freeze([0, 0, 0, 0, 1, 1, 0, 0, 0, 0]),
    ]),
    // ⑥ H 字形（双侧 + 中央横档）
    Object.freeze([
        Object.freeze([1, 1, 0, 0, 0, 0, 0, 0, 1, 1]),
        Object.freeze([1, 1, 0, 0, 0, 0, 0, 0, 1, 1]),
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        Object.freeze([1, 1, 0, 0, 0, 0, 0, 0, 1, 1]),
        Object.freeze([1, 1, 0, 0, 0, 0, 0, 0, 1, 1]),
    ]),
    // ⑦ 双方块（左右两个小回字）
    Object.freeze([
        Object.freeze([1, 1, 1, 0, 0, 0, 0, 1, 1, 1]),
        Object.freeze([1, 0, 1, 0, 0, 0, 0, 1, 0, 1]),
        Object.freeze([1, 0, 1, 0, 0, 0, 0, 1, 0, 1]),
        Object.freeze([1, 0, 1, 0, 0, 0, 0, 1, 0, 1]),
        Object.freeze([1, 1, 1, 0, 0, 0, 0, 1, 1, 1]),
    ]),
    // ⑧ 漏斗（上宽下窄）— 引导球向下集中
    Object.freeze([
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        Object.freeze([0, 1, 1, 1, 1, 1, 1, 1, 1, 0]),
        Object.freeze([0, 0, 1, 1, 1, 1, 1, 1, 0, 0]),
        Object.freeze([0, 0, 0, 1, 1, 1, 1, 0, 0, 0]),
        Object.freeze([0, 0, 0, 0, 1, 1, 0, 0, 0, 0]),
    ]),
    // ⑨ 反漏斗（上窄下宽）— 球从底部反弹扩散
    Object.freeze([
        Object.freeze([0, 0, 0, 0, 1, 1, 0, 0, 0, 0]),
        Object.freeze([0, 0, 0, 1, 1, 1, 1, 0, 0, 0]),
        Object.freeze([0, 0, 1, 1, 1, 1, 1, 1, 0, 0]),
        Object.freeze([0, 1, 1, 1, 1, 1, 1, 1, 1, 0]),
        Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ]),
    // ⑩ 棋盘格（交错分布）— 球在间隙中蜿蜒
    Object.freeze([
        Object.freeze([1, 0, 1, 0, 1, 0, 1, 0, 1, 0]),
        Object.freeze([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]),
        Object.freeze([1, 0, 1, 0, 1, 0, 1, 0, 1, 0]),
        Object.freeze([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]),
        Object.freeze([1, 0, 1, 0, 1, 0, 1, 0, 1, 0]),
    ]),
]);

// =====================================================================
// 三、关卡模板（12 个）
// 每个模板是 9 行 × 7 列的地图（row0=空顶部弹跳区 + row1~8=砖块区）
// 0=空(通道), 1=普通砖块, 2=高HP砖块
// 每个模板保证至少1条贯通底部到顶部的路线
// 用于特定关卡（每5关）的精心设计地形
// =====================================================================
export const LEVEL_TEMPLATES = Object.freeze([
    // ① 金字塔：中央通道，从底部宽到顶部窄
    Object.freeze({
        name: '金字塔',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 0, 0, 1, 0, 0, 0]),
            Object.freeze([0, 0, 1, 0, 1, 0, 0]),
            Object.freeze([0, 1, 1, 0, 1, 1, 0]),
            Object.freeze([0, 1, 2, 0, 2, 1, 0]),
            Object.freeze([1, 1, 2, 0, 2, 1, 1]),
            Object.freeze([1, 2, 1, 0, 1, 2, 1]),
            Object.freeze([2, 1, 1, 0, 1, 1, 2]),
            Object.freeze([2, 2, 1, 0, 1, 2, 2]),
        ]),
    }),
    // ② 城墙：两段城墙中间留门洞
    Object.freeze({
        name: '城墙',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([2, 2, 2, 0, 2, 2, 2]),
            Object.freeze([2, 1, 1, 0, 1, 1, 2]),
            Object.freeze([1, 1, 0, 0, 0, 1, 1]),
            Object.freeze([1, 1, 1, 1, 1, 1, 1]),
            Object.freeze([2, 2, 0, 0, 0, 2, 2]),
            Object.freeze([1, 1, 0, 0, 0, 1, 1]),
            Object.freeze([1, 1, 1, 1, 1, 1, 1]),
            Object.freeze([2, 1, 1, 0, 1, 1, 2]),
        ]),
    }),
    // ③ 漏斗：上宽下窄，中间收缩后再展开
    Object.freeze({
        name: '漏斗',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 1, 1, 1, 1, 1, 1]),
            Object.freeze([1, 2, 1, 1, 1, 2, 1]),
            Object.freeze([0, 1, 2, 1, 2, 1, 0]),
            Object.freeze([0, 0, 1, 0, 1, 0, 0]),
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 1, 1, 0, 1, 1, 0]),
            Object.freeze([1, 1, 2, 0, 2, 1, 1]),
            Object.freeze([2, 2, 2, 0, 2, 2, 2]),
        ]),
    }),
    // ④ 螺旋阶梯：斜向交错，球需要Z字形上升
    Object.freeze({
        name: '螺旋阶梯',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 0, 0, 0, 1, 1, 1]),
            Object.freeze([0, 0, 0, 0, 0, 2, 1]),
            Object.freeze([1, 1, 1, 0, 0, 0, 0]),
            Object.freeze([1, 2, 0, 0, 0, 0, 0]),
            Object.freeze([0, 0, 0, 0, 1, 1, 1]),
            Object.freeze([0, 0, 0, 0, 0, 2, 1]),
            Object.freeze([1, 1, 1, 0, 0, 0, 0]),
            Object.freeze([1, 2, 0, 0, 0, 0, 0]),
        ]),
    }),
    // ⑤ 口袋陷阱：多个封闭口袋，入口小出口大
    Object.freeze({
        name: '口袋陷阱',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 0, 1, 1, 1, 0, 1]),
            Object.freeze([1, 0, 1, 0, 1, 0, 1]),
            Object.freeze([1, 0, 0, 0, 0, 0, 1]),
            Object.freeze([2, 2, 2, 0, 2, 2, 2]),
            Object.freeze([1, 0, 1, 0, 1, 0, 1]),
            Object.freeze([1, 0, 1, 0, 1, 0, 1]),
            Object.freeze([1, 0, 0, 0, 0, 0, 1]),
            Object.freeze([2, 2, 1, 0, 1, 2, 2]),
        ]),
    }),
    // ⑥ 棋盘密布：间隔排列，球从间隙穿梭
    Object.freeze({
        name: '棋盘密布',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 0, 2, 0, 2, 0, 1]),
            Object.freeze([0, 1, 0, 1, 0, 1, 0]),
            Object.freeze([2, 0, 1, 0, 1, 0, 2]),
            Object.freeze([0, 2, 0, 2, 0, 2, 0]),
            Object.freeze([1, 0, 2, 0, 2, 0, 1]),
            Object.freeze([0, 1, 0, 1, 0, 1, 0]),
            Object.freeze([2, 0, 1, 0, 1, 0, 2]),
            Object.freeze([0, 1, 0, 1, 0, 1, 0]),
        ]),
    }),
    // ⑦ 双翼展开：中央空，两侧翅膀对称
    Object.freeze({
        name: '双翼展开',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 1, 0, 0, 0, 1, 0]),
            Object.freeze([1, 2, 1, 0, 1, 2, 1]),
            Object.freeze([2, 1, 2, 0, 2, 1, 2]),
            Object.freeze([1, 2, 1, 0, 1, 2, 1]),
            Object.freeze([2, 1, 0, 0, 0, 1, 2]),
            Object.freeze([1, 0, 0, 0, 0, 0, 1]),
            Object.freeze([2, 1, 0, 0, 0, 1, 2]),
            Object.freeze([1, 2, 1, 0, 1, 2, 1]),
        ]),
    }),
    // ⑧ 回旋镖：弧形布局，球弹射后回旋消砖
    Object.freeze({
        name: '回旋镖',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 0, 1, 1, 1, 0, 0]),
            Object.freeze([0, 1, 2, 0, 2, 1, 0]),
            Object.freeze([1, 2, 0, 0, 0, 2, 1]),
            Object.freeze([1, 0, 0, 0, 0, 0, 1]),
            Object.freeze([2, 1, 0, 0, 0, 1, 2]),
            Object.freeze([0, 2, 1, 0, 1, 2, 0]),
            Object.freeze([0, 0, 2, 0, 2, 0, 0]),
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
        ]),
    }),
    // ⑨ 迷宫：多拐弯通道，考验角度
    Object.freeze({
        name: '迷宫',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 1, 0, 1, 1, 1, 1]),
            Object.freeze([0, 0, 0, 1, 0, 0, 0]),
            Object.freeze([1, 1, 1, 1, 0, 1, 1]),
            Object.freeze([0, 0, 0, 0, 0, 1, 0]),
            Object.freeze([1, 1, 1, 1, 1, 1, 0]),
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 2, 1, 1, 1, 2, 1]),
            Object.freeze([1, 0, 0, 0, 0, 0, 1]),
        ]),
    }),
    // ⑩ 心形：浪漫造型，中间通道
    Object.freeze({
        name: '心形',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 1, 0, 0, 0, 1, 0]),
            Object.freeze([1, 2, 1, 0, 1, 2, 1]),
            Object.freeze([1, 1, 2, 0, 2, 1, 1]),
            Object.freeze([1, 1, 1, 0, 1, 1, 1]),
            Object.freeze([0, 1, 2, 0, 2, 1, 0]),
            Object.freeze([0, 0, 1, 0, 1, 0, 0]),
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
        ]),
    }),
    // ⑪ 锯齿山脉：锯齿形顶部+底部密集
    Object.freeze({
        name: '锯齿山脉',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([2, 0, 0, 2, 0, 0, 2]),
            Object.freeze([1, 2, 0, 1, 0, 2, 1]),
            Object.freeze([1, 1, 0, 1, 0, 1, 1]),
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([1, 1, 1, 0, 1, 1, 1]),
            Object.freeze([2, 1, 2, 0, 2, 1, 2]),
            Object.freeze([1, 2, 1, 0, 1, 2, 1]),
            Object.freeze([2, 2, 2, 0, 2, 2, 2]),
        ]),
    }),
    // ⑫ 对角线：从左上到右下的对角线布局
    Object.freeze({
        name: '对角线',
        map: Object.freeze([
            Object.freeze([0, 0, 0, 0, 0, 0, 0]),
            Object.freeze([2, 1, 0, 0, 0, 0, 0]),
            Object.freeze([1, 2, 1, 0, 0, 0, 0]),
            Object.freeze([0, 1, 2, 1, 0, 0, 0]),
            Object.freeze([0, 0, 1, 2, 1, 0, 0]),
            Object.freeze([0, 0, 0, 1, 2, 1, 0]),
            Object.freeze([0, 0, 0, 0, 1, 2, 1]),
            Object.freeze([0, 0, 0, 0, 0, 1, 2]),
            Object.freeze([0, 0, 0, 0, 0, 0, 1]),
        ]),
    }),
]);

/** 单行图形总数 */
export const ROW_PATTERN_COUNT = ROW_PATTERNS.length;       // 10
/** 多行图形总数 */
export const MULTI_ROW_TEMPLATE_COUNT = MULTI_ROW_TEMPLATES.length; // 10
/** 关卡模板总数 */
export const LEVEL_TEMPLATE_COUNT = LEVEL_TEMPLATES.length; // 12
/** 所有预设图形总数 */
export const TOTAL_PATTERN_COUNT = ROW_PATTERN_COUNT + MULTI_ROW_TEMPLATE_COUNT + LEVEL_TEMPLATE_COUNT; // 32
