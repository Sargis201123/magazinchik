// «Доска дела» (game/cases.ts) — окно из утреннего меню. Сверху — кто пострадал и что случилось, ниже — приколотые
// улики (чёткие — найденные в зале, размытые — пришедшие утром, ещё не найденные — «❔»), потом трое подозреваемых.
// Допрос — разговор как в сценках (ui/skits.ts, dialogBox): «Где вы были?», «Что видели?» и «Показать улику» — для
// чётких улик о нём. Заданный вопрос серый с галочкой и второй раз не нажимается; ответы помнит сохранение — можно
// вернуться к допросу завтра. В пятницу у каждого — «Обвинить» (с подтверждением): итог — реплика пострадавшего
// или обиженного невиновного и что принесло дело.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import {
  openCaseOf,
  type ClueSrc,
} from '../game/cases';
import {
  accuse,
  askCase,
  casePortrait,
  clueCount,
  confrontable,
  extraClues,
  seeBoard,
  tellCase,
  type CaseGain,
  CASES,
  accuseToday,
  closedToday,
} from '../game/caseBoard';
import { track } from '../platform/analytics';
import { haptic } from '../platform/telegram';
import { sound } from '../platform/sound';
import { dialogBox } from './dialog';
import { button, el, injectStyles, openModal, UI_FONT, who } from './dom';

/** Карточка утра и доска: записки приколоты к пробковой доске, размытые — бледнее (стили — с этим окном, не в общем файле). */
const css = `
.ui-box.ui-case { background: #eef0f6; border-color: #3a4466; }
.ui-case-hot { color: #a22633; font-weight: 700; }
.ui-case-name { font: 800 16px ${UI_FONT}; margin: -2px 0 4px; }
.ui-case-notes { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 8px; background: #b86f50; border: 2px solid #2b2233; border-radius: 6px; }
.ui-case-note { background: #fbf6ea; border: 1px solid #2b2233; border-radius: 3px; padding: 5px 6px; font-size: 12.5px; line-height: 1.3; box-shadow: 1px 2px 0 rgba(0,0,0,.3); transform: rotate(-1deg); }
.ui-case-note:nth-child(even) { transform: rotate(1deg); }
.ui-case-note b { display: block; font-size: 11.5px; margin-bottom: 2px; }
.ui-case-note.weak > div:nth-child(2) { color: #8b7f70; font-style: italic; }
.ui-case-note.missing { background: #e6dcc4; border-style: dashed; box-shadow: none; }
.ui-case-line { background: #eef0f6; border: 2px solid #3a4466; border-radius: 8px; padding: 6px 8px; margin: 6px 0; }
.ui-case-suspect { border-top: 1px dashed #d8ccb0; padding-top: 4px; }
.ui-chip.ui-case-accuse { background: #e43b44; color: #fff; }
`;

