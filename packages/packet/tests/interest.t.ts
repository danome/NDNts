import "../test-fixture/expect";

import { Decoder, Encoder } from "@ndn/tlv";

import { Interest, LLSign, LLVerify, Name, ParamsDigest, SigInfo, SigType, TT } from "..";
import { FwHint } from "../src/fwhint";

test("encode", () => {
  expect(() => new Interest({} as any)).toThrow();

  let interest = new Interest();
  expect(() => Encoder.encode(interest)).toThrow();

  interest = new Interest("/A");
  expect(interest.name).toEqualName("/A");
  expect(interest.canBePrefix).toBeFalsy();
  expect(interest.mustBeFresh).toBeFalsy();
  expect(interest.fwHint).toBeUndefined();
  expect(interest.nonce).toBeUndefined();
  expect(interest.lifetime).toBe(4000);
  expect(interest.hopLimit).toBe(255);
  expect(interest).toEncodeAs([
    0x05, 0x0B,
    0x07, 0x03, 0x08, 0x01, 0x41,
    0x0A, 0x04, undefined, undefined, undefined, undefined,
  ]);
  expect(interest.nonce).toBeUndefined();

  interest = new Interest("/B", Interest.CanBePrefix, Interest.MustBeFresh,
    new FwHint([new FwHint.Delegation("/FH", 33)]),
    Interest.Nonce(0x85AC8579), Interest.Lifetime(8198), Interest.HopLimit(5));
  expect(interest.name).toEqualName("/B");
  expect(interest.canBePrefix).toBeTruthy();
  expect(interest.mustBeFresh).toBeTruthy();
  expect(interest.nonce).not.toBeUndefined();
  expect(interest.nonce).toBe(0x85AC8579);
  expect(interest.lifetime).toBe(8198);
  expect(interest.hopLimit).toBe(5);
  expect(interest).toEncodeAs([
    0x05, 0x23,
    0x07, 0x03, 0x08, 0x01, 0x42,
    0x21, 0x00,
    0x12, 0x00,
    0x1E, 0x0B, 0x1F, 0x09, 0x07, 0x04, 0x08, 0x02, 0x46, 0x48, 0x1E, 0x01, 0x21,
    0x0A, 0x04, 0x85, 0xAC, 0x85, 0x79,
    0x0C, 0x02, 0x20, 0x06,
    0x22, 0x01, 0x05,
  ]);

  interest.name = new Name("C");
  interest.canBePrefix = false;
  interest.mustBeFresh = false;
  interest.fwHint = undefined;
  interest.nonce = undefined;
  interest.lifetime = 4000;
  interest.hopLimit = 255;
  interest = new Interest(interest);
  expect(interest).toEncodeAs([
    0x05, 0x0B,
    0x07, 0x03, 0x08, 0x01, 0x43,
    0x0A, 0x04, undefined, undefined, undefined, undefined,
  ]);
});

test("decode", async () => {
  let decoder = new Decoder(Uint8Array.of(
    0x05, 0x05,
    0x07, 0x03, 0x08, 0x01, 0x41,
  ));
  let interest = decoder.decode(Interest);
  expect(interest.name).toEqualName("/A");
  expect(interest.canBePrefix).toBeFalsy();
  expect(interest.mustBeFresh).toBeFalsy();

  decoder = new Decoder(Uint8Array.of(
    0x05, 0x23,
    0x07, 0x03, 0x08, 0x01, 0x41,
    0x21, 0x00,
    0x12, 0x00,
    0x1E, 0x0B, 0x1F, 0x09, 0x07, 0x04, 0x08, 0x02, 0x46, 0x48, 0x1E, 0x01, 0x21,
    0x0A, 0x04, 0xA0, 0xA1, 0xA2, 0xA3,
    0x0C, 0x02, 0x76, 0xA1,
    0x22, 0x01, 0xDC,
  ));
  interest = decoder.decode(Interest);
  expect(interest.name).toEqualName("/A");
  expect(interest.canBePrefix).toBeTruthy();
  expect(interest.mustBeFresh).toBeTruthy();
  expect(interest.fwHint).toBeDefined();
  expect(interest.fwHint!.delegations).toHaveLength(1);
  expect(interest.nonce).toBe(0xA0A1A2A3);
  expect(interest.lifetime).toBe(30369);
  expect(interest.hopLimit).toBe(220);
  expect(interest.appParameters).toBeUndefined();
  expect(interest.sigInfo).toBeUndefined();
  expect(interest.sigValue).toBeUndefined();

  // noop for non parameterized Interest
  await expect(interest.validateParamsDigest()).resolves.toBeUndefined();
});

