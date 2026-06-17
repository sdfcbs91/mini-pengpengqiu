/**
 * 开放数据域 — 排行榜（全屏渲染，样式参照 150 球历史记录列表）
 * 子域负责渲染所有 UI（标题、tab、列表、返回按钮）
 * 主域只做黑底 + drawImage + 点击检测
 */

const sharedCanvas = wx.getSharedCanvas();
const ctx = sharedCanvas.getContext('2d');

// 注意：sharedCanvas 的宽高只能在主域设置，子域设置无效（微信限制）
// 主域会在显示排行榜前设置好尺寸

let rankList = [];
let scrollY = 0;
let rankCategory = 'level';

const TABS = [
  { key: 'level', label: '闯关' },
  { key: 'mode150', label: '150球' },
  { key: 'stars', label: '星星数' },
];

// 分类配置
const CATEGORY_CONFIG = {
  level: {
    sortKey: 'maxLevel',
    col2: '关卡', col3: '星星',
    col2Fn: (f) => `第${gv(f, 'maxLevel')}关`,
    col3Fn: (f) => `${gv(f, 'totalStars')}⭐`,
  },
  mode150: {
    sortKey: 'mode150Best',
    col2: '最高分', col3: '关卡',
    col2Fn: (f) => `${gv(f, 'mode150Best')}分`,
    col3Fn: (f) => `第${gv(f, 'maxLevel')}关`,
  },
  stars: {
    sortKey: 'totalStars',
    col2: '星星', col3: '关卡',
    col2Fn: (f) => `${gv(f, 'totalStars')}⭐`,
    col3Fn: (f) => `第${gv(f, 'maxLevel')}关`,
  },
};

function gv(f, key) {
  if (!f || !f.KVDataList) return 0;
  const item = f.KVDataList.find(kv => kv.key === key);
  return item ? (parseInt(item.value) || 0) : 0;
}

// 监听主域消息
wx.onMessage((data) => {
  if (data.action === 'showRankByCategory') {
    rankCategory = data.category || 'level';
    fetchRankData(data.shareTicket);
  } else if (data.action === 'showRank') {
    rankCategory = 'level';
    fetchRankData('');
  } else if (data.action === 'showGroupRank') {
    rankCategory = 'level';
    fetchRankData(data.shareTicket);
  } else if (data.action === 'hideRank') {
    rankList = [];
    scrollY = 0;
    // 清屏
    ctx.clearRect(0, 0, sharedCanvas.width, sharedCanvas.height);
  } else if (data.action === 'scroll') {
    scrollY += data.deltaY || 0;
    scrollY = Math.max(0, scrollY);
    renderRank();
  }
});

function fetchRankData(shareTicket) {
  const keyList = ['maxLevel', 'totalStars', 'mode150Best'];
  const onSuccess = (res) => {
    console.log('[排行榜] 获取数据成功', res.data && res.data.length, res.data);
    rankList = res.data || [];
    sortRankList();
    scrollY = 0;
    renderRank();
  };
  const onFail = (err) => {
    console.error('[排行榜] 获取数据失败', err);
    rankList = [];
    renderRank();
  };
  try {
    if (shareTicket) {
      wx.getGroupCloudStorage({ shareTicket, keyList, success: onSuccess, fail: onFail });
    } else {
      wx.getFriendCloudStorage({ keyList, success: onSuccess, fail: onFail });
    }
  } catch (e) {
    console.error('[排行榜] 调用异常', e);
    rankList = [];
    renderRank();
  }
}

function sortRankList() {
  const cfg = CATEGORY_CONFIG[rankCategory] || CATEGORY_CONFIG.level;
  rankList.sort((a, b) => {
    const av = gv(a, cfg.sortKey);
    const bv = gv(b, cfg.sortKey);
    if (bv !== av) return bv - av;
    const sub = cfg.sortKey === 'maxLevel' ? 'totalStars' : 'maxLevel';
    return gv(b, sub) - gv(a, sub);
  });
}

/**
 * 全屏渲染排行榜（样式参照 150 球历史记录弹窗）
 * 使用 screenWidth/screenHeight 作为逻辑尺寸
 */
