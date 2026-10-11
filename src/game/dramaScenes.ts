// Сцены сюжета «Папа и Соня» (src/game/drama.ts): день, место, картинка и реплики. Сами тексты — в переводах drama.*.

import type { DramaScene } from './drama';
import { line } from './story';

export const SCENES: DramaScene[] = [
  {
    day: 2,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.1.1'),
      line('father', 'drama.1.2'),
      line('sonya', 'drama.1.3'),
      line('father', 'drama.1.4'),
    ],
  },
  {
    day: 4,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.2.1'),
      line('father', 'drama.2.2'),
      line('grandma', 'drama.2.3', 'sad'),
    ],
  },
  {
    day: 6,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('valya', 'drama.3.1', 'happy'),
      line('valya', 'drama.3.2', 'surprised'),
    ],
  },
  {
    day: 9,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.4.1'),
      line('father', 'drama.4.2'),
      line('sonya', 'drama.4.3', 'sad'),
      line('father', 'drama.4.4', 'sad'),
    ],
  },
  {
    day: 12,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('sonya', 'drama.5.1'),
      line('father', 'drama.5.2'),
      line('sonya', 'drama.5.3', 'sad'),
    ],
  },
  {
    day: 15,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.6.1'),
      line('father', 'drama.6.2', 'angry'),
      line('sonya', 'drama.6.3', 'surprised'),
      line('father', 'drama.6.4'),
    ],
  },
  {
    day: 18,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.7.1'),
      line('father', 'drama.7.2'),
      line('grandma', 'drama.7.3', 'sad'),
      line('father', 'drama.7.4'),
    ],
  },
  {
    day: 21,
    place: 'drama.place.shop',
    lines: [
      line('marat', 'drama.8.1'),
      line('father', 'drama.8.2'),
      line('marat', 'drama.8.3', 'sad'),
    ],
  },
  {
    day: 24,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.9.1'),
      line('father', 'drama.9.2', 'surprised'),
      line('sonya', 'drama.9.3', 'sad'),
      line('father', 'drama.9.4', 'sad'),
      line('sonya', 'drama.9.5'),
    ],
  },
  {
    day: 27,
    place: 'drama.place.kitchen',
    lines: [
      line('father', 'drama.10.1', 'sad'),
    ],
  },
  {
    day: 30,
    place: 'drama.place.shop',
    lines: [
      line('valya', 'drama.11.1', 'happy'),
      line('valya', 'drama.11.2', 'surprised'),
      line('father', 'drama.11.3', 'sad'),
    ],
  },
  {
    day: 33,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.12.1'),
      line('father', 'drama.12.2'),
      line('sonya', 'drama.12.3', 'sad'),
      line('father', 'drama.12.4', 'surprised'),
      line('sonya', 'drama.12.5', 'sad'),
      line('sonya', 'drama.12.6'),
    ],
  },
  {
    day: 36,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.13.1', 'angry'),
      line('father', 'drama.13.2', 'sad'),
      line('grandma', 'drama.13.3', 'sad'),
    ],
  },
  {
    day: 39,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('sonya', 'drama.14.1'),
      line('father', 'drama.14.2'),
      line('sonya', 'drama.14.3', 'happy'),
      line('father', 'drama.14.4', 'happy'),
    ],
  },
  {
    day: 42,
    place: 'drama.place.night',
    lines: [
      line('father', 'drama.15.1', 'sad'),
    ],
  },
  {
    day: 45,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.16.1', 'sad'),
      line('father', 'drama.16.2'),
      line('sonya', 'drama.16.3', 'angry'),
      line('father', 'drama.16.4', 'angry'),
    ],
  },
  {
    day: 48,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.17.1', 'angry'),
      line('father', 'drama.17.2', 'angry'),
      line('sonya', 'drama.17.3', 'angry'),
      line('father', 'drama.17.4', 'sad'),
    ],
  },
  {
    day: 51,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.18.1'),
      line('father', 'drama.18.2'),
      line('grandma', 'drama.18.3', 'sad'),
    ],
  },
  {
    day: 54,
    place: 'drama.place.empty_home',
    art: 'drama_photo',
    lines: [
      line('father', 'drama.19.1', 'sad'),
    ],
  },
  {
    day: 57,
    place: 'drama.place.shop',
    lines: [
      line('valya', 'drama.20.1'),
      line('father', 'drama.20.2', 'surprised'),
      line('valya', 'drama.20.3', 'sad'),
      line('father', 'drama.20.4', 'sad'),
    ],
  },
  {
    day: 60,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.21.1'),
      line('father', 'drama.21.2'),
      line('sonya', 'drama.21.3', 'sad'),
      line('father', 'drama.21.4', 'angry'),
      line('sonya', 'drama.21.5', 'sad'),
    ],
  },
  {
    day: 63,
    place: 'drama.place.shop',
    lines: [
      line('eduard', 'drama.22.1'),
      line('eduard', 'drama.22.2', 'sad'),
      line('eduard', 'drama.22.3'),
    ],
  },
  {
    day: 66,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.23.1'),
      line('father', 'drama.23.2', 'sad'),
      line('sonya', 'drama.23.3'),
      line('father', 'drama.23.4'),
      line('sonya', 'drama.23.5', 'sad'),
    ],
  },
  {
    day: 69,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.24.1', 'sad'),
      line('father', 'drama.24.2', 'sad'),
      line('grandma', 'drama.24.3'),
    ],
  },
  {
    day: 72,
    place: 'drama.place.shop',
    lines: [
      line('valya', 'drama.25.1', 'surprised'),
      line('father', 'drama.25.2', 'surprised'),
      line('father', 'drama.25.3'),
    ],
  },
  {
    day: 73,
    place: 'drama.place.road',
    art: 'drama_rain',
    lines: [
      line('father', 'drama.26.1', 'sad'),
      line('sonya', 'drama.26.2', 'surprised'),
      line('father', 'drama.26.3'),
      line('sonya', 'drama.26.4', 'sad'),
      line('father', 'drama.26.5', 'sad'),
      line('father', 'drama.26.6', 'sad'),
      line('sonya', 'drama.26.7', 'sad'),
      line('sonya', 'drama.26.8'),
      line('father', 'drama.26.9', 'sad'),
      line('sonya', 'drama.26.10'),
    ],
  },
  {
    day: 76,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.27.1', 'surprised'),
      line('father', 'drama.27.2', 'happy'),
      line('sonya', 'drama.27.3', 'happy'),
      line('father', 'drama.27.4', 'happy'),
    ],
  },
  {
    day: 79,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.28.1', 'happy'),
      line('father', 'drama.28.2'),
    ],
  },
  {
    day: 82,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('sonya', 'drama.29.1', 'happy'),
      line('father', 'drama.29.2', 'happy'),
      line('sonya', 'drama.29.3', 'happy'),
      line('father', 'drama.29.4', 'happy'),
    ],
  },
  {
    day: 85,
    place: 'drama.place.entrance',
    visit: true,
    lines: [
      line('sonya', 'drama.30.1'),
      line('father', 'drama.30.2'),
      line('sonya', 'drama.30.3', 'happy'),
    ],
  },
  {
    day: 88,
    place: 'drama.place.home_evening',
    lines: [
      line('father', 'drama.31.1'),
      line('sonya', 'drama.31.2', 'surprised'),
      line('father', 'drama.31.3'),
      line('sonya', 'drama.31.4', 'happy'),
    ],
  },
  {
    day: 91,
    place: 'drama.place.lake',
    art: 'drama_lake',
    lines: [
      line('father', 'drama.32.1'),
      line('sonya', 'drama.32.2'),
      line('father', 'drama.32.3', 'happy'),
      line('sonya', 'drama.32.4', 'happy'),
      line('father', 'drama.32.5', 'happy'),
    ],
  },
];
