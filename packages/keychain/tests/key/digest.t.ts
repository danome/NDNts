import { SigType } from "@ndn/packet";

import { PrivateKey, PublicKey, theDigestKey } from "../..";
import * as TestSignVerify from "../../test-fixture/sign-verify";

test("isKey", async () => {
  expect(PrivateKey.isPrivateKey(theDigestKey)).toBeTruthy();
  expect(PublicKey.isPublicKey(theDigestKey)).toBeTruthy();
  await expect(theDigestKey.exportAsSpki()).rejects.toThrow(/cannot export/);
});

test.each(TestSignVerify.TABLE)("%p", async ({ cls }) => {
  const record = await TestSignVerify.execute(cls, theDigestKey, theDigestKey, theDigestKey, theDigestKey);
  TestSignVerify.check(record, { deterministic: true, sameAB: true });
  expect(record.sA0.sigInfo.type).toBe(SigType.Sha256);
  expect(record.sA0.sigInfo.keyLocator).toBeUndefined();
});
