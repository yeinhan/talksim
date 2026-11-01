import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKakao } from "../src/parser.js";

const android = `민수 님과 카카오톡 대화
저장한 날짜 : 2024년 3월 2일 오후 10:00

2024년 3월 1일 금요일
2024년 3월 1일 오후 11:58, 민수 : 자니?
2024년 3월 1일 오후 11:59, 지영 : 아니 ㅋㅋ
뭐해
2024년 3월 2일 오전 12:01, 민수 : 사진
2024년 3월 2일 오전 9:05, 지영님이 민수님을 초대했습니다.
2024년 3월 2일 오후 12:30, 지영 : 점심: 김밥 먹음 : 맛있어
`;

const ios = `Talk_2024.3.2 22:00-1.txt
저장한 날짜 : 2024. 3. 2. 오후 10:00

2024년 3월 1일 금요일
2024. 3. 1. 오후 11:58, 민수 : 자니?
2024. 3. 1. 23:59, 지영 : 이모티콘
`;

const pc = `민수 님과 카카오톡 대화
저장한 날짜 : 2024-03-02 22:00:00

--------------- 2024년 3월 1일 금요일 ---------------
[민수] [오후 11:58] 자니?
[지영] [오후 11:59] 아니
두번째 줄
--------------- 2024년 3월 2일 토요일 ---------------
지영님이 들어왔습니다.
[민수] [오전 12:01] 삭제된 메시지입니다.
`;

const en = `KakaoTalk Chats with Minsu
Date Saved : Mar 2, 2024 at 10:00 PM

Friday, March 1, 2024
Mar 1, 2024 at 11:58 PM, Minsu : u up?
3/1/24, 11:59 PM, Jiyoung : yes
`;

test("android", () => {
  const r = parseKakao(android);
  assert.equal(r.format, "android");
  assert.equal(r.messages.length, 4);
  assert.deepEqual(r.messages[0].time, new Date(2024, 2, 1, 23, 58));
  assert.equal(r.messages[1].text, "아니 ㅋㅋ\n뭐해");
  assert.deepEqual(r.messages[2].time, new Date(2024, 2, 2, 0, 1));
  assert.equal(r.messages[2].kind, "photo");
  assert.equal(r.messages[3].text, "점심: 김밥 먹음 : 맛있어");
  assert.equal(r.messages[3].sender, "지영");
});

test("ios", () => {
  const r = parseKakao(ios);
  assert.equal(r.format, "ios");
  assert.equal(r.messages.length, 2);
  assert.deepEqual(r.messages[1].time, new Date(2024, 2, 1, 23, 59));
  assert.equal(r.messages[1].kind, "emoticon");
});

test("pc", () => {
  const r = parseKakao(pc);
  assert.equal(r.format, "pc");
  assert.equal(r.messages.length, 3);
  assert.equal(r.messages[1].text, "아니\n두번째 줄");
  assert.deepEqual(r.messages[2].time, new Date(2024, 2, 2, 0, 1));
  assert.equal(r.messages[2].kind, "deleted");
});

test("english", () => {
  const r = parseKakao(en);
  assert.equal(r.messages.length, 2);
  assert.deepEqual(r.messages[0].time, new Date(2024, 2, 1, 23, 58));
  assert.equal(r.messages[1].sender, "Jiyoung");
});
