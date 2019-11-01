import { SimpleEndpoint } from "@ndn/fw";
import { Interest } from "@ndn/l3pkt";
import { Name, NamingConvention } from "@ndn/name";
import { Segment as Segment03, Version as Version03 } from "@ndn/naming-convention-03";

import { fetch } from "./fetch";

/** Discover version with CanBePrefix. */
export function discoverVersion(name: Name, opts: Partial<discoverVersion.Options> = {}): discoverVersion.Progress {
  const { versionMustBeFresh, versionConvention, segmentNumConvention } = {
    versionMustBeFresh: true,
    versionConvention: Version03,
    segmentNumConvention: Segment03,
    ...opts,
  };

  const interest = new Interest(name, Interest.CanBePrefix, Interest.MustBeFresh);
  interest.mustBeFresh = versionMustBeFresh;
  const consumer = new SimpleEndpoint(opts.fw).consume(interest);
  return Object.assign(
    consumer.then((data) => {
      if (data.name.length !== name.length + 2 ||
          !versionConvention.match(data.name.get(-2)!) ||
          !segmentNumConvention.match(data.name.get(-1)!)) {
        throw new Error(`cannot extract version from ${data.name}`);
      }
      return data.name.getPrefix(-1);
    }),
    { abort() { consumer.abort(); } },
  );
}

export namespace discoverVersion {
  export interface Options extends fetch.Options {
    /**
     * Choose a version naming convention.
     * Default is Version from @ndn/naming-convention-03 package.
     */
    versionConvention: NamingConvention<unknown, unknown>;

    /**
     * Whether to set MustBeFresh on version discovery Interest.
     * Default is true.
     */
    versionMustBeFresh: boolean;
  }

  export type Progress = Promise<Name> & {
    abort(): void;
  };
}
