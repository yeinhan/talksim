// 카카오톡 "대화 내보내기" 텍스트를 메시지 배열로 바꾸는 분석기.
// 브라우저 안에서만 실행되며, 어떤 데이터도 외부로 보내지 않는다.
//
// 지원 형식
//  - 안드로이드:  2024년 1월 1일 오후 3:01, 홍길동 : 안녕
//  - 아이폰:      2024. 1. 1. 오후 3:01, 홍길동 : 안녕   (24시간제 15:01 도 지원)
//  - PC(윈도/맥): --------------- 2024년 1월 1일 월요일 ---------------
//                 [홍길동] [오후 3:01] 안녕
//  - 영어 설정:   Jan 1, 2024, 3:01 PM, Hong : hi  /  1/1/24, 3:01 PM, Hong : hi
//
// 결과: { title, format, messages: [{ time: Date, sender, text, kind }] }
//   kind: "text" | "photo" | "emoticon" | "video" | "file" | "deleted"

const AMPM = { 오전: 0, 오후: 12, AM: 0, PM: 12, am: 0, pm: 12 };

function toHour(ampm, h) {
  h = Number(h);
  if (ampm == null) return h;
  const offset = AMPM[ampm] ?? 0;
  if (h === 12) h = 0;
  return h + offset;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// 모바일 형식: 날짜, 시간, 보낸사람 : 내용
const MOBILE_PATTERNS = [
  {
    format: "android",
    re: /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후)? ?(\d{1,2}):(\d{2}), (.+?) : (.*)$/,
    build: (m) => [new Date(+m[1], +m[2] - 1, +m[3], toHour(m[4], m[5]), +m[6]), m[7], m[8]],
  },
  {
    format: "ios",
    re: /^(\d{4})\. ?(\d{1,2})\. ?(\d{1,2})\.? (오전|오후)? ?(\d{1,2}):(\d{2}),? (.+?) : (.*)$/,
    build: (m) => [new Date(+m[1], +m[2] - 1, +m[3], toHour(m[4], m[5]), +m[6]), m[7], m[8]],
  },
  {
    format: "english",
    re: /^([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4}),? (?:at )?(\d{1,2}):(\d{2}) ?(AM|PM|am|pm)?, (.+?) : (.*)$/,
    build: (m) => [
      new Date(+m[3], MONTHS[m[1].toLowerCase()], +m[2], toHour(m[6], m[4]), +m[5]),
      m[7],
      m[8],
    ],
  },
  {
    format: "english-numeric",
    re: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),? (\d{1,2}):(\d{2}) ?(AM|PM|am|pm)?, (.+?) : (.*)$/,
    build: (m) => {
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      return [new Date(y, +m[1] - 1, +m[2], toHour(m[6], m[4]), +m[5]), m[7], m[8]];
    },
  },
];

// PC 형식
const PC_DATE = /^-+ (\d{4})년 (\d{1,2})월 (\d{1,2})일 \S+ -+$/;
const PC_DATE_EN = /^-+ \S+, ([A-Za-z]+) (\d{1,2}), (\d{4}) -+$/;
const PC_MSG = /^\[(.+?)\] \[(오전|오후|AM|PM)? ?(\d{1,2}):(\d{2}) ?(AM|PM)?\] (.*)$/;

function classify(text) {
  const t = text.trim();
  if (t === "사진" || t === "Photo" || /^사진 \d+장$/.test(t) || /^\d+ photos?$/i.test(t)) return "photo";
  if (t === "이모티콘" || t === "Emoticon" || t === "(이모티콘)") return "emoticon";
  if (t === "동영상" || t === "Video") return "video";
  if (/^파일: /.test(t) || /^File: /.test(t)) return "file";
  if (t === "삭제된 메시지입니다." || t === "This message was deleted.") return "deleted";
  return "text";
}

export function parseKakao(raw) {
  const lines = raw.replace(/^﻿/, "").split(/\r?\n/);
  const messages = [];
  const counts = {};
  let title = null;
  let pcDate = null;
  let last = null;

  const firstLine = lines[0]?.trim() ?? "";
  if (/카카오톡 대화|KakaoTalk Chats? with|Talk_/.test(firstLine)) title = firstLine;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    let parsed = null;

    for (const p of MOBILE_PATTERNS) {
      const m = line.match(p.re);
      if (m) {
        const [time, sender, text] = p.build(m);
        parsed = { time, sender, text, format: p.format };
        break;
      }
    }

    if (!parsed) {
      let d = line.match(PC_DATE);
      if (d) {
        pcDate = [+d[1], +d[2] - 1, +d[3]];
        last = null;
        continue;
      }
      d = line.match(PC_DATE_EN);
      if (d && MONTHS[d[1].slice(0, 3).toLowerCase()] != null) {
        pcDate = [+d[3], MONTHS[d[1].slice(0, 3).toLowerCase()], +d[2]];
        last = null;
        continue;
      }
      const m = pcDate && line.match(PC_MSG);
      if (m) {
        const ampm = m[2] || m[5];
        const time = new Date(pcDate[0], pcDate[1], pcDate[2], toHour(ampm, m[3]), +m[4]);
        parsed = { time, sender: m[1], text: m[6], format: "pc" };
      }
    }

    if (parsed) {
      counts[parsed.format] = (counts[parsed.format] || 0) + 1;
      last = { time: parsed.time, sender: parsed.sender, text: parsed.text, kind: "text" };
      messages.push(last);
      continue;
    }

    // 날짜 구분선, 입장/퇴장 같은 시스템 메시지는 건너뛴다.
    if (isSystemLine(line)) {
      last = null;
      continue;
    }

    // 그 외 줄은 앞 메시지의 줄바꿈된 내용
    if (last) last.text += "\n" + line;
  }

  for (const msg of messages) msg.kind = classify(msg.text);

  const format = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
  return { title, format, messages };
}

function isSystemLine(line) {
  return (
    /^\d{4}년 \d{1,2}월 \d{1,2}일 \S+요일$/.test(line) ||
    /^\d{4}년 \d{1,2}월 \d{1,2}일 (오전|오후)? ?\d{1,2}:\d{2}(, [^:]+)?$/.test(line) ||
    /^\d{4}\. ?\d{1,2}\. ?\d{1,2}\.? (오전|오후)? ?\d{1,2}:\d{2}(, [^:]+)?$/.test(line) ||
    /^[A-Za-z]+day, [A-Za-z]+ \d{1,2}, \d{4}$/.test(line) ||
    /^저장한 날짜 ?: /.test(line) ||
    /^Date Saved ?: /.test(line)
  );
}
