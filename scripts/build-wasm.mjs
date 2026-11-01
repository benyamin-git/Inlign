#!/usr/bin/env node
// Builds @inlign/engine-wasm into packages/engine-wasm/pkg.
//
// The generated package is git-ignored; `packages/engine-wasm/package.json` is
// the committed shim that points at it.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const crateDir = path.join(repoRoot, "crates", "engine-wasm");

const check = spawnSync("wasm-pack", ["--version"], { stdio: "ignore" });

if (check.error?.code === "ENOENT") {
  console.error(
    [
      "wasm-pack is required to build @inlign/engine-wasm but was not found on PATH.",
      "",
      "Install the target and the tool:",
      "  rustup target add wasm32-unknown-unknown",
      "  cargo install wasm-pack",
      "",
      "Then run `pnpm build:wasm` again.",
    ].join("\n"),
  );
  process.exit(1);
}

const wasmPack = spawn(
  "wasm-pack",
  [
    "build",
    "--target",
    "bundler",
    "--out-dir",
    "../../packages/engine-wasm/pkg",
    "--out-name",
    "inlign_engine_wasm",
  ],
  { cwd: crateDir, stdio: "inherit" },
);

wasmPack.on("error", (error) => {
  console.error(`Failed to run wasm-pack: ${error.message}`);
  process.exit(1);
});

wasmPack.on("close", (code) => {
  process.exit(code ?? 1);
});
