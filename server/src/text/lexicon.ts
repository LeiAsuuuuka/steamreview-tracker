// Word lists for Simplified Chinese game reviews. Extend these as new slang shows up.

/** Extra entries for jieba so game terms stay whole. */
export const GAME_DICT = [
  '掉帧', '卡顿', '闪退', '黑屏', '掉线', '延迟', '帧数', '帧率', '优化', '服务器', '外挂', '联机',
  '存档', '读档', '手感', '打击感', '配乐', '音乐', '剧情', '画风', '画面', '美术', '美术风格', '画质',
  'Boss战', 'boss战', 'Boss设计', 'boss设计', '新手引导', '新手教程', '平衡性', '数值', '爆率', '掉率',
  '太肝', '肝度', '很肝', '氪金', '微氪', '白嫖', '劝退', '上头', '耐玩', '重复度', '可玩性', '性价比',
  '汉化', '机翻', '翻译', '本地化', '中文', '配音', '主线', '支线', '开放世界', '地图', '关卡', '难度',
  '抽卡', '皮肤', '付费', '内购', '退款', '史低', '打折', '首发', '更新', '补丁', '版本', '新版本',
  '新武器', '武器', '祝福', '技能', '角色', '队友', '匹配', '排位', '多人', '单机', '手柄', '键鼠',
  '好评', '差评', '神作', '粪作', '佳作', '玩法', '机制', '操作', '流畅', '丝滑', 'bug', 'BUG',
  '空气墙', '一周目', '二周目', '多周目', '类魂', '魂类', '魂like', '受苦', '肉鸽', '跑图', '视角', '锁定',
  '黑猴', '国产', '国产游戏', '交互', '引导', '加载', '读条', '存档点', '传送点', '收集', '成就',
];

/** Single characters that carry meaning in game reviews and should not be dropped. */
export const ALLOWED_SINGLE = new Set(['肝', '卡', '氪', '菜', '难', '爽', '贵', '香', '坑']);

const CHINESE_STOP = `
的 了 是 在 我 有 和 就 不 人 都 一 一个 上 也 很 到 说 要 去 你 会 着 没有 看 好 自己 这 那 他 她 它 们
我们 你们 他们 她们 它们 这个 那个 这些 那些 这样 那样 这么 那么 什么 怎么 为什么 哪 哪里 哪个 谁
还是 还 就是 但是 但 而且 并且 或者 如果 因为 所以 虽然 然后 而 并 及 与 跟 对 对于 把 被 让 给 从 向
以 以及 之 之后 之前 以后 以前 时候 时 现在 已经 曾经 一直 一下 一些 一点 有点 有些 一样 一般 一定
可以 可能 能 能够 应该 需要 想 觉得 认为 知道 感觉 发现 出来 起来 下去 过来 过去 东西 地方 事情
真的 真是 确实 其实 当然 简直 非常 特别 比较 十分 太 最 更 越 越来越 挺 蛮 超 超级 相当 极其 实在
啊 吧 呢 吗 哦 哈 哈哈 哈哈哈 嗯 呀 啦 嘛 呗 哇 噢 唉 诶 额 emm 嘿
又 再 才 只 只是 只有 不过 不是 没 没什么 不会 不能 不要 不用 别 无 非 否 并不 还有 还要 而已
多 少 大 小 新 老 好的 很多 许多 所有 每 每个 各种 其他 其它 别的 另外 之类 等 等等 方面 部分
个 次 些 点 种 样 下 里 中 内 外 前 后 左右 之间 本 该 此 其 所 为 于 上面 下面 里面 后面 前面
结果 第一次 只能 一把 要死 上次 这次 每次 每场 尤其 甚至 而是 一边 一起 直接 主要 稍微 有时 有时候 经常 总是 终于 依然 依旧
第一 第二 第三 一次 两 两个 几 几个 半 全 整个 完全 根本 基本 基本上 总之 总的来说 反正 毕竟
游戏 这游戏 这款 这款游戏 本作 作品 玩 玩家 好玩 推荐 不推荐 值得 小时 时间 一款 个人 大家 朋友 体验 感受
`;

const ENGLISH_STOP = `
a an the and or but if then so of to in on at for with by from as is are was were be been being it its this that
these those i you he she we they me my your our their them not no yes do does did done have has had just very
really too also can could would should will game games play played playing good great fun 10 10/10 lol
`;

export const STOPWORDS = new Set(
  (CHINESE_STOP + ENGLISH_STOP)
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean),
);
