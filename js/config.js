import { SCREEN_WIDTH, SCREEN_HEIGHT, MENU_BUTTON_RECT, SAFE_AREA } from './render';

// 总关卡数
export const TOTAL_LEVELS = 600;

// 网格配置
export const GRID_COLS = 12;
export const GRID_ROWS = 10;
export const BRICK_PADDING = 2;

// 关卡选择页 - 网格布局（横屏模式：更多列，更少行）
export const LEVEL_GRID_COLS = 8;
export const LEVEL_GRID_ROWS = 3;
export const LEVELS_PER_PAGE = LEVEL_GRID_COLS * LEVEL_GRID_ROWS;

// 横屏左侧安全边距（动态计算）
// safeArea.left 表示屏幕左侧不可用区域（刘海/圆角），横屏时即为刘海宽度
const _safeLeft = SAFE_AREA.left || 0;
export const SAFE_LEFT = _safeLeft;

// 横屏右侧安全边距（胶囊按钮区域 + 刘海/圆角）
// 胶囊按钮在横屏模式下位于右上角，需要避开
const _safeRight = SCREEN_WIDTH - (SAFE_AREA.right || SCREEN_WIDTH);
const _menuSafeRight = MENU_BUTTON_RECT.width > 0 ? (SCREEN_WIDTH - MENU_BUTTON_RECT.left + 8) : 0;
export const SAFE_RIGHT = Math.max(_safeRight, _menuSafeRight);

// 屏幕适配比例（横屏模式：以高度为基准适配）
export const SCALE = SCREEN_HEIGHT / 375;

// ====== 游戏场景布局（横屏模式：左侧信息面板 + 中间游戏区 + 右侧技能） ======
export const STATUS_BAR_HEIGHT = 0;                        // 横屏无顶部状态栏
export const HUD_TOP_HEIGHT = 0;                           // 顶部不再有HUD（按钮分布在左右两侧）

// 左侧信息面板（分数 + 倒计时）
export const LEFT_PANEL_X = 12 * SCALE;                    // 左侧面板X位置
export const LEFT_PANEL_WIDTH = 85 * SCALE;                // 左侧面板宽度（按图2比例放大）

// 右侧技能面板（避开右上角微信胶囊菜单 + 容纳更大按钮）
export const RIGHT_PANEL_WIDTH = 80 * SCALE;               // 右侧面板宽度
export const RIGHT_PANEL_X = SCREEN_WIDTH - 12 * SCALE - RIGHT_PANEL_WIDTH;  // 右侧面板X位置

// 顶部返回按钮区域
export const BACK_BUTTON_R = 22 * SCALE;                   // 返回按钮半径

// 中间游戏区域（避开左右面板 + 顶部胶囊 + 底部留空给发射器）
// 砖块区域整体下移 20*SCALE：GAME_AREA_TOP 和 GAME_AREA_BOTTOM 同步下移
// 但 LAUNCH_Y（白球位置）保持原值不变（见下方 LAUNCH_Y 定义）
export const GAME_AREA_LEFT = LEFT_PANEL_X + LEFT_PANEL_WIDTH + 14 * SCALE;
export const GAME_AREA_RIGHT = RIGHT_PANEL_X - 14 * SCALE;
export const GAME_AREA_TOP = 36 * SCALE;                   // 原 16 → 36（下移 20*SCALE）
export const GAME_AREA_BOTTOM = SCREEN_HEIGHT - 30 * SCALE; // 原 -50 → -30（下移 20*SCALE）
export const GAME_AREA_WIDTH = GAME_AREA_RIGHT - GAME_AREA_LEFT;
export const GAME_AREA_HEIGHT = GAME_AREA_BOTTOM - GAME_AREA_TOP;

// 砖块尺寸（根据游戏区域和列数自动计算）
export const BRICK_GAP = 2 * SCALE;
export const BRICK_W = (GAME_AREA_WIDTH - (GRID_COLS + 1) * BRICK_GAP) / GRID_COLS;
// 砖块高度按 GRID_ROWS 行均分游戏区高度
export const BRICK_H = Math.min(BRICK_W, (GAME_AREA_HEIGHT - (GRID_ROWS + 1) * BRICK_GAP - 60 * SCALE) / GRID_ROWS);

// 砖块区域底部（用于绘制游戏边框，使白球落在边框外）
// = 第一行顶 + 总行数 * (砖块高 + 间距) + 一些缓冲
export const BRICK_AREA_BOTTOM = GAME_AREA_TOP + GRID_ROWS * (BRICK_H + BRICK_GAP) + 8 * SCALE;

// ====== 关卡目标 & 倒计时 ======
export const TARGET_SCORE = 300;                           // 目标分数（达到即过关）
export const LEVEL_TIME_LIMIT = 120;                       // 单关倒计时（秒），默认 2 分钟

