// 첫 화면에 보여줄 예시 대화(가상 인물). 안드로이드 내보내기 형식으로 만든다.

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const A = "민수";
const B = "지영";
const OPENERS_A = ["자니?", "뭐해", "점심 뭐 먹었어", "야 이거 봐봐", "오늘 시간 돼?", "굿모닝", "사진"];
const OPENERS_B = ["뭐해?", "나 오늘 너무 피곤해 ㅠㅠ", "이모티콘", "야야", "저녁 먹었어?"];
const LINES_A = ["ㅋㅋㅋㅋ 진짜?", "나도 보고싶다", "떡볶이 먹을래?", "오늘 날씨 미쳤다", "ㅋㅋㅋ 너 진짜 웃겨", "이모티콘", "고마워", "주말에 영화 보자", "사진", "헐 대박", "보고싶어", "떡볶이 콜?"];
const LINES_B = ["ㅋㅋ", "응응", "좋아", "ㅎㅎ 그래", "떡볶이 좋아", "이모티콘", "아 진짜 ㅠㅠ", "나 지금 바빠", "이따 연락할게", "ㅋㅋㅋ 미쳤다", "고마워", "사진"];

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
  const out = [`${B} 님과 카카오톡 대화 (예시)`, "저장한 날짜 : 2026년 10월 31일 오후 11:40", ""];
  const start = new Date(2026, 8, 1);
  for (let day = 0; day < 60; day++) {
    if (r() < 0.12) continue;
    const convs = 1 + Math.floor(r() * 2);
    for (let c = 0; c < convs; c++) {
      const t = new Date(start);
      t.setDate(start.getDate() + day);
      t.setHours([9, 20][c] + Math.floor(r() * 2), Math.floor(r() * 60));
      let who = r() < 0.68 ? A : B;
      out.push(`${fmt(t)}, ${who} : ${who === A ? pick(OPENERS_A) : pick(OPENERS_B)}`);
      const len = 3 + Math.floor(r() * 12);
      for (let i = 0; i < len; i++) {
        const switchTurn = r() < 0.7;
        if (switchTurn) who = who === A ? B : A;
        const wait = who === B ? (r() < 0.15 ? 60 + r() * 120 : r() * 18) : r() * 5;
        t.setMinutes(t.getMinutes() + Math.max(1, Math.round(wait)));
        out.push(`${fmt(t)}, ${who} : ${who === A ? pick(LINES_A) : pick(LINES_B)}`);
      }
    }
  }
  return out.join("\n");
}
