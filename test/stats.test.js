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