// 发射点（白球位置 = 发射轨道线 Y 位置）
// 固定在屏幕底部上方 40*SCALE，不随 GAME_AREA_BOTTOM 变化
// 这样砖块区下移时，白球位置保持不动
export const LAUNCH_Y = SCREEN_HEIGHT - 40 * SCALE;

// 白色发射轨道线（限制白球横向移动范围）
// 居中放置，宽度 = 砖块区宽度的 80%
export const LAUNCH_BAR_HEIGHT = 5 * SCALE;
export const LAUNCH_BAR_WIDTH = (GAME_AREA_RIGHT - GAME_AREA_LEFT) * 0.8;
export const LAUNCH_BAR_X_LEFT = GAME_AREA_LEFT + ((GAME_AREA_RIGHT - GAME_AREA_LEFT) - LAUNCH_BAR_WIDTH) / 2;
export const LAUNCH_BAR_X_RIGHT = LAUNCH_BAR_X_LEFT + LAUNCH_BAR_WIDTH;

// 球配置
export const BALL_RADIUS = 6 * SCALE;
export const BALL_SPEED = 12 * SCALE;
export const BALL_LAUNCH_INTERVAL = 3;  // 帧间隔
export const BALL_TRAIL_LENGTH = 8;

// 加球道具
export const PICKUP_RADIUS = 10 * SCALE;

// 技能初始数量
export const LIGHTNING_INITIAL = 2;
export const MULTIBALL_INITIAL = 2;
export const MAX_ENERGY = 100;
export const ENERGY_PER_BRICK = 5;

// 砖块填充率
export const BRICK_FILL_RATE_MIN = 0.4;
export const BRICK_FILL_RATE_MAX = 0.7;
export const PICKUP_PER_ROW_MIN = 1;
export const PICKUP_PER_ROW_MAX = 2;

// 颜色配置（霓虹风格）
export const COLORS = {
  // 背景
  bgTop: '#0a0e27',
  bgMid: '#0c1435',
  bgBottom: '#0d0520',

  // 霓虹边框/发光
  neonBlue: '#00d4ff',
  neonCyan: '#00f5ff',
  neonGreen: '#39ff14',
  neonYellow: '#f0e130',
  neonOrange: '#ff6600',
  neonPink: '#ff1493',
  neonPurple: '#8b5cf6',
  neonRed: '#ff0044',

  // 游戏场景 - 砖块颜色梯度（按HP比例）
  brickColors: [
    { bg: '#8b1a1a', border: '#ff3333', glow: 'rgba(255,51,51,0.4)' },     // 深红(低HP)
    { bg: '#8b3a1a', border: '#ff6633', glow: 'rgba(255,102,51,0.4)' },    // 橙红
    { bg: '#6b1a4a', border: '#cc3388', glow: 'rgba(204,51,136,0.4)' },    // 玫红
    { bg: '#4a1a6b', border: '#8855cc', glow: 'rgba(136,85,204,0.5)' },    // 紫色
    { bg: '#2a1a7b', border: '#6644ee', glow: 'rgba(102,68,238,0.5)' },    // 蓝紫(高HP)
  ],

  // 关卡格子颜色（按行交替使用）
  levelColors: [
    { bg: '#1a6b1a', border: '#39ff14', glow: 'rgba(57,255,20,0.4)' },
    { bg: '#6b6b1a', border: '#f0e130', glow: 'rgba(240,225,48,0.4)' },
    { bg: '#1a4a6b', border: '#00d4ff', glow: 'rgba(0,212,255,0.4)' },
    { bg: '#6b1a4a', border: '#ff1493', glow: 'rgba(255,20,147,0.4)' },
    { bg: '#4a1a6b', border: '#8b5cf6', glow: 'rgba(139,92,246,0.4)' },
  ],

  // 锁定关卡
  lockedBg: '#1a1a2e',
  lockedBorder: '#333355',

  // 星星
  starActive: '#ffdd00',
  starInactive: '#333355',

  // 文字
  textWhite: '#ffffff',
  textGray: '#888899',

  // 底部导航栏
  navBg: '#0a0a1a',
  navActive: '#ff6600',
  navInactive: '#555577',

  // 按钮/技能
  btnRed: '#dc2626',
  btnGreen: '#22c55e',
  skillRed: '#cc1111',
  skillRedGlow: 'rgba(204,17,17,0.6)',
  energyBar: '#00d4ff',
  energyBarBg: '#1a1a3a',

  // 球
  ballColor: '#ffffff',
  ballGlow: 'rgba(255,255,255,0.6)',
  trailColor: 'rgba(180,120,255,0.5)',

  // 道具
  pickupColor: '#e0e0ff',
  pickupGlow: 'rgba(200,180,255,0.6)',
};
