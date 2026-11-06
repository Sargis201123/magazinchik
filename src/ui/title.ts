// Стартовый экран: вывеска магазина, «Играть», язык и звук. За ним уже виден зал.
// С «Бабушкиной фермой» (src/farm) вывесок две: выбранная светится, «Играть» ведёт в неё; выбор запоминается.

import { getLang, NATIVE, setLang, SHIPPED, t } from '../i18n';
import { saveLang } from '../i18n/stored';
import { sound } from '../platform/sound';
import { mixer } from '../platform/mixer';
import { track } from '../platform/analytics';
import { addToHomeScreen, canFullscreen, homeScreenStatus, isFullscreen, setFullscreen } from '../platform/telegram';
import type { StoreState } from '../game/economy';
import { button, el, injectStyles, pixelize } from './dom';
import { muteChip } from './audio';
import { markReady } from '../platform/yandex';
import { saveChoice, type GameChoice } from '../game/farm/save';

const css = `
.ui-title { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  gap: 14px; padding: calc(var(--safe-top, env(safe-area-inset-top)) + 9vh) 24px calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 28px); box-sizing: border-box;
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
/* «Играть» — главная кнопка: объёмная, с бликом, мягко дышит и зовёт нажать. */
.ui-title .ui-btn.ui-play { position: relative; overflow: hidden; font-size: 22px; font-weight: 800; letter-spacing: .5px; color: #fff;
  text-shadow: 0 2px 0 #2b2233; background: linear-gradient(#a8e283 0 50%, #7fc659 50%); border-width: 4px; border-radius: 8px;
  box-shadow: inset 0 3px 0 rgba(255,255,255,.5), inset 0 -4px 0 rgba(43,34,51,.18), 0 5px 0 #2b2233, 0 0 26px rgba(143,209,106,.35);
  animation: ui-play-breathe 2.4s ease-in-out 1.2s infinite; }
.ui-title .ui-btn.ui-play::after { content: ''; position: absolute; top: -20%; bottom: -20%; left: -40%; width: 28%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); transform: skewX(-20deg);
  animation: ui-play-shine 3.2s ease-in-out 1.6s infinite; pointer-events: none; }
.ui-title .ui-btn.ui-play:active { animation: none; transform: translateY(3px) scale(.98); box-shadow: inset 0 3px 0 rgba(255,255,255,.5), 0 2px 0 #2b2233; }
@keyframes ui-play-breathe { 50% { transform: scale(1.03); } }
@keyframes ui-play-shine { 0% { left: -40%; } 45%, 100% { left: 120%; } }
@media (prefers-reduced-motion: reduce) { .ui-title .ui-btn.ui-play, .ui-title .ui-btn.ui-play::after { animation: none; } }
.ui-title .ui-muted { color: #8b9bb4; }
/* Две вывески рядом: «Магазинчик» и «Бабушкина ферма». Выбранная — во весь свет, с бегущими лампочками;
   другая — притушена и чуть меньше. Касание вывески — выбрать. */
.ui-signs { display: flex; gap: 10px; width: min(340px, 94vw); align-items: flex-start; }
.ui-signs .ui-sign { flex: 1 1 0; width: auto; min-width: 0; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: filter .25s, opacity .25s, scale .25s; }
.ui-signs .ui-sign h1 { font-size: 21px; padding: 12px 4px 3px; overflow-wrap: anywhere; }
.ui-signs .ui-sign p { font-size: 12px; padding: 0 6px 12px; }
.ui-signs .ui-sign.dim { filter: saturate(.55) brightness(.6); scale: .92; }
.ui-signs .ui-sign.dim .ui-bulbs, .ui-signs .ui-sign.dim h1 { animation: none; }
.ui-signs .ui-sign.dim h1 { text-shadow: 0 3px 0 #b86f50, 0 5px 0 #181425; }
.ui-signs .ui-sign.dim .ui-bulbs { border-color: #8b9bb4; }
.ui-sign.farm { background: #5c3a2a; animation-delay: .25s, 1.15s; }
.ui-sign.farm .ui-awning { background: repeating-linear-gradient(90deg, #63c74d 0 24px, #ead4aa 24px 48px); }
.ui-sign.farm h1 { color: #ead4aa; text-shadow: 0 0 10px rgba(99,199,77,.7), 0 3px 0 #3e8948, 0 5px 0 #181425; }
.ui-sign.farm p { color: #ead4aa; }
.ui-sign .ui-new { position: absolute; top: 4px; right: -4px; padding: 2px 6px; background: #e43b44; color: #fff; border: 2px solid #181425;
  border-radius: 4px; font: 800 11px/1.1 system-ui, sans-serif; transform: rotate(8deg); animation: ui-new 1.6s ease-in-out infinite; z-index: 1; }
@keyframes ui-new { 50% { transform: rotate(8deg) scale(1.12); } }
@media (prefers-reduced-motion: reduce) { .ui-sign .ui-new { animation: none; } }
`;

let styled = false;

