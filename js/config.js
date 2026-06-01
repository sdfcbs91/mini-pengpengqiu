import { SCREEN_WIDTH, SCREEN_HEIGHT } from './render';

// 总关卡数
export const TOTAL_LEVELS = 600;

// 网格配置
export const GRID_COLS = 7;
export const BRICK_PADDING = 2;

// 关卡选择页 - 网格布局（横屏模式：更多列，更少行）
export const LEVEL_GRID_COLS = 8;
export const LEVEL_GRID_ROWS = 4;
export const LEVELS_PER_PAGE = LEVEL_GRID_COLS * LEVEL_GRID_ROWS;

// 屏幕适配比例（横屏模式：以高度为基准适配）
export const SCALE = SCREEN_HEIGHT / 375;

// ====== 游戏场景布局（横屏模式） ======
export const STATUS_BAR_HEIGHT = 0;                        // 横屏无顶部状态栏
export const HUD_TOP_HEIGHT = 36 * SCALE;                  // 顶部HUD高度（一行按钮）
export const GAME_AREA_LEFT = 8 * SCALE;                   // 游戏区域左边距
export const GAME_AREA_RIGHT = SCREEN_WIDTH - 8 * SCALE;
export const GAME_AREA_TOP = HUD_TOP_HEIGHT + 6 * SCALE;
export const GAME_AREA_BOTTOM = SCREEN_HEIGHT - 16 * SCALE;
export const GAME_AREA_WIDTH = GAME_AREA_RIGHT - GAME_AREA_LEFT;
export const GAME_AREA_HEIGHT = GAME_AREA_BOTTOM - GAME_AREA_TOP;

// 砖块尺寸（根据游戏区域和列数自动计算）
export const BRICK_GAP = 2 * SCALE;
export const BRICK_W = (GAME_AREA_WIDTH - (GRID_COLS + 1) * BRICK_GAP) / GRID_COLS;
// 横屏模式：砖块高度按游戏区域高度计算，确保能显示足够多行（约10行可见）
export const BRICK_H = Math.min(BRICK_W, (GAME_AREA_HEIGHT - 11 * BRICK_GAP) / 10);

// 发射点
export const LAUNCH_Y = GAME_AREA_BOTTOM - 10 * SCALE;

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
