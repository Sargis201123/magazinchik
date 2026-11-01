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
    day: 3,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('sonya', 'drama.2.1'),
      line('father', 'drama.2.2'),
      line('sonya', 'drama.2.3', 'sad'),
    ],
  },
  {
    day: 4,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.3.1'),
      line('father', 'drama.3.2'),
      line('grandma', 'drama.3.3', 'sad'),
    ],
  },
  {
    day: 5,
    place: 'drama.place.night',
    lines: [
      line('father', 'drama.4.1', 'sad'),
    ],
  },
  {
    day: 6,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('valya', 'drama.5.1', 'happy'),
    ],
  },
  {
    day: 7,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.6.1'),
      line('father', 'drama.6.2'),
      line('sonya', 'drama.6.3', 'happy'),
      line('father', 'drama.6.4'),
      line('sonya', 'drama.6.5', 'sad'),
    ],
  },
  {
    day: 9,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.7.1'),
      line('father', 'drama.7.2'),
      line('sonya', 'drama.7.3', 'sad'),
      line('father', 'drama.7.4', 'sad'),
    ],
  },
  {
    day: 10,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.8.1'),
      line('father', 'drama.8.2'),
      line('grandma', 'drama.8.3', 'sad'),
    ],
  },
  {
    day: 12,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('sonya', 'drama.9.1'),
      line('father', 'drama.9.2'),
      line('sonya', 'drama.9.3', 'sad'),
    ],
  },
  {
    day: 14,
    place: 'drama.place.night',
    lines: [
      line('father', 'drama.10.1'),
    ],
  },
  {
    day: 15,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.11.1'),
      line('father', 'drama.11.2', 'angry'),
      line('sonya', 'drama.11.3', 'surprised'),
      line('father', 'drama.11.4'),
    ],
  },
  {
    day: 16,
    place: 'drama.place.shop',
    lines: [
      line('valya', 'drama.12.1'),
      line('father', 'drama.12.2'),
      line('valya', 'drama.12.3', 'sad'),
    ],
  },
  {
    day: 18,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.13.1'),
      line('father', 'drama.13.2'),
      line('grandma', 'drama.13.3', 'sad'),
      line('father', 'drama.13.4'),
    ],
  },
  {
    day: 19,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.14.1'),
      line('father', 'drama.14.2', 'angry'),
      line('sonya', 'drama.14.3'),
    ],
  },
  {
    day: 20,
    place: 'drama.place.shop',
    lines: [
      line('marat', 'drama.15.1', 'happy'),
      line('father', 'drama.15.2'),
    ],
  },
  {
    day: 21,
    place: 'drama.place.shop',
    lines: [
      line('marat', 'drama.16.1'),
      line('father', 'drama.16.2'),
      line('marat', 'drama.16.3', 'sad'),
    ],
  },
  {
    day: 22,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.17.1'),
      line('father', 'drama.17.2', 'sad'),
      line('sonya', 'drama.17.3', 'surprised'),
      line('father', 'drama.17.4', 'sad'),
    ],
  },
  {
    day: 24,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.18.1'),
      line('father', 'drama.18.2', 'surprised'),
      line('sonya', 'drama.18.3', 'sad'),
      line('father', 'drama.18.4', 'sad'),
      line('sonya', 'drama.18.5'),
    ],
  },
  {
    day: 27,
    place: 'drama.place.kitchen',
    lines: [
      line('father', 'drama.19.1', 'sad'),
    ],
  },
  {
    day: 28,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.20.1'),
      line('father', 'drama.20.2', 'angry'),
      line('grandma', 'drama.20.3'),
      line('father', 'drama.20.4', 'angry'),
    ],
  },
  {
    day: 30,
    place: 'drama.place.shop',
    lines: [
      line('valya', 'drama.21.1', 'happy'),
      line('father', 'drama.21.3', 'sad'),
    ],
  },
  {
    day: 31,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.22.1'),
      line('father', 'drama.22.2', 'surprised'),
      line('sonya', 'drama.22.3', 'happy'),
      line('father', 'drama.22.4', 'sad'),
      line('sonya', 'drama.22.5', 'sad'),
    ],
  },
  {
    day: 33,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.23.1'),
      line('father', 'drama.23.2'),
      line('sonya', 'drama.23.3', 'sad'),
      line('father', 'drama.23.4', 'surprised'),
      line('sonya', 'drama.23.5', 'sad'),
      line('sonya', 'drama.23.6'),
    ],
  },
  {
    day: 35,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('sonya', 'drama.24.1'),
      line('father', 'drama.24.2', 'surprised'),
      line('sonya', 'drama.24.3'),
      line('sonya', 'drama.24.4', 'sad'),
    ],
  },
  {
    day: 36,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.25.1', 'angry'),
      line('father', 'drama.25.2', 'sad'),
      line('grandma', 'drama.25.3', 'sad'),
    ],
  },
  {
    day: 38,
    place: 'drama.place.night',
    lines: [
      line('father', 'drama.26.1', 'sad'),
    ],
  },
  {
    day: 39,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('sonya', 'drama.27.1'),
      line('father', 'drama.27.2'),
      line('sonya', 'drama.27.3', 'happy'),
      line('father', 'drama.27.4', 'happy'),
    ],
  },
  {
    day: 41,
    place: 'drama.place.shop',
    lines: [
      line('valya', 'drama.28.1', 'happy'),
    ],
  },
  {
    day: 42,
    place: 'drama.place.night',
    lines: [
      line('father', 'drama.29.1', 'sad'),
    ],
  },
  {
    day: 44,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.30.1'),
      line('father', 'drama.30.2', 'surprised'),
      line('sonya', 'drama.30.3'),
    ],
  },
  {
    day: 45,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.31.1', 'sad'),
      line('father', 'drama.31.2'),
      line('sonya', 'drama.31.3', 'angry'),
      line('father', 'drama.31.4', 'angry'),
    ],
  },
  {
    day: 47,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.32.1', 'happy'),
      line('father', 'drama.32.2'),
      line('father', 'drama.32.3', 'sad'),
    ],
  },
  {
    day: 48,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.33.1', 'angry'),
      line('father', 'drama.33.2', 'angry'),
      line('sonya', 'drama.33.3', 'angry'),
      line('father', 'drama.33.4', 'sad'),
    ],
  },
  {
    day: 50,
    place: 'drama.place.home_evening',
    lines: [
      line('father', 'drama.34.1', 'sad'),
    ],
  },
  {
    day: 51,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.35.1'),
      line('father', 'drama.35.2'),
      line('grandma', 'drama.35.3', 'sad'),
    ],
  },
  {
    day: 53,
    place: 'drama.place.shop',
    lines: [
      line('marat', 'drama.36.1'),
      line('father', 'drama.36.2', 'surprised'),
      line('marat', 'drama.36.3', 'sad'),
    ],
  },
  {
    day: 54,
    place: 'drama.place.empty_home',
    art: 'drama_photo',
    lines: [
      line('father', 'drama.37.1', 'sad'),
    ],
  },
  {
    day: 56,
    place: 'drama.place.night',
    lines: [
      line('father', 'drama.38.1', 'sad'),
    ],
  },
  {
    day: 57,
    place: 'drama.place.shop',
    lines: [
      line('valya', 'drama.39.1'),
      line('father', 'drama.39.2', 'surprised'),
      line('valya', 'drama.39.3', 'sad'),
      line('father', 'drama.39.4', 'sad'),
    ],
  },
  {
    day: 60,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.40.1'),
      line('father', 'drama.40.2'),
      line('sonya', 'drama.40.3', 'sad'),
      line('father', 'drama.40.4', 'angry'),
      line('sonya', 'drama.40.5', 'sad'),
    ],
  },
  {
    day: 62,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.41.1'),
      line('father', 'drama.41.2', 'surprised'),
      line('father', 'drama.41.3', 'sad'),
      line('sonya', 'drama.41.4', 'surprised'),
      line('father', 'drama.41.5'),
    ],
  },
  {
    day: 63,
    place: 'drama.place.shop',
    lines: [
      line('eduard', 'drama.42.1'),
      line('eduard', 'drama.42.2', 'sad'),
      line('eduard', 'drama.42.3'),
    ],
  },
  {
    day: 65,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('sonya', 'drama.43.1'),
      line('father', 'drama.43.2'),
      line('sonya', 'drama.43.3', 'sad'),
    ],
  },
  {
    day: 66,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.44.1'),
      line('father', 'drama.44.2', 'sad'),
      line('sonya', 'drama.44.3'),
      line('father', 'drama.44.4'),
      line('sonya', 'drama.44.5', 'sad'),
    ],
  },
  {
    day: 68,
    place: 'drama.place.night',
    lines: [
      line('father', 'drama.45.1', 'sad'),
    ],
  },
  {
    day: 69,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.46.1', 'sad'),
      line('father', 'drama.46.2', 'sad'),
      line('grandma', 'drama.46.3'),
    ],
  },
  {
    day: 70,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.47.1'),
      line('father', 'drama.47.2'),
      line('sonya', 'drama.47.3', 'angry'),
    ],
  },
  {
    day: 72,
    place: 'drama.place.shop',
    lines: [
      line('valya', 'drama.48.1', 'surprised'),
      line('father', 'drama.48.2', 'surprised'),
      line('father', 'drama.48.3'),
    ],
  },
  {
    day: 73,
    place: 'drama.place.road',
    art: 'drama_rain',
    lines: [
      line('father', 'drama.49.1', 'sad'),
      line('sonya', 'drama.49.2', 'surprised'),
      line('father', 'drama.49.3'),
      line('sonya', 'drama.49.4', 'sad'),
      line('father', 'drama.49.5', 'sad'),
      line('father', 'drama.49.6', 'sad'),
      line('sonya', 'drama.49.7', 'sad'),
      line('sonya', 'drama.49.8'),
      line('father', 'drama.49.9', 'sad'),
      line('sonya', 'drama.49.10'),
    ],
  },
  {
    day: 74,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.50.1'),
      line('father', 'drama.50.2', 'happy'),
      line('sonya', 'drama.50.3', 'happy'),
    ],
  },
  {
    day: 76,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.51.1', 'surprised'),
      line('father', 'drama.51.2', 'happy'),
      line('sonya', 'drama.51.3', 'happy'),
      line('father', 'drama.51.4', 'happy'),
    ],
  },
  {
    day: 77,
    place: 'drama.place.shop',
    lines: [
      line('valya', 'drama.52.1', 'surprised'),
      line('father', 'drama.52.2', 'happy'),
    ],
  },
  {
    day: 79,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.53.1', 'happy'),
      line('father', 'drama.53.2'),
    ],
  },
  {
    day: 80,
    place: 'drama.place.kitchen',
    lines: [
      line('sonya', 'drama.54.1', 'surprised'),
      line('father', 'drama.54.2', 'happy'),
      line('sonya', 'drama.54.3', 'happy'),
      line('father', 'drama.54.4', 'happy'),
    ],
  },
  {
    day: 82,
    place: 'drama.place.shop',
    visit: true,
    lines: [
      line('sonya', 'drama.55.1', 'happy'),
      line('father', 'drama.55.2', 'happy'),
      line('sonya', 'drama.55.3', 'happy'),
      line('father', 'drama.55.4', 'happy'),
    ],
  },
  {
    day: 83,
    place: 'drama.place.home_evening',
    lines: [
      line('sonya', 'drama.56.1'),
      line('father', 'drama.56.2', 'sad'),
    ],
  },
  {
    day: 85,
    place: 'drama.place.entrance',
    visit: true,
    lines: [
      line('sonya', 'drama.57.1'),
      line('father', 'drama.57.2'),
      line('sonya', 'drama.57.3', 'happy'),
    ],
  },
  {
    day: 86,
    place: 'drama.place.shop',
    lines: [
      line('marat', 'drama.58.1', 'happy'),
      line('father', 'drama.58.2', 'happy'),
    ],
  },
  {
    day: 88,
    place: 'drama.place.home_evening',
    lines: [
      line('father', 'drama.59.1'),
      line('sonya', 'drama.59.2', 'surprised'),
      line('father', 'drama.59.3'),
      line('sonya', 'drama.59.4', 'happy'),
    ],
  },
  {
    day: 89,
    place: 'drama.place.call',
    lines: [
      line('grandma', 'drama.60.1', 'happy'),
      line('father', 'drama.60.2', 'happy'),
      line('grandma', 'drama.60.3', 'surprised'),
      line('grandma', 'drama.60.4', 'happy'),
    ],
  },
  {
    day: 91,
    place: 'drama.place.lake',
    art: 'drama_lake',
    lines: [
      line('father', 'drama.61.1'),
      line('sonya', 'drama.61.2'),
      line('father', 'drama.61.3', 'happy'),
      line('sonya', 'drama.61.4', 'happy'),
      line('father', 'drama.61.5', 'happy'),
    ],
  },
];
