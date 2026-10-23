// Настройки звука: ползунки «Общая / Музыка / Окружение / Эффекты / Голоса» в профиле и быстрая
// кнопка «без звука» — в игре, на заставке и в утреннем окне. Каждое выключение и включение
// уходит в аналитику: по доле игроков без звука видно, стал ли новый звук приятнее.

import { t, type TextKey } from '../i18n';
import { track } from '../platform/analytics';
import { ambience } from '../platform/ambience';
import { audibleAgain, inaudible, VOLUME_KEYS, type VolumeKey } from '../platform/mix';
import { mixer } from '../platform/mixer';
import { sound } from '../platform/sound';
import { button, el } from './dom';

const css = `
.ui-volume { display: grid; grid-template-columns: 7.5em 1fr 2.6em; align-items: center; gap: 8px; margin: 6px 0; font-size: 14px; }
.ui-volume b { font-weight: 600; white-space: nowrap; }
.ui-volume output { text-align: right; font-size: 13px; color: #6a5f58; }
/* Ползунок в цвет рамок: тёмная дорожка, заполненная часть — золотая, ручка — квадратная, «пиксельная». */
.ui-volume input { -webkit-appearance: none; appearance: none; width: 100%; height: 10px; margin: 8px 0; border: 2px solid #2b2233;
  border-radius: 3px; background: linear-gradient(90deg, #feae34 var(--v, 80%), #e6dcc4 var(--v, 80%)); touch-action: pan-y; }
.ui-volume input::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border: 2px solid #2b2233; border-radius: 3px;
  background: #fee761; box-shadow: 0 2px 0 #2b2233; }
.ui-volume input::-moz-range-thumb { width: 18px; height: 18px; border: 2px solid #2b2233; border-radius: 3px; background: #fee761; }
.ui-volume.off { opacity: .55; }
/* Быстрое «без звука» в игре — внизу слева, напротив ускорения. */
.ui-mute { right: auto; left: max(10px, calc((100vw - var(--game-w, min(100vw, 56.25dvh))) / 2 + 10px)); padding: 5px 7px; line-height: 0; }
.ui-mute .ui-ico { height: 20px; vertical-align: 0; }
/* В первые дни внизу — жёлтая плашка обучения (ускорения и подвоза ещё нет): кнопка — выше неё, на высоте подвоза. */
.ui-mute.ui-mute-up { bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 84px); }
.ui-on-title .ui-mute { display: none; }
`;

let styled = false;
export function injectAudioStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

const LABELS: Record<VolumeKey, [string, TextKey]> = {
  master: ['🔊', 'audio.master'],
  music: ['🎵', 'audio.music'],
  ambience: ['🐦', 'audio.ambience'],
  effects: ['🛒', 'audio.effects'],
  voices: ['💬', 'audio.voices'],
};

/** Звука нет совсем: выключен кнопкой или ползунками (mix.ts, inaudible). */
const silent = (): boolean => inaudible(mixer.volumes(), mixer.isMuted());

/** Значок быстрой кнопки: что сейчас — звук есть или выключен. */
export const muteIcon = (): string => (silent() ? '🔇' : '🔊');

/**
 * Быстро выключить или включить весь звук и отметить это в аналитике. Ползунки не трогаем —
 * разве что звук убран ими до нуля: тогда «включить» возвращает их к обычным (mix.ts, audibleAgain).
 */
export function toggleMute(day: number): void {
  const next = !silent();
  if (!next) {
    const now = mixer.volumes();
    const back = audibleAgain(now);
    for (const key of VOLUME_KEYS) if (back[key] !== now[key]) mixer.setVolume(key, back[key]);
  }
  mixer.setMuted(next);
  track(next ? 'mute_on' : 'mute_off', day);
  if (!next) sound.tap();
}

/** Чип «звук / без звука» (заставка, профиль): подпись вслед за состоянием. */
export function muteChip(day: () => number, after: () => void, className = 'ui-chip'): HTMLButtonElement {
  return button(silent() ? t('title.soundOff') : t('title.soundOn'), () => {
    toggleMute(day());
    after();
  }, className);
}

/** Как прозвучит канал: короткий пример, когда отпустили ползунок. */
function preview(key: VolumeKey): void {
  if (key === 'music') return;
  if (key === 'ambience') ambience.chime();
  else if (key === 'voices') [0, 90, 180].forEach((ms) => setTimeout(() => sound.voice(330), ms));
  else sound.coin();
}

/** Блок «Звук» в профиле: быстрая кнопка и пять ползунков. Сдвинули — слышно сразу и запомнилось. */
export function audioBox(day: () => number, rerender: () => void): HTMLElement {
  injectAudioStyles();
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🔊 ${t('audio.title')}`), el('div', 'ui-muted', t('audio.note')));
  const chips = el('div', 'ui-chips');
  chips.append(muteChip(day, rerender, `ui-chip${silent() ? '' : ' active'}`));
  box.append(chips);
  const volumes = mixer.volumes();
  let mask = mixer.silenceMask();
  for (const key of VOLUME_KEYS) {
    const row = el('label', 'ui-volume');
    const [icon, label] = LABELS[key];
    const input = el('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '5';
    input.value = String(Math.round(volumes[key] * 100));
    const value = el('output', '', `${input.value}%`);
    const show = () => {
      input.style.setProperty('--v', `${input.value}%`);
      value.textContent = `${input.value}%`;
      row.classList.toggle('off', input.value === '0' || mixer.isMuted());
    };
    show();
    // Пока двигают ползунок, меню не глушит мир: громкость подбирают на слух, как в игре.
    input.addEventListener('input', () => {
      mixer.listen();
      mixer.setVolume(key, Number(input.value) / 100);
      show();
    });
    // Отпустили ползунок: пример звука; если какой-то канал выключился или включился — в аналитику.
    input.addEventListener('change', () => {
      mixer.listen();
      preview(key);
      const now = mixer.silenceMask();
      if (now !== mask) track('sound_mask', day(), now);
      mask = now;
    });
    row.append(el('b', '', `${icon} ${t(label)}`), input, value);
    box.append(row);
  }
  return box;
}
