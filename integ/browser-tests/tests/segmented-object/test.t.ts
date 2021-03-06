import "./api";

import { makeObjectBody } from "@ndn/segmented-object/test-fixture/object-body";
import { deleteTmpFiles, writeTmpFile } from "@ndn/segmented-object/test-fixture/tmpfile";
import { toHex } from "@ndn/tlv";
import { createHash } from "crypto";

import { navigateToPage, pageInvoke } from "../../test-fixture/pptr";

let objectBody: Buffer;
let objectBodyDigest: string;
let filename: string;
beforeAll(() => {
  objectBody = makeObjectBody(16 * 1024);
  objectBodyDigest = toHex(createHash("sha256").update(objectBody).digest());
  filename = writeTmpFile(objectBody);
});
afterAll(deleteTmpFiles);

beforeEach(() => navigateToPage(__dirname));

test("blob to buffer", async () => {
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.click("#upload-input"),
  ]);
  await fileChooser.accept([filename]);
  await new Promise((r) => setTimeout(r, 500));

  const { size, digest } = await pageInvoke<typeof window.testBlobChunkSource>(page, "testBlobChunkSource");
  expect(size).toBe(objectBody.byteLength);
  expect(digest).toBe(objectBodyDigest);
});
