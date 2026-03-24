#!/usr/bin/env node

const bold = (s) => `\x1b[1m${s}\x1b[22m`;
const cyan = (s) => `\x1b[36m${s}\x1b[39m`;
const dim = (s) => `\x1b[2m${s}\x1b[22m`;

console.log("");
console.log(`  ${bold("kiyas")} ${dim("(كياس)")} installed successfully!`);
console.log("");
console.log(`  Run ${cyan("kiyas setup")} to get started.`);
console.log("");
