import { DataResponse, Forwarder, FwFace, InterestToken, RejectInterest } from "@ndn/fw";
import { Data, Interest } from "@ndn/l3pkt";
import { Name, NamingConvention } from "@ndn/name";
import { Segment as Segment03 } from "@ndn/naming-convention-03";
import { EventEmitter } from "events";
import pushable from "it-pushable";
import assert from "minimalistic-assert";
import pDefer from "p-defer";
import { writeToStream } from "streaming-iterables";
import StrictEventEmitter from "strict-event-emitter-types";

interface Events {
  /** Emitted when a Data segment arrives. */
  segment: (segmentNum: number, data: Data) => void;
  /** Emitted when a data chunk arrives, in segment number order. */
  data: Uint8Array;
  /** Emitted after all data chunks arrive. */
  end: void;
  /** Emitted upon error. */
  error: Error;
}

type Emitter = StrictEventEmitter<EventEmitter, Events>;

class Fetcher extends (EventEmitter as new() => Emitter) {
  /**
   * Wait for the segmented object to be completely fetched.
   * Resolves to reassembled object; rejects upon error.
   *
   * This property must be first accessed right after fetch() function call.
   */
  public get promise() {
    if (!this.promise_) {
      this.promise_ = new Promise<Uint8Array>((resolve, reject) => {
        let totalLength = 0;
        const chunks = [] as Uint8Array[];
        this.on("data", (chunk) => {
          chunks.push(chunk);
          totalLength += chunk.length;
        });
        this.on("end", () => {
          const output = new Uint8Array(totalLength);
          let offset = 0;
          chunks.forEach((chunk) => {
            output.set(chunk, offset);
            offset += chunk.length;
          });
          assert.equal(offset, totalLength);
          resolve(output);
        });
        this.on("error", reject);
      });
    }
    return this.promise_;
  }

  /**
   * Iterate over chunks of the segmented object in order.
   *
   * This property must be first accessed right after fetch() function call.
   */
  public get chunks(): AsyncIterable<Uint8Array> {
    const it = pushable<Uint8Array>();
    this.on("data", (chunk) => it.push(chunk));
    this.on("end", () => it.end());
    this.on("error", (err) => it.end(err));
    return it;
  }

  /** Deliver packets to forwarding. */
  private tx = pushable<FwFace.Rxable>();
  private promise_?: Promise<Uint8Array>;
  private finalBlockId?: number;

  constructor(public readonly name: Name, opts: fetch.Options) {
    super();
    Object.assign(this, opts);
    (this as EventEmitter).on("newListener", this.waitForDataListener);
  }

  /** Stop fetching immediately. */
  public abort = (err?: Error) => {
    this.emit("error", err ?? new Error("abort"));
    this.tx.end();
  }

  /**
   * Write the segmented object to a stream as it's being fetched.
   * @param stream destination stream; it will not be closed.
   * @returns a Promise that resolves upon completion or rejects upon error.
   *
   * This must be invoked right after fetch() function call.
   */
  public writeToStream(stream: NodeJS.WritableStream): Promise<void> {
    return writeToStream(stream, this.chunks);
  }

  private waitForDataListener = (eventName: string) => {
    if (eventName !== "data") {
      return;
    }
    (this as EventEmitter).off("newListener", this.waitForDataListener);

    this.fw.addFace({
      extendedTx: true,
      rx: this.tx,
      toString: () => `fetch(${this.name})`,
      tx: this.rx,
    });

    this.run().catch(this.abort);
  }

  private async run() {
    for (let i = this.segmentRange?.[0] ?? 0;
         i <= Math.min(this.finalBlockId ?? Infinity, (this.segmentRange?.[1] ?? Infinity) - 1);
         ++i) {
      const dataPromise = pDefer<Data>();
      this.tx.push(InterestToken.set(
        new Interest(this.name.append(this.segmentNumConvention, i),
                     Interest.Lifetime(this.interestLifetime)),
        dataPromise,
      ));
      const data = await dataPromise.promise;
      this.emit("segment", i, data);

      if (data.finalBlockId && data.finalBlockId.equals(data.name.at(-1))) {
        this.finalBlockId = i;
      }
      this.emit("data", data.content);
    }

    this.tx.end();
    this.emit("end");
  }

  /** Process packet from forwarding. */
  private rx = async (iterable: AsyncIterable<FwFace.Txable>) => {
    for await (const pkt of iterable) {
      switch (true) {
        case pkt instanceof Data: {
          const data = pkt as DataResponse<pDefer.DeferredPromise<Data>>;
          for (const dataPromise of InterestToken.get(data)) {
            dataPromise.resolve(data);
          }
          break;
        }
        case pkt instanceof RejectInterest: {
          const rej = pkt as RejectInterest<pDefer.DeferredPromise<Data>>;
          const dataPromise = InterestToken.get(rej);
          dataPromise.reject(new Error(rej.reason));
          break;
        }
      }
    }
  }
}
interface Fetcher extends fetch.Options {}

/** Initiate fetching of a segment object. */
export function fetch(name: Name, opts: Partial<fetch.Options> = {}): fetch.Fetcher {
  return new Fetcher(name, {
    fw: Forwarder.getDefault(),
    segmentNumConvention: Segment03,
    interestLifetime: Interest.DefaultLifetime,
    ...opts,
  });
}

type Fetcher_ = Fetcher;

export namespace fetch {
  export interface Options {
    /** Use the specified forwarder instead of the default. */
    fw: Forwarder;

    /**
     * Choose a segment number naming convention.
     * Default is Segment from @ndn/naming-convention-03 package.
     */
    segmentNumConvention: NamingConvention<number, unknown>;

    /**
     * Specify segment number range as [begin, end).
     * The begin segment number is inclusive and the end segment number is exclusive.
     * If the begin segment number is greater than the final segment number, fetching will fail.
     * If the end segment number is undefined or greater than the final segment number,
     * fetching will stop at the final segment.
     */
    segmentRange?: [number, number|undefined];

    /** Specify InterestLifetime. */
    interestLifetime: number;
  }

  /** Fetching progress and response. */
  export type Fetcher = Omit<Fetcher_, keyof Options>;
}