test("encode parameterized", async () => {
  // insert empty AppParameters
  let interest = new Interest(new Name("/A").append(ParamsDigest.PLACEHOLDER).append("C"));
  await interest.updateParamsDigest();
  expect(interest).toEncodeAs(({ value }) => {
    expect(value).toMatchTlv(
      ({ decoder }) => {
        const name = decoder.decode(Name);
        expect(name.length).toBe(3);
        expect(name.at(1).is(ParamsDigest)).toBeTruthy();
      },
      ({ type }) => expect(type).toBe(TT.Nonce),
      ({ type, length }) => {
        expect(type).toBe(TT.AppParameters);
        expect(length).toBe(0);
      },
    );
  });

  // append ParamsDigest
  interest = new Interest(new Name("/A"), Uint8Array.of(0xC0, 0xC1));
  await interest.updateParamsDigest();
  expect(interest.name.length).toBe(2);
  expect(interest.name.at(1).is(ParamsDigest)).toBeTruthy();
  expect(Encoder.encode(interest)).toBeInstanceOf(Uint8Array);

  // immediately verifiable
  await expect(interest.validateParamsDigest()).resolves.toBeUndefined();

  // cannot encode placeholder
  interest = new Interest(
    new Name("/A").append(ParamsDigest.PLACEHOLDER).append("C"),
    Uint8Array.of(0xC0, 0xC1),
  );
  expect(() => Encoder.encode(interest)).toThrow(/ParamsDigest/);
});

test("decode parameterized", async () => {
  let decoder = new Decoder(Encoder.encode([
    TT.Interest,
    new Name("/A"),
    [TT.AppParameters, Uint8Array.of(0xC0, 0xC1)],
  ]));
  expect(() => decoder.decode(Interest)).toThrow(/missing/);

  decoder = new Decoder(Encoder.encode([
    TT.Interest,
    new Name("/A").append(ParamsDigest, new Uint8Array(32)),
    [TT.AppParameters, Uint8Array.of(0xC0, 0xC1)],
  ]));
  let interest = decoder.decode(Interest);
  expect(interest.name.length).toBe(2);
  expect(interest.appParameters).not.toBeUndefined();

  interest = new Interest(
    new Name("/A").append(ParamsDigest.PLACEHOLDER).append("C"),
    Uint8Array.of(0xC0, 0xC1),
  );
  await interest.updateParamsDigest();
  const wire = Encoder.encode(interest);
  decoder = new Decoder(wire);
  interest = decoder.decode(Interest);
  expect(interest.name.length).toBe(3);
  expect(interest.appParameters).not.toBeUndefined();

  const verify = jest.fn();
  await expect(interest[LLVerify.OP](verify)).rejects.toThrow();
  expect(verify).not.toHaveBeenCalled();

  await expect(interest.validateParamsDigest()).resolves.toBeUndefined();

  decoder = new Decoder(wire);
  interest = decoder.decode(Interest);
  interest.name = interest.name.replaceAt(1, ParamsDigest.create(new Uint8Array(32)));
  await expect(interest.validateParamsDigest()).rejects.toThrow(/incorrect/);
});

test("encode signed", async () => {
  // error on out of place ParamsDigest
  const interest = new Interest(new Name("/A").append(ParamsDigest.PLACEHOLDER).append("C"));
  interest.sigInfo = new SigInfo(SigType.Sha256);
  const sign = jest.fn();
  await expect(interest[LLSign.OP](sign)).rejects.toThrow(/out of place/);

  // other tests in llsign.t.ts
});

test("decode signed", () => {
  let decoder = new Decoder(Encoder.encode([
    TT.Interest,
    new Name("/A").append(ParamsDigest, new Uint8Array(32)),
    [TT.ISigValue, new Uint8Array(4)],
  ]));
  expect(() => decoder.decode(Interest)).toThrow(/missing/);

  decoder = new Decoder(Encoder.encode([
    TT.Interest,
    new Name("/A").append(ParamsDigest, new Uint8Array(32)),
    [TT.AppParameters, Uint8Array.of(0xC0, 0xC1)],
    [TT.ISigValue, new Uint8Array(4)],
  ]));
  expect(() => decoder.decode(Interest)).toThrow(/missing/);

  decoder = new Decoder(Encoder.encode([
    TT.Interest,
    new Name("/A").append(ParamsDigest, new Uint8Array(32)).append("C"),
    [TT.AppParameters, Uint8Array.of(0xC0, 0xC1)],
    new SigInfo(SigType.Sha256).encodeAs(TT.ISigInfo),
    [TT.ISigValue, new Uint8Array(4)],
  ]));
  expect(() => decoder.decode(Interest)).toThrow(/out of place/);

  decoder = new Decoder(Encoder.encode([
    TT.Interest,
    new Name("/A").append(ParamsDigest, new Uint8Array(32)),
    [TT.AppParameters, Uint8Array.of(0xC0, 0xC1)],
    new SigInfo(SigType.Sha256).encodeAs(TT.ISigInfo),
    [TT.ISigValue, new Uint8Array(4)],
  ]));
  const interest = decoder.decode(Interest);
  expect(interest.name.length).toBe(2);
  expect(interest.appParameters).not.toBeUndefined();
  expect(interest.sigInfo).not.toBeUndefined();
  expect(interest.sigValue).not.toBeUndefined();
});
