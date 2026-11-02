// 대화 파일(.txt 또는 .zip)을 조금씩 읽어 분석기에 넣는다.
// 아이폰 "모든 메시지 도큐먼트로 저장하기" zip에는 사진·동영상이 다 들어 있어 수 GB가 될 수 있다.
// 그래서 zip 전체를 메모리에 올리지 않고, 목차(central directory)만 읽은 뒤
// 대화 텍스트 파일 부분만 잘라서 압축을 풀어 읽는다.

import { createKakaoParser } from "./parser.js";

export class ChatFileError extends Error {}

// onProgress(0~1)
export async function readChatFile(file, onProgress = () => {}) {
  const isZip = /\.zip$/i.test(file.name) || (await looksLikeZip(file));
  let stream, total;
  if (isZip) {
    const entry = await findTextEntry(file);
    total = entry.compressedSize;
    stream = countBytes(entry.blob.stream(), total, onProgress);
    if (entry.method === 8) stream = stream.pipeThrough(new DecompressionStream("deflate-raw"));
    else if (entry.method !== 0) throw new ChatFileError("지원하지 않는 압축 방식이에요. 다시 내보내기 해주세요.");
  } else {
    total = file.size;
    stream = countBytes(file.stream(), total, onProgress);
  }
  const parser = createKakaoParser();
  await feedLines(stream.pipeThrough(new TextDecoderStream("utf-8")), parser);
  onProgress(1);
  return parser.finish();
}

async function looksLikeZip(file) {
  if (file.size < 4) return false;
  const v = new DataView(await file.slice(0, 4).arrayBuffer());
  return v.getUint32(0, true) === 0x04034b50;
}

function countBytes(stream, total, onProgress) {
  let done = 0, lastReport = 0;
  return stream.pipeThrough(new TransformStream({
    transform(chunk, ctrl) {
      done += chunk.byteLength;
      const now = Date.now();
      if (now - lastReport > 50) { lastReport = now; onProgress(Math.min(0.99, done / Math.max(total, 1))); }
      ctrl.enqueue(chunk);
    },
  }));
}

async function feedLines(textStream, parser) {
  const reader = textStream.getReader();
  let rest = "";
  let n = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const parts = (rest + value).split(/\r?\n/);
    rest = parts.pop();
    for (const line of parts) parser.push(line);
    // 아주 큰 파일에서도 화면(게이지)이 멈추지 않도록 가끔 양보한다.
    if ((n += parts.length) > 20000) { n = 0; await new Promise((r) => setTimeout(r, 0)); }
  }
  if (rest) parser.push(rest);
}

// ---- zip 목차 읽기 (ZIP64 포함) ----
async function view(file, start, end) {
  return new DataView(await file.slice(start, end).arrayBuffer());
}

async function findTextEntry(file) {
  if (typeof DecompressionStream !== "function") {
    throw new ChatFileError("이 브라우저는 zip 파일을 열 수 없어요. 휴대폰을 최신 버전으로 업데이트하거나 .txt 파일로 올려주세요.");
  }
  const tailLen = Math.min(file.size, 65535 + 22 + 20);
  const tailStart = file.size - tailLen;
  const tail = await view(file, tailStart, file.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ChatFileError("zip 파일이 깨졌거나 끝까지 저장되지 않았어요. 다시 내보내기 해주세요.");

  let count = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const loc = eocd - 20;
    if (loc < 0 || tail.getUint32(loc, true) !== 0x07064b50) throw new ChatFileError("zip 파일 목차를 읽지 못했어요.");
    const z64Offset = Number(tail.getBigUint64(loc + 8, true));
    const z = await view(file, z64Offset, z64Offset + 56);
    if (z.getUint32(0, true) !== 0x06064b50) throw new ChatFileError("zip 파일 목차를 읽지 못했어요.");
    count = Number(z.getBigUint64(32, true));
    cdSize = Number(z.getBigUint64(40, true));
    cdOffset = Number(z.getBigUint64(48, true));
  }

  const cd = await view(file, cdOffset, cdOffset + cdSize);
  const utf8 = new TextDecoder("utf-8");
  const entries = [];
  let p = 0;
  for (let k = 0; k < count && p + 46 <= cd.byteLength; k++) {
    if (cd.getUint32(p, true) !== 0x02014b50) break;
    const method = cd.getUint16(p + 10, true);
    let compressedSize = cd.getUint32(p + 20, true);
    let size = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    let localOffset = cd.getUint32(p + 42, true);
    const name = utf8.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    // ZIP64 추가 정보
    let e = p + 46 + nameLen;
    const eEnd = e + extraLen;
    while (e + 4 <= eEnd) {
      const id = cd.getUint16(e, true), len = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) { size = Number(cd.getBigUint64(q, true)); q += 8; }
        if (compressedSize === 0xffffffff) { compressedSize = Number(cd.getBigUint64(q, true)); q += 8; }
        if (localOffset === 0xffffffff) { localOffset = Number(cd.getBigUint64(q, true)); }
      }
      e += 4 + len;
    }
    entries.push({ name, method, compressedSize, size, localOffset });
    p = eEnd + commentLen;
  }

  const txt = entries
    .filter((x) => /\.(txt|csv)$/i.test(x.name) && !/(^|\/)__MACOSX\//.test(x.name) && !x.name.split("/").pop().startsWith("._"))
    .sort((a, b) => b.size - a.size)[0];
  if (!txt) throw new ChatFileError("zip 파일 안에서 대화 텍스트를 찾지 못했어요. 카카오톡에서 다시 내보내기 해주세요.");

  const lh = await view(file, txt.localOffset, txt.localOffset + 30);
  if (lh.getUint32(0, true) !== 0x04034b50) throw new ChatFileError("zip 파일이 깨졌어요. 다시 내보내기 해주세요.");
  const start = txt.localOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
  return { ...txt, blob: file.slice(start, start + txt.compressedSize) };
}
