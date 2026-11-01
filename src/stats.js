// 파싱된 메시지로 재미 통계를 계산한다.

const DEFAULTS = {
  newConversationGapHours: 6, // 이 시간 이상 조용하다가 보낸 메시지 = 선톡
  slowReplyMinutes: 60, // 이보다 늦게 답하면 "읽씹 의심"
};

const STOPWORDS = new Set([
  "나", "너", "난", "넌", "내", "니", "그", "이", "저", "좀", "더", "잘", "진짜", "그냥", "근데", "아",
  "어", "응", "웅", "네", "예", "음", "오", "와", "헐", "다", "또", "안", "못", "거", "것", "수", "그래",
  "사진", "이모티콘", "동영상",
]);

const LAUGH = /ㅋ{2,}|ㅎ{2,}/g;
const CRY = /[ㅠㅜ]{2,}/g;

export function tokenize(text) {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !/^[ㅋㅎㅠㅜㄱ-ㅎㅏ-ㅣ]+$/.test(w) && !/^\d+$/.test(w));
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([word, count]) => ({ word, count }));
}

export function computeStats(messages, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const gapMs = o.newConversationGapHours * 3600_000;
  const people = new Map();
  const person = (name) => {
    if (!people.has(name)) {
      people.set(name, {
        name, messages: 0, chars: 0, starts: 0, ends: 0, laughs: 0, cries: 0,
        photos: 0, emoticons: 0, deleted: 0, replyMinutes: [], slowReplies: 0,
        maxStreak: 0, words: new Map(), openers: new Map(),
      });
    }
    return people.get(name);
  };

  const byHour = Array(24).fill(0);
  const byWeekday = Array(7).fill(0);
  const byDay = new Map();
  const conversations = [];

  let prev = null;
  let streak = 0;

  for (const m of messages) {
    const p = person(m.sender);
    p.messages++;
    byHour[m.time.getHours()]++;
    byWeekday[m.time.getDay()]++;
    const dayKey = `${m.time.getFullYear()}-${String(m.time.getMonth() + 1).padStart(2, "0")}-${String(m.time.getDate()).padStart(2, "0")}`;
    byDay.set(dayKey, (byDay.get(dayKey) || 0) + 1);

    if (m.kind === "photo") p.photos++;
    else if (m.kind === "emoticon") p.emoticons++;
    else if (m.kind === "deleted") p.deleted++;
    else if (m.kind === "text") {
      p.chars += m.text.length;
      p.laughs += (m.text.match(LAUGH) || []).length;
      p.cries += (m.text.match(CRY) || []).length;
      for (const w of tokenize(m.text)) {
        if (STOPWORDS.has(w) || w.length < 2) continue;
        p.words.set(w, (p.words.get(w) || 0) + 1);
      }
    }

    const isNewConversation = !prev || m.time - prev.time >= gapMs;
    if (isNewConversation) {
      if (prev) person(prev.sender).ends++;
      p.starts++;
      const opener = m.kind === "text" ? m.text.split("\n")[0].trim().slice(0, 20) : `(${kindLabel(m.kind)})`;
      p.openers.set(opener, (p.openers.get(opener) || 0) + 1);
      conversations.push({ start: m.time, starter: m.sender, opener, count: 1 });
      streak = 1;
    } else {
      conversations[conversations.length - 1].count++;
      if (prev.sender !== m.sender) {
        const mins = (m.time - prev.time) / 60000;
        p.replyMinutes.push(mins);
        if (mins >= o.slowReplyMinutes) p.slowReplies++;
        streak = 1;
      } else {
        streak++;
      }
    }
    p.maxStreak = Math.max(p.maxStreak, streak);
    prev = m;
  }
  if (prev) person(prev.sender).ends++;

  const list = [...people.values()]
    .map((p) => ({
      name: p.name,
      messages: p.messages,
      chars: p.chars,
      starts: p.starts,
      ends: p.ends,
      laughs: p.laughs,
      cries: p.cries,
      photos: p.photos,
      emoticons: p.emoticons,
      deleted: p.deleted,
      maxStreak: p.maxStreak,
      medianReplyMinutes: median(p.replyMinutes),
      avgReplyMinutes: p.replyMinutes.length ? p.replyMinutes.reduce((a, b) => a + b, 0) / p.replyMinutes.length : null,
      slowReplies: p.slowReplies,
      replies: p.replyMinutes.length,
      topWords: topN(p.words, 10),
      topOpeners: topN(p.openers, 5),
      _words: p.words,
    }))
    .sort((a, b) => b.messages - a.messages);

  const total = messages.length;
  const totalStarts = conversations.length;
  for (const p of list) {
    p.messageShare = total ? p.messages / total : 0;
    p.startShare = totalStarts ? p.starts / totalStarts : 0;
    p.affection = affectionScore(p, list.length);
  }

  const titles = list.length >= 3 ? assignTitles(list) : [];
  for (const p of list) p.titles = titles.filter((t) => t.name === p.name).map((t) => t.title);

  const busiestDays = [...byDay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([day, count]) => ({ day, count }));

  return {
    totalMessages: total,
    first: messages[0] ? { sender: messages[0].sender, text: messages[0].text, time: messages[0].time } : null,
    last: messages.at(-1) ? { time: messages.at(-1).time } : null,
    activeDays: byDay.size,
    conversations: totalStarts,
    people: list,
    byHour,
    byWeekday,
    busiestDays,
    longestStreakDays: longestStreak([...byDay.keys()]),
    verdict: verdict(list),
    titles,
  };
}

