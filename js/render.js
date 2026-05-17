GameGlobal.canvas = wx.createCanvas();

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();

// 设备像素比（高清屏适配核心）
const dpr = windowInfo.pixelRatio || 2;

// 逻辑尺寸（所有游戏坐标基于此）
export const SCREEN_WIDTH = windowInfo.screenWidth;
export const SCREEN_HEIGHT = windowInfo.screenHeight;

// canvas 设为物理像素尺寸，绘制更清晰
canvas.width = SCREEN_WIDTH * dpr;
canvas.height = SCREEN_HEIGHT * dpr;

// 导出 dpr 供其他模块使用
export const DPR = dpr;
