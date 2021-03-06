import "@ndn/tlv/test-fixture/expect";

import { Decodable, Decoder, Encodable, Encoder } from "@ndn/tlv";
import * as crypto from "crypto";

import { Data, Interest, KeyDigest, LLSign, LLVerify, Name, SigInfo, SigType, TT } from "..";

class TestAlgo {
  constructor(private readonly key: string, private readonly wantSignError: boolean = false) {
  }

  public sign(pkt: LLSign.Signable) {
    return pkt[LLSign.OP](async (input) => {
      await new Promise((r) => setTimeout(r, 5));
      if (this.wantSignError) {
        throw new Error("mock-signing-error");
      }
      return this.computeSignature(input);
    });
  }

  public verify(pkt: LLVerify.Verifiable) {
    return pkt[LLVerify.OP](async (input, sig) => {
      await new Promise((r) => setTimeout(r, 5));
      // warning: this is insecure comparison, for test case only
      if (Buffer.compare(sig, this.computeSignature(input)) !== 0) {
        throw new Error("incorrect signature value");
      }
    });
  }

  private computeSignature(input: Uint8Array): Uint8Array {
    // warning: this is insecure hashing algorithm, for test case only
    const hash = crypto.createHmac("sha256", this.key);
    hash.update(input);
    return hash.digest();
  }
}

const ALGO0 = new TestAlgo("0");
const ALGO1 = new TestAlgo("1", true);

type Pkt = LLSign.Signable & LLVerify.Verifiable & Encodable & {sigInfo: SigInfo};

interface Row {
  cls: (new(name: Name) => Pkt) & Decodable<Pkt>;
  checkWire: (tlv: Decoder.Tlv) => void;
}

const TABLE = [
  {
    cls: Interest,
    checkWire({ type, value }) {
      expect(type).toBe(TT.Interest);
      expect(value).toMatchTlv(
        ({ type, value }) => {
          expect(type).toBe(TT.Name);
          expect(value).toMatchTlv(
            ({ type }) => expect(type).toBe(TT.GenericNameComponent),
            ({ type, length }) => {
              expect(type).toBe(TT.ParametersSha256DigestComponent);
              expect(length).toBe(32);
            },
          );
        },
        ({ type }) => expect(type).toBe(TT.Nonce),
        ({ type, length }) => {
          expect(type).toBe(TT.AppParameters);
          expect(length).toBe(0);
        },
        ({ type }) => expect(type).toBe(TT.ISigInfo),
        ({ type, length }) => {
          expect(type).toBe(TT.ISigValue);
          expect(length).toBe(32);
        },
      );
    },
  },
  {
    cls: Data,
    checkWire({ type, value }) {
      expect(type).toBe(TT.Data);
      expect(value).toMatchTlv(
        ({ decoder }) => expect(decoder.decode(Name).length).toBe(1),
        ({ type }) => expect(type).toBe(TT.DSigInfo),
        ({ type, length }) => {
          expect(type).toBe(TT.DSigValue);
          expect(length).toBe(32);
        },
      );
    },
  },
] as Row[];

test.each(TABLE)("sign %#", async ({ cls }) => {
  const pkt = new cls(new Name("/A"));
  pkt.sigInfo = new SigInfo(SigType.HmacWithSha256, new KeyDigest(Uint8Array.of(0xA0, 0xA1)));
  await expect(ALGO1.sign(pkt)).rejects.toThrow(/mock-signing-error/);

  await ALGO0.sign(pkt);
  expect(() => Encoder.encode(pkt)).not.toThrow();
});

test.each(TABLE)("verify %#", async ({ cls, checkWire }) => {
  const src = new cls(new Name("/A"));
  src.sigInfo = new SigInfo(SigType.Sha256);
  await ALGO0.sign(src);
  const wire = Encoder.encode(src);
  expect(wire).toMatchTlv(checkWire);

  await expect(ALGO0.verify(src)).resolves.toBeUndefined();
  await expect(ALGO1.verify(src)).rejects.toThrow(/incorrect/);

  const obj = new Decoder(wire).decode(cls);
  await expect(ALGO0.verify(obj)).resolves.toBeUndefined();
  await expect(ALGO1.verify(obj)).rejects.toThrow(/incorrect/);
});
