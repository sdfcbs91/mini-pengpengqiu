const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

/**
 * 云函数：getUserInfo
 * 获取当前用户的 openid 和基本信息
 * 通过 cloudbase 的 getWXContext 获取 openid
 * 通过 openapi 获取手机号等（如需要可扩展）
 *
 * 返回：
 *   code: 0 成功
 *   openid: 用户唯一标识
 *   nickName: 用户昵称（从数据库读取，首次为空）
 *   avatarUrl: 用户头像（从数据库读取，首次为空）
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const unionid = wxContext.UNIONID || '';

  const db = cloud.database();
  const collection = db.collection('user_progress');

  try {
    // 查询已有用户记录
    const { data } = await collection.where({ _openid: openid }).get();

    if (data.length > 0) {
      const doc = data[0];
      return {
        code: 0,
        openid,
        unionid,
        nickName: (doc.userInfo && doc.userInfo.nickName) || '',
        avatarUrl: (doc.userInfo && doc.userInfo.avatarUrl) || '',
      };
    }

    // 新用户，创建初始记录
    await collection.add({
      data: {
        _openid: openid,
        userInfo: null,
        maxLevel: 1,
        levelProgress: null,
        lastLoginTime: db.serverDate(),
        createTime: db.serverDate(),
        updateCount: 0,
      },
    });

    return {
      code: 0,
      openid,
      unionid,
      nickName: '',
      avatarUrl: '',
    };
  } catch (err) {
    return {
      code: -1,
      msg: err.message || 'unknown error',
      openid,
    };
  }
};
