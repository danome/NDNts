import { KeyChainImplWebCrypto as crypto, timingSafeEqual } from "@ndn/keychain";
import { fromUtf8 } from "@ndn/tlv";
import { EventEmitter } from "events";
import StrictEventEmitter from "strict-event-emitter-types";

import { ChallengeRequest } from "../packet/mod";
import { ServerChallenge, ServerChallengeContext, ServerChallengeResponse } from "./challenge";

interface Events {
  newpin: (requestId: Uint8Array, pin: string) => void;
}

type Emitter = StrictEventEmitter<EventEmitter, Events>;

class State {
  public readonly pin: Uint8Array;

  constructor() {
    this.pin = crypto.getRandomValues(new Uint8Array(6));
    for (let i = 0; i < this.pin.byteLength; ++i) {
      this.pin[i] = 0x30 | (this.pin[i] % 10);
    }
  }

  public verify(code: Uint8Array): boolean {
    return timingSafeEqual(this.pin, code);
  }
}

export class ServerPinChallenge extends (EventEmitter as new() => Emitter) implements ServerChallenge {
  public readonly challengeId = "pin";
  public readonly timeLimit = 60000;
  public readonly retryLimit = 3;

  public async process(request: ChallengeRequest, context: ServerChallengeContext): Promise<ServerChallengeResponse> {
    if (typeof context.challengeState === "undefined") {
      const state = new State();
      this.emit("newpin", request.requestId, fromUtf8(state.pin));
      context.challengeState = state;
      return {
        success: false,
        decrementRetry: false,
        challengeStatus: "need-code",
      };
    }

    const state = context.challengeState as State;
    const code = request.parameters.code;
    if (!code || !state.verify(code)) {
      return {
        success: false,
        decrementRetry: true,
        challengeStatus: "wrong-code",
      };
    }

    return {
      success: true,
      decrementRetry: false,
      challengeStatus: "success",
    };
  }
}
