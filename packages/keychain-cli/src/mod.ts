import "hard-rejection/register.js";

import yargs from "yargs";

import { AddCertCommand } from "./add-cert";
import { DeleteCommand } from "./delete";
import { GenKeyCommand } from "./gen-key";
import { ImportNdnsecCommand } from "./import-ndnsec";
import { ImportSafeBagCommand } from "./import-safebag";
import { IssueCertCommand } from "./issue-cert";
import { ListCertsCommand } from "./list-certs";
import { ListKeysCommand } from "./list-keys";
import { Ndncert02ClientCommand } from "./ndncert02-client";
import { Ndncert03CaCommand } from "./ndncert03-ca";
import { Ndncert03ClientCommand } from "./ndncert03-client";
import { Ndncert03MakeProfileCommand } from "./ndncert03-make-profile";
import { Ndncert03ShowProfileCommand } from "./ndncert03-show-profile";
import { ShowCertCommand } from "./show-cert";

yargs
  .scriptName("ndntssec")
  .command(new GenKeyCommand())
  .command(new ShowCertCommand())
  .command(new DeleteCommand())
  .command(new IssueCertCommand())
  .command(new ListKeysCommand())
  .command(new ListCertsCommand())
  .command(new AddCertCommand())
  .command(new ImportSafeBagCommand())
  .command(new ImportNdnsecCommand())
  .command(new Ndncert02ClientCommand())
  .command(new Ndncert03MakeProfileCommand())
  .command(new Ndncert03ShowProfileCommand())
  .command(new Ndncert03CaCommand())
  .command(new Ndncert03ClientCommand())
  .demandCommand()
  .parse();
