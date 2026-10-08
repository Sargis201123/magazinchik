// Стартовый экран: вывеска магазина, «Играть», язык и звук. За ним уже виден зал.

import { getLang, setLang, t, type Lang } from '../i18n';
import { saveLang } from '../i18n/stored';
import { sound } from '../platform/sound';
import type { StoreState } from '../game/economy';
import { button, el, injectStyles, pixelize } from './dom';

const css = `
.ui-title { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 24px; box-sizing: border-box;
  background: linear-gradient(180deg, rgba(24,20,37,.92) 0%, rgba(24,20,37,.55) 45%, rgba(24,20,37,.92) 100%);
  font: 15px/1.4 system-ui, sans-serif; color: #f4ecd8; text-align: center; }
.ui-sign { width: min(300px, 82vw); border: 4px solid #181425; border-radius: 8px; overflow: hidden;
  box-shadow: 0 6px 0 #181425, 0 0 40px rgba(254,231,97,.25); background: #2b2233; }
.ui-awning { height: 26px; background: repeating-linear-gradient(90deg, #e43b44 0 24px, #f4ecd8 24px 48px);
  border-bottom: 4px solid #181425; }
.ui-sign h1 { margin: 0; padding: 16px 8px 4px; font: 800 34px/1.1 system-ui, sans-serif; color: #fee761; letter-spacing: 1px;
  text-shadow: 0 3px 0 #b86f50, 0 5px 0 #181425; }
.ui-sign p { margin: 0; padding: 0 12px 16px; color: #c0cbdc; font-size: 14px; }
.ui-title .ui-btn { max-width: 300px; font-size: 18px; padding: 14px; }
.ui-title .ui-chips { justify-content: center; }
.ui-title .ui-muted { color: #8b9bb4; }
`;

let styled = false;

export interface TitleOptions {
  save: StoreState | null;
  onPlay: () => void;
}

export function showTitle({ save, onPlay }: TitleOptions): void {
  injectStyles();
  if (!styled) {
    styled = true;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
  }
  const root = el('div', 'ui-title');
  document.body.append(root);

  const render = () => {
    const sign = el('div', 'ui-sign');
    sign.append(el('div', 'ui-awning'), el('h1', '', t('title.name')), el('p', '', t('title.tagline')));

    const play = button(save ? t('title.continue') : t('title.play'), () => {
      sound.coin();
      root.remove();
      onPlay();
    });
    const progress = save ? el('div', 'ui-muted', t('title.progress', { day: save.day, money: save.money })) : null;

    const langs = el('div', 'ui-chips');
    for (const lang of ['ru', 'en'] as Lang[]) {
      const chip = button(lang.toUpperCase(), () => {
        if (lang === getLang()) return;
        setLang(lang);
        saveLang(lang);
        // Надписи в самой сцене строятся при запуске — проще перезапустить игру.
        location.reload();
      }, `ui-chip${lang === getLang() ? ' active' : ''}`);
      langs.append(chip);
    }
    const toggle = button(sound.isMuted() ? t('title.soundOff') : t('title.soundOn'), () => {
      sound.setMuted(!sound.isMuted());
      sound.tap();
      render();
    }, 'ui-chip');
    langs.append(toggle);

    root.replaceChildren(sign, play, ...(progress ? [progress] : []), langs);
    pixelize(root);
  };
  render();
}
