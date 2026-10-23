# Звуки действий и голоса: откуда каждый звук

Всё, что лежит в `public/audio/sfx/`, собирает `art/sfx/render.py` из двух источников:

- **записи Kenney** (www.kenney.nl) — наборы *Impact Sounds*, *RPG Audio*, *Casino Audio*, *Foley Sounds*,
  лицензия **CC0 1.0** (`License.txt` каждого набора: «free to use in personal, educational and commercial
  projects», указывать автора не обязательно). Файлы скачивает `art/sfx/sources.py` из зеркала
  `series-ai/jam-ready-assets` на GitHub и сверяет с контрольными суммами SHA-256 (они же — в Git LFS зеркала);
  лицензия набора скачивается рядом и проверяется на CC0;
- **свой синтез** (`art/sfx/synth.py`, `art/sfx/voice.py`) — numpy, без чужих записей: колокольчики, сканер,
  касса, швабра, скотч, кот, пёс и все слоги голосов. Чужих прав в нём нет, указывать авторов не нужно.

Записанных голосов кота и собаки под CC0 отсюда достать не удалось (freesound, BigSoundBank и OpenGameArt
закрыты для этой машины, а копии в чужих репозиториях — без проверяемой лицензии), поэтому они синтезированы
моделью голоса. Свою запись можно подложить вместо синтеза: функция `meow`/`bark` в `synth.py` → чтение файла.

Проверка уровней: `python3 art/sfx/check.py` (пик, RMS, длительность, доля «подвала» каждого куска).

## Ленты

- `sfx.ogg` / `sfx.m4a` — звуки действий, 36.526 с;
- `voice.ogg` / `voice.m4a` — слоги голосов, 31.611 с, 78 слогов × 2 голоса,
  свой синтез (`voice.py`), без чужих прав.

## Звуки действий

