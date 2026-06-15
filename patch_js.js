/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
let code = fs.readFileSync('/Users/nikitazigangirov/Projects/montazhor/app/components/TemplateBuilder.tsx', 'utf-8');

// 1. Remove .phrase-word from targets
code = code.replace(
  /const targets = el\.querySelectorAll\("\.phrase-word, \.keyword/g,
  'const targets = el.querySelectorAll(".keyword'
);

// 2. Remove gsap.set(words, { opacity: 1 });
code = code.replace(
  /gsap\.set\(words, \{ opacity: 1 \}\);\n/g,
  ''
);

fs.writeFileSync('/Users/nikitazigangirov/Projects/montazhor/app/components/TemplateBuilder.tsx', code);
console.log("JS patched!");
