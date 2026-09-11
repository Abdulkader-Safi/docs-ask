#!/usr/bin/env node
import { main } from "./main.ts";

main().then(
  (code) => { process.exitCode = code; },
  (err) => { console.error(err); process.exitCode = 1; },
);
