// 첫 화면에 보여줄 예시 대화(가상 인물). 안드로이드 내보내기 형식으로 만든다.

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// 가상의 친구 4명 단톡방
const MEMBERS = [
  { name: "민수", weight: 0.36, starts: 0.45, wait: 4, openers: ["얘들아 뭐해", "오늘 저녁 콜?", "야 이거 봐봐", "사진"], lines: ["ㅋㅋㅋㅋ 진짜?", "떡볶이 먹을래?", "ㅋㅋㅋ 레전드", "주말에 노래방 콜?", "헐 대박", "사진", "이모티콘"] },
  { name: "지영", weight: 0.28, starts: 0.25, wait: 10, openers: ["다들 일어났어?", "나 오늘 너무 피곤해 ㅠㅠ", "이모티콘"], lines: ["ㅋㅋ", "좋아", "ㅎㅎ 그래", "아 진짜 ㅠㅠ", "이모티콘", "고마워", "ㅋㅋㅋ 미쳤다"] },
  { name: "현우", weight: 0.24, starts: 0.25, wait: 25, openers: ["시험 언제야", "사진", "점심 뭐 먹었어"], lines: ["ㅇㅇ", "난 콜", "사진", "내일 몇 시에 봐?", "ㅋㅋㅋㅋㅋ", "오늘 날씨 미쳤다"] },
  { name: "서연", weight: 0.12, starts: 0.05, wait: 60, openers: ["오랜만~"], lines: ["ㅋㅋ", "나도 갈래", "이모티콘", "늦게 봤다 ㅠㅠ"] },
];

function pickWeighted(r, key) {
  let x = r(), acc = 0;
  for (const m of MEMBERS) { acc += m[key]; if (x < acc) return m; }
  return MEMBERS[0];
}

function pad(n) { return String(n).padStart(2, "0"); }

function fmt(d) {
  const h = d.getHours();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${ampm} ${h12}:${pad(d.getMinutes())}`;
}

export function sampleChat() {
  const r = rng(7);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const out = ["고딩 친구들 4 카카오톡 대화 (예시)", "저장한 날짜 : 2026년 10월 31일 오후 11:40", ""];
  const start = new Date(2026, 8, 1);
  for (let day = 0; day < 60; day++) {
    if (r() < 0.12) continue;
    const convs = 1 + Math.floor(r() * 2);
    for (let c = 0; c < convs; c++) {
      const t = new Date(start);
      t.setDate(start.getDate() + day);
      t.setHours([12, 20][c] + Math.floor(r() * 2), Math.floor(r() * 60));
      let who = pickWeighted(r, "starts");
      out.push(`${fmt(t)}, ${who.name} : ${pick(who.openers)}`);
      const len = 4 + Math.floor(r() * 16);
      for (let i = 0; i < len; i++) {
        const next = r() < 0.25 ? who : pickWeighted(r, "weight");
        const wait = next === who ? r() * 2 : r() * next.wait * (r() < 0.1 ? 4 : 1);
        who = next;
        t.setMinutes(t.getMinutes() + Math.max(1, Math.round(wait)));
        out.push(`${fmt(t)}, ${who.name} : ${pick(who.lines)}`);
      }
    }
  }
  return out.join("\n");
}
