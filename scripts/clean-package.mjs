import { rm } from "node:fs/promises";
import { join } from "node:path";

const packageDir = process.cwd();

await Promise.all([
  rm(join(packageDir, "dist"), { force: true, recursive: true }),
  rm(join(packageDir, "tsconfig.tsbuildinfo"), { force: true })
]);