function renderRank() {
  const w = sharedCanvas.width;
  const h = sharedCanvas.height;
  // 适配比例：子域 canvas 物理像素 / 逻辑 375
  const info = wx.getSystemInfoSync ? wx.getSystemInfoSync() : { screenWidth: 375, screenHeight: 667 };
  const sw = info.screenWidth;
  const sh = info.screenHeight;
  const sx = w / sw;  // 物理像素/逻辑像素 比率（= DPR）
  const sy = h / sh;
  const s = Math.min(sx, sy);
  const cfg = CATEGORY_CONFIG[rankCategory] || CATEGORY_CONFIG.level;

  ctx.clearRect(0, 0, w, h);

  // 背景（与主域 bgTop 一致的深蓝黑）
  ctx.fillStyle = '#0a0e27';
  ctx.fillRect(0, 0, w, h);

  const centerX = w / 2;

  // ===== 标题 =====
  const topY = 30 * s;
  ctx.fillStyle = '#4499cc';
  ctx.font = `bold ${20 * s}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('排行榜', centerX, topY);

  // ===== Tab =====
  const tabW = 72 * s;
  const tabH = 28 * s;
  const tabGap = 8 * s;
  const totalTabW = TABS.length * tabW + (TABS.length - 1) * tabGap;
  const tabStartX = centerX - totalTabW / 2;
  const tabY = 60 * s;

  TABS.forEach((tab, i) => {
    const tx = tabStartX + i * (tabW + tabGap);
    const active = rankCategory === tab.key;
    ctx.fillStyle = active ? '#4499cc' : 'rgba(30,40,70,0.8)';
    ctx.fillRect(tx, tabY, tabW, tabH);
    ctx.strokeStyle = '#4499cc';
    ctx.lineWidth = 1;
    ctx.strokeRect(tx, tabY, tabW, tabH);
    ctx.fillStyle = active ? '#ffffff' : '#888899';
    ctx.font = `bold ${12 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tab.label, tx + tabW / 2, tabY + tabH / 2);
  });

  // ===== 表头（参照历史记录样式） =====
  const headerY = tabY + tabH + 20 * s;
  const tableW = 280 * s;
  const tableLeft = (w - tableW) / 2;
  const col1X = tableLeft;
  const col2X = tableLeft + 30 * s;
  const col3X = tableLeft + 170 * s;
  const col4X = tableLeft + 230 * s;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#4499cc';
  ctx.font = `bold ${11 * s}px Arial`;
  ctx.textBaseline = 'middle';
  ctx.fillText('#', col1X, headerY);
  ctx.fillText('玩家', col2X, headerY);
  ctx.fillText(cfg.col2, col3X, headerY);
  ctx.fillText(cfg.col3, col4X, headerY);

  // 分隔线
  ctx.strokeStyle = 'rgba(68,153,204,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tableLeft, headerY + 12 * s);
  ctx.lineTo(tableLeft + tableW, headerY + 12 * s);
  ctx.stroke();

  // ===== 返回按钮 =====
  const btnW = 120 * s;
  const btnH = 40 * s;
  const btnY = h - 70 * s;
  ctx.strokeStyle = '#4499cc';
  ctx.lineWidth = 2;
  ctx.strokeRect(centerX - btnW / 2, btnY - btnH / 2, btnW, btnH);
  ctx.fillStyle = '#4499cc';
  ctx.font = `bold ${14 * s}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('返回', centerX, btnY);

  // ===== 数据列表（参照历史记录样式） =====
  if (rankList.length === 0) {
    ctx.fillStyle = '#888888';
    ctx.font = `${14 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('暂无数据', centerX, h / 2);
    return;
  }

  const listTop = headerY + 20 * s;
  const listBottom = btnY - btnH / 2 - 10 * s;
  const listHeight = listBottom - listTop;
  const rowH = 32 * s;

  // 裁剪列表区域
  ctx.save();
  ctx.beginPath();
  ctx.rect(tableLeft - 5 * s, listTop, tableW + 10 * s, listHeight);
  ctx.clip();

  for (let i = 0; i < rankList.length; i++) {
    const friend = rankList[i];
    const rowY = listTop + i * rowH + 10 * s - scrollY;
    if (rowY + rowH < listTop || rowY - rowH > listBottom) continue;

    const nickName = friend.nickname || friend.nickName || '微信用户';
    const displayName = nickName.length > 6 ? nickName.slice(0, 6) + '..' : nickName;

    // 排名颜色
    const rankColors = ['#ffdd00', '#c0c0c0', '#cd7f32'];
    ctx.fillStyle = i < 3 ? rankColors[i] : '#ffffff';
    ctx.font = `bold ${12 * s}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, col1X, rowY);

    // 玩家昵称
    ctx.fillStyle = '#ffffff';
    ctx.font = `${12 * s}px Arial`;
    ctx.fillText(displayName, col2X, rowY);

    // 成绩1
    ctx.fillStyle = '#aaddff';
    ctx.font = `${11 * s}px Arial`;
    ctx.fillText(cfg.col2Fn(friend), col3X, rowY);

    // 成绩2
    ctx.fillStyle = '#888888';
    ctx.font = `${10 * s}px Arial`;
    ctx.fillText(cfg.col3Fn(friend), col4X, rowY);
  }

  ctx.restore();

  // 滚动条（内容超出时）
  const totalH = rankList.length * rowH;
  if (totalH > listHeight) {
    const barH = Math.max(10 * s, listHeight * (listHeight / totalH));
    const barY = listTop + (scrollY / (totalH - listHeight)) * (listHeight - barH);
    ctx.fillStyle = 'rgba(68,153,204,0.4)';
    ctx.fillRect(tableLeft + tableW + 2 * s, barY, 3 * s, barH);
  }
}
