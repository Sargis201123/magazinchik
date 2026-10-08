// Стартовый экран: вывеска магазина, «Играть», язык и звук. За ним уже виден зал.

import { getLang, setLang, t, type Lang } from '../i18n';
import { saveLang } from '../i18n/stored';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import type { StoreState } from '../game/economy';
import { button, el, injectStyles, pixelize } from './dom';

const css = `
.ui-title { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  gap: 14px; padding: calc(env(safe-area-inset-top) + 9vh) 24px calc(env(safe-area-inset-bottom) + 28px); box-sizing: border-box;
  background: linear-gradient(180deg, rgba(24,20,37,.8) 0%, rgba(24,20,37,.1) 38%, rgba(24,20,37,.1) 55%, rgba(24,20,37,.92) 82%);
  font: 15px/1.4 system-ui, sans-serif; color: #f4ecd8; text-align: center; }
/* Пока открыт титул, верхняя панель и подсказка спрятаны. */
.ui-on-title .ui-hud, .ui-on-title .ui-stock, .ui-on-title .ui-hint { opacity: 0; }
.ui-title-controls { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
/* Вывеска опускается сверху с подпрыгиванием и чуть покачивается; по краю бегут лампочки. */
.ui-sign { position: relative; width: min(300px, 82vw); border: 4px solid #181425; border-radius: 8px; overflow: hidden;
  box-shadow: 0 6px 0 #181425, 0 0 40px rgba(254,231,97,.3); background: #2b2233; transform-origin: 50% -40px;
  animation: ui-sign-drop .9s cubic-bezier(.3, 1.4, .5, 1) both, ui-sign-swing 5s ease-in-out .9s infinite; }
@keyframes ui-sign-drop { from { transform: translateY(-160%) rotate(-5deg); } }
@keyframes ui-sign-swing { 50% { transform: rotate(.8deg); } }
.ui-bulbs { position: absolute; inset: 31px 5px 5px; border: 3px dotted #fee761; border-radius: 6px; pointer-events: none;
  animation: ui-chase .5s steps(1) infinite; }
@keyframes ui-chase { 50% { border-color: #f77622; } }
.ui-awning { height: 26px; background: repeating-linear-gradient(90deg, #e43b44 0 24px, #f4ecd8 24px 48px);
  border-bottom: 4px solid #181425; }
/* Неон: при включении мигает, потом ровно светится и чуть дышит. */
.ui-sign h1 { margin: 0; padding: 16px 8px 4px; font: 800 34px/1.1 system-ui, sans-serif; color: #fee761; letter-spacing: 1px;
  text-shadow: 0 0 10px rgba(254,231,97,.8), 0 3px 0 #b86f50, 0 5px 0 #181425;
  animation: ui-neon-on 1.4s .7s both, ui-neon 3s ease-in-out 2.1s infinite; }
@keyframes ui-neon-on { 0%, 12%, 30%, 45% { opacity: .25; text-shadow: none; } 8%, 20%, 38%, 100% { opacity: 1; } }
@keyframes ui-neon { 50% { text-shadow: 0 0 18px rgba(254,231,97,1), 0 3px 0 #b86f50, 0 5px 0 #181425; } }
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
  document.body.classList.add('ui-on-title');

  const render = () => {
    const sign = el('div', 'ui-sign');
    sign.append(el('div', 'ui-awning'), el('h1', '', t('title.name')), el('p', '', t('title.tagline')), el('div', 'ui-bulbs'));

    const play = button(save ? t('title.continue') : t('title.play'), () => {
      sound.coin();
      music.start();
      root.remove();
      document.body.classList.remove('ui-on-title');
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
    const tunes = button(music.isMuted() ? t('title.musicOff') : t('title.musicOn'), () => {
      music.setMuted(!music.isMuted());
      render();
    }, 'ui-chip');
    langs.append(tunes);

    const controls = el('div', 'ui-title-controls');
    controls.append(play, ...(progress ? [progress] : []), langs);
    root.replaceChildren(sign, controls);
    pixelize(root);
  };
  render();
}
