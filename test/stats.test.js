import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKakao } from "../src/parser.js";
import { computeStats, countWord } from "../src/stats.js";

const chat = `2024년 3월 1일 오후 11:00, 민수 : 자니? ㅋㅋ
2024년 3월 1일 오후 11:10, 지영 : 아니 ㅋㅋㅋ 피자 먹어
2024년 3월 1일 오후 11:11, 민수 : 피자 맛있겠다
2024년 3월 1일 오후 11:12, 민수 : 나도 피자
2024년 3월 2일 오후 3:00, 지영 : 점심 뭐 먹었어
2024년 3월 2일 오후 5:00, 민수 : 피자
`;

test("stats", () => {
  const { messages } = parseKakao(chat);
  const s = computeStats(messages);
  const m = s.people.find((p) => p.name === "민수");
  const j = s.people.find((p) => p.name === "지영");
  assert.equal(s.conversations, 2);
  assert.equal(m.starts, 1);
  assert.equal(j.starts, 1);
  assert.equal(m.topOpeners[0].word, "자니? ㅋㅋ");
  assert.equal(m.maxStreak, 2);
  assert.equal(m.slowReplies, 1);
  assert.equal(j.medianReplyMinutes, 10);
  assert.equal(m.topWords[0].word, "피자");
  assert.equal(m.laughs, 1);
  assert.equal(s.longestStreakDays, 2);
  assert.deepEqual(countWord(messages, "피자"), { 지영: 1, 민수: 3 });
  assert.ok(s.verdict.title);
});

test("group titles", () => {
  const lines = [];
  const add = (h, m, who, text) => lines.push(`2024년 3월 1일 ${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m).padStart(2, "0")}, ${who} : ${text}`);
  add(9, 0, "가영", "다들 뭐해");
  add(9, 1, "나래", "ㅋㅋㅋ 출근");
  add(9, 2, "가영", "나도");
  add(9, 3, "가영", "배고파");
  add(9, 4, "가영", "점심 뭐 먹지");
  add(9, 30, "다솜", "ㅠㅠ 피곤");
  add(9, 31, "나래", "이모티콘");
  const { messages } = parseKakao(lines.join("\n"));
  const s = computeStats(messages);
  const byTitle = Object.fromEntries(s.titles.map((t) => [t.title, t.name]));
  assert.equal(byTitle["분위기 메이커"], "가영");
  assert.equal(byTitle["선톡왕"], "가영");
  assert.ok(s.titles.filter((x) => x.name === "가영").length <= 2);
  assert.equal(byTitle["눈팅러"], "다솜");
  assert.equal(byTitle["감성 충만"], "다솜");
  assert.ok(s.people.find((p) => p.name === "가영").titles.includes("분위기 메이커"));
  for (const p of s.people) assert.ok(p.titles.length >= 1);
});

test("no titles for 1:1", () => {
  const { messages } = parseKakao(chat);
  assert.deepEqual(computeStats(messages).titles, []);
});

test("conversation gap adapts to the chat's reply rhythm", async () => {
  const { chooseGapHours, computeStats } = await import("../src/stats.js");
  const mk = (stepMin, n) => {
    const out = [];
    let t = new Date(2026, 0, 1, 9).getTime();
    for (let i = 0; i < n; i++) {
      out.push({ time: new Date(t), sender: i % 2 ? "A" : "B", text: "hi", kind: "text" });
      t += (i % 10 === 9 ? 24 * 60 : stepMin) * 60000;
    }
    return out;
  };
  // 빠른 대화: 1분 간격이면 기준은 최소값 근처
  assert.ok(chooseGapHours(mk(1, 200)).hours <= 2);
  // 느린 대화: 40분 간격이면 기준이 길어진다
  assert.ok(chooseGapHours(mk(40, 200)).hours >= 3);
  // 메시지가 적으면 6시간
  assert.equal(chooseGapHours(mk(1, 5)).hours, 6);
  // 직접 지정하면 그 값을 쓴다
  assert.equal(computeStats(mk(1, 200), { newConversationGapHours: 6 }).gap.hours, 6);
});
