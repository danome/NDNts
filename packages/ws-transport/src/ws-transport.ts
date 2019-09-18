import { DatagramTransport } from "@ndn/llface";
import WebSocketStream from "websocket-stream";

/** WebSocket transport. */
export class WsTransport extends DatagramTransport {
  public static async connect(uri: string): Promise<WsTransport> {
    const stream = WebSocketStream(uri,
      {
        objectMode: true,
        perMessageDeflate: false,
      } as any);
    return new WsTransport(stream);
  }

  protected constructor(stream: WebSocketStream.WebSocketDuplex) {
    super(stream);
  }
}