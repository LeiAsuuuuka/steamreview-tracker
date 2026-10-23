// Word lists for game reviews. Extend these as new slang shows up, then run `npm run reindex`.

/** Extra entries for jieba (Chinese) so game terms stay whole. */
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
  // Traditional Chinese
  '掉幀', '卡頓', '閃退', '優化', '伺服器', '連線', '存檔', '手感', '打擊感', '配樂', '劇情', '畫風', '畫面',
  '美術', '難度', '關卡', '地圖', '開放世界', '平衡性', '新手引導', '中文化', '翻譯', '課金', '抽卡', '退款',
];

/** Single characters that carry meaning in game reviews and should not be dropped. */
export const ALLOWED_SINGLE = new Set(['肝', '卡', '氪', '菜', '难', '難', '爽', '贵', '貴', '香', '坑']);

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

const TRADITIONAL_STOP = `
這 個 們 為 說 還 沒 會 對 與 讓 給 從 時 後 現 經 點 種 樣 裡 這個 那個 這些 那些 這樣 那樣 這麼 那麼
什麼 怎麼 為什麼 我們 你們 他們 還是 還有 雖然 然後 因為 所以 但是 而且 時候 現在 已經 一直 一點 有點
覺得 認為 知道 感覺 發現 起來 東西 地方 事情 真的 確實 其實 當然 非常 特別 比較 越來越 沒有 不會 不能
遊戲 這遊戲 這款 這款遊戲 本作 作品 玩家 好玩 推薦 不推薦 值得 小時 時間 一款 個人 大家 朋友 體驗
`;

const ENGLISH_STOP = `
a an the and or but if then so of to in on at for with by from as is are was were be been being it its this that
these those i you he she we they me my your our their them not no yes do does did done have has had just very
really too also can could would should will game games play played playing good great fun lol
it's i'm don't doesn't didn't isn't can't won't you're there here what when where which who how why all any
some more most much many one two get got like even still only about after before over into out up down
than then because while way time hours hour lot thing things make made really pretty actually overall
ever first want wanted doing going anything something everything nothing next bit feel feels right minutes
seconds again back know think every through being well need see say said use used thing take give
i've i'd i'll that's there's they're we're you've you'll wasn't aren't haven't wouldn't couldn't
definitely probably maybe literally honestly
`;

const RUSSIAN_STOP = `
и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от
меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам
ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего
раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем
чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот
через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть
том нельзя такой им более всегда конечно всю между это игра игры игру игре очень просто часов
`;

const SPANISH_STOP = `
de la que el en y a los del se las por un para con no una su al lo como más pero sus le ya o este sí porque
esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni
contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho
quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas es son
fue ser juego juegos jugar horas bueno buen muy
`;

const PORTUGUESE_STOP = `
de a o que e do da em um para é com não uma os no se na por mais as dos como mas foi ao ele das tem à seu
sua ou ser quando muito há nos já está eu também só pelo pela até isso ela entre era depois sem mesmo aos ter
seus quem nas me esse eles estão você tinha foram essa num nem suas meu às minha têm numa pelos elas havia
seja qual será nós tenho lhe deles essas esses pelas este fosse dele tu te vocês vos lhes meus minhas teu
tua teus tuas nosso nossa nossos nossas dela delas esta estes estas aquele aquela aqueles aquelas isto aquilo
jogo jogos jogar horas bom muito
`;

const GERMAN_STOP = `
der die und in den von zu das mit sich des auf für ist im dem nicht ein eine als auch es an werden aus er hat
dass sie nach wird bei einer um am sind noch wie einem über einen so zum war haben nur oder aber vor zur bis
mehr durch man sein wurde sei ich du wir ihr mich mir dir dich uns euch mein dein kann können wenn was schon
sehr viel ganz gut spiel spiele spielen stunden einfach wirklich immer dann noch doch mal
`;

const FRENCH_STOP = `
au aux avec ce ces dans de des du elle en et eux il je la le les leur lui ma mais me même mes moi mon ne nos
notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous c d j l
à m n s t y été être avoir est sont était fait plus très bien tout tous jeu jeux jouer heures vraiment aussi
`;

const POLISH_STOP = `
i w z na się nie do to że jest jak o co ale po tak za od już tylko jego ich ma czy dla może przez był być
gdy są jej mi mnie ten ta te tym tego bardzo gra gry grę godzin
`;

const TURKISH_STOP = `
ve bir bu da de için ile çok ama gibi daha ne o var mi mı ben sen en olarak oyun oyunu saat güzel
`;

const JAPANESE_STOP = `
これ それ あれ この その あの ここ そこ です ですが ますが ます でした ません ない ある いる する した して なる なっ
こと もの ため よう から まで ので のに けど けれど でも また まだ もう とても すごい ちょっと
ゲーム 時間 プレイ 本作 作品 おすすめ 面白い 楽しい 良い いい
`;

const KOREAN_STOP = `
그리고 그러나 하지만 그래서 그런데 이 그 저 것 수 등 더 너무 정말 진짜 게임 게임이 게임은 게임을 시간 플레이 재밌어요 재미있음
`;

export const STOPWORDS = new Set(
  [
    CHINESE_STOP, TRADITIONAL_STOP, ENGLISH_STOP, RUSSIAN_STOP, SPANISH_STOP, PORTUGUESE_STOP,
    GERMAN_STOP, FRENCH_STOP, POLISH_STOP, TURKISH_STOP, JAPANESE_STOP, KOREAN_STOP,
  ]
    .join(' ')
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean),
);
