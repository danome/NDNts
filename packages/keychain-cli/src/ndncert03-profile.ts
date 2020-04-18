import { CertificateName } from "@ndn/keychain";
import { CaProfile } from "@ndn/ndncert";
import { Name } from "@ndn/packet";
import { Encoder } from "@ndn/tlv";
import { promises as fs } from "graceful-fs";
import { Arguments, Argv, CommandModule } from "yargs";

import { keyChain } from "./util";

interface Args {
  out: string;
  prefix: string;
  info: string;
  cert: string;
  "valid-days": number;
}

export class Ndncert03ProfileCommand implements CommandModule<{}, Args> {
  public command = "ndncert03-profile";
  public describe = "generate CA profile of NDNCERT 0.3";

  public builder(argv: Argv): Argv<Args> {
    return argv
      .option("out", {
        demandOption: true,
        desc: "output filename",
        type: "string",
      })
      .option("prefix", {
        demandOption: true,
        desc: "CA name prefix",
        type: "string",
      })
      .option("info", {
        default: "NDNts NDNCERT CA",
        desc: "CA introduction",
        type: "string",
      })
      .option("cert", {
        demandOption: true,
        desc: "CA certificate name",
        type: "string",
      })
      .option("valid-days", {
        default: 30,
        desc: "maximum validity period",
        type: "number",
      });
  }

  public async handler(args: Arguments<Args>) {
    const certName = CertificateName.from(new Name(args.cert));
    const cert = await keyChain.getCert(certName.toName());
    const signer = await keyChain.getPrivateKey(certName.toKeyName().toName());

    const profile = await CaProfile.build({
      prefix: new Name(args.prefix),
      info: args.info,
      probeKeys: [],
      maxValidityPeriod: 86400 * args["valid-days"],
      cert,
      signer,
    });
    await fs.writeFile(args.out, Encoder.encode(profile.data));
  }
}