let styled = false;
function styles(): void {
  injectStyles();
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

const SRC_ICON: Record<ClueSrc, string> = { receipt: '🧾', camera: '📹', find: '🐕', talk: '💬' };

/** Голос героя (высота «пика», пока банк слогов не скачан). */
const PITCH: Record<string, number> = {
  case_rosa: 640, case_zina: 600, case_boris: 220, case_gosha: 300, case_semyon: 260, case_valera: 340, police: 320, eduard: 240, farmer: 300,
  skit_ruslan: 380, skit_fyodor: 260, skit_viktor: 340, skit_hoodie: 400, skit_lyosha: 420, skit_painter: 300, skit_karina: 640,
};

const key = (s: string) => s as TextKey;
/** Портрет для who(): то же имя, что у casePortrait, без «portrait_». */
const face = (base: string, mood: Parameters<typeof casePortrait>[1]) => casePortrait(base, mood).replace(/^portrait_/, '');

/**
 * Новость утра о деле (через очередь новостей, game/headlines.ts — одна за утро): в понедельник — кто пострадал и
 * что случилось, в пятницу — «пора назвать виновного», в субботу — «ушло в архив». «Потом» — карточка уходит,
 * строчка дела (caseLine) остаётся.
 */
export function caseNewsBox(state: StoreState, openBoard: () => void, later: (s: StoreState) => void): HTMLElement[] {
  styles();
  const open = openCaseOf(state);
  const box = el('div', 'ui-box ui-case');
  if (!open) {
    const last = closedToday(state);
    if (last?.tone !== 'archived') return [];
    box.append(el('div', '', t('case.archived', { title: t(key(`case.${last.id}.title`)) })), button(t('case.ok'), () => later(tellCase(state)), 'ui-chip'));
    return [box];
  }
  const def = CASES[open.id];
  const friday = accuseToday(state);
  // Заголовок собирается из «🕵 Дело недели» и названия (как в строчке дела ниже): лишний ключ — лишний вес основного кода.
  box.append(el('b', '', `${t('case.title')}: «${t(key(`case.${open.id}.title`))}»`));
  if (friday) box.append(el('div', 'ui-note ui-case-hot', t('case.boxFriday')), el('div', 'ui-muted', t('case.boxClues', { n: clueCount(open).got, total: open.got.length })));
  else box.append(who(face(def.victim, 'sad'), el('div', '', `${t(key(`case.${open.id}.victim`))}: «${t(key(`case.${open.id}.intro`))}»`)), el('div', 'ui-muted', t('case.boxDays', { n: open.due - state.day })));
  const acts = el('div', 'ui-chips');
  acts.append(button(t('case.open'), openBoard, 'ui-chip'), button(t('case.later'), () => later(tellCase(state)), 'ui-chip secondary'));
  box.append(acts);
  return [box];
}

/** Строчка дела в утре (когда новость о нём уже была или сегодня не его утро): улики, сколько до пятницы, доска. */
export function caseLine(state: StoreState, openBoard: () => void): HTMLElement[] {
  const open = openCaseOf(state);
  if (!open) return [];
  styles();
  const { got, fresh } = clueCount(open);
  const friday = accuseToday(state);
  const row = el('div', 'ui-row ui-case-line');
  const text = el('div', '');
  text.append(el('b', '', `🕵 «${t(key(`case.${open.id}.title`))}»`));
  const sub = `${t('case.boxClues', { n: got, total: open.got.length })}${fresh ? ` · ${t('case.boxNew')}` : ''}`;
  text.append(el('div', friday ? 'ui-case-hot' : 'ui-muted', friday ? `${sub} · ${t('case.lineFriday')}` : sub));
  row.append(text, button(t('case.open'), openBoard, 'ui-chip'));
  return [row];
}

/** Итог дела строчкой: «+700 💰 · ★ +0.10 · слава района: гостей +10% на 4 дн.». */
function gainLine(g: CaseGain): string {
  const out: string[] = [];
  if (g.money) out.push(`+${g.money} 💰`);
  out.push(`★ ${g.rating > 0 ? '+' : '−'}${Math.abs(g.rating).toFixed(2)}`);
  if (g.fame) out.push(t('case.fame', { p: Math.round(g.fame[0] * 100), d: g.fame[1] }));
  return out.join(' · ');
}

/** Доска дела. set — записать состояние (утро перерисуется под окном). */
export function showCaseBoard(getState: () => StoreState, set: (s: StoreState) => void): void {
  styles();
  const { card, close } = openModal();
  card.classList.add('ui-case-board');
  set(seeBoard(getState()));

  const board = () => {
    const state = getState();
    const open = openCaseOf(state);
    if (!open) {
      close();
      return;
    }
    const def = CASES[open.id];
    const id = open.id;
    const friday = accuseToday(state);
    const notes = el('div', 'ui-case-notes');
    def.clues.forEach((clue, i) => {
      const g = open.got[i];
      const note = el('div', `ui-case-note${g === 1 ? ' weak' : g ? '' : ' missing'}`);
      note.append(el('b', '', `📌 ${SRC_ICON[clue.src]} ${t(`case.src.${clue.src}`)}`));
      if (g) note.append(el('div', '', t(key(`case.${id}.c${i}${g === 1 ? '.weak' : ''}`))));
      else note.append(el('div', 'ui-muted', t('case.clueMissing')));
      if (g === 1) note.append(el('div', 'ui-muted', t('case.clueWeak')));
      notes.append(note);
    });
    for (const extra of extraClues(state)) {
      const note = el('div', 'ui-case-note');
      const vars = Object.fromEntries(Object.entries(extra.vars ?? {}).map(([k, v]) => [k, t(v)]));
      note.append(el('b', '', `📌 ${extra.icon}`), el('div', '', t(extra.key, vars)));
      notes.append(note);
    }
    const suspects = Object.entries(def.suspects).map(([sus, base]) => {
      const row = el('div', 'ui-row ui-case-suspect');
      const name = el('div', '');
      name.append(el('b', '', t(key(`case.${id}.s.${sus}`))));
      const asked = (open.asked ?? []).filter((a) => a.startsWith(`${sus}:`)).length;
      if (open.confessed && sus === def.culprit) name.append(el('div', 'ui-case-hot', t('case.confessed')));
      else if (asked) name.append(el('div', 'ui-muted', t('case.askedN', { n: asked })));
      const acts = el('div', 'ui-chips');
      acts.append(button(t('case.ask'), () => talk(sus, null), 'ui-chip'));
      if (friday) acts.append(button(t('case.accuse'), () => confirm(sus), 'ui-chip ui-case-accuse'));
      row.append(who(face(base, null), name, true), acts);
      return row;
    });
    card.replaceChildren(
      el('h2', '', t('case.title')),
      el('div', 'ui-case-name', `«${t(key(`case.${id}.title`))}»`),
      who(face(def.victim, 'sad'), el('div', '', `${t(key(`case.${id}.victim`))}: «${t(key(`case.${id}.intro`))}»`)),
      // 13.11: подсказки доски — те же тексты, что в карточке «Новое!» и в пятничной новости: свои почти повторяли
      // их, а русский словарь лежит в основном коде (предел веса).
      el('div', friday ? 'ui-note ui-case-hot' : 'ui-note', friday ? t('case.boxFriday') : t('tip.case.text')),
      el('h3', '', t('case.clues')),
      notes,
      el('h3', '', t('case.suspects')),
      ...suspects,
      button(t('case.close'), close, 'ui-btn secondary'),
    );
  };

  /** Допрос: q — какой вопрос только что задали (null — подозреваемый только что подошёл). */
  const talk = (sus: string, q: string | null) => {
    const open = openCaseOf(getState());
    if (!open) return board();
    const id = open.id;
    const def = CASES[id];
    const base = def.suspects[sus];
    const clue = q && /^c\d$/.test(q);
    const text = q === null ? t(key(`case.${id}.s.${sus}.hi`)) : clue ? t(key(`case.${id}.${q}.ans`)) : t(key(`case.${id}.s.${sus}.${q}`));
    // Признание — грустное лицо, объяснение невиновного — удивлённое; в остальном лица ровные: портрет не выдаёт вора.
    const mood = clue ? (sus === def.culprit ? 'sad' : 'surprised') : null;
    const asked = new Set(open.asked ?? []);
    const options = ['where', 'seen', ...confrontable(open, sus).map((i) => `c${i}`)].map((opt) => {
      const src = opt.startsWith('c') ? def.clues[Number(opt.slice(1))].src : null;
      const label = src ? `${SRC_ICON[src]} ${t(`case.show.${src}`)}` : t(opt === 'where' ? 'case.q.where' : 'case.q.seen');
      const done = asked.has(`${sus}:${opt}`);
      return button(
        done ? `✓ ${label}` : label,
        () => {
          sound.tap();
          const next = askCase(getState(), sus, opt);
          if (!openCaseOf(getState())?.confessed && openCaseOf(next)?.confessed) haptic.success();
          set(next);
          talk(sus, opt);
        },
        done ? 'ui-btn secondary ui-skit-seen' : 'ui-btn',
        done,
      );
    });
    card.replaceChildren(
      dialogBox({
        caption: `🕵 «${t(key(`case.${id}.title`))}»`,
        portrait: casePortrait(base, mood),
        name: t(key(`case.${id}.s.${sus}`)),
        text: `«${text}»`,
        pitch: PITCH[base] ?? 400,
        noNext: true,
        nextLabel: '',
        onNext: () => {},
        after: [...options, button(t('case.toBoard'), board, 'ui-btn secondary')],
      }),
    );
  };

  const confirm = (sus: string) => {
    const open = openCaseOf(getState());
    if (!open) return board();
    const name = t(key(`case.${open.id}.s.${sus}`));
    card.replaceChildren(
      el('h2', '', t('case.title')),
      who(face(CASES[open.id].suspects[sus], null), el('b', '', name)),
      el('p', '', t('case.sure', { name })),
      el('div', 'ui-muted', t('case.sureNote')),
      button(t('case.accuse'), () => charge(sus), 'ui-btn danger'),
      button(t('case.think'), board, 'ui-btn secondary'),
    );
  };

  const charge = (sus: string) => {
    const before = getState();
    const open = openCaseOf(before);
    const result = accuse(before, sus);
    if (!open || !result) return board();
    set(result.state);
    track(`case_${open.id}`, before.day, ['great', 'good', 'wrong'].indexOf(result.tone));
    const def = CASES[open.id];
    const right = result.tone !== 'wrong';
    if (right) {
      haptic.success();
      sound.coin();
    } else {
      haptic.error();
      sound.bad();
    }
    card.replaceChildren(
      el('h2', '', t(`case.tone.${result.tone}`)),
      dialogBox({
        caption: `🕵 «${t(key(`case.${open.id}.title`))}»`,
        portrait: right ? casePortrait(def.victim, 'happy') : casePortrait(def.suspects[sus], 'angry'),
        name: right ? t(key(`case.${open.id}.victim`)) : t(key(`case.${open.id}.s.${sus}`)),
        text: `«${right ? t(key(`case.${open.id}.thanks`)) : t('case.hurt')}»`,
        pitch: PITCH[right ? def.victim : def.suspects[sus]] ?? 400,
        after: [el('div', right ? 'ui-gift-reward' : 'ui-note', gainLine(result.gain))],
        nextLabel: t('case.close'),
        onNext: close,
      }),
    );
  };

  board();
}
