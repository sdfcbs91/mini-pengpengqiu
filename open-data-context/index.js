/**
 * 开放数据域 — 排行榜（支持分类：闯关/150球/星星）
 * 同时支持好友排行和群排行（有 shareTicket 时取群数据，否则取好友数据）
 */

const sharedCanvas = wx.getSharedCanvas();
const ctx = sharedCanvas.getContext('2d');

let rankList = [];
let scrollY = 0;
let rankTitle = '排行榜';
let rankCategory = 'level';  // 'level' | 'mode150' | 'stars'

// 分类配置
const CATEGORY_CONFIG = {
  level: {
    title: '闯关排名',
    sortKey: 'maxLevel',
    displayFn: (friend) => `第${getKVValue(friend.KVDataList, 'maxLevel')}关`,
    subFn: (friend) => `${getKVValue(friend.KVDataList, 'totalStars')}⭐`,
  },
  mode150: {
    title: '150球最高分',
    sortKey: 'mode150Best',
    displayFn: (friend) => `${getKVValue(friend.KVDataList, 'mode150Best')}分`,
    subFn: () => '',
  },
  stars: {
    title: '星星排名',
    sortKey: 'totalStars',
    displayFn: (friend) => `${getKVValue(friend.KVDataList, 'totalStars')}⭐`,
    subFn: (friend) => `第${getKVValue(friend.KVDataList, 'maxLevel')}关`,
  },
};

// 监听主域消息
wx.onMessage((data) => {
  if (data.action === 'showRankByCategory') {
    rankCategory = data.category || 'level';
    const cfg = CATEGORY_CONFIG[rankCategory] || CATEGORY_CONFIG.level;
    rankTitle = cfg.title;
    fetchRankData(data.shareTicket);
  } else if (data.action === 'showRank') {
    rankCategory = 'level';
    rankTitle = '闯关排名';
    fetchRankData('');
  } else if (data.action === 'showGroupRank') {
    rankCategory = 'level';
    rankTitle = '闯关排名';
    fetchRankData(data.shareTicket);
  } else if (data.action === 'hideRank') {
    rankList = [];
    scrollY = 0;
  } else if (data.action === 'scroll') {
    scrollY += data.deltaY || 0;
    scrollY = Math.max(0, scrollY);
    renderRank();
  }
});

/**
 * 获取排行数据（有 shareTicket 取群数据，否则取好友数据）
 */
function fetchRankData(shareTicket) {
  const keyList = ['maxLevel', 'totalStars', 'mode150Best'];
  const onSuccess = (res) => {
    rankList = res.data || [];
    sortRankList();
    scrollY = 0;
    renderRank();
  };
  const onFail = () => {
    rankList = [];
    renderRank();
  };

  if (shareTicket) {
    wx.getGroupCloudStorage({ shareTicket, keyList, success: onSuccess, fail: onFail });
  } else {
    wx.getFriendCloudStorage({ keyList, success: onSuccess, fail: onFail });
  }
}

/**
 * 按当前分类排序
 */
function sortRankList() {
  const cfg = CATEGORY_CONFIG[rankCategory] || CATEGORY_CONFIG.level;
  const sortKey = cfg.sortKey;
  rankList.sort((a, b) => {
    const av = getKVValue(a.KVDataList, sortKey);
    const bv = getKVValue(b.KVDataList, sortKey);
    if (bv !== av) return bv - av;
    // 次要排序：闯关排名时按星星，其他按关卡
    const subKey = sortKey === 'maxLevel' ? 'totalStars' : 'maxLevel';
    return getKVValue(b.KVDataList, subKey) - getKVValue(a.KVDataList, subKey);
  });
}

function getKVValue(list, key) {
  if (!list) return 0;
  const item = list.find(kv => kv.key === key);
  return item ? (parseInt(item.value) || 0) : 0;
}

/**
 * 渲染排行榜
 */
function renderRank() {
  const w = sharedCanvas.width;
  const h = sharedCanvas.height;
  const dpr = w / 375;
  const cfg = CATEGORY_CONFIG[rankCategory] || CATEGORY_CONFIG.level;

  ctx.clearRect(0, 0, w, h);

  // 背景
  ctx.fillStyle = 'rgba(10, 14, 39, 0.95)';
  ctx.fillRect(0, 0, w, h);

  // 标题
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${18 * dpr}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rankTitle, w / 2, 30 * dpr);

  // 表头
  const headerY = 55 * dpr;
  ctx.fillStyle = '#888899';
  ctx.font = `${11 * dpr}px Arial`;
  ctx.textAlign = 'left';
  ctx.fillText('排名', 15 * dpr, headerY);
  ctx.fillText('玩家', 60 * dpr, headerY);
  ctx.textAlign = 'right';
  ctx.fillText('成绩', w - 70 * dpr, headerY);

  // 分割线
  ctx.strokeStyle = 'rgba(100,150,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10 * dpr, 65 * dpr);
  ctx.lineTo(w - 10 * dpr, 65 * dpr);
  ctx.stroke();

  if (rankList.length === 0) {
    ctx.fillStyle = '#555577';
    ctx.font = `${14 * dpr}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('暂无数据', w / 2, h / 2);
    return;
  }

  // 列表区域
  const listTop = 70 * dpr;
  const rowHeight = 50 * dpr;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, listTop, w, h - listTop);
  ctx.clip();

  rankList.forEach((friend, i) => {
    const y = listTop + i * rowHeight - scrollY;
    if (y + rowHeight < listTop || y > h) return;

    const nickName = friend.nickname || '微信用户';
    const avatarUrl = friend.avatarUrl || '';

    // 交替背景
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(20,30,60,0.5)';
      ctx.fillRect(0, y, w, rowHeight);
    }

    // 前三名高亮
    const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
    ctx.fillStyle = i < 3 ? rankColors[i] : '#aaaacc';
    ctx.font = `bold ${14 * dpr}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, 30 * dpr, y + rowHeight / 2);

    // 头像（圆形裁剪）
    if (avatarUrl) {
      try {
        const img = wx.createImage();
        img.src = avatarUrl;
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(55 * dpr, y + rowHeight / 2, 15 * dpr, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, 40 * dpr, y + rowHeight / 2 - 15 * dpr, 30 * dpr, 30 * dpr);
          ctx.restore();
        };
      } catch (e) { /* ignore */ }
    }

    // 昵称
    ctx.fillStyle = '#ffffff';
    ctx.font = `${12 * dpr}px Arial`;
    ctx.textAlign = 'left';
    const displayName = nickName.length > 6 ? nickName.slice(0, 6) + '...' : nickName;
    ctx.fillText(displayName, 75 * dpr, y + rowHeight / 2);

    // 主成绩（按分类显示）
    ctx.fillStyle = '#00d4ff';
    ctx.font = `bold ${13 * dpr}px Arial`;
    ctx.textAlign = 'right';
    ctx.fillText(cfg.displayFn(friend), w - 15 * dpr, y + rowHeight / 2 - 6 * dpr);

    // 副信息
    const subText = cfg.subFn(friend);
    if (subText) {
      ctx.fillStyle = '#888899';
      ctx.font = `${10 * dpr}px Arial`;
      ctx.fillText(subText, w - 15 * dpr, y + rowHeight / 2 + 10 * dpr);
    }
  });

  ctx.restore();
}
