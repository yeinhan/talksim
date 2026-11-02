import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readChatFile } from "../src/reader.js";

const chat = ["민수 님과 카카오톡 대화", "저장한 날짜 : 2026. 11. 1. 오후 6:00", "",
  "2019. 3. 1. 오후 11:58, 민수 : 자니?", "2019. 3. 2. 오전 12:01, 지영 : 아니 ㅋㅋ", "두번째 줄",
  "2025. 10. 2. 오전 12:02, 민수 : 6년 지났다"].join("\n");

function makeZip(opts) {
  const dir = mkdtempSync(join(tmpdir(), "zip-"));
  const out = join(dir, "chat.zip");
  execFileSync("python3", ["-c", `
import zipfile, sys, os
txt, out, media, z64 = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4] == "1"
with zipfile.ZipFile(out, "w") as z:
    z.writestr(zipfile.ZipInfo("KakaoTalk_Chats/photo.jpg"), os.urandom(media), compress_type=zipfile.ZIP_STORED)
    z.writestr("__MACOSX/._KakaoTalkChats.txt", "junk")
    zi = zipfile.ZipInfo("KakaoTalk_Chats/KakaoTalkChats.txt"); zi.compress_type = zipfile.ZIP_DEFLATED
    with z.open(zi, "w", force_zip64=z64) as f:
        f.write(txt.encode("utf-8"))
`, chat, out, String(opts.media), opts.zip64 ? "1" : "0"]);
  const buf = readFileSync(out);
  return new File([buf], "KakaoTalk_Chats.zip");
}

test("reads txt by streaming", async () => {
  const progress = [];
  const r = await readChatFile(new File([chat], "Talk.txt"), (p) => progress.push(p));
  assert.equal(r.messages.length, 3);
  assert.equal(r.messages[1].text, "아니 ㅋㅋ\n두번째 줄");
  assert.equal(progress.at(-1), 1);
});

test("reads only the chat text from a zip with big media", async () => {
  const r = await readChatFile(makeZip({ media: 20_000_000, zip64: false }));
  assert.equal(r.messages.length, 3);
  assert.equal(r.messages[2].text, "6년 지났다");
});

test("reads zip64 entries", async () => {
  const r = await readChatFile(makeZip({ media: 1000, zip64: true }));
  assert.equal(r.messages.length, 3);
});
