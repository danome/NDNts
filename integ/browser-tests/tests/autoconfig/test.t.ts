import "./api";

import { navigateToPage, pageInvoke } from "../../test-fixture/pptr";

beforeEach(() => navigateToPage(__dirname));

test("connectToTestbed", async () => {
  const record = await pageInvoke<typeof window.testConnectToTestbed>(page, "testConnectToTestbed");
  expect(record.faces.length).toBeGreaterThan(0);
});
