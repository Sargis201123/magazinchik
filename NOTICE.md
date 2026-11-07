# Сторонние работы (Notices)

## pixelfx

Пиксельные эффекты в игре — рябь на лужах, светлячки, монетка и золотой всплеск у счётчика, конфетти,
салют (кадры `public/assets/fx_*.png`, описание `src/scenes/fxSheets.ts`) — запечены скриптом
`scripts/fx-bake.mjs` из библиотеки **pixelfx** (https://github.com/patch-gg/pixelfx, коммит a841596) и
перекрашены в палитру игры. Светлячок в `scripts/fx-bake.mjs` повторяет рисунок `weather/fireflies`.
Скилл `.claude/skills/pixelfx` — из той же библиотеки.

**Hugo Duprez (Sprite Fusion).** Часть эффектов pixelfx (и среди наших: светлячок, монетка и всплеск, конфетти,
салют) адаптирует открытые пиксельные эффекты Sprite Fusion (https://www.spritefusion.com/pixel-art-vfx),
Copyright (c) 2026 Hugo Duprez, MIT License.

Шрифт Patch Pixel из `gallery/fonts` pixelfx лицензией MIT не покрыт — в игру и в репозиторий он не взят.

Лицензия pixelfx:

```
MIT License

Copyright (c) 2026 Patch
Copyright (c) 2026 Hugo Duprez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Pixel Food — Henry Software (CC0)

Значки хлеба, мяса и рыбы в окнах игры (`public/assets/uiitem_*.png`) сделаны из набора
[Pixel Food](https://henrysoftware.itch.io/pixel-food) (Henry Software) и переведены в палитру игры
(`art/ui_items.py`). Лицензия набора — CC0 1.0 (общественное достояние): указывать автора не обязательно,
указываем с благодарностью. Исходный лист и заметка о лицензии — `art/vendor/henry-pixel-food/`.