| звук | вариант | откуда | лицензия |
|---|---|---|---|
| `scan` | 1 | сканер: пьезо «пик» 1 | свой синтез (art/sfx), без чужих прав |
| `scan` | 2 | сканер: пьезо «пик» 2 | свой синтез (art/sfx), без чужих прав |
| `scan` | 3 | сканер: пьезо «пик» 3 | свой синтез (art/sfx), без чужих прав |
| `scan` | 4 | сканер: пьезо «пик» 4 | свой синтез (art/sfx), без чужих прав |
| `till` | 1 | касса: рычаг, звонок, ящик 1 | свой синтез (art/sfx), без чужих прав; щелчок рычага — RPG Audio (1.0) / metalLatch.ogg, мелочь — handleCoins2.ogg (CC0 1.0 (Kenney, www.kenney.nl; License.txt набора)) |
| `till` | 2 | касса: рычаг, звонок, ящик 2 | свой синтез (art/sfx), без чужих прав; щелчок рычага — RPG Audio (1.0) / metalLatch.ogg, мелочь — handleCoins2.ogg (CC0 1.0 (Kenney, www.kenney.nl; License.txt набора)) |
| `till` | 3 | касса: рычаг, звонок, ящик 3 | свой синтез (art/sfx), без чужих прав; щелчок рычага — RPG Audio (1.0) / metalLatch.ogg, мелочь — handleCoins2.ogg (CC0 1.0 (Kenney, www.kenney.nl; License.txt набора)) |
| `till` | 4 | касса: рычаг, звонок, ящик 4 | свой синтез (art/sfx), без чужих прав; щелчок рычага — RPG Audio (1.0) / metalLatch.ogg, мелочь — handleCoins2.ogg (CC0 1.0 (Kenney, www.kenney.nl; License.txt набора)) |
| `coin` | 1 | RPG Audio (1.0) / handleCoins.ogg, 0.10–0.40 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `coin` | 2 | RPG Audio (1.0) / handleCoins.ogg, 0.43–0.73 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `coin` | 3 | RPG Audio (1.0) / handleCoins2.ogg, 0.00–0.32 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `coin` | 4 | RPG Audio (1.0) / handleCoins.ogg, 0.23–0.45 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `coin` | 5 | RPG Audio (1.0) / handleCoins.ogg, 0.57–0.85 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `notes` | 1 | Casino Audio (1.1) / card-fan-1.ogg, 0.14–0.44 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `notes` | 2 | Casino Audio (1.1) / card-fan-1.ogg, 0.37–0.70 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `notes` | 3 | Casino Audio (1.1) / card-fan-2.ogg, 0.49–0.79 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `notes` | 4 | Casino Audio (1.1) / card-fan-2.ogg, 0.80–1.12 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `glass` | 1 | Impact Sounds (1.0) / impactGlass_light_000.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `glass` | 2 | Impact Sounds (1.0) / impactGlass_light_001.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `glass` | 3 | Impact Sounds (1.0) / impactGlass_light_002.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `glass` | 4 | Impact Sounds (1.0) / impactGlass_light_003.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `glass` | 5 | Impact Sounds (1.0) / impactGlass_light_004.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `tin` | 1 | Impact Sounds (1.0) / impactTin_medium_000.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `tin` | 2 | Impact Sounds (1.0) / impactTin_medium_001.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `tin` | 3 | Impact Sounds (1.0) / impactTin_medium_002.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `tin` | 4 | Impact Sounds (1.0) / impactTin_medium_003.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `tin` | 5 | Impact Sounds (1.0) / impactTin_medium_004.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `bump` | 1 | Impact Sounds (1.0) / impactGeneric_light_000.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `bump` | 2 | Impact Sounds (1.0) / impactGeneric_light_001.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `bump` | 3 | Impact Sounds (1.0) / impactGeneric_light_002.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `bump` | 4 | Impact Sounds (1.0) / impactGeneric_light_003.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `soft` | 1 | RPG Audio (1.0) / dropLeather.ogg, 0.12–0.42 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `soft` | 2 | RPG Audio (1.0) / handleSmallLeather.ogg, 0.06–0.32 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `soft` | 3 | RPG Audio (1.0) / cloth4.ogg, 0.00–0.30 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `soft` | 4 | Casino Audio (1.1) / card-slide-1.ogg, 0.12–0.40 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `box` | 1 | Casino Audio (1.1) / card-place-1.ogg, 0.13–0.40 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `box` | 2 | Casino Audio (1.1) / card-place-3.ogg, 0.27–0.56 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `box` | 3 | Casino Audio (1.1) / card-place-4.ogg, 0.11–0.41 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `box` | 4 | RPG Audio (1.0) / bookPlace2.ogg, 0.00–0.25 с, высота ×1.25 | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `paper` | 1 | Casino Audio (1.1) / card-slide-5.ogg, 0.10–0.35 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `paper` | 2 | Casino Audio (1.1) / card-slide-6.ogg, 0.00–0.14 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `paper` | 3 | Casino Audio (1.1) / card-slide-6.ogg, 0.14–0.40 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `paper` | 4 | Casino Audio (1.1) / card-place-4.ogg, 0.23–0.45 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `door` | 1 | колокольчик над дверью 1 | свой синтез (art/sfx), без чужих прав |
| `door` | 2 | колокольчик над дверью 2 | свой синтез (art/sfx), без чужих прав |
| `door` | 3 | колокольчик над дверью 3 | свой синтез (art/sfx), без чужих прав |
| `bell` | 1 | колокольчик: дверь распахнули 1 | свой синтез (art/sfx), без чужих прав |
| `bell` | 2 | колокольчик: дверь распахнули 2 | свой синтез (art/sfx), без чужих прав |
| `bell` | 3 | колокольчик: дверь распахнули 3 | свой синтез (art/sfx), без чужих прав |
| `ding` | 1 | таймер печи 1 | свой синтез (art/sfx), без чужих прав |
| `ding` | 2 | таймер печи 2 | свой синтез (art/sfx), без чужих прав |
| `unbox` | 1 | скотч и клапаны коробки 1 | свой синтез (art/sfx), без чужих прав |
| `unbox` | 2 | скотч и клапаны коробки 2 | свой синтез (art/sfx), без чужих прав |
| `unbox` | 3 | скотч и клапаны коробки 3 | свой синтез (art/sfx), без чужих прав |
| `boxland` | 1 | RPG Audio (1.0) / bookPlace1.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `boxland` | 2 | RPG Audio (1.0) / bookPlace2.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `boxland` | 3 | RPG Audio (1.0) / bookPlace3.ogg | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `mop` | 1 | швабра 1 | свой синтез (art/sfx), без чужих прав; брызги — Foley Sounds (1.0) / sinkWater3.ogg (CC0 1.0 (Kenney, www.kenney.nl; License.txt набора)) |
| `mop` | 2 | швабра 2 | свой синтез (art/sfx), без чужих прав; брызги — Foley Sounds (1.0) / sinkWater3.ogg (CC0 1.0 (Kenney, www.kenney.nl; License.txt набора)) |
| `mop` | 3 | швабра 3 | свой синтез (art/sfx), без чужих прав; брызги — Foley Sounds (1.0) / sinkWater3.ogg (CC0 1.0 (Kenney, www.kenney.nl; License.txt набора)) |
| `mop` | 4 | швабра 4 | свой синтез (art/sfx), без чужих прав; брызги — Foley Sounds (1.0) / sinkWater3.ogg (CC0 1.0 (Kenney, www.kenney.nl; License.txt набора)) |
| `meow` | 1 | мяу | свой синтез (art/sfx), без чужих прав |
| `meow` | 2 | короткое «мя» | свой синтез (art/sfx), без чужих прав |
| `meow` | 3 | «мррау?» | свой синтез (art/sfx), без чужих прав |
| `meow` | 4 | долгое «мяяу» | свой синтез (art/sfx), без чужих прав |
| `bark` | 1 | гав | свой синтез (art/sfx), без чужих прав |
| `bark` | 2 | гав-гав | свой синтез (art/sfx), без чужих прав |
| `bark` | 3 | тяв-тяв-тяв | свой синтез (art/sfx), без чужих прав |
| `click` | 1 | Impact Sounds (1.0) / impactWood_light_000.ogg, 0.00–0.07 с, высота ×1.7 | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `click` | 2 | Impact Sounds (1.0) / impactWood_light_001.ogg, 0.00–0.07 с, высота ×1.7 | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `click` | 3 | Impact Sounds (1.0) / impactWood_light_002.ogg, 0.00–0.07 с, высота ×1.7 | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `click` | 4 | Impact Sounds (1.0) / impactWood_light_003.ogg, 0.00–0.07 с, высота ×1.7 | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `click` | 5 | Impact Sounds (1.0) / impactWood_light_004.ogg, 0.00–0.07 с, высота ×1.7 | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `page` | 1 | RPG Audio (1.0) / bookFlip2.ogg, 0.00–0.20 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `page` | 2 | RPG Audio (1.0) / bookFlip2.ogg, 0.19–0.41 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
| `page` | 3 | RPG Audio (1.0) / bookFlip3.ogg, 0.00–0.22 с | CC0 1.0 (Kenney, www.kenney.nl; License.txt набора) |
