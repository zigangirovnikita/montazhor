/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
let css = fs.readFileSync('/Users/nikitazigangirov/Projects/montazhor/app/components/TemplateBuilder.module.css', 'utf-8');

const presetsToRemoveBg = [
  'preset-kinetic_phrase_glass',
  'preset-kinetic_phrase_slam',
  'preset-caption_matrix_decode',
  'preset-caption_neon_glow',
  'preset-caption_gradient_fill',
  'preset-caption_clip_wipe',
  'preset-caption_highlight',
  'preset-caption_glitch_rgb',
  'preset-caption_emoji_pop',
  'preset-caption_particle_burst',
  'preset-caption_editorial_emphasis'
];

presetsToRemoveBg.forEach(preset => {
  const regex = new RegExp(`\\.overlay:global\\(\\.\\${preset}\\) :global\\(\\.phrase-card\\) \\{[^}]+\\}`, 'g');
  css = css.replace(regex, '');
});

fs.writeFileSync('/Users/nikitazigangirov/Projects/montazhor/app/components/TemplateBuilder.module.css', css);
console.log("CSS patched!");
