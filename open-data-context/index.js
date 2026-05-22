/**
 * 开放数据域 — 好友排行榜
 * 在子域 canvas 上渲染好友排行列表
 */

const sharedCanvas = wx.getSharedCanvas();
const ctx = sharedCanvas.getContext('2d');

let rankList = [];
let scrollY = 0;

// 监听主域消息
wx.onMessage((data) => {
  if (data.action === 'showRank') {
    fetchFriendRank();
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
 * 获取好友排行数据
 */
function fetchFriendRank() {
  wx.getFriendCloudStorage({
    keyList: ['maxLevel', 'totalStars'],
    success: (res) => {
      rankList = res.data || [];
      // 按 maxLevel 降序排列
      rankList.sort((a, b) => {
        const aLevel = getKVValue(a.KVDataList, 'maxLevel');
        const bLevel = getKVValue(b.KVDataList, 'maxLevel');
        if (bLevel !== aLevel) return bLevel - aLevel;
        return getKVValue(b.KVDataList, 'totalStars') - getKVValue(a.KVDataList, 'totalStars');
      });
      scrollY = 0;
      renderRank();
    },
    fail: () => {
      rankList = [];
      renderRank();
    },
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
  const dpr = w / 375; // 适配比例

  ctx.clearRect(0, 0, w, h);

  // 背景
  ctx.fillStyle = 'rgba(10, 14, 39, 0.95)';
  ctx.fillRect(0, 0, w, h);

  // 标题
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${18 * dpr}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('好友排行榜', w / 2, 30 * dpr);

  // 表头
  const headerY = 55 * dpr;
  ctx.fillStyle = '#888899';
  ctx.font = `${11 * dpr}px Arial`;
  ctx.textAlign = 'left';
  ctx.fillText('排名', 15 * dpr, headerY);
  ctx.fillText('玩家', 60 * dpr, headerY);
  ctx.textAlign = 'right';
  ctx.fillText('关卡', w - 80 * dpr, headerY);
  ctx.fillText('星星', w - 15 * dpr, headerY);

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
    ctx.fillText('暂无好友数据', w / 2, h / 2);
    return;
  }

  // 列表区域
  const listTop = 70 * dpr;
  const rowHeight = 50 * dpr;
  const maxVisible = Math.floor((h - listTop) / rowHeight);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, listTop, w, h - listTop);
  ctx.clip();

  rankList.forEach((friend, i) => {
    const y = listTop + i * rowHeight - scrollY;
    if (y + rowHeight < listTop || y > h) return;

    const maxLevel = getKVValue(friend.KVDataList, 'maxLevel');
    const totalStars = getKVValue(friend.KVDataList, 'totalStars');
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

    // 关卡数
    ctx.fillStyle = '#00d4ff';
    ctx.font = `bold ${13 * dpr}px Arial`;
    ctx.textAlign = 'right';
    ctx.fillText(`第${maxLevel}关`, w - 70 * dpr, y + rowHeight / 2);

    // 星星数
    ctx.fillStyle = '#ffdd00';
    ctx.fillText(`${totalStars}⭐`, w - 15 * dpr, y + rowHeight / 2);
  });

  ctx.restore();
}
