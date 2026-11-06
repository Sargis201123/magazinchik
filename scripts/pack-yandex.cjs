// Архив для Яндекс Игр (npm run build:yandex): dist-yandex/ → dist-yandex.zip, index.html в корне.
// Убираем то, что нужно только Telegram и серверу (картинки карточек и ролик бота, заголовки Cloudflare),
// и проверяем требования площадки: без пробелов и кириллицы в именах (п. 1.21), не больше 100 МБ.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-yandex');
const ZIP = path.join(ROOT, 'dist-yandex.zip');
const LIMIT = 100 * 1024 * 1024;

for (const extra of ['promo', '_headers']) fs.rmSync(path.join(DIST, extra), { recursive: true, force: true });

const files = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else files.push(full);
  }
};
walk(DIST);

const bad = files.map((f) => path.relative(DIST, f)).filter((f) => /[\sЀ-ӿ]/.test(f));
if (bad.length) {
  console.error('Пробелы или кириллица в именах файлов (Яндекс не примет):', bad.slice(0, 10));
  process.exit(1);
}
const total = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
if (total > LIMIT) {
  console.error(`Игра весит ${(total / 1024 / 1024).toFixed(1)} МБ — больше 100 МБ.`);
  process.exit(1);
}
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
if (html.includes('telegram.org') || !html.includes('/sdk.js')) {
  console.error('index.html: нет /sdk.js или остался скрипт Telegram.');
  process.exit(1);
}

fs.rmSync(ZIP, { force: true });
execFileSync('zip', ['-r', '-q', '-X', ZIP, '.'], { cwd: DIST, stdio: 'inherit' });
console.log(`${path.relative(ROOT, ZIP)}: ${files.length} файлов, ${(total / 1024 / 1024).toFixed(1)} МБ без сжатия, архив ${(fs.statSync(ZIP).size / 1024 / 1024).toFixed(1)} МБ`);
