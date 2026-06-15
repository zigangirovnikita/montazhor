/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
let code = fs.readFileSync('/Users/nikitazigangirov/Projects/montazhor/app/components/TemplateBuilder.tsx', 'utf-8');

code = code.replace(
  /const targets = el\.querySelectorAll\("\.keyword, \.number-value, \.bullet-card, \.check-item, \.bar, \.keyword-line, \.truth-word, \.myth-word, \.stat-row, \.concept-center, \.concept-node, \.lesson-title, \.lesson-subtext"\);\n\s*gsap\.killTweensOf\(targets\);\n\s*gsap\.set\(targets, \{ opacity: 0, y: 0, x: 0, scale: 1, rotate: 0, scaleY: 1, "--strike-scale": 0, "--shine-x": "-130%" \}\);/g,
  `const targets = el.querySelectorAll(".keyword, .number-value, .bullet-card, .check-item, .bar, .keyword-line, .truth-word, .myth-word, .stat-row, .concept-center, .concept-node, .lesson-title, .lesson-subtext");\n      if (targets.length > 0) {\n        gsap.killTweensOf(targets);\n        gsap.set(targets, { opacity: 0, y: 0, x: 0, scale: 1, rotate: 0, scaleY: 1, "--strike-scale": 0, "--shine-x": "-130%" });\n      }`
);

fs.writeFileSync('/Users/nikitazigangirov/Projects/montazhor/app/components/TemplateBuilder.tsx', code);
console.log("Targets patched!");