// 특정 단어를 사람별로 몇 번 말했는지
export function countWord(messages, word) {
  const out = {};
  const needle = word.trim();
  if (!needle) return out;
  for (const m of messages) {
    if (m.kind !== "text") continue;
    let i = 0, n = 0;
    while ((i = m.text.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
    if (n) out[m.sender] = (out[m.sender] || 0) + n;
  }
  return out;
}

function kindLabel(kind) {
  return { photo: "사진", emoticon: "이모티콘", video: "동영상", file: "파일", deleted: "삭제됨" }[kind] || kind;
}

function longestStreak(dayKeys) {
  const days = dayKeys.map((k) => Date.parse(k + "T00:00:00Z") / 86400000).sort((a, b) => a - b);
  let best = 0, cur = 0, prev = null;
  for (const d of days) {
    cur = prev !== null && d - prev === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

// 0~100점. 선톡 비율, 말 수, 답장 속도, 리액션을 섞은 재미용 점수.
function affectionScore(p, peopleCount) {
  const fair = 1 / Math.max(peopleCount, 1);
  const startPart = Math.min(p.startShare / fair, 2) / 2; // 공평한 몫의 2배면 만점
  const msgPart = Math.min(p.messageShare / fair, 2) / 2;
  const replyPart = p.medianReplyMinutes == null ? 0.5 : Math.exp(-p.medianReplyMinutes / 20);
  const reactPart = p.messages ? Math.min((p.laughs + p.emoticons + p.cries) / p.messages / 0.5, 1) : 0;
  return Math.round(100 * (0.35 * startPart + 0.2 * msgPart + 0.3 * replyPart + 0.15 * reactPart));
}

function verdict(list) {
  if (list.length < 2) return { title: "혼잣말 장인", desc: "대화 상대가 없어요." };
  if (list.length > 2) {
    const top = list[0];
    return { title: `${top.name} 님이 이 방의 분위기 메이커`, desc: `전체 메시지의 ${Math.round(top.messageShare * 100)}%를 책임지고 있어요.` };
  }
  const [a, b] = [...list].sort((x, y) => y.affection - x.affection);
  const diff = a.affection - b.affection;
  if (a.affection >= 65 && diff <= 10) return { title: "서로 진심인 찐친", desc: "선톡도 답장도 막상막하예요." };
  if (diff > 25) return { title: `${a.name} 님만 열정적`, desc: `${b.name} 님, 답장 좀 빨리 해주세요.` };
  if (diff > 10) return { title: `${a.name} 님이 조금 더 좋아하는 사이`, desc: "한쪽으로 살짝 기울어 있어요." };
  return { title: "적당히 편한 사이", desc: "무난하고 평화로운 대화예요." };
}

// 단톡방(3명 이상) 멤버 칭호. 칭호마다 가장 잘 맞는 사람에게 주되,
// 한 사람이 칭호를 독차지하지 않도록 1인당 최대 2개까지만 준다.
const TITLES = [
  { title: "분위기 메이커", desc: "말을 제일 많이 해요", score: (p) => p.messages },
  { title: "선톡왕", desc: "조용할 때 먼저 말을 꺼내요", score: (p) => p.starts },
  { title: "답장 요정", desc: "답장이 제일 빨라요", ok: (p) => p.replies >= 5, score: (p) => -p.medianReplyMinutes },
  { title: "리액션 장인", desc: "ㅋㅋ와 이모티콘을 제일 잘 써요", ok: (p) => p.messages >= 20, score: (p) => (p.laughs + p.emoticons) / p.messages },
  { title: "폭격기", desc: "혼자 연달아 보내는 기록 1위", ok: (p) => p.maxStreak >= 3, score: (p) => p.maxStreak },
  { title: "감성 충만", desc: "ㅠㅠ를 제일 많이 써요", ok: (p) => p.cries > 0, score: (p) => p.cries / p.messages },
  { title: "사진 작가", desc: "사진을 제일 많이 보내요", ok: (p) => p.photos > 0, score: (p) => p.photos },
  { title: "읽씹 장인", desc: "1시간 넘게 답 안 한 횟수 1위", ok: (p) => p.slowReplies > 0, score: (p) => p.slowReplies },
  { title: "눈팅러", desc: "보기만 하고 말은 아껴요", score: (p) => -p.messages },
];
const MAX_TITLES_PER_PERSON = 2;

export function assignTitles(people) {
  const out = [];
  const count = new Map();
  for (const t of TITLES) {
    const ranked = people
      .filter((p) => (t.ok ? t.ok(p) : true) && Number.isFinite(t.score(p)))
      .sort((a, b) => t.score(b) - t.score(a));
    const p = ranked.find((x) => (count.get(x.name) || 0) < MAX_TITLES_PER_PERSON);
    if (!p) continue;
    count.set(p.name, (count.get(p.name) || 0) + 1);
    out.push({ title: t.title, desc: t.desc, name: p.name });
  }
  for (const p of people) {
    if (!count.has(p.name)) out.push({ title: "평화주의자", desc: "무난하게 대화에 함께해요", name: p.name });
  }
  return out;
}
