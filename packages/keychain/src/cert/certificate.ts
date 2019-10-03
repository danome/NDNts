import { Data } from "@ndn/l3pkt";

import { CertificateName } from "../name";

import { ContentTypeKEY } from "./an";
import { ValidityPeriod } from "./validity-period";

/**
 * NDN Certificate v2.
 * This type is immutable.
 * To create a new Certificate, use buildCertificate function.
 */
export class Certificate {
  public readonly certName: CertificateName;
  public readonly validity: ValidityPeriod;

  public get name() { return this.data.name; }

  /** Public key in SubjectPublicKeyInfo binary format. */
  public get publicKey() { return this.data.content; }

  constructor(public readonly data: Data) {
    this.certName = CertificateName.from(data.name);
    if (this.data.contentType !== ContentTypeKEY) {
      throw new Error("ContentType must be KEY");
    }
    const validity = ValidityPeriod.get(data.sigInfo);
    if (typeof validity === "undefined") {
      throw new Error("ValidityPeriod is missing");
    }
    this.validity = validity;
  }
}
