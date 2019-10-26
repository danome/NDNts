import { Forwarder, FwFace, SimpleEndpoint } from "@ndn/fw";
import { L3Face } from "@ndn/l3face";
import { Interest } from "@ndn/l3pkt";
import { Name } from "@ndn/name";
import hirestime from "hirestime";

import { createTransport } from "./platform";

const getNow = hirestime();

async function testConnection(face: FwFace, name: Name = new Name("/localhop/nfd/rib/list")) {
  face.addRoute(name);
  try {
    const interest = new Interest(name, Interest.CanBePrefix,
                                  Interest.Lifetime(1000));
    await new SimpleEndpoint(face.fw).consume(interest);
  } finally {
    face.removeRoute(name);
  }
}

function makeDefaultOptions() {
  return {
    fw: Forwarder.getDefault(),
    testConnection,
  } as connect.Options;
}

/** Connect to a router and test the connection. */
export async function connect(host: string, options: Partial<connect.Options> = {}): Promise<connect.Result> {
  const opts = { ...makeDefaultOptions(), ...options };
  const { fw, testConnection: tc } = opts;
  const transport = await createTransport(host, opts);
  const face = fw.addFace(new L3Face(transport));

  const testConnectionStart = getNow();
  let testConnectionDuration: number;
  let testConnectionResult: any;
  try {
    if (typeof tc === "function") {
      testConnectionResult = await tc(face);
    } else {
      await testConnection(face, tc);
    }
    testConnectionDuration = getNow() - testConnectionStart;
  } catch (err) {
    face.close();
    throw err;
  }
  return { face, testConnectionDuration, testConnectionResult };
}

export namespace connect {
  export interface Options {
    fw: Forwarder;

    /** Test that the face can reach a given name, or provide custom tester function. */
    testConnection: Name | ((face: FwFace) => Promise<any>);
  }

  export interface Result {
    /** Created face */
    face: FwFace;
    /** Execution duration of testConnection function. */
    testConnectionDuration: number;
    /** Return value from custom testConnection function. */
    testConnectionResult: any;
  }
}