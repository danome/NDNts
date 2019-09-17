const fs = require("fs");
const path = require("path");

const tsconfig = {
  compilerOptions: {
    baseUrl: "..",
    paths: {},
  },
};

fs.readdirSync("packages", { withFileTypes: true })
.forEach((direct) => {
  if (!direct.isDirectory()) {
    return;
  }
  const { name, private } = require(path.join("..", "packages", direct.name, "package.json"));
  if (!!private || !name) {
    return;
  }
  tsconfig.compilerOptions.paths[name] = [path.join("packages", direct.name, "src")];
  tsconfig.compilerOptions.paths[`${name}/test-fixture`] = [path.join("packages", direct.name, "test-fixture")];
});

fs.writeFileSync("mk/tsconfig-paths.json", JSON.stringify(tsconfig, undefined, 2));
