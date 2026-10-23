# Атмосфера «Магазинчика»: откуда каждый звук

Файлы игры — `public/audio/amb/*.ogg` (Opus, Android и ПК) и `*.m4a` (AAC, iPhone и Safari), описание —
`public/audio/amb/manifest.json`. Собирает их `art/ambience/render.py`, проверяет `art/ambience/check.py`.
Всё, что в них звучит, — либо записи под **CC0** (общественное достояние: можно в коммерческой игре,
без указания автора), либо синтез с нуля (numpy, без чужих записей).

## Как проверялась лицензия

Сайты Freesound, Kenney, OpenGameArt, BigSoundBank из среды сборки закрыты, поэтому записи взяты из
набора **ESC-50** (K. J. Piczak, «ESC: Dataset for Environmental Sound Classification», ACM MM 2015,
<https://github.com/karolpiczak/ESC-50>). Это 2000 пятисекундных отрывков из записей Freesound. Набор
целиком выложен под CC BY-NC, но в его файле `LICENSE` для **каждого** отрывка указаны исходная запись
на Freesound, её автор и лицензия, под которой автор её выложил. Берём только отрывки с пометкой `[CC0]`.

Проверка — не на слово, а при каждом рендере (`art/ambience/sources.py`):
- скачивается `LICENSE` набора, и для каждого отрывка сверяется, что он записан именно как `[CC0]`,
  именно от этого автора и этой записи Freesound; не сошлось — рендер останавливается;
- сам отрывок сверяется по SHA-256 (первые 16 знаков — в таблице `CLIPS`): изменённый файл не пройдёт.

Перед выпуском стоит один раз открыть страницы записей на Freesound (ссылки ниже) и убедиться, что там
по-прежнему «Creative Commons 0» — из среды сборки это было недоступно. Лицензия CC0 безотзывна: даже
если автор потом сменит её для новых скачиваний, уже полученная копия остаётся CC0.

Рассматривались и не взяты: звуки приложения Blanket (часть — CC BY, у остальных лицензию можно
подтвердить только их собственным списком), набор UI-звуков uisfx (CC0, но это кнопки, а не улица).

## Записи (CC0, через ESC-50)

| отрывок ESC-50 | в файле | запись на Freesound | автор | страница | лицензия | что это |
|---|---|---|---|---|---|---|
| `2-73027-A-10` | rain | rain_on_greenhouse.mp3 | j1987 | [73027](https://freesound.org/people/j1987/sounds/73027/) | CC0 | дождь по стеклу теплицы |
| `5-198321-A-10` | rain | rain.wav | schafferdavid | [198321](https://freesound.org/people/schafferdavid/sounds/198321/) | CC0 | ровный дождь |
| `5-181766-A-10` | rain | rain.aiff | laura222 | [181766](https://freesound.org/people/laura222/sounds/181766/) | CC0 | ровный дождь |
| `4-180380-A-10` | rain | rain.wav | aumguy | [180380](https://freesound.org/people/aumguy/sounds/180380/) | CC0 | дождь с каплями |
| `2-82367-A-10` | rain | Rain on Plastic Roof.WAV | gynation | [82367](https://freesound.org/people/gynation/sounds/82367/) | CC0 | капли по навесу |
| `1-21189-A-10` | rain | Louisiana Rain 1.wav | uberhuberman | [21189](https://freesound.org/people/uberhuberman/sounds/21189/) | CC0 | ровный дождь |
| `1-50060-A-10` | downpour | rain_session_27sec_2006.wav | vibe_crc | [50060](https://freesound.org/people/vibe_crc/sounds/50060/) | CC0 | сильный ровный дождь |
| `3-157615-A-10` | downpour | rain recording.mp3 | Keygenerator | [157615](https://freesound.org/people/Keygenerator/sounds/157615/) | CC0 | сильный ровный дождь |
| `1-26222-A-10` | downpour | medium heavey rain.wav | Walter_Odington | [26222](https://freesound.org/people/Walter_Odington/sounds/26222/) | CC0 | сильный дождь |
| `2-87781-A-10` | downpour | rain.wav | sagetyrtle | [87781](https://freesound.org/people/sagetyrtle/sounds/87781/) | CC0 | сильный дождь, низкий |
| `1-54958-A-10` | downpour | rain.ogg | thammo | [54958](https://freesound.org/people/thammo/sounds/54958/) | CC0 | ливень |
| `2-122616-A-14` | birds | Song thrush (pevchiy drozd) | urupin | [122616](https://freesound.org/people/urupin/sounds/122616/) | CC0 | певчий дрозд |
| `4-187769-B-14` | birds | binaural-birds-06-05-2013.flac | dwareing | [187769](https://freesound.org/people/dwareing/sounds/187769/) | CC0 | щебет |
| `4-182795-A-14` | birds | bird chirps4.wav | keweldog | [182795](https://freesound.org/people/keweldog/sounds/182795/) | CC0 | чириканье |
| `3-181132-A-14` | birds | bird chirps.wav | keweldog | [181132](https://freesound.org/people/keweldog/sounds/181132/) | CC0 | чириканье |
| `4-223127-A-14` | birds | general birdsong.wav | keweldog | [223127](https://freesound.org/people/keweldog/sounds/223127/) | CC0 | пение |
| `4-188287-A-9` | crows | crow 1 | pepv | [188287](https://freesound.org/people/pepv/sounds/188287/) | CC0 | карканье |
| `1-75162-A-9` | crows | crow.wav | nigelcoop | [75162](https://freesound.org/people/nigelcoop/sounds/75162/) | CC0 | карканье |
| `1-56233-A-9` | crows | Crows_01.wav | Q.K. | [56233](https://freesound.org/people/Q.K./sounds/56233/) | CC0 | несколько ворон |
| `4-138344-A-9` | crows | crow.wav | UncleSigmund | [138344](https://freesound.org/people/UncleSigmund/sounds/138344/) | CC0 | карканье |
| `2-117615-A…E-48` | fireworks | Fireworks - explode and fizz.wav | soundmary | [117615](https://freesound.org/people/soundmary/sounds/117615/) | CC0 | салют |
| `2-117616-A-48` | fireworks | fireworks exploding 1.wav | soundmary | [117616](https://freesound.org/people/soundmary/sounds/117616/) | CC0 | салют |
| `1-160563-A/B-48` | fireworks | Fireworks July 3, 2012 | daveincamas | [160563](https://freesound.org/people/daveincamas/sounds/160563/) | CC0 | далёкий салют |

Какие именно куски попали в нарезку — `segments[].id` в `manifest.json` (имя отрывка и номер куска).
Обработка: срез низа и шумодав (ровный фон — ветер, далёкие машины, шипение — убирается), выравнивание
тембра у дождя (шесть записей звучат как один дождь), нарезка по звучащим участкам, выравнивание громкости.

## Синтез (без записей)

| что | в файле | как сделано (`art/ambience/synth.py`) |
|---|---|---|
| гомон покупателей | murmur | слоги по частотам русского языка: голос — гармоники с огибающей формант (как у синтезатора Клатта), согласные — шум в своей полосе, интонация фразы и коартикуляция; четыре пары собеседников по углам зала, отзвук комнаты; слов не разобрать |
| капли по стеклу витрины | rain, downpour | короткие звонкие «тик» (моды стекла 1.8–5.5 кГц), иногда крупная капля с низким «ток» — поверх записанного дождя |
| велозвонок | street | купол звонка — затухающие моды-дублеты: «дзынь-дзынь», «дзззынь», «дзынь… дзынь» |
| трамвай вдали | street | стук колёс на стыках «тук-тук… тук-тук», «пение» колёс, вой мотора с эффектом Доплера, низкий гул, иногда скрип на повороте; широкого шума нет (шум машин звучал как прибой) |
| звонок трамвая | street | колокол ниже велосипедного, «дзинь-дзинь» и трижды, с отзвуком улицы |
| голуби вспорхнули | street | 2–4 птицы, у каждой 10–16 взмахов: первые — с хлопком, дальше реже и глуше |
| фонарь зажёгся | street | щелчки поджига, «дзинь» плафона, короткое гудение дросселя (100 Гц и обертоны) |
| неон жужжит | (в игре) | WebAudio на лету: гул 100 Гц, слышны обертоны около 1.4 кГц; изредка треск мигания |

## Проверка готовых файлов

`python3 art/ambience/check.py` декодирует каждый файл в обоих форматах и печатает длительность, пик,
true-peak, RMS и громкость (LUFS); у петель — шов (скачок на стыке против естественного шага рядом:
щелчок был бы больше); у нарезки — каждый кусок: длина, пик, RMS, тишина вокруг и края без щелчка.
Код выхода 1 — если что-то не в порядке.