export interface TitleOptions {
  save: StoreState | null;
  onPlay: () => void;
  /**
   * Вторая игра — «Бабушкина ферма» (src/farm): её прогресс (нет сохранения — null), выбор в прошлый раз
   * и что делать по «Играть» с выбранной фермой. Нет onFarm — одна вывеска, как раньше.
   */
  farm?: { day: number; money: number } | null;
  choice?: GameChoice;
  onFarm?: () => void;
}

export function showTitle({ save, onPlay, farm = null, choice = 'store', onFarm }: TitleOptions): void {
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

  let homeReady = false;
  let picking = false;
  // Какая игра выбрана: что выбирал в прошлый раз (у новичка и старого игрока без выбора — «Магазинчик»).
  let picked: GameChoice = onFarm ? choice : 'store';
  void homeScreenStatus().then((ok) => {
    homeReady = ok;
    if (ok && root.isConnected) render();
  });

  const render = () => {
    const sign = el('div', 'ui-sign');
    sign.append(el('div', 'ui-awning'), el('h1', '', t('title.name')), el('p', '', t('title.tagline')), el('div', 'ui-bulbs'));
    let signs: HTMLElement = sign;
    const farmSign = el('div', 'ui-sign farm');
    if (onFarm) {
      // Две вывески: касание — выбрать (кнопка «Играть» и строка прогресса — под выбранную; вывески
      // не перестраиваются, иначе снова падали бы сверху).
      farmSign.append(el('div', 'ui-awning'), el('h1', '', t('title.farmName')), el('p', '', t('title.farmTagline')), el('div', 'ui-bulbs'));
      if (!farm) farmSign.append(el('div', 'ui-new', t('title.new')));
      const pick = (game: GameChoice) => () => {
        if (picked === game) return;
        picked = game;
        sound.tap();
        mark();
      };
      sign.addEventListener('click', pick('store'));
      farmSign.addEventListener('click', pick('farm'));
      signs = el('div', 'ui-signs');
      signs.append(sign, farmSign);
    }

    const play = button('', () => {
      sound.coin();
      // Раз за запуск: играют ли без звука (или без части каналов) — главный признак, нравится ли звук.
      const silent = mixer.silenceMask();
      if (silent) track('sound_off', save?.day ?? 1, silent);
      root.remove();
      document.body.classList.remove('ui-on-title');
      if (onFarm) saveChoice(picked);
      if (picked === 'farm') onFarm?.();
      else onPlay();
    }, 'ui-btn ui-play');
    const progress = el('div', 'ui-muted');
    /** Вывески, «Играть» и строка прогресса — под выбранную игру. */
    const mark = () => {
      const toFarm = picked === 'farm';
      sign.classList.toggle('dim', Boolean(onFarm) && toFarm);
      farmSign.classList.toggle('dim', !toFarm);
      play.textContent = toFarm ? t('title.farmPlay') : save ? t('title.continue') : t('title.play');
      const line = toFarm ? (farm ? t('title.farmProgress', { day: farm.day, money: farm.money }) : '') : save ? t('title.progress', { day: save.day, money: save.money }) : '';
      progress.textContent = line;
      progress.hidden = !line;
      pixelize(progress);
    };
    mark();

    const langs = el('div', 'ui-chips');
    // Язык: одна фишка с названием текущего; по нажатию — список готовых языков, каждый на нём самом.
    if (picking) {
      for (const lang of SHIPPED) {
        langs.append(button(NATIVE[lang], () => {
          picking = false;
          if (lang === getLang()) return render();
          setLang(lang);
          saveLang(lang);
          // Надписи в самой сцене строятся при запуске — проще перезапустить игру. ?lang= в адресе
          // важнее выбора — убираем его, иначе язык не сменится.
          const url = new URL(location.href);
          if (url.searchParams.has('lang')) {
            url.searchParams.delete('lang');
            location.replace(url.href);
          } else location.reload();
        }, `ui-chip${lang === getLang() ? ' active' : ''}`));
      }
    } else {
      langs.append(button(`🌐 ${NATIVE[getLang()]}`, () => {
        picking = true;
        render();
      }, 'ui-chip'));
    }
    // Звук — одной кнопкой; громкость по каналам — в профиле (🏆 → «Звук»).
    langs.append(muteChip(() => save?.day ?? 1, render));
    // В Telegram на телефоне — полный экран и ярлык на главный экран.
    if (canFullscreen()) {
      langs.append(
        button(isFullscreen() ? t('title.fullOn') : t('title.fullOff'), () => {
          setFullscreen(!isFullscreen());
          setTimeout(render, 400);
        }, 'ui-chip'),
      );
    }
    if (homeReady) {
      langs.append(
        button(t('title.home'), () => {
          addToHomeScreen();
          homeReady = false;
          render();
        }, 'ui-chip'),
      );
    }

    const controls = el('div', 'ui-title-controls');
    controls.append(play, progress, langs);
    root.replaceChildren(signs, controls);
    pixelize(root);
  };
  render();
  // Яндекс Игры: загрузка закончилась, кнопка «Играть» на экране — LoadingAPI.ready() (п. 1.19.2).
  markReady();
}
