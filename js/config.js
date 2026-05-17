import { SCREEN_WIDTH } from './render';

// 总关卡数
export const TOTAL_LEVELS = 200;

// 网格配置
export const GRID_COLS = 7;
export const BRICK_PADDING = 2;

// 关卡选择页 - 网格布局
export const LEVEL_GRID_COLS = 5;
export const LEVEL_GRID_ROWS = 4;
export const LEVELS_PER_PAGE = LEVEL_GRID_COLS * LEVEL_GRID_ROWS;

// 颜色配置（霓虹风格）
export const COLORS = {
  // 背景
  bgTop: '#0a0e27',
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

  // 关卡格子颜色（按行交替使用）
  levelColors: [
    { bg: '#1a6b1a', border: '#39ff14', glow: 'rgba(57,255,20,0.4)' },   // 绿色
    { bg: '#6b6b1a', border: '#f0e130', glow: 'rgba(240,225,48,0.4)' },   // 黄色
    { bg: '#1a4a6b', border: '#00d4ff', glow: 'rgba(0,212,255,0.4)' },    // 蓝色
    { bg: '#6b1a4a', border: '#ff1493', glow: 'rgba(255,20,147,0.4)' },   // 粉色
    { bg: '#4a1a6b', border: '#8b5cf6', glow: 'rgba(139,92,246,0.4)' },   // 紫色
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

  // 按钮
  btnRed: '#dc2626',
  btnGreen: '#22c55e',
};

// 屏幕适配比例
export const SCALE = SCREEN_WIDTH / 375;
