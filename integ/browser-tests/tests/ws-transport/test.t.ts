import "./api";

import * as TestTransport from "@ndn/l3face/test-fixture/transport";
import * as WsTest from "@ndn/ws-transport/test-fixture/wss";

import { navigateToPage, pageInvoke } from "../../test-fixture/pptr";

beforeEach(() => Promise.all([
  WsTest.createServer(),
  navigateToPage(__dirname),
]));

afterEach(WsTest.destroyServer);

test("pair", async () => {
  await pageInvoke<typeof window.connectWsTransportPair>(page, "connectWsTransportPair", WsTest.uri);
  await WsTest.waitNClients(2);
  WsTest.enableBroadcast();
  const result = await pageInvoke<typeof window.testWsTransportPair>(page, "testWsTransportPair");
  TestTransport.check(result);
});
