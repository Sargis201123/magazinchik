import { warmKey } from '../game/firstday';
import { momentCount } from '../game/moments';
import { getLang, memberName, t } from '../i18n';
import { pluralForm } from '../i18n/plural';
import type { TextKey } from '../i18n/ru';
import {
  buyChance,
  priceAppeal,
  buyShelf,
  buyStock,
  canPlace,
  daysUntilSeason,
  SEASONAL,
  CATEGORIES,
  billTotal,
  daysUntilBill,
  DEBT_PAYMENT,
  monthlyBill,
  monthOf,
  STAFF_ROLES,
  expandStore,
  onShelves,
  freeSlots,
  moveToShelf,
  shelveAll,
  HYPER_LEVEL,
  nextStoreLevel,
  payDebt,
  PRICE_STEP,
  PRODUCTS,
  PRODUCT_IDS,
  resolveBadBatch,
  RETURN_REFUND,
  sellableProducts,
  setPrice,
  SHELF_KINDS,
  SHELF_LEVELS,
  sellShelf,
  storeShelf,
  placeStored,
  isFixture,
  shelfCapacity,
  shelfCount,
  shelfFree,
  shelfResale,
  storeLevel,
  STORE_LEVELS,
  OWN_PRODUCTS,
  ownProductOpen,
  productAvailable,
  upgradeCost,
  upgradeShelf,
  warehouseCapacity,
  warehouseCount,
  warehouseOf,
  answerRaise,
  cashierScan,
  servePerDay,
  fire,
  ownerLevel,
  ownerNextLevelAt,
  ownerScan,
  hire,
  STAFF_ROLE_IDS,
  staffLimit,
  staffOf,
  TRAITS,
  type StaffMember,
  type BadBatchChoice,
  type ProductId,
  type StoreState,
  shelfKindOpen,
  EXHAUSTED_DAYS,
  giveDayOff,
  isTired,
  roleOpen,
  isAbsent,
} from '../game/economy';
import {
  canHaggle,
  haggle,
  HAGGLE_ASKS,
  newDeal,
  SUPPLIER_IDS,
  SUPPLIERS,
  unitPrice,
  type Deal,
  type SupplierId,
  supplierOpen,
  badBatch,
} from '../game/suppliers';
import { guestsGain, guestsToday } from '../game/day';
import { buyKiosk, KIOSK_TIERS, kioskCount, kioskSlots, KIOSKS_BY_LEVEL, kioskTier, kioskTierIndex, laneGuests, nextKioskPrice, nextKioskTier, openRegisters, upgradeKiosks, withNextTill } from '../game/lanes';
import {
  ALL_QUESTS_RATING,
  QUEST_TEXT,
  RANK_GUESTS,
  rankName,
  rankOf,
  rankThreshold,
  seasonFor,
  type Quest,
} from '../game/endless';
import { answerEvent, CLIENTS, fridgeRepairCost, repairShelf, type ClientId, type MorningEvent } from '../game/events';
import { applyReorder } from '../game/reorder';
import { AUTO_SHARES, AUTO_TOPUP_MARKUP, AUTO_TOPUPS, autoActive, autoCancel, autoDay, autoLimit, autoMorning, autoResume, autoReturn, autoSetShare, autoShare, autoToggle } from '../game/autoorder';
import { bestOffer, canStock, restockPlan, restockTarget } from '../game/restock';
import { stockOf, usualSales } from '../game/bakery';

/**
 * Утренняя уценка — только лишнее сверх обычных продаж (как вечерние электронные ценники): старое покупатели
 * берут первым, и то, что и так купят по полной цене, уценивать — себе в убыток.
 */
const surplus = (state: StoreState) => markdownSurplus(state, (id) => usualSales(state, id) ?? 0);
import { activePromo, setPromo, type PromoKind } from '../game/promo';
import { deliverContracts, type Delivery } from '../game/contracts';
import { daysToFair, isFairDay } from '../game/fair';
import { WEEKLY_TEXT, weeklyUntil, type Challenge } from '../game/weekly';
import { pendingTip, seeTip, soloExpandRisk, TIP_ICONS } from '../game/tips';
import { markdownSurplus, toggleDonate } from '../game/economy';
import { currentCandidates, friendCandidates, JOB_AD_COST, startJobSearch, train, trainingCost } from '../game/staff';
import { answerCeremony, answerOffer, BEST_EVERY, BEST_REWARDS, bestBonus, bestGift, careerOf, dismissLeft, nextRank, promotedWage, rankKey, xpToNext, type BestReward } from '../game/career';
import { BRANCH_HEAD_BONUS } from '../game/branch';
import {
  CONTEST_DAYS,
  CONTEST_EMPTY,
  CONTEST_EVERY_LOST,
  CONTEST_EVERY_WON,
  CONTEST_NEED,
  CONTEST_UNHAPPY,
  contestAnnounce,
  contestOf,
  contestRating,
  contestResult,
  CRITERIA,
  juryDay,
  legendNumber,
  seeAnnounce,
  seeResult,
  tierKey,
  type ContestResult,
  type ContestState,
} from '../game/contest';
import { dramaDone, dramaScene, isLastScene, seeDrama, type DramaScene } from '../game/drama';
import { activeEvent, addDays, cardOf, cardWaiting, guestDue, guestOn, nextGuest, openCard, openedCards, type LiveEvent } from '../game/live';
import { liveEvents, todayLocal } from '../platform/live';
import { dateLabel, GUEST_ICON, showLiveCard, THEME_ICON } from './live';
import { weekBox, weekSoonLine } from './weeks';
import { WEEK_IDS, type WeekId } from '../game/weeks';
import { CHARACTERS, currentChapter, finishChapter, finishIntro, pendingStory, type Chapter, type CharacterId } from '../game/story';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { WEATHER_EFFECTS, weatherDemand, weatherFor } from '../game/weather';
import { BIG_DAYS, bigDayFor, bigDayKnown, bigDayProgress } from '../game/bigday';
import {
  GIANT_BATTLE_DAYS,
  GIANT_BUILD_DAYS,
  GIANT_FAME,
  GIANT_RATING,
  GIANT_REMATCH_DAYS,
  giantDefense,
  giantNews,
  giantOf,
  giantPull,
  giantReward,
  seeGiantNews,
  type GiantPhase,
} from '../game/giant';
import { CANDY_COST, CANDY_PRICE, nextRack, rackCapacity, rackOf, refillRack, upgradeRack } from '../game/impulse';
import { haggleBonus, learnSkill, nextLevelXp, ownerLevelOf, ownerTiming, ownerXp, SKILL_IDS, SKILL_MAX, skillLevel, skillPoints, SKILLS } from '../game/owner';
import { LOAN_INTEREST, LOAN_MONTHS, loanOptions, loanPayment, loanTotal, repayLoan, takeLoan } from '../game/bank';
import { showReport } from './report';
import { buyCups, COFFEE_CHANCE, CUP_COST, cupsOf, CUPS_MAX, TABLES_COFFEE } from '../game/coffee';
import { coffeePrice, coffeeSprite, GEAR, GEAR_IDS, gearAvailable, gearTier, nextGear, ovenBake, ovenBatch, ovenBatchCost, ovenSprite, upgradeGear, type GearId } from '../game/gear';
import { BAKE_MODES, bakeModeOf, setBakeMode } from '../game/bakery';
import { buyRegister, isCashierRole, nextRegisterCount, nextRegisterPrice, registerCount, registerOfRole, registerSlots } from '../game/registers';
import { activeWar, answerWar } from '../game/war';
import {
  adoptCat,
  buyBed,
  CAT_BASE_LUCK,
  CAT_BED_IDS,
  CAT_BEDS,
  CAT_FROM_DAY,
  CAT_NAME_MAX,
  catAway,
  catOffer,
  declineCat,
  FEED_COST,
  feedCat,
  fedToday,
  setBed,
} from '../game/cat';
import { holidayFor } from '../game/calendar';
import { dialogBox } from './dialog';
import { achievementsButton } from './achievements';
import { liteMode, setLiteMode } from '../platform/quality';
import { sheetAsset, sheetPng } from './sheet';
import { activeAd, activeAds, AD_IDS, adBlock, adBoost, adExtraGuests, adGain, ADS, adPrice, adUntil, buyAd, MAX_ADS } from '../game/ads';
import { answerCafe, CAFE_DAYS, CAFE_MISSES, cafeCanDeliver, cafeDaysLeft, cafeLoyalty, cafeOf } from '../game/cafe';
import { BRAND_BATCH, BRAND_COSTS, BRAND_DEMAND_STEP, BRAND_MAX, brandAvailable, brandBatchCost, brandLevel, buyBrandLevel } from '../game/brand';
import { debtLimit, seeDebtWarning, seeGrandmaRescue } from '../game/bankruptcy';
import { premiumDecor, restartGame } from '../game/restart';
import { answerTale, canChoose, taleToday, TALES } from '../game/tales';
import { arcBox, arcLines } from './arcs';
import { claimPass, EXCLUSIVE_LEVELS, grantPass, passCoins, passDecor, passExclusive, passItem, passLevel, passReady, PASS_DAYS, PASS_LEVELS, PASS_STARS, seasonDaysLeft, seasonExclusives, XP_DAY, XP_PER_LEVEL, XP_QUEST, XP_WEEKLY } from '../game/pass';
import { showSupport } from './support';
import { rushPrize } from '../game/rush';
import { answerStaffEvent, eventCost } from '../game/staffEvents';
import { activeTrick, answerTrick, counterCost, trickResult, trickToday, type TrickAnswer } from '../game/tricks';
import { answerOpening, BUILDINGS, districtNews, districtSite, isMatchDay, OPENING_DAYS, type BuildingId } from '../game/district';
import { canCook, cook, cookMenu, dishPortions, DISHES, DISH_IDS, foodSlots, foodSprite, kitchenOpen, kitchenWorking, menuAuto, morningOrder, orderCost, pantryOf, portionsOf, portionsTotal, stoveSprite, toggleMenu } from '../game/kitchen';
import { addFriend, duelInfo, duelReward, MP_EVENT, guildAction, guildInfo, guildReward, guildsEnabled, inviteToGuild, weekendInfo, visitsInfo, claimGifts } from '../platform/multiplayer';
import { buyPerk, canSell, CAPITAL_STEP, CROWD_STEP, FAME_STEP, legacyOf, perkCost, perkLevel, PERK_IDS, PERKS, salePoints, sellBusiness, SUPPLIERS_STEP, type PerkId } from '../game/legacy';
import { RECORD_ICONS, RECORD_IDS } from '../game/records';
import { flushCloud, saveGame } from '../game/save';
import { buyRadio, hasRadio, RADIO_PRICE, setStation, STATION_INFO, STATIONS, stationOf } from '../game/radio';
import { BOSS_DAYS, bossActive, EDUARD_GROWTH_DAYS, EDUARD_LOYAL_RATING, EDUARD_MAX, EDUARD_STAGES, eduardLook, eduardNews, eduardPull, eduardStage, seeEduardNews, type EduardNews } from '../game/eduard';
import { buyUpgrade, hasUpgrade, UPGRADE_IDS, UPGRADES, withUpgrades } from '../game/upgrades';

/** Высота «голоса» героев в диалогах. */
const VOICE: Record<CharacterId, number> = { grandma: 620, valya: 700, marat: 330, eduard: 240, inspector: 420, sonya: 760, father: 300 };
import { buyDecor, canTry, DECOR, DECOR_KINDS, grantDecor, setDecor, STAR_PACKS, tryDecor, type DecorItem, type DecorKind, decorItem } from '../game/decor';
import { buyWithStars, starsAvailable } from '../platform/stars';
import {
  adoptDog,
  burglaryChance,
  burglaryNews,
  DOG_FOOD,
  DOG_FROM_DAY,
  DOG_PRICE,
  hasWatchman,
  securityOf,
  seeBurglaryNews,
  setWatchman,
  WATCHMAN_BOUNTY,
  WATCHMAN_WAGE,
  type BurglaryNews,
} from '../game/watch';
import { claimFriends, INVITE_REWARD, inviteFriends, socialInfo, WELCOME_GIFT } from '../platform/social';
import { flushSoon, track } from '../platform/analytics';
import { MORNING_TABS, openAllTabs, openTabs, seeTab, tabNew, tabOpen, unlockTab } from '../game/onboarding';
import { newTag, tabHint } from './onboarding';
import { seeWeek, tutAt, tutIndex, tutNext, tutPass, tutReplay, tutSkip, tutStep, tutTell, weekNote, type TutStep, type WeekNote } from '../game/tutorial';
import type { Coach, Spot } from './coach';
import { showLeaderboard } from './leaderboard';
import { keepsakeBox, presentsBox } from './presents';
import { leagueBox, leagueClaimBox, leaguePlace } from './league';
import { haptic, trustedNow } from '../platform/telegram';
import { showReviews } from './reviews';
import { anchorScroll, button, el, foldUp, holdPlace, openModal, staffFace, toast, unfold, who } from './dom';
import { hoodBox } from './hood';
import { BRANCH_PRICE, BRANCH_TRACK_IDS, BRANCH_TRACKS, branchGain, branchInOldShop, branchLock, branchOf, branchShare, branchSignName, branchTier, branchUsual, branchWeek, buyBranch, hyperLock, nextBranchTier, upgradeBranch } from '../game/branch';
import { morningNudge, NUDGE_IDLE_MS, NUDGE_LAST_DAY, type MorningNudge } from '../game/nudge';
import { tryNudge } from './nudge';
import { audioBox } from './audio';
import { answerLife, LIFE_GIFT, lifeNews } from '../game/life';
import { keepPlaces, kioskSpotFree } from '../scenes/placement';
import { albumButton, showAlbum } from './album';
import { freshCount } from '../game/collections';

/** Портрет заказчика: шеф — это Марат. */
const CLIENT_PORTRAIT: Record<ClientId, string> = { chef: 'marat', school: 'school', valya: 'valya' };

interface MorningOptions {
  getState: () => StoreState;
  setState: (s: StoreState) => void;
  onOpen: () => void;
  /** «Переставить полки»: утро закрывается, в зале — перестановка; потом утро откроется снова. */
  onArrange?: () => void;
  /** Зайти в гости в магазин друга (id в Telegram, имя). */
  onVisit?: (id: number, name: string) => void;
  /** «Заглянуть к конкуренту» из рейтинга (ключ с сервера, имя) и к боссу через дорогу (game/rival.ts). */
  onRival?: (key: string, name: string) => void;
  onBoss?: () => void;
  /** Бабушка закончила обучение — теперь можно вручить её гостинец. */
  onTourDone?: () => void;
  /** Дочитали вступление главы (в новом начале гостинец ждёт его конца). */
  onStoryDone?: () => void;
  /** Подсветка бабушкиного обучения (ui/coach.ts): шаги утра — у нужной кнопки. */
  coach?: Coach;
}

// Вкладки в одну строку: значок и короткая подпись. Профиль (достижения, наследие, настройки) —
// кнопкой в углу заголовка, не вкладкой.
type Tab = 'buy' | 'hall' | 'extras' | 'staff' | 'grow' | 'profile';
/**
 * Номер карточки «Что нового»: увеличить, когда появятся новые заметные вещи. Видевшие прежнюю
 * (2: звук, перестановка, друзья…) увидят новую один раз.
 */
const WHATS_NEW = 5;
/** Строки карточки «Что нового» — самое свежее сверху. */
const WHATS_NEW_LINES: TextKey[] = [
  'news.hood',
  'news.hyper',
  'news.branch',
  'news.goal',
  'news.kiosks',
  'news.relief',
  'news.restock',
  'news.housewarming',
  'news.newyear',
  'news.prices',
];

const TABS: [Tab, string, TextKey][] = [
  ['buy', '🛒', 'tab.buy'],
  ['hall', '🏪', 'tab.hall'],
  ['extras', '☕', 'tab.extras'],
  ['staff', '👥', 'tab.staff'],
  ['grow', '🏗', 'tab.grow'],
];

/**
 * Бабушкино обучение в первое утро: по шагу на каждую часть утреннего окна. Подсвечивается то,
 * о чём она говорит (вкладка открывается сама), реплика — внизу экрана.
 */
type TourFocus = 'none' | 'title' | 'today' | 'tab' | 'open';
const TOUR: { key: TextKey; focus: TourFocus; tab?: Tab; mood?: 'happy' | 'sad' }[] = [
  { key: 'tour.hello', focus: 'none', mood: 'happy' },
  { key: 'tour.top', focus: 'title' },
  { key: 'tour.today', focus: 'today' },
  { key: 'tour.buy', focus: 'tab', tab: 'buy' },
  { key: 'tour.warehouse', focus: 'tab', tab: 'hall' },
  { key: 'tour.shelves', focus: 'tab', tab: 'hall' },
  { key: 'tour.extras', focus: 'tab', tab: 'extras' },
  { key: 'tour.staff', focus: 'tab', tab: 'staff' },
  { key: 'tour.store', focus: 'tab', tab: 'grow' },
  { key: 'tour.open', focus: 'open' },
  { key: 'tour.hall', focus: 'open', mood: 'happy' },
];

/** До какого дня утро напоминает про активные моменты дня. */
const MOMENT_TIP_LAST_DAY = 5;
const productLabel = (id: ProductId) => `${PRODUCTS[id].icon} ${t(PRODUCTS[id].nameKey)}`;

/** Строка товара: крупная пиксельная иконка, название (и ценник), подпись и кнопки справа. */
function itemRow(pid: ProductId, opts: { price?: number; sub?: string; actions: HTMLElement[]; name?: string }): HTMLElement {
  const row = el('div', 'ui-item');
  const icon = el('img', 'ui-item-icon');
  icon.src = sheetPng(`item_${pid}_0`);
  icon.alt = '';
  const body = el('div');
  const name = el('div', 'ui-item-name', opts.name ?? t(PRODUCTS[pid].nameKey));
  if (opts.price !== undefined) name.append(el('span', 'ui-tag', `${opts.price} 💰`));
  body.append(name);
  if (opts.sub) body.append(el('div', 'ui-item-sub', opts.sub));
  const actions = el('div', 'ui-item-actions');
  actions.append(...opts.actions);
  row.append(icon, body, actions);
  return row;
}

/** Строка с картинкой из игры (стойка, кофемашина, лежанка): название, ценник, подпись, кнопки. */
/** Какие сворачиваемые блоки игрок раскрыл (помним между утрами, если есть хранилище). */
const OPEN_KEY = 'magazinchik.open';
const openFolds: Set<string> = (() => {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set<string>();
  }
})();

/** Блок со сворачиваемым содержимым: заголовок с ▸/▾, по умолчанию свёрнут. Открывается и закрывается плавно. */
function foldBox(id: string, title: string, fill: (body: HTMLElement) => void): HTMLElement {
  const box = el('div', 'ui-box');
  const head = el('button', 'ui-fold', '');
  const body = el('div');
  const render = () => {
    const open = openFolds.has(id);
    head.textContent = `${open ? '▾' : '▸'} ${title}`;
    body.hidden = !open;
    if (open && !body.childElementCount) fill(body);
  };
  head.addEventListener('click', () => {
    const open = !openFolds.has(id);
    if (open) openFolds.add(id);
    else openFolds.delete(id);
    rememberFolds();
    if (open) {
      render();
      unfold(body);
    } else {
      // Стрелка — сразу, содержимое уезжает за ней.
      head.textContent = `▸ ${title}`;
      // Поля вложенных карточек схлопываются вместе с блоком — заголовок досдвигаем на место.
      foldUp(body, () => holdPlace(head, render));
    }
  });
  render();
  box.append(head, body);
  return box;
}

const rememberFolds = () => {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...openFolds]));
  } catch {
    // Без хранилища помним до перезапуска.
  }
};

/**
 * Подробности под плиткой, полкой или «Сегодня» рисует перерисовка окна: закрываемые сначала плавно
 * уезжают (нажатое остаётся на месте — holdPlace), открытые — плавно выезжают после перерисовки.
 */
function flipSpan(cell: HTMLElement, key: string, shown: HTMLElement | null, apply: () => void): void {
  if (shown) {
    if (shown.dataset.closing) return;
    shown.dataset.closing = '1';
    foldUp(shown, () => holdPlace(cell, apply));
    return;
  }
  apply();
  const span = document.querySelector<HTMLElement>(`.ui-anchored [data-fold="${key}"]`);
  if (span) unfold(span);
}

function artRow(texture: string, opts: { name: string; price?: number; sub?: string; actions: HTMLElement[] }): HTMLElement {
  const row = el('div', 'ui-item');
  const img = el('img', 'ui-item-art');
  img.src = sheetPng(texture);
  img.alt = '';
  const body = el('div');
  const name = el('div', 'ui-item-name', opts.name);
  if (opts.price !== undefined) name.append(el('span', 'ui-tag', `${opts.price} 💰`));
  body.append(name);
  if (opts.sub) body.append(el('div', 'ui-item-sub', opts.sub));
  const actions = el('div', 'ui-item-actions');
  actions.append(...opts.actions);
  row.append(img, body, actions);
  return row;
}

/** «+10%» / «−20%» для множителя. */
/** Название на вывеске — до 16 букв: длиннее не влезает на доску. */
const SHOP_NAME_MAX = 16;

/** Улучшения в списке «Уголков»: кассы самообслуживания живут отдельно, рядом с кассами (их бывает несколько). */
const LISTED_UPGRADES = UPGRADE_IDS.filter((id) => id !== 'selfCheckout');

const percent = (k: number): string => `${k >= 1 ? '+' : '−'}${Math.round(Math.abs(k - 1) * 100)}%`;

/** Заголовок с «❔»: длинное пояснение спрятано и открывается по нажатию. */
/**
 * Длинные пояснения в карточке прячутся за «❔» рядом с заголовком: видны цифры и кнопки,
 * а «как это работает» — по нажатию.
 */
function tuckNotes(box: HTMLElement): HTMLElement {
  const notes = [...box.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('ui-muted') && (c.textContent?.length ?? 0) > 70);
  if (!notes.length) return box;
  for (const n of notes) {
    n.hidden = true;
    n.classList.add('ui-help-text');
  }
  const toggle = button('❔', () => {
    const show = notes[0].hidden;
    for (const n of notes) n.hidden = !show;
    toggle.classList.toggle('active', show);
  }, 'ui-help-btn ui-help-inline');
  const head = box.querySelector(':scope > b, :scope > h3');
  if (head) head.after(toggle);
  else box.prepend(toggle);
  return box;
}

/** То же для списка блоков вкладки. */
const tuckAll = (items: HTMLElement[]): HTMLElement[] => items.map((e) => (e.classList.contains('ui-box') ? tuckNotes(e) : e));

/** Плитка сетки: значок (эмодзи или картинка), название, состояние; красная — нужно внимание. */
interface Tile {
  id: string;
  icon: string;
  title: string;
  status: string;
  alert?: boolean;
  details: () => HTMLElement[];
}

/** toggle(id, show): show — открыть эту плитку, иначе закрыть (если открыта именно она). */
function tileGrid(tiles: Tile[], open: string | null, toggle: (id: string, show: boolean) => void): HTMLElement {
  const grid = el('div', 'ui-shelf-grid');
  for (const tile of tiles) {
    const cell: HTMLButtonElement = button(
      '',
      () => flipSpan(cell, `tile:${tile.id}`, open === tile.id ? grid.querySelector<HTMLElement>(':scope > .ui-shelf-span') : null, () => toggle(tile.id, open !== tile.id)),
      `ui-shelf-card ui-tile-card${open === tile.id ? ' active' : ''}${tile.alert ? ' broken' : ''}`,
    );
    const icon = tile.icon.startsWith('assets/') ? el('img', 'ui-tile-img') : el('span', 'ui-tile-icon', tile.icon);
    if (icon instanceof HTMLImageElement) {
      icon.src = sheetAsset(tile.icon);
      icon.alt = '';
    }
    const text = el('span', 'ui-tile-text');
    text.append(el('b', '', tile.title), el('span', 'ui-shelf-meta', tile.status));
    cell.append(icon, text);
    grid.append(cell);
    if (open === tile.id) {
      const details = el('div', 'ui-shelf-span');
      details.dataset.fold = `tile:${tile.id}`;
      details.append(...tuckAll(tile.details()));
      grid.append(details);
    }
  }
  return grid;
}

function helpRow(title: HTMLElement | string, text: string): HTMLElement {
  const wrap = el('div', 'ui-help');
  const head = el('div', 'ui-help-head');
  const note = el('div', 'ui-help-text', text);
  note.hidden = true;
  const toggle = button('❔', () => {
    note.hidden = !note.hidden;
    toggle.classList.toggle('active', !note.hidden);
  }, 'ui-help-btn');
  head.append(typeof title === 'string' ? el('span', 'ui-muted', title) : title, toggle);
  wrap.append(head, note);
  return wrap;
}

/** Где элемент на экране — для подсветки обучения. */
const rectOf = (node: HTMLElement): Spot | null => {
  if (!node.isConnected) return null;
  const r = node.getBoundingClientRect();
  return r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
};

/** Утро: закупка (товар едет на склад), раскладка со склада на полки, полки и цены. */
export function showMorning({ getState, setState, onOpen, onArrange, onVisit, onRival, onBoss, onTourDone, onStoryDone, coach }: MorningOptions): void {
  const { card, close } = openModal();
  // Нажатый заголовок или кнопка остаются на месте, когда блоки сворачиваются и окно перерисовывается.
  anchorScroll(card);
  const deals = Object.fromEntries(SUPPLIER_IDS.map((id) => [id, newDeal(SUPPLIERS[id])])) as Record<SupplierId, Deal>;
  const quotes = Object.fromEntries(SUPPLIER_IDS.map((id) => [id, SUPPLIERS[id].lines.hello])) as Record<SupplierId, TextKey>;
  let tab: Tab = 'buy';
  /** Какие товары показывать в закупке: заканчивающиеся, все или сезонные. */
  let buyFilter: 'low' | 'all' | 'season' = 'low';
  /** Какая полка во вкладке «Зал» раскрыта (улучшить, продать, починить). */
  let openShelf = -1;
  /** Какая плитка «Уголков» раскрыта, чей ряд в «Персонале» и какой навык хозяина. */
  let openCorner: string | null = null;
  let openStaff: string | null = null;
  let openSkill: string | null = null;
  /** Вкладку только что переключили — содержимое въезжает сбоку (при покупках не дёргается). */
  let slideTab = false;
  /** Какая реплика сюжетного диалога сейчас на экране. */
  let storyLine = 0;
  /** Реплика финальной церемонии (0 — новость ведущей, дальше — герои). */
  let finaleLine = 0;
  /** Реплика сцены «Папа и Соня». */
  let dramaLine = 0;
  /** Шаг бабушкиного обучения и его реплика внизу экрана (пока идёт обучение). */
  let tourStep = 0;
  /** Какой шаг обучения уже ушёл в аналитику (утро перерисовывается, шаг — один раз). */
  let trackedStep = -1;
  /** Открыто подтверждение «Начать заново». */
  let confirmRestart = false;
  /** Шаг обучения, к кнопке которого уже прокрутили список (прокручиваем один раз на шаг). */
  let scrolledLesson = '';
  /** Что нового сегодня (первая неделя): сказано в это утро, висит до «Понятно». */
  let weekShown: WeekNote | null = null;
  let tourEl: HTMLElement | null = null;
  const endTour = () => {
    tourEl?.remove();
    tourEl = null;
    card.classList.remove('touring');
  };
  /** Бракованная партия, по которой ждём решения игрока. */
  let pendingBad: { sid: SupplierId; pid: ProductId; qty: number; price: number } | null = null;
  /** Утром по договорам приехал товар — показать строкой в сводке. */
  const morningDelivery = deliverContracts(getState(), (sid, pid) => unitPrice(SUPPLIERS[sid], newDeal(SUPPLIERS[sid]), pid));
  const delivered: Delivery[] = morningDelivery.deliveries;
  if (morningDelivery.deliveries.length) setState(morningDelivery.state);
  /** Автозаказ: утром сам закупает нужное на день в пределах лимита (по обычной цене, без брака). */
  const autoPrice = (sid: SupplierId, pid: ProductId) => unitPrice(SUPPLIERS[sid], newDeal(SUPPLIERS[sid]), pid);
  /** Утренняя закупка автозаказа — сразу на полки (повторно докупает только недостающее). */
  const autoBuy = (state: StoreState): StoreState => shelveAll(autoMorning(state, autoPrice, guestsToday(state)));
  if (autoActive(getState())) setState(autoBuy(getState()));

  /**
   * Подсказка «что дальше» (game/nudge.ts): игрок застыл в меню, а важное не сделано — мягко светится
   * нужная кнопка и одна строка над «Открыть магазин». Любое касание окна — гаснет до перерисовки.
   */
  let idleSince = Date.now();
  let nudged: MorningNudge | null = null;
  const awake = () => {
    idleSince = Date.now();
    nudged = null;
  };
  card.addEventListener('pointerdown', awake, { passive: true, capture: true });
  card.addEventListener('scroll', () => (idleSince = Date.now()), { passive: true });
  card.classList.toggle('ui-calm', liteMode());
  const nudgeTimer = window.setInterval(() => {
    if (!card.isConnected) {
      window.clearInterval(nudgeTimer);
      return;
    }
    const idle = Date.now() - idleSince;
    // Только в меню с вкладками, без бабушкиного обхода и без окна поверх.
    if (nudged || idle < NUDGE_IDLE_MS || !card.classList.contains('ui-full') || card.classList.contains('touring')) return;
    if (document.querySelectorAll('.ui-modal:not(.closing)').length > 1 || document.querySelector('.ui-dialog')) return;
    const state = getState();
    // Идёт шаг бабушкиного обучения утра — говорит она, строка снизу о том же молчит (одна подсказка за раз).
    if (state.day > NUDGE_LAST_DAY || tutAt(state, 'morning') || document.querySelector('.ui-coach-say')) return;
    const kind = morningNudge(state, { restock: restockPlan(state, priceOf, guestsToday(state)).lines.length > 0 });
    if (!kind || !tryNudge(state.day, kind, idle)) return;
    nudged = kind;
    const tabButton = (id: Tab) => card.querySelector<HTMLElement>(`.ui-tab[data-tab="${id}"]`);
    const target =
      kind === 'restock'
        ? (tab === 'buy' ? card.querySelector<HTMLElement>('.ui-restock .ui-btn') : null) ?? tabButton('buy')
        : kind === 'grow'
          ? tab === 'grow' ? null : tabButton('grow')
          : card.querySelector<HTMLElement>('.ui-open-bar .ui-btn');
    target?.classList.add('ui-nudge');
    card.querySelector('.ui-open-bar')?.prepend(el('div', 'ui-nudge-line', t(`nudge.${kind}`)));
    haptic.tap();
  }, 1000);

  // Торговая неделя и гильдия приходят с сервера чуть позже — перерисовать утро, когда пришли.
  const onMultiplayer = () => {
    if (!card.isConnected) window.removeEventListener(MP_EVENT, onMultiplayer);
    else render();
  };
  window.addEventListener(MP_EVENT, onMultiplayer);

  /** quiet — звук уже сыграла заставка (награда главы), свой «дзынь» не нужен. */
  const update = (next: StoreState | null, feedback: 'tap' | 'success' | 'error' = 'tap', quiet = false) => {
    if (!next) return;
    // Купленное сразу встаёт на полки, лишнее остаётся на складе.
    setState(shelveAll(next));
    haptic[feedback]();
    if (!quiet) sound[feedback === 'tap' ? 'tap' : feedback === 'success' ? 'coin' : 'bad']();
    render();
  };

  /** Сюжетный момент или мягкая неудача — заставка один раз на сцену (утро перерисовывается часто). */
  let cued = '';
  const cue = (id: 'story' | 'fail', scene: string) => {
    if (scene === cued) return;
    cued = scene;
    music.sting(id);
  };

  const render = () => {
    const state = getState();
    // Окно во всю высоту — только у меню с вкладками (ниже); сюжет и письма — по размеру, по центру.
    card.classList.remove('ui-full');
    const title = el('h2');
    title.append(el('span', '', t('morning.title', { n: state.day })), el('span', '', t('morning.money', { n: state.money })));

    if (state.bankrupt) {
      card.replaceChildren(closedBox(state));
      return;
    }
    if (confirmRestart) {
      card.replaceChildren(title, restartBox(state));
      return;
    }
    if (state.grandmaRescue && !state.grandmaRescue.seen) {
      cue('fail', 'rescue');
      card.replaceChildren(rescueBox(state, state.grandmaRescue.paid));
      return;
    }
    if (state.debtWarning && !state.debtWarning.seen) {
      cue('fail', `debt:${state.day}`);
      card.replaceChildren(title, bankLetterBox(state));
      return;
    }
    if (pendingBad) {
      card.replaceChildren(title, qualityBox(pendingBad));
      return;
    }
    const story = pendingStory(state);
    if (story) {
      cue('story', `story:${story.kind}:${state.story.chapter}`);
      card.replaceChildren(storyBox(state, story.kind, story.chapter));
      return;
    }
    const drama = dramaScene(state, todayLocal());
    if (drama) {
      cue('story', `drama:${drama.day}`);
      card.replaceChildren(dramaBox(drama));
      return;
    }
    const news = eduardNews(state);
    if (news !== null) {
      card.replaceChildren(eduardNewsBox(news));
      return;
    }
    const giantPhase = giantNews(state);
    if (giantPhase) {
      card.replaceChildren(giantNewsBox(state, giantPhase));
      return;
    }
    const result = contestResult(state);
    if (result) {
      card.replaceChildren(contestResultBox(result));
      return;
    }
    const announce = contestAnnounce(state);
    if (announce) {
      card.replaceChildren(contestAnnounceBox(announce));
      return;
    }
    const night = burglaryNews(state);
    if (night) {
      card.replaceChildren(burglaryBox(night));
      return;
    }
    if (state.quitNotice?.length) {
      card.replaceChildren(title, quitBox(state.quitNotice));
      return;
    }
    const asking = state.staff.find((m) => m.raiseAsk);
    if (asking) {
      card.replaceChildren(title, raiseBox(asking));
      return;
    }
    if (catOffer(state)) {
      card.replaceChildren(title, catOfferBox(state));
      return;
    }
    if (state.plan?.event && !state.plan.decided) {
      card.replaceChildren(title, eventBox(state, state.plan.event));
      return;
    }

    const touring = state.tourDone === false;
    const step = touring ? TOUR[Math.min(tourStep, TOUR.length - 1)] : null;
    if (step?.tab) tab = step.tab;

    // Новое начало: вкладки открываются по одной, когда понадобятся (game/onboarding.ts).
    // Во время бабушкиного обхода видны все — она о каждой рассказывает.
    if (!touring) {
      const opened = openTabs(state);
      for (const id of opened.opened) track('onb_tab', state.day, MORNING_TABS.indexOf(id));
      // В закрытую вкладку ведёт кнопка («Закупить» в «Главном на сегодня») — она открывается сразу.
      let next = tab === 'profile' ? opened.state : unlockTab(opened.state, tab);
      // Новичку нового начала прежние «Что нового» ни к чему: он и так видит игру такой. Следующие — покажем.
      if (next.onboarding === 'play' && next.whatsNew === undefined) next = { ...next, whatsNew: WHATS_NEW };
      if (next !== state) {
        if (opened.opened.length) flushSoon();
        setState(next);
        render();
        return;
      }
    }
    const shown = TABS.filter(([id]) => touring || tabOpen(state, id));
    // Шаг бабушкиного обучения (game/tutorial.ts): пока он идёт, подсказку говорит она у самой кнопки.
    const lesson = touring ? null : tutAt(state, 'morning');
    // Только что открытая вкладка: ярлык «Новое» и бабушкина подсказка над вкладками.
    const fresh = touring || lesson ? undefined : shown.find(([id]) => tabNew(state, id))?.[0];
    // Первая неделя: что ни утро — бабушка говорит, что нового (после подсказки о вкладке).
    const week = touring || lesson || fresh ? null : weekNote(state);
    if (week) {
      weekShown = week;
      track('tut_week', state.day, week.day);
      setState(seeWeek(state, week));
      render();
      return;
    }
    const see = (id: Tab) => {
      if (tabNew(getState(), id)) setState(seeTab(getState(), id));
    };

    const tabs = el('div', 'ui-tabs');
    const badges = tabBadges(state);
    const go = (id: Tab) => () => {
      tab = id;
      slideTab = true;
      see(id);
      if (id === 'hall') hallSeen();
      render();
      // Вкладку сменили, а список прокручен далеко вниз — показываем её начало.
      requestAnimationFrame(() => card.querySelector('.ui-tabs')?.scrollIntoView({ block: 'start' }));
    };
    for (const [id, icon, label] of shown) {
      const b = button('', go(id), `ui-tab${tab === id ? ' active' : ''}${!touring && tabNew(state, id) ? ' ui-tab-new' : ''}`);
      b.dataset.tab = id;
      b.append(el('span', 'ui-tab-icon', icon), el('span', 'ui-tab-label', t(label)));
      if (badges[id]) b.append(el('span', 'ui-tab-dot', String(badges[id])));
      else if (!touring && tabNew(state, id)) b.append(newTag());
      tabs.append(b);
    }
    const hint = fresh
      ? tabHint(t(`onb.tab.${fresh}` as TextKey), () => {
          see(fresh);
          haptic.tap();
          render();
        })
      : weekShown?.day === state.day && !lesson
        ? tabHint(t(weekShown.key, { name: weekShown.product ? productLabel(weekShown.product) : '', cost: weekShown.cost ?? 0 }), () => {
            weekShown = null;
            haptic.tap();
            render();
          })
        : null;
    const profile = button('🏆', go('profile'), `ui-chip ui-profile-btn${tab === 'profile' ? ' active' : ''}`);
    profile.title = t('tab.profile');
    // «Новое в альбоме» коллекций — точкой на кнопке профиля, где лежит альбом.
    if (tab !== 'profile' && freshCount(state)) profile.append(el('span', 'ui-tab-dot', String(freshCount(state))));
    title.append(profile);

    const body = el('div', slideTab ? 'ui-enter' : '');
    if (tab === 'profile') body.append(el('h3', '', `🏆 ${t('tab.profile')}`));
    const content = { buy: buyTab, hall: hallTab, extras: extrasTab, staff: staffTab, grow: growTab, profile: profileTab }[tab](state);
    // В «Персонале», «Развитии» и профиле длинные пояснения карточек — за «❔».
    body.append(...(tab === 'staff' || tab === 'grow' || tab === 'profile' ? tuckAll(content) : content));
    slideTab = false;
    const today = todoBox(state);
    const info = infos(
      ...deliveryLine(),
      ...fairLine(state),
      ...promoLine(state),
      goalLine(state),
      ...debtLine(state),
      ...bigDayLine(state),
      ...seasonLine(state),
      ...weekSoonLine(state),
      ...weatherLine(state),
      ...warLine(state),
      ...districtLines(state),
      ...arcLines(state),
      ...trickLines(state),
      ...nightGuestLines(state),
      ...holidayLine(state),
      el('div', 'ui-muted', t('morning.guests', { r: state.rating.toFixed(1), n: guestsToday(state) })),
      billForecast(state),
    );
    const openButton = button(t('morning.open'), () => {
      endTour();
      if (tutStep(getState()) === 'open') setState(tutPass(getState(), 'open'));
      coach?.hide();
      coach?.skipButton(false);
      close();
      onOpen();
    });
    // Кнопка «Открыть магазин» всегда внизу окна — не нужно листать до конца списка.
    const openBar = el('div', 'ui-open-bar');
    openBar.append(openButton);
    card.classList.add('ui-full');
    // Сверху — только то, где нужно решить или забрать; остальное утро — в свёрнутой карточке «Сегодня».
    card.replaceChildren(
      title,
      ...(touring ? [] : whatsNewBox(state)),
      ...(touring ? [] : tipBox(state)),
      ...giftsBox(),
      ...presentsBox(getState, update),
      ...leagueClaimBox(state, getState, update),
      ...(touring ? [] : liveBox(state)),
      ...(touring ? [] : weekBox(state, guestsToday(state))),
      ...staffEventBox(state),
      ...careerBox(state),
      ...districtBox(state),
      ...lifeBox(state),
      ...trickBox(state),
      ...taleBox(state),
      ...arcBox(state, getState, update),
      ...guildClaimBox(state),
      today,
      todayCard(state, touring, [...friendShopsBox(), ...leagueBox(() => showLeaderboard(undefined, { tab: 'league', level: getState().level })), ...rushBox(state), ...passBox(state), ...duelBox(state), ...goalsBox(state), info, ...giantBox(state), ...contestBox(state)]),
      ...(hint ? [hint] : []),
      tabs,
      body,
      openBar,
    );
    if (lesson) showLesson(state, lesson, tabs, body, openButton);
    else coach?.skipButton(false);
    if (!step) {
      endTour();
      return;
    }
    const focus = {
      none: null,
      title,
      today,
      tab: tabs.querySelector<HTMLElement>('.ui-tab.active'),
      open: openButton,
    }[step.focus];
    focus?.classList.add('ui-tour-focus');
    // То, о чём рассказывают вместе с подсвеченным: содержимое вкладки, сводка дня.
    const lit = { none: null, title: null, today: info, tab: body, open: null }[step.focus];
    lit?.classList.add('ui-tour-lit');
    showTour(step);
    if (focus) requestAnimationFrame(() => focus.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    else card.scrollTo({ top: 0 });
  };

  /**
   * Шаг бабушкиного обучения в утре: светлое окошко и стрелка у кнопки, одна строчка рядом.
   * Кнопки нет (закупать нечего, вкладка уже открыта) — шаг засчитан, утро рисуется дальше.
   */
  /** Шаг обучения «Загляни в „Зал“» — последний: бабушка прощается одной строчкой. */
  const hallSeen = () => {
    if (tutStep(getState()) !== 'hall') return;
    const at = tutIndex(getState());
    const next = tutNext(getState());
    setState(next);
    if (tutStep(next)) return;
    track('tut_done', next.day, at);
    flushSoon();
    coach?.skipButton(false);
    coach?.note(t('tut.done'), 4500);
  };

  const showLesson = (state: StoreState, lesson: TutStep, tabs: HTMLElement, body: HTMLElement, openButton: HTMLElement) => {
    if (!coach) return;
    const tabButton = (id: Tab) => tabs.querySelector<HTMLElement>(`[data-tab="${id}"]`);
    let target: HTMLElement | null = null;
    let key: TextKey = 'tut.open';
    if (lesson === 'reorder') {
      target = tab === 'buy' ? body.querySelector<HTMLElement>('.ui-restock .ui-btn') : tabButton('buy');
      key = tab === 'buy' ? 'tut.reorder' : 'tut.buyTab';
    } else if (lesson === 'open') target = openButton;
    else if (tab !== 'hall') {
      target = tabButton('hall');
      key = 'tut.hall';
    }
    if (!target) {
      if (lesson === 'hall') hallSeen();
      else setState(tutPass(state, lesson));
      render();
      return;
    }
    const told = tutTell(state);
    if (told) {
      track('tut_step', state.day, tutIndex(state));
      flushSoon();
      setState(told);
    }
    const node = target;
    const id = `${lesson}:${key}`;
    // Новый шаг, а кнопка ниже края списка — прокрутить к ней (один раз: покупки список не дёргают).
    if (scrolledLesson !== id) {
      scrolledLesson = id;
      requestAnimationFrame(() => node.isConnected && node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
    coach.onSkip = () => {
      track('tut_skip', getState().day, tutIndex(getState()));
      flushSoon();
      setState(tutSkip(getState()));
      render();
    };
    coach.skipButton(true, true);
    coach.show({ id, text: t(key), target: () => rectOf(node), under: () => node });
  };

  /** Красные цифры на вкладках: где утром нужно что-то сделать. */
  const tabBadges = (state: StoreState): Partial<Record<Tab, number>> => {
    const empty = sellableProducts(state).filter((pid) => canStock(state, pid) && stockOf(state, pid) === 0).length;
    const broken = state.shelves.filter((sh) => sh.broken).length + (surplus(state).count ? 1 : 0);
    const rack = rackOf(state);
    const extras = (state.cat && !fedToday(state) ? 1 : 0) + (rack.stock <= rackCapacity(state) / 3 && rack.stock < rackCapacity(state) ? 1 : 0);
    const next = nextStoreLevel(state);
    const grow = next && state.debt === 0 && state.money >= next.cost ? 1 : 0;
    return { buy: empty, hall: broken, extras, grow };
  };

  /**
   * «Сегодня»: строка значков (рейтинг, гости, задания, неделя, сезон) — по нажатию раскрываются
   * подробности: новости района, задания, испытания, погода, счета.
   */
  const todayCard = (state: StoreState, touring: boolean, details: HTMLElement[]): HTMLElement => {
    const box = el('div', 'ui-box ui-today');
    const open = touring || openFolds.has('today');
    const head = el('button', 'ui-today-head');
    const chips = el('div', 'ui-today-chips');
    const chip = (text: string, hot = false) => chips.append(el('span', `ui-today-chip${hot ? ' hot' : ''}`, text));
    chip(`★ ${state.rating.toFixed(1)}`);
    chip(`👥 ~${guestsToday(state)}`);
    const quests = state.plan?.quests ?? [];
    if (quests.length) chip(`🎯 ${quests.length}`);
    const weekly = state.weekly?.challenges as Challenge[] | undefined;
    if (weekly?.length) chip(`📅 ${weekly.filter((c) => c.done).length}/${weekly.length}`);
    const ready = state.pass ? passReady(state) : 0;
    if (state.pass) chip(`🎫 ${passLevel(state.pass)}${ready ? ` · 🎁${ready}` : ''}`, ready > 0);
    // Турнир района (ui/league.ts): место в лиге этой недели.
    const place = leaguePlace();
    if (place) chip(`🏆 ${place}`, place <= 3);
    head.append(el('b', '', `${open ? '▾' : '▸'} ${t('today.title')}`), chips);
    head.addEventListener('click', () => {
      if (touring) return;
      flipSpan(head, 'today', open ? box.querySelector<HTMLElement>('.ui-today-more') : null, () => {
        if (open) openFolds.delete('today');
        else openFolds.add('today');
        rememberFolds();
        render();
      });
    });
    box.append(head);
    if (open) {
      const more = el('div', 'ui-today-more');
      more.dataset.fold = 'today';
      more.append(...details);
      box.append(more);
    }
    return box;
  };

  /** Реплика бабушки внизу экрана: «Дальше» — следующий шаг, «Пропустить» — сразу к делу. */
  const showTour = (step: (typeof TOUR)[number]) => {
    card.classList.add('touring');
    tourEl?.remove();
    tourEl = el('div', 'ui-tour');
    const last = tourStep >= TOUR.length - 1;
    // Каждый шаг — в аналитику: на каком бросают обход (номер шага с 1).
    if (trackedStep !== tourStep) {
      trackedStep = tourStep;
      track('tour_step', getState().day, tourStep + 1);
    }
    const finish = () => {
      const at = tourStep + 1;
      tourStep = 0;
      trackedStep = -1;
      endTour();
      track(last ? 'tour_done' : 'tour_skip', getState().day, at);
      flushSoon();
      // После обхода в новом начале все вкладки уже знакомы — не прячем их обратно.
      update(openAllTabs({ ...getState(), tourDone: true }), last ? 'success' : 'tap');
      // Подарок — только после обучения: окно гостинца не мешает бабушкиным подсказкам.
      if (onTourDone) {
        onTourDone();
        render();
      }
    };
    const skip = button(t('tour.skip'), finish, 'ui-tour-skip');
    tourEl.append(
      el('div', 'ui-tour-head', t('tour.title', { n: tourStep + 1, total: TOUR.length })),
      dialogBox({
        portrait: `portrait_grandma${step.mood ? `_${step.mood}` : ''}`,
        name: t(CHARACTERS.grandma.nameKey),
        text: t(step.key),
        pitch: VOICE.grandma,
        nextLabel: last ? t('tour.done') : t('tour.next'),
        onNext: () => {
          if (last) {
            finish();
            return;
          }
          tourStep++;
          slideTab = true;
          render();
        },
      }),
    );
    if (!last) tourEl.append(skip);
    document.body.append(tourEl);
  };

  // ---------- Закупка ----------

  /**
   * Автозаказ — первой карточкой закупки, крупно: включён ли, лимит на день, что купил утром (товар можно
   * вернуть по одному или весь). Не куплен — та же карточка с кнопкой покупки.
   */
  const autoCard = (state: StoreState): HTMLElement[] => {
    if (state.day <= 3) return [];
    const up = UPGRADES.autoOrder;
    const owned = hasUpgrade(state, 'autoOrder');
    if (!owned && state.level < up.minLevel) return [];
    const on = autoActive(state);
    const box = el('div', `ui-box ui-auto${on ? ' on' : ''}`);
    const head = el('div', 'ui-auto-head');
    head.append(el('b', '', t('auto.title')), el('span', 'ui-auto-state', owned ? t(on ? 'auto.stateOn' : 'auto.stateOff') : `${up.price} 💰`));
    box.append(head);
    if (!owned) {
      box.append(
        el('div', 'ui-muted', t('auto.teaser')),
        button(t('auto.buy', { n: up.price }), () => {
          const bought = buyUpgrade(getState(), 'autoOrder');
          update(bought && autoBuy({ ...bought, autoOrder: { ...bought.autoOrder, on: true } }), 'success');
        }, 'ui-btn', state.money < up.price),
      );
      return [box];
    }
    if (!on) {
      box.append(el('div', 'ui-muted', t('auto.offText')), button(t('auto.enable'), () => update(autoBuy(autoToggle(getState())), 'success'), 'ui-btn'));
      return [box];
    }
    // Лимит: доля денег на утро — сразу видно, сколько это в монетах.
    const limitRow = el('div', 'ui-row ui-auto-limit');
    const shares = el('div', 'ui-chips');
    for (const share of AUTO_SHARES) {
      shares.append(
        // Подняли лимит — сразу докупает до нового; опустили — купленное остаётся (вернуть можно ниже).
        button(
          t('auto.share', { p: Math.round(share * 100) }),
          () => {
            const next = autoSetShare(getState(), share);
            update(share > autoShare(getState()) ? autoBuy(next) : next);
          },
          `ui-chip${autoShare(state) === share ? ' active' : ''}`,
        ),
      );
    }
    limitRow.append(el('span', '', t('auto.limit', { n: autoLimit(state) })), shares);
    box.append(limitRow);
    const today = autoDay(state);
    const off = button(t('auto.disable'), () => update(autoToggle(getState())), 'ui-chip');
    const actions = el('div', 'ui-chips ui-auto-actions');
    if (today.canceled) {
      box.append(el('div', 'ui-note', t('auto.canceled')), button(t('auto.resume'), () => update(autoBuy(autoResume(getState())), 'success'), 'ui-btn secondary'));
    } else if (today.lines.length) {
      box.append(el('div', 'ui-muted', t('auto.bought', { spent: today.spent, limit: autoLimit(state) })));
      const lines = el('div', 'ui-chips ui-auto-lines');
      for (const line of today.lines) lines.append(button(`${PRODUCTS[line.pid].icon}×${line.qty} ✕`, () => update(autoReturn(getState(), line.pid)), 'ui-chip'));
      box.append(lines);
      if (today.cut) box.append(el('div', 'ui-note', t('auto.cut')));
      const refund = today.lines.reduce((sum, l) => sum + l.paid, 0);
      actions.append(button(t('auto.cancel', { n: refund }), () => update(autoCancel(getState())), 'ui-chip'));
    } else {
      box.append(el('div', 'ui-muted', t(today.cut ? 'auto.cut' : 'auto.nothing')));
    }
    actions.append(off);
    box.append(el('div', 'ui-muted', t('auto.day', { n: AUTO_TOPUPS, p: Math.round((AUTO_TOPUP_MARKUP - 1) * 100) })), actions);
    return [box];
  };

  /** Сколько товара стоит на полках и сколько всего мест (сломанные холодильники и ларь не в сезон не в счёт). */
  const shelfSpace = (state: StoreState) => {
    const working = state.shelves.filter((sh) => !sh.broken && PRODUCT_IDS.some((pid) => canPlace(pid, sh) && productAvailable(pid, state.day)));
    return { s: working.reduce((a, sh) => a + shelfCount(sh), 0), smax: working.reduce((a, sh) => a + shelfCapacity(sh), 0) };
  };

  const priceOf = (sid: SupplierId, pid: ProductId) => unitPrice(SUPPLIERS[sid], deals[sid], pid);

  /** Купить у поставщика: брак — с той же вероятностью, что и раньше. */
  const buyFrom = (sid: SupplierId, pid: ProductId, qty: number, price: number) => {
    const bad = badBatch(sid, getState().day, Math.random());
    const next = buyStock(getState(), pid, qty, price, bad);
    if (bad && next) pendingBad = { sid, pid, qty, price };
    update(next, bad ? 'error' : 'tap');
  };

  /**
   * «Закупить нужное»: одна кнопка — всё, чего не хватит на день, у самых дешёвых поставщиков, сразу
   * на полки и на склад. «Не влезет» — только когда правда нет места или денег, и сказано, чего именно.
   */
  const restockBox = (state: StoreState): HTMLElement => {
    const plan = restockPlan(state, priceOf, guestsToday(state));
    const box = el('div', 'ui-box ui-restock');
    if (!plan.lines.length) {
      if (!plan.cut) box.append(el('b', '', `✅ ${t('restock.enough')}`));
      else box.append(el('div', 'ui-note', t(plan.short === 'money' ? 'restock.noMoney' : 'restock.noRoom')));
      return box;
    }
    const list = plan.lines.map((l) => `${PRODUCTS[l.pid].icon}×${l.qty}`).join(' ');
    box.append(
      button(t('restock.buy', { n: plan.total }), () => {
        const fresh = restockPlan(getState(), priceOf, guestsToday(getState()));
        if (!fresh.lines.length) return;
        const result = applyReorder(getState(), fresh, (line) => badBatch(line.sid, getState().day, Math.random()));
        if (result.badLine) pendingBad = { sid: result.badLine.sid, pid: result.badLine.pid, qty: result.badLine.qty, price: result.badLine.price };
        // Ничего не купилось (не должно: план считает место как при покупке) — без звона монет.
        const bought = result.state.money < getState().money;
        // Шаг обучения «Закупить нужное» пройден; бабушкина подсказка о «Закупке» уже не нужна.
        const next = tutStep(getState()) === 'reorder' ? tutPass(seeTab(result.state, 'buy'), 'reorder') : result.state;
        update(next, result.badLine || !bought ? 'error' : 'success');
      }, state.day <= 2 ? 'ui-btn ui-pulse' : 'ui-btn'),
      el('div', 'ui-muted', list),
    );
    if (plan.cut) box.append(el('div', 'ui-note', t(plan.short === 'money' ? 'restock.cutMoney' : 'restock.cutRoom')));
    return box;
  };

  /** Список по товарам: остаток, сколько нужно на день, лучшая цена и у кого, «+1» / «+5». */
  const productRows = (state: StoreState): HTMLElement[] => {
    const guests = guestsToday(state);
    const free = warehouseCapacity(state) - warehouseCount(state);
    const seasonal = (pid: ProductId) => Boolean(SEASONAL[pid]);
    const shown = PRODUCT_IDS.filter((pid) => {
      if (buyFilter === 'season') return seasonal(pid);
      if (!canStock(state, pid) || !bestOffer(state, pid, priceOf)) return false;
      return buyFilter === 'all' || stockOf(state, pid) < restockTarget(state, pid, guests) * 0.6;
    });
    const box = el('div', 'ui-box');
    for (const pid of shown) {
      if (!productAvailable(pid, state.day)) {
        box.append(el('div', 'ui-muted', `🗓 ${t('goods.offer', { name: productLabel(pid), when: t(`goods.when.${pid}` as TextKey), left: t('goods.in', { n: daysUntilSeason(pid, state.day) }) })}`));
        continue;
      }
      const offer = bestOffer(state, pid, priceOf);
      if (!offer || !canStock(state, pid)) {
        box.append(el('div', 'ui-muted', `🔒 ${productLabel(pid)}: ${t('prices.locked', { shelf: t(SHELF_KINDS[PRODUCTS[pid].category].nameKey) })}`));
        continue;
      }
      const { sid, price } = offer;
      const chips = [1, 5].map((qty) =>
        button(
          `+${qty}`,
          () => buyFrom(sid, pid, qty, price),
          // В первые дни «+5» у хлеба пульсирует — подсказка, с чего начать.
          state.day <= 2 && qty === 5 && pid === 'bread' ? 'ui-chip ui-pulse' : 'ui-chip',
          qty > free || price * qty > state.money,
        ),
      );
      const need = restockTarget(state, pid, guests);
      const sub = `${t('buy.inWarehouse', { s: onShelves(state, pid), n: warehouseOf(state, pid) })} · ${t('restock.need', { n: need })} · ${t(SUPPLIERS[sid].nameKey)}`;
      box.append(itemRow(pid, { price, sub, actions: chips }));
    }
    if (!box.childElementCount) box.append(el('div', 'ui-muted', t(buyFilter === 'low' ? 'restock.noneLow' : 'restock.none')));
    return [box];
  };

  const buyTab = (state: StoreState): HTMLElement[] => {
    const filters = el('div', 'ui-chips ui-filter');
    for (const id of ['low', 'all', 'season'] as const) {
      filters.append(
        button(t(`restock.filter.${id}` as TextKey), () => {
          buyFilter = id;
          render();
        }, `ui-chip${buyFilter === id ? ' active' : ''}`),
      );
    }
    // Оптовик появляется, когда в помещении можно поставить полку нового отдела.
    const suppliers = SUPPLIER_IDS.filter((sid) => {
      const req = SUPPLIERS[sid].requires;
      return !Array.isArray(req) || req.some((k) => shelfKindOpen(state, k));
    });
    return [
      ...autoCard(state),
      ...cafeBox(state),
      // Купленное сразу уходит на полки — показываем и полки, и склад, иначе кажется, что ничего не купил.
      helpRow(t('buy.space', { ...shelfSpace(state), n: warehouseCount(state), max: warehouseCapacity(state) }), t('buy.note')),
      restockBox(state),
      filters,
      ...productRows(state),
      foldBox('suppliers', `🤝 ${t('restock.suppliers')}`, (body) => body.append(...suppliers.map((sid) => supplierBox(sid, getState())))),
      foldBox('prices', `🏷 ${t('tab.prices')}`, (body) => body.append(helpRow(t('prices.title'), t('prices.note', { g: percent(priceAppeal(getState())) })), ...pricesTab(getState()))),
    ];
  };

  const supplierBox = (sid: SupplierId, state: StoreState) => {
    const s = SUPPLIERS[sid];
    const deal = deals[sid];
    const box = el('div', 'ui-box');
    box.append(who(sid, el('b', '', t(s.nameKey))), el('div', 'ui-quote', `«${t(quotes[sid])}»`));

    if (!supplierOpen(s, state.shelves)) {
      const kinds = Array.isArray(s.requires) ? s.requires.filter((k) => shelfKindOpen(state, k)) : [s.requires!];
      box.append(el('div', 'ui-muted', t('buy.needShelf', { shelf: kinds.map((k) => t(SHELF_KINDS[k].nameKey)).join(' / ') })));
      return box;
    }

    // Что у него есть сегодня и почём; покупать — в списке выше (там сразу самая низкая цена).
    const offers = PRODUCT_IDS.filter((pid) => canStock(state, pid))
      .map((pid) => ({ pid, price: unitPrice(s, deal, pid) }))
      .filter((o): o is { pid: ProductId; price: number } => o.price !== null);
    box.append(el('div', 'ui-item-sub', offers.map((o) => `${PRODUCTS[o.pid].icon}${o.price}`).join('  ')));

    // Торг одной строкой: слева «Торг» и сердечки терпения поставщика, справа три одинаковые кнопки.
    const haggleRow = el('div', 'ui-haggle');
    if (deal.discount > 0) {
      haggleRow.classList.add('done');
      haggleRow.append(el('b', '', `✅ ${t('buy.discount', { p: Math.round(deal.discount * 100) })}`));
    } else if (deal.angry) {
      haggleRow.classList.add('angry');
      haggleRow.append(el('b', '', `😤 ${t('buy.angryNote')}`));
    } else {
      const label = el('div', 'ui-haggle-label');
      const hearts = '♥'.repeat(deal.attemptsLeft) + '♡'.repeat(Math.max(0, s.patience - deal.attemptsLeft));
      const pips = el('span', 'ui-haggle-pips', hearts);
      pips.title = t('buy.attempts', { n: deal.attemptsLeft });
      label.append(el('b', '', `🤝 ${t('buy.haggle')}`), pips);
      const asks = el('div', 'ui-haggle-asks');
      for (const ask of HAGGLE_ASKS) {
        asks.append(
          button(
            `−${Math.round(ask * 100)}%`,
            () => {
              const result = haggle(s, deals[sid], ask, getState().rating, Math.random(), haggleBonus(getState()));
              deals[sid] = result.deal;
              quotes[sid] = result.success ? s.lines.yes : result.deal.angry ? s.lines.angry : s.lines.no;
              haptic[result.success ? 'success' : 'error']();
              render();
            },
            'ui-chip',
            !canHaggle(deal),
          ),
        );
      }
      haggleRow.append(label, asks);
    }
    box.append(haggleRow);
    return box;
  };

  const qualityBox = (batch: NonNullable<typeof pendingBad>) => {
    const box = el('div', 'ui-box');
    box.append(
      el('h3', '', `⚠️ ${t('quality.title')}`),
      el('p', '', t('quality.text', { product: productLabel(batch.pid), n: batch.qty, supplier: t(SUPPLIERS[batch.sid].nameKey) })),
    );
    const refund = Math.round(batch.qty * batch.price * RETURN_REFUND);
    const options: [BadBatchChoice, TextKey, string][] = [
      ['shelf', 'quality.shelf', t('quality.shelfHint')],
      ['markdown', 'quality.markdown', t('quality.markdownHint')],
      ['return', 'quality.return', t('quality.returnHint', { n: refund })],
    ];
    for (const [choice, label, hint] of options) {
      box.append(
        button(t(label), () => {
          pendingBad = null;
          update(resolveBadBatch(getState(), batch.pid, choice, batch.price));
        }),
        el('div', 'ui-muted', hint),
      );
    }
    return box;
  };

  // ---------- Склад ----------

  /** Склад во вкладке «Зал»: что не влезло на полки — строкой значков; разложить одной кнопкой. */
  const stockBox = (state: StoreState): HTMLElement[] => {
    const out: HTMLElement[] = [];
    const expiring = surplus(state).count;
    if (expiring) {
      const box = el('div', 'ui-box');
      box.append(
        el('div', 'ui-note', t('markdown.note', { n: expiring })),
        button(t('markdown.button', { n: expiring }), () => update(surplus(getState()).state, 'success'), 'ui-chip'),
      );
      out.push(box);
    }
    const present = PRODUCT_IDS.filter((pid) => warehouseOf(state, pid) > 0);
    const box = el('div', 'ui-box');
    box.append(el('b', '', `📦 ${t('warehouse.capacity', { n: warehouseCount(state), max: warehouseCapacity(state) })}`));
    if (!present.length) {
      box.append(el('div', 'ui-muted', t('warehouse.empty')));
    } else {
      const line = present.map((pid) => {
        const units = state.warehouse[pid] ?? [];
        const bad = units.filter((u) => u.bad && !u.markdown).length;
        return `${PRODUCTS[pid].icon}${units.length}${bad ? `(⚠${bad})` : ''}`;
      });
      box.append(el('div', 'ui-stock-line', line.join('  ')));
      // Есть что поставить на свободное место — одна кнопка вместо кнопки у каждого товара.
      const movable = present.some((pid) => state.shelves.some((sh) => canPlace(pid, sh) && shelfFree(sh) > 0));
      if (movable)
        box.append(
          button(t('todo.stockBtn'), () => {
            let next = getState();
            next.shelves.forEach((_, i) => (next = moveToShelf(next, i).state));
            update(next, 'success');
          }, 'ui-chip'),
        );
      const noShelf = present.filter((pid) => !state.shelves.some((sh) => canPlace(pid, sh)));
      for (const pid of noShelf) box.append(el('div', 'ui-muted', `${productLabel(pid)}: ${t('warehouse.noShelf', { shelf: t(SHELF_KINDS[PRODUCTS[pid].category].nameKey) })}`));
    }
    box.append(helpRow(t(state.donate ? 'donate.on' : 'donate.off'), t('donate.title')));
    box.append(button(t(state.donate ? 'donate.toggleOff' : 'donate.toggleOn'), () => update(toggleDonate(getState())), 'ui-chip'));
    out.push(box);
    return out;
  };

  // ---------- Полки ----------

  /** Сезонные товары: когда и где продаются, сколько ждать; плюс ларь для мороженого — купить прямо здесь. */
  const seasonBox = (state: StoreState): HTMLElement => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('goods.title')));
    for (const pid of Object.keys(SEASONAL) as ProductId[]) {
      const left = daysUntilSeason(pid, state.day);
      box.append(el('div', '', `${t(`goods.${pid}` as TextKey)} · ${left === 0 ? t('goods.now') : t('goods.in', { n: left })}`));
      if (state.shelves.some((s) => canPlace(pid, s))) continue;
      box.append(el('div', 'ui-muted', t('prices.locked', { shelf: t(SHELF_KINDS[PRODUCTS[pid].category].nameKey) })));
    }
    // Мороженое — круглый год, но только из ларя: пока его нет — купить прямо здесь.
    if (!state.shelves.some((s) => s.kind === 'icebox')) {
      const price = SHELF_KINDS.icebox.price;
      box.append(el('div', '', t('goods.icecream')));
      if (!shelfKindOpen(state, 'icebox')) box.append(el('div', 'ui-muted', `🔒 ${t('shelf.lockedLevel', { name: t(STORE_LEVELS[1].nameKey) })}`));
      else
        box.append(
          el('div', 'ui-muted', t('goods.noIcebox')),
          button(t('shelves.buy', { name: t('shelf.icebox'), cost: price }), () => update(buyShelf(getState(), 'icebox'), 'success'), 'ui-btn secondary', price > state.money),
        );
    }
    return box;
  };

  /** Товар в списке «Только: …» — у сезонного подписано, когда его продают. */
  const shelfGoodLabel = (pid: ProductId): string => (SEASONAL[pid] ? `${productLabel(pid)} (${t(`goods.when.${pid}` as TextKey)})` : productLabel(pid));

  /** Подробности полки под сеткой: что на ней можно, улучшить, починить, продать. */
  const shelfDetails = (state: StoreState, i: number): HTMLElement => {
    const shelf = state.shelves[i];
    const box = el('div', 'ui-box ui-shelf-details');
    const head = el('div', 'ui-row');
    head.append(
      el('b', '', t(SHELF_KINDS[shelf.kind].nameKey)),
      // Вёдра с цветами бесплатные — их не продают.
      ...(SHELF_KINDS[shelf.kind].price ? [button(t('shelves.sell', { n: shelfResale(shelf) }), () => {
        openShelf = -1;
        update(keepPlaces(getState(), sellShelf(getState(), i), i));
      }, 'ui-chip')] : []),
      // Обычную полку можно убрать в запас (товар — на склад) и поставить потом обратно бесплатно.
      ...(isFixture(shelf) ? [] : [button(`📦 ${t('shelves.store')}`, () => {
        openShelf = -1;
        update(keepPlaces(getState(), storeShelf(getState(), i), i));
      }, 'ui-chip', !storeShelf(state, i))]),
    );
    if (!isFixture(shelf) && !storeShelf(state, i)) box.append(el('div', 'ui-muted', t('shelves.storeFull')));
    const allowed = PRODUCT_IDS.filter((pid) => PRODUCTS[pid].category === shelf.kind).map(shelfGoodLabel).join(', ');
    box.append(head, el('div', 'ui-muted', t('shelves.only', { list: allowed })));
    if (shelf.kind === 'icebox') box.append(el('div', 'ui-muted', t('shelves.iceboxNote')));
    if (shelf.kind === 'florist') box.append(el('div', 'ui-muted', t('shelves.floristNote')));
    if (shelf.broken) {
      const cost = fridgeRepairCost(state.level);
      box.append(
        el('div', 'ui-note', `🔧 ${t('shelves.broken')}`),
        button(t('shelves.repair', { cost }), () => update(repairShelf(getState(), i), 'success'), 'ui-btn', state.money < cost),
      );
    }
    const cost = upgradeCost(shelf);
    if (cost === null) box.append(el('div', 'ui-muted', t('shelves.maxLevel')));
    else
      box.append(
        button(t('shelves.upgrade', { cap: SHELF_LEVELS[shelf.level + 1].capacity, cost }), () => update(upgradeShelf(getState(), i), 'success'), 'ui-btn secondary', cost > state.money),
      );
    return box;
  };

  /** «Зал»: склад одной карточкой, полки — сеткой (нажать — подробности), покупка новых полок. */
  const hallTab = (state: StoreState): HTMLElement[] => {
    const slots = storeLevel(state).slots;
    const space = shelfSpace(state);
    const arrange = onArrange
      ? [
          button(`🔧 ${t('arrange.open')}`, () => {
            endTour();
            close();
            onArrange();
          }, 'ui-btn secondary'),
        ]
      : [];
    const out: HTMLElement[] = [
      helpRow(`🗄 ${t('shelves.slots', { n: slots - freeSlots(state), max: slots })} · ${t('hall.goods', { n: space.s, max: space.smax })}`, t('shelves.rule')),
      ...arrange,
      ...stockBox(state),
    ];
    if (openShelf >= state.shelves.length) openShelf = -1;
    const grid = el('div', 'ui-shelf-grid');
    state.shelves.forEach((shelf, i) => {
      const n = shelfCount(shelf);
      const max = shelfCapacity(shelf);
      const cell: HTMLButtonElement = button('', () => {
        const shown = openShelf === i ? grid.querySelector<HTMLElement>(':scope > .ui-shelf-span') : null;
        const show = !shown;
        flipSpan(cell, `shelf:${i}`, shown, () => {
          // Явно, а не «наоборот»: закрытие ждёт конца анимации, а за это время могли раскрыть другую полку.
          if (show) openShelf = i;
          else if (openShelf === i) openShelf = -1;
          render();
        });
      }, `ui-shelf-card${openShelf === i ? ' active' : ''}${shelf.broken ? ' broken' : ''}`);
      const bar = el('div', 'ui-bar');
      const fill = el('div', 'ui-bar-fill');
      fill.style.width = `${Math.round((n / Math.max(1, max)) * 100)}%`;
      fill.style.background = shelf.broken ? '#e43b44' : n / Math.max(1, max) < 0.25 ? '#feae34' : '#63c74d';
      bar.append(fill);
      const icons = PRODUCT_IDS.filter((pid) => (shelf.items[pid]?.length ?? 0) > 0).slice(0, 3).map((pid) => PRODUCTS[pid].icon).join('');
      cell.append(
        el('b', '', `${shelf.broken ? '🔧 ' : ''}${t(SHELF_KINDS[shelf.kind].nameKey)}`),
        el('span', 'ui-shelf-meta', `${icons} ${n}/${max} · ${'★'.repeat(shelf.level + 1)}`),
        bar,
      );
      grid.append(cell);
      // Подробности — сразу под строкой с выбранной полкой.
      if (openShelf === i) {
        const details = shelfDetails(state, i);
        details.classList.add('ui-shelf-span');
        details.dataset.fold = `shelf:${i}`;
        grid.append(details);
      }
    });
    out.push(grid, foldBox('season', `🗓 ${t('goods.title')}`, (body) => body.append(seasonBox(getState()))));
    // Запас: убранные полки ставятся обратно на первое свободное место бесплатно.
    if (state.storedShelves?.length) {
      out.push(el('h3', '', `📦 ${t('shelves.storedTitle')}`));
      state.storedShelves.forEach((shelf, k) => {
        const open = shelfKindOpen(state, shelf.kind);
        out.push(button(
          t('shelves.place', { name: `${t(SHELF_KINDS[shelf.kind].nameKey)} ${'★'.repeat(shelf.level + 1)}` }),
          () => update(placeStored(getState(), k), 'success'),
          'ui-btn secondary',
          freeSlots(state) <= 0 || !open,
        ));
      });
    }
    out.push(el('h3', '', t('shelves.buyTitle')));
    if (freeSlots(state) <= 0) {
      out.push(el('div', 'ui-muted', t('shelves.noRoom')));
    } else {
      for (const kind of CATEGORIES) {
        const { nameKey, price, minLevel } = SHELF_KINDS[kind];
        // Новые отделы — только в больших помещениях: пока закрыто, видно, где откроется.
        if (!shelfKindOpen(state, kind)) {
          if (minLevel === state.level + 1)
            out.push(el('div', 'ui-muted', `🔒 ${t(nameKey)} — ${t('shelf.lockedLevel', { name: t(STORE_LEVELS[minLevel].nameKey) })}`));
          continue;
        }
        out.push(
          button(
            t('shelves.buy', { name: t(nameKey), cost: price }),
            () => update(buyShelf(getState(), kind), 'success'),
            'ui-btn secondary',
            price > state.money,
          ),
        );
      }
    }
    return out;
  };

  // ---------- Бесконечная игра: сезон, задания, звание, альбом ----------

  /** Погода дня — только если не ясно. */
  const holidayLine = (state: StoreState): HTMLElement[] => {
    const holiday = holidayFor(state.day);
    return holiday === 'march8' || holiday === 'halloween' ? [el('div', 'ui-muted', t(`holiday.${holiday}`))] : [];
  };

  /** Прогноз: что сегодня берут чаще и реже, сколько гостей; и погода на завтра. */
  const weatherLine = (state: StoreState): HTMLElement[] => {
    const weather = weatherFor(state.day);
    const effect = WEATHER_EFFECTS[weather];
    const sellable = sellableProducts(state);
    const icons = (keep: (k: number) => boolean) =>
      sellable
        .filter((id) => keep(weatherDemand(weather, id)))
        .map((id) => PRODUCTS[id].icon)
        .join('');
    const parts = [t('forecast.today', { icon: effect.icon, name: t(`weather.name.${weather}`) })];
    const more = icons((k) => k > 1);
    const less = icons((k) => k < 1);
    if (more) parts.push(t('forecast.more', { list: more }));
    if (less) parts.push(t('forecast.less', { list: less }));
    if (effect.guests !== 1) parts.push(t('forecast.guests', { n: percent(effect.guests) }));
    if (hasUpgrade(state, 'coffee') && effect.coffee !== 1) parts.push(t('forecast.coffee', { n: percent(effect.coffee) }));
    const tomorrow = weatherFor(state.day + 1);
    parts.push(t('forecast.tomorrow', { icon: WEATHER_EFFECTS[tomorrow].icon, name: t(`weather.name.${tomorrow}`) }));
    return [el('div', 'ui-muted', parts.join(' · '))];
  };

  /** Идёт ценовая война: какой товар, почём у Эдуарда и чья берёт. */
  const warLine = (state: StoreState): HTMLElement[] => {
    const war = activeWar(state);
    if (!war) return [];
    const ours = state.prices[war.product] <= war.price;
    const line = el(
      'div',
      'ui-muted',
      `${t('war.line', { product: productLabel(war.product), price: war.price, n: war.until - state.day + 1 })} — ${t(ours ? 'war.win' : 'war.lose')}`,
    );
    if (!ours) line.style.color = '#b13e53';
    return [line];
  };


  /** Многодневный особый день (ремонт дороги, болезнь) со второго дня уже известен — видно утром. */
  const bigDayLine = (state: StoreState): HTMLElement[] => {
    const id = bigDayFor(state.day);
    const progress = bigDayProgress(state.day);
    if (!id || !progress || !bigDayKnown(state.day)) return [];
    const title = t(`bigday.${id}.title` as TextKey);
    return [el('div', 'ui-note', t('bigday.morning', { icon: BIG_DAYS[id].icon, title, n: progress.of - progress.n + 1 }))];
  };

  const seasonLine = (state: StoreState): HTMLElement[] => {
    const season = seasonFor(state.day);
    if (season) {
      return [el('div', 'ui-note', t('season.banner', { icon: season.icon, name: t(season.nameKey), desc: t(season.descKey) }))];
    }
    for (let d = 1; d <= 3; d++) {
      const next = seasonFor(state.day + d);
      if (next) return [el('div', 'ui-muted', t('season.soon', { n: d, icon: next.icon, name: t(next.nameKey) }))];
    }
    return [];
  };

  const questText = (q: Quest) =>
    t(QUEST_TEXT[q.kind], { n: q.target, product: q.product ? productLabel(q.product) : '' });

  /** Окно пропуска: уровни с наградами двух дорожек и покупка звёздного пропуска. */
  const passModal = () => {
    const { card, close } = openModal();
    const render2 = () => {
      const state = getState();
      const pass = state.pass;
      if (!pass) return close();
      const level = passLevel(pass);
      const rows = el('div', 'ui-box');
      for (let l = 1; l <= PASS_LEVELS; l++) {
        const row = el('div', `ui-pass-row${l <= level ? ' open' : ''}`);
        const decor = passExclusive(pass.season, l) ?? passDecor(state, l);
        const cell = (track: 'free' | 'premium', label: string) => {
          const got = pass[track].includes(l);
          const can = l <= level && !got && (track === 'free' || pass.paid);
          const b = button(got ? t('pass.done') : can ? `${label}` : `${t('pass.locked')} ${label}`, () => {
            const next = claimPass(getState(), l, track);
            if (next) {
              setState(next);
              haptic.success();
              sound.coin();
              render2();
              render();
            }
          }, `ui-chip${track === 'premium' ? ' premium' : ''}`, !can);
          return b;
        };
        row.append(
          el('b', 'ui-pass-level', t('pass.level', { n: l })),
          cell('free', t('pass.free', { n: passCoins(state, l) })),
          cell('premium', `${t('pass.premium', { n: passCoins(state, l) * 2 })}${decor ? ` + ${t(decorItem(decor).nameKey)}` : ''}`),
        );
        rows.append(row);
      }
      const bar = el('div', 'ui-goal-bar');
      const fill = el('div');
      fill.style.width = `${level >= PASS_LEVELS ? 100 : Math.round(((pass.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100)}%`;
      bar.append(fill);
      const head: HTMLElement[] = [
        el('h2', '', t('pass.title', { n: pass.season })),
        el('div', '', t('pass.xp', { xp: pass.xp, l: level, max: PASS_LEVELS })),
        bar,
        el('div', 'ui-muted', t('pass.note', { d: XP_DAY, q: XP_QUEST, w: XP_WEEKLY, x: XP_PER_LEVEL, days: PASS_DAYS })),
      ];
      // Эксклюзив сезона: вывеска и наряд крупно — ради них и стоит взять звёздный пропуск.
      const exclusive = seasonExclusives(pass.season);
      if (exclusive.length) {
        const show = el('div', 'ui-pass-excl');
        for (const id of exclusive) {
          const item = decorItem(id);
          const got = state.decor.owned.includes(id);
          const cardEl = el('div', `ui-decor premium${got ? ' active' : ''}`);
          cardEl.append(decorPreview(item, item.kind), el('div', 'ui-decor-name', t(item.nameKey)), el('div', 'ui-decor-status', got ? `✓ ${t('pass.exclusiveGot')}` : t('pass.exclusiveAt', { l: EXCLUSIVE_LEVELS[item.kind] ?? 0 })));
          show.append(cardEl);
        }
        head.push(el('b', '', t('pass.exclusive')), show, el('div', 'ui-muted', t('pass.exclusiveNote')));
        const next = seasonExclusives(pass.season + 1);
        if (next.length) head.push(el('div', 'ui-muted', t('pass.nextSeason', { items: next.map((id) => t(decorItem(id).nameKey)).join(', ') })));
      }
      if (pass.paid) head.push(el('div', 'ui-note', t('pass.paid')));
      else {
        const note = el('div', 'ui-muted', t('pass.buyNote'));
        const buy = button(t('pass.buy', { n: PASS_STARS }), () => {
          buy.disabled = true;
          note.textContent = t('decor.paying');
          void buyWithStars(passItem(pass.season)).then((result) => {
            if (result === 'paid') {
              setState(grantPass(getState(), [passItem(pass.season)]));
              void flushCloud();
              haptic.success();
              render2();
              render();
              return;
            }
            buy.disabled = false;
            note.textContent = t(result === 'unavailable' ? 'decor.starsOff' : result === 'cancelled' ? 'decor.payCancelled' : 'decor.payFailed');
          });
        }, 'ui-btn');
        head.push(buy, note);
      }
      card.replaceChildren(...head, rows, button(t('board.close'), close, 'ui-btn secondary'));
    };
    render2();
  };

  /** Новости от ночных гостей: студент вернул долг, таксист рассказал о нас (nightGuests.ts). */
  const nightGuestLines = (state: StoreState): HTMLElement[] => {
    const night = state.nightGuests;
    const out: HTMLElement[] = [];
    if (night?.news) out.push(el('div', night.news === 'repaid' ? 'ui-note' : 'ui-muted', t(`nightNews.${night.news}` as TextKey, { n: night.newsAmount ?? 0 })));
    if (night?.boost === state.day) out.push(el('div', 'ui-muted', t('nightNews.taxi')));
    return out;
  };

  /** Кто напротив пакостит: босс района или сам Эдуард. */
  const rivalName = (state: StoreState): string => {
    const stage = eduardStage(state);
    return bossActive(state) && stage !== null ? t(EDUARD_STAGES[stage].nameKey) : t('eduard.name');
  };

  /** Козни конкурента: промоутер, перетяжка или «проверяющий» — и чем ответить (tricks.ts). */
  const trickBox = (state: StoreState): HTMLElement[] => {
    const trick = trickToday(state);
    if (!trick) return [];
    const rival = rivalName(state);
    const cost = counterCost(trick.kind, state.level);
    const answer = (a: TrickAnswer) => () => update(answerTrick(getState(), a), a === 'counter' ? 'success' : undefined);
    const box = el('div', 'ui-box ui-tale');
    box.append(
      el('b', '', t(`trick.${trick.kind}.title` as TextKey, { rival })),
      el('p', '', t(`trick.${trick.kind}.text` as TextKey, { rival })),
      button(t(`trick.${trick.kind}.counter` as TextKey, { n: cost }), answer('counter'), 'ui-btn', state.money < cost),
    );
    if (trick.kind !== 'banner') box.append(button(t(`trick.${trick.kind}.complain` as TextKey), answer('complain'), 'ui-btn secondary'));
    box.append(button(t('trick.ignore'), answer('ignore'), 'ui-btn secondary'));
    return [box];
  };

  /** Строки утра: что сейчас делает конкурент и чем кончился вчерашний «проверяющий». */
  const trickLines = (state: StoreState): HTMLElement[] => {
    const out: HTMLElement[] = [];
    const done = trickResult(state);
    if (done?.result) {
      out.push(el('div', done.result === 'fined' ? 'ui-note' : 'ui-muted', t(`trick.result.${done.result}` as TextKey, { n: done.fine ?? 0, rival: rivalName(state) })));
    }
    const trick = activeTrick(state);
    if (!trick || !trick.answer) return out;
    const left = trick.until - state.day + 1;
    if (trick.kind === 'promoter') {
      const key = trick.answer === 'counter' ? 'counter' : trick.answer === 'complain' ? (trick.stopped ? 'stopped' : 'failed') : 'ignore';
      out.push(el('div', 'ui-muted', t(`trick.line.promoter.${key}` as TextKey)));
    } else if (trick.kind === 'banner') {
      out.push(el('div', 'ui-muted', t(trick.answer === 'counter' ? 'trick.line.banner.counter' : 'trick.line.banner.ignore', { n: left })));
    } else if (trick.day === state.day) {
      out.push(el('div', 'ui-muted', t('trick.line.inspector')));
    }
    return out;
  };

  /** В районе открылось новое здание: кто теперь будет заходить и поздравить ли (district.ts). */
  const districtBox = (state: StoreState): HTMLElement[] => {
    const id = districtNews(state);
    if (!id) return [];
    const b = BUILDINGS[id];
    const name = t(`district.${id}` as TextKey);
    const box = el('div', 'ui-box ui-tale');
    box.append(
      el('b', '', t('district.title', { icon: b.icon, name })),
      el('p', '', t(`district.${id}.open` as TextKey)),
      button(t('district.gift', { n: b.gift, d: OPENING_DAYS }), () => update(answerOpening(getState(), id, true), 'success'), 'ui-btn', state.money < b.gift),
      button(t('district.skip'), () => update(answerOpening(getState(), id, false)), 'ui-btn secondary'),
    );
    return [box];
  };

  /** Строки утра про район: что строят, матч сегодня, праздник открытия. */
  const districtLines = (state: StoreState): HTMLElement[] => {
    const out: HTMLElement[] = [];
    const site = districtSite(state);
    const named = (id: BuildingId) => ({ icon: BUILDINGS[id].icon, name: t(`district.${id}` as TextKey) });
    if (site) out.push(el('div', 'ui-muted', t('district.site', { ...named(site.id), n: site.days })));
    if (isMatchDay(state)) out.push(el('div', 'ui-note', t('district.match')));
    const boost = state.district?.boost;
    if (boost && boost.until >= state.day) out.push(el('div', 'ui-muted', t('district.boost', { ...named(boost.id), n: boost.until - state.day + 1 })));
    return out;
  };

  /** История с сотрудниками: просьба или ситуация и два решения (staffEvents.ts). */
  const staffEventBox = (state: StoreState): HTMLElement[] => {
    const event = state.staffEvent;
    if (!event) return [];
    const [a, b] = event.roles.map((r) => state.staff.find((m) => m.role === r));
    if (!a) return [];
    const cost = eventCost(event);
    const params = { name: memberName(a), name2: b ? memberName(b) : '', n: cost };
    const box = el('div', 'ui-box ui-tale');
    box.append(
      el('b', '', t('staffEvent.title', { name: memberName(a), role: t(STAFF_ROLES[a.role].nameKey) })),
      el('p', '', t(`staffEvent.${event.kind}.text` as TextKey, params)),
      button(t(`staffEvent.${event.kind}.yes` as TextKey, params), () => update(answerStaffEvent(getState(), true), 'success'), 'ui-btn', state.money < cost),
      button(t(`staffEvent.${event.kind}.no` as TextKey, params), () => update(answerStaffEvent(getState(), false)), 'ui-btn secondary'),
    );
    return [box];
  };

  /**
   * Карьера (game/career.ts): церемония «сотрудник месяца» с наградой на выбор, предложение повысить
   * или поставить на филиал, записка об уходе давнего сотрудника. Всё необязательно, не больше одного в день.
   */
  const careerBox = (state: StoreState): HTMLElement[] => {
    const career = state.career;
    const out: HTMLElement[] = [];
    const ceremony = career?.ceremony;
    const crowned = ceremony && state.staff.find((m) => m.role === ceremony.role);
    if (ceremony && crowned) {
      const box = el('div', 'ui-box ui-tale ui-career');
      const name = el('div');
      name.append(el('b', '', memberName(crowned)), el('div', 'ui-item-sub', t(STAFF_ROLES[crowned.role].nameKey)));
      box.append(
        el('h3', '', t('career.best.title')),
        who(staffFace(crowned.name), name),
        el('p', '', t('career.best.say')),
        el('div', 'ui-muted', t('career.best.stats', { shifts: ceremony.shifts, miss: ceremony.miss })),
        el('p', '', t('career.best.text')),
        el('b', '', t('career.best.ask')),
      );
      const label: Record<BestReward, string> = {
        cash: t('career.best.cash', { n: bestBonus(state) }),
        off: t('career.best.off'),
        gift: t('career.best.gift', { n: bestGift(state) }),
      };
      const row = el('div', 'ui-career-rewards');
      for (const reward of BEST_REWARDS) {
        const next = answerCeremony(state, reward);
        row.append(button(label[reward], () => update(answerCeremony(getState(), reward), 'success'), reward === 'cash' ? 'ui-btn' : 'ui-btn secondary', !next));
      }
      box.append(row, el('div', 'ui-muted', t('career.best.hint')));
      out.push(box);
    }
    const offer = career?.offer;
    const asking = offer && state.staff.find((m) => m.role === offer.role);
    if (offer && asking) {
      const box = el('div', 'ui-box ui-tale ui-career');
      const role = t(STAFF_ROLES[asking.role].nameKey);
      const days = Math.round(careerOf(asking, state.day).xp);
      const name = el('div');
      name.append(el('b', '', memberName(asking)), el('div', 'ui-item-sub', role));
      if (offer.to === 'branch') {
        box.append(
          el('h3', '', t('career.branch.title')),
          who(staffFace(asking.name), name),
          el('p', '', t('career.branch.text')),
          el('div', 'ui-muted', t('career.branch.note', { p: Math.round(BRANCH_HEAD_BONUS * 100) })),
          button(t('career.branch.yes'), () => update(answerOffer(getState(), true), 'success')),
          button(t('career.branch.no'), () => update(answerOffer(getState(), false)), 'ui-btn secondary'),
          el('div', 'ui-muted', t('career.promo.noHint')),
        );
      } else {
        box.append(
          el('h3', '', t('career.promo.title')),
          who(staffFace(asking.name), name),
          el('p', '', t('career.promo.text', { days, rank: t(rankKey(asking, offer.to).replace('career.rank.', 'career.to.') as TextKey) })),
          el('div', 'ui-muted', t(offer.to === 'admin' ? 'career.promo.admin' : 'career.promo.senior')),
          el('div', '', t('career.promo.wage', { from: asking.wage, to: promotedWage(asking) })),
          button(t('career.promo.yes'), () => update(answerOffer(getState(), true), 'success')),
          button(t('career.promo.no'), () => update(answerOffer(getState(), false)), 'ui-btn secondary'),
          el('div', 'ui-muted', t('career.promo.noHint')),
        );
      }
      out.push(box);
    }
    const left = career?.left;
    if (left) {
      const box = el('div', 'ui-box ui-tale');
      const whoName = memberName({ name: left.name, friend: left.friend ? { name: left.friend } : undefined });
      const name = el('div');
      name.append(el('b', '', whoName), el('div', 'ui-item-sub', t(STAFF_ROLES[left.role].nameKey)));
      box.append(
        el('h3', '', t('career.left.title', { name: whoName })),
        who(staffFace(left.name), name),
        el('p', '', t(`career.leave.${left.why}` as TextKey)),
        el('div', 'ui-muted', t('career.left.note', { days: left.days })),
        button(t('career.left.ok'), () => update(dismissLeft(getState()))),
      );
      out.push(box);
    }
    return out;
  };

  /** Подарки друзей: «угостили кофе» — забрать монеты. */
  const giftsBox = (): HTMLElement[] => {
    const gifts = visitsInfo()?.gifts ?? [];
    if (!gifts.length) return [];
    const total = gifts.reduce((sum, g) => sum + g.amount, 0);
    const box = el('div', 'ui-box ui-duel');
    const claim = button(t('visit.claim', { n: total }), () => {
      claim.disabled = true;
      void claimGifts().then((n) => update({ ...getState(), money: getState().money + n }, n ? 'success' : 'tap'));
    });
    box.append(el('div', 'ui-note', t('visit.gifts', { names: [...new Set(gifts.map((g) => g.name))].join(', ') })), claim);
    return [box];
  };

  /**
   * Праздник по настоящему календарю (game/live.ts): открытки по дням — сегодняшнюю открыть,
   * сколько до праздничной вещи, когда заглянет гость и, по желанию, набор за звёзды.
   */
  const liveBox = (state: StoreState): HTMLElement[] => {
    const today = todayLocal();
    const e = activeEvent(liveEvents(), today);
    const card = e && cardOf(e, today);
    if (!e || !card) return [];
    const opened = openedCards(state, e, today);
    const box = el('div', 'ui-box ui-live');
    box.append(el('b', '', `${THEME_ICON[e.theme]} ${t(`live.${e.theme}.title` as TextKey)}`));
    // Календарь: открытые — галочкой, сегодняшняя подпрыгивает, пропущенные — бледные.
    const grid = el('div', 'ui-advent');
    grid.style.gridTemplateColumns = `repeat(${Math.min(8, card.total)}, 1fr)`;
    for (let n = 1; n <= card.total; n++) {
      const date = addDays(today, n - card.n);
      const done = opened.includes(date);
      const mark = done ? ' done' : n === card.n ? ' today' : n < card.n ? ' missed' : ' later';
      grid.append(el('span', `ui-advent-day${mark}`, done ? '✓' : String(Number(date.slice(8)))));
    }
    box.append(grid, el('div', 'ui-muted', t('live.box.count', { n: opened.length, total: card.total })));
    if (cardWaiting(state, e, today)) box.append(button(t('live.box.open'), () => openLiveCard(e, today)));
    else box.append(el('div', 'ui-note', t('live.box.opened')));
    if (e.prize) {
      const item = t(decorItem(e.prize.decor).nameKey);
      const got = state.decor.owned.includes(e.prize.decor);
      box.append(el('div', 'ui-muted', got ? t('live.box.prizeGot', { item }) : t('live.box.prize', { need: e.prize.cards, cards: t(`live.box.cards.${pluralForm(e.prize.cards, getLang())}`), item, n: Math.min(opened.length, e.prize.cards) })));
    }
    const guest = guestOn(e, today);
    const next = guest ? null : nextGuest(e, today);
    if (guest) box.append(el('div', 'ui-note', t(guestDue(state, e, today) ? 'live.box.guestToday' : 'live.box.guestSeen', { icon: GUEST_ICON[guest], who: t(`who.${guest}`) })));
    else if (next) box.append(el('div', 'ui-muted', t('live.box.guestNext', { icon: GUEST_ICON[next.who], who: t(`who.${next.who}`), date: dateLabel(next.date) })));
    // Набор за звёзды — только по желанию: когда бесплатная открытка уже открыта и пока набор не куплен.
    const pack = e.pack ? STAR_PACKS[e.pack] : undefined;
    if (pack && !cardWaiting(state, e, today) && !pack.items.every((id) => state.decor.owned.includes(id))) {
      box.append(
        button(t('live.box.pack', { name: t(pack.nameKey), n: pack.stars }), () => premiumDecorModal(decorItem(pack.items[0])), 'ui-btn secondary'),
        el('div', 'ui-muted', t('live.box.packNote')),
      );
    }
    return [box];
  };

  /** Открыть открытку дня: монеты (и праздничная вещь) — сразу, окно с открыткой — поверх утра. */
  const openLiveCard = (e: LiveEvent, today: string) => {
    const opened = openCard(getState(), e, today);
    if (!opened) return;
    track('live_card', getState().day, opened.gift.n);
    update(opened.state, 'success', true);
    showLiveCard(e.theme, opened.gift);
  };

  /** Жизнь района: свадьба, малыш, пенсия у постоянных — подарок или поздравить. */
  const lifeBox = (state: StoreState): HTMLElement[] => {
    const news = lifeNews(state);
    if (!news) return [];
    const box = el('div', 'ui-box ui-duel');
    box.append(
      el('b', '', t('life.title')),
      el('p', '', t(news.textKey)),
      button(t('life.gift', { n: LIFE_GIFT }), () => update(answerLife(getState(), news, true), 'success'), 'ui-btn', state.money < LIFE_GIFT),
      button(t('life.congrats'), () => update(answerLife(getState(), news, false)), 'ui-btn secondary'),
    );
    return [box];
  };

  /** Магазины друзей: зайти в гости — посмотреть, как у них всё устроено. */
  const friendShopsBox = (): HTMLElement[] => {
    const friends = visitsInfo()?.friends ?? [];
    if (!friends.length || !onVisit) return [];
    const box = el('div', 'ui-box');
    box.append(el('b', '', `🏠 ${t('visitShop.title')}`));
    for (const f of friends.slice(0, 6)) {
      const row = el('div', 'ui-row');
      row.append(
        el('span', '', `${f.name} · ${t(STORE_LEVELS[Math.min(f.level, STORE_LEVELS.length - 1)].nameKey)}`),
        button(t('visitShop.go'), () => {
          endTour();
          close();
          onVisit(f.id, f.name);
        }, 'ui-chip'),
      );
      box.append(row);
    }
    return [box];
  };

  /** «Чёрная пятница района»: общий счётчик и место в выходные, приз — после. */
  const rushBox = (state: StoreState): HTMLElement[] => {
    const w = weekendInfo();
    if (!w) return [];
    const box = el('div', 'ui-box ui-rush');
    if (w.last && state.rushClaimed !== w.last.week) {
      const prize = rushPrize(state.level, w.last.rank, w.last.players);
      box.append(
        el('div', 'ui-note', t('rush.result', { rank: w.last.rank, players: w.last.players, revenue: money(w.last.revenue) })),
        button(t('rush.claim', { n: prize }), () => update({ ...getState(), money: getState().money + prize, rushClaimed: w.last!.week }, 'success')),
      );
    }
    if (w.active) {
      box.append(
        el('b', '', t('rush.title')),
        el('div', '', t('rush.text', { total: money(w.total), players: w.players })),
        el('div', 'ui-muted', w.me.rank ? t('rush.me', { rank: w.me.rank, revenue: money(w.me.revenue), h: w.endsIn }) : t('rush.meNone', { h: w.endsIn })),
        ...w.top.slice(0, 3).map((r, i) => el('div', `ui-item-sub${r.me ? ' ui-me' : ''}`, t('rush.top', { place: i + 1, name: r.name, revenue: money(r.revenue) }))),
      );
    }
    return box.childElementCount ? [box] : [];
  };

  /** Строка сезона сверху утра: уровень, дни до конца, сколько наград ждёт. */
  const passBox = (state: StoreState): HTMLElement[] => {
    const pass = state.pass;
    if (!pass) return [];
    const ready = passReady(state);
    const box = el('div', 'ui-box ui-pass');
    box.append(
      el('b', '', t('pass.line', { n: pass.season, l: passLevel(pass), max: PASS_LEVELS, d: seasonDaysLeft(trustedNow()) })),
      button(ready ? t('pass.ready', { n: ready }) : t('pass.open'), passModal, ready ? 'ui-btn' : 'ui-btn secondary'),
    );
    return [box];
  };

  const money = (n: number) => n.toLocaleString('ru-RU');

  /** Торговая неделя с другом: счёт этой недели и награда за прошлую. */
  const duelBox = (state: StoreState): HTMLElement[] => {
    const duel = duelInfo();
    if (!duel?.rival && !duel?.last) return [];
    const box = el('div', 'ui-box ui-duel');
    if (duel.last && state.duelClaimed !== duel.last.week) {
      const { won, mine, theirs, name } = duel.last;
      const reward = duelReward(state.level, won);
      box.append(
        el('div', 'ui-note', t(won ? 'duel.won' : 'duel.lost', { name, mine: money(mine), theirs: money(theirs) })),
        button(t('duel.claim', { n: reward }), () => update({ ...getState(), money: getState().money + reward, duelClaimed: duel.last!.week }, 'success')),
      );
    }
    if (duel.rival) {
      const { name, mine, theirs } = duel.rival;
      const bar = el('div', 'ui-duel-bar');
      const fill = el('div');
      fill.style.width = `${Math.round((mine / Math.max(1, mine + theirs)) * 100)}%`;
      bar.append(fill);
      box.append(
        el('b', '', t('duel.title', { name })),
        el('div', '', t('duel.score', { name, mine: money(mine), theirs: money(theirs) })),
        bar,
        el('div', 'ui-muted', t('duel.left', { n: duel.daysLeft, r: duelReward(state.level, true) })),
      );
    }
    return box.childElementCount ? [box] : [];
  };

  /** Награда гильдии за выполненную цель прошлой недели — сверху утра. */
  const guildClaimBox = (state: StoreState): HTMLElement[] => {
    const g = guildInfo();
    if (!g?.last?.reached || state.guildClaimed === g.last.week) return [];
    const reward = guildReward(state.level);
    const box = el('div', 'ui-box ui-duel');
    box.append(
      el('div', 'ui-note', t('guild.reached', { name: g.name })),
      button(t('guild.claim', { n: reward }), () => update({ ...getState(), money: getState().money + reward, guildClaimed: g.last!.week }, 'success')),
    );
    return [box];
  };

  /** Гильдия в профиле: основать, вступить, участники и цель недели. */
  let guildError = '';
  const guildBox = (state: StoreState): HTMLElement[] => {
    if (!guildsEnabled()) return [];
    const box = el('div', 'ui-box');
    const act = (action: 'create' | 'join' | 'leave', extra: { name?: string; code?: string } = {}) =>
      void guildAction(action, extra).then((res) => {
        guildError = res.error ? t(`guild.err.${res.error}` as TextKey) : '';
        update(getState(), res.error ? 'error' : 'success');
      });
    const g = guildInfo();
    if (!g) {
      const name = el('input', 'ui-input');
      name.placeholder = t('guild.namePlaceholder');
      name.maxLength = 24;
      const code = el('input', 'ui-input');
      code.placeholder = t('guild.codePlaceholder');
      code.maxLength = 6;
      box.append(
        el('b', '', t('guild.title')),
        el('div', 'ui-muted', t('guild.note')),
        name,
        button(t('guild.create'), () => act('create', { name: name.value }), 'ui-btn'),
        code,
        button(t('guild.join'), () => act('join', { code: code.value }), 'ui-btn secondary'),
      );
      if (guildError) box.append(el('div', 'ui-note', guildError));
      return [box];
    }
    const bar = el('div', 'ui-goal-bar');
    const fill = el('div');
    fill.style.width = `${Math.min(100, Math.round((g.total / Math.max(1, g.target)) * 100))}%`;
    bar.append(fill);
    box.append(
      el('b', '', t('guild.head', { name: g.name, code: g.code })),
      el('div', '', t('guild.goal', { total: money(g.total), target: money(g.target), n: g.daysLeft })),
      bar,
      el('div', 'ui-muted', t('guild.reward', { r: guildReward(state.level) })),
    );
    for (const m of g.members) box.append(el('div', `ui-item-sub${m.me ? ' ui-me' : ''}`, t('guild.member', { name: m.name, n: money(m.week) })));
    box.append(
      button(t('guild.invite'), () => inviteToGuild(g.code, t('guild.share')), 'ui-btn'),
      button(t('guild.leave'), () => act('leave'), 'ui-btn secondary'),
    );
    return [box];
  };

  /** История постоянного покупателя: эпизод дня и выбор (tales.ts). */
  const taleBox = (state: StoreState): HTMLElement[] => {
    const today = taleToday(state);
    if (!today) return [];
    const tale = TALES[today.id];
    const box = el('div', 'ui-box ui-tale');
    box.append(
      el('b', '', t('tale.title', { icon: tale.icon, name: t(`tale.${today.id}.name` as TextKey), n: today.ep + 1, of: tale.episodes.length })),
      el('p', '', t(`tale.${today.id}.${today.ep}.text` as TextKey)),
    );
    tale.episodes[today.ep].forEach((choice, i) => {
      const ok = canChoose(state, choice);
      const need = choice.require;
      const label = t(`tale.${today.id}.${today.ep}.${i}` as TextKey);
      box.append(button(label, () => update(answerTale(getState(), i), 'success'), i === 0 ? 'ui-btn' : 'ui-btn secondary', !ok));
      if (!ok && need?.money) box.append(el('div', 'ui-item-sub', t('tale.need.money', { n: need.money })));
      if (!ok && need?.product) box.append(el('div', 'ui-item-sub', `${PRODUCTS[need.product[0]].icon} ${t('tale.need.product', { n: need.product[1] })}`));
    });
    return [box];
  };

  /** Цели дня и испытания — одной яркой карточкой сверху: что сделать сегодня и за что награда. */
  const goalsBox = (state: StoreState): HTMLElement[] => {
    const quests = state.plan?.quests ?? [];
    const weekly = state.weekly;
    const momentTip = momentCount(state) > 0 && state.day <= MOMENT_TIP_LAST_DAY;
    if (!quests.length && !weekly && !momentTip) return [];
    const box = el('div', 'ui-box ui-goals');
    if (quests.length) {
      box.append(el('b', '', t('quest.title')));
      for (const q of quests) {
        const r = el('div', 'ui-row');
        r.append(el('span', '', `• ${questText(q)}`), el('b', 'ui-goal-reward', `+${q.reward} 💰`));
        box.append(r);
      }
      box.append(el('div', 'ui-muted', `${t('quest.now')} ${t('quest.allBonus', { r: ALL_QUESTS_RATING })}`));
    }
    // Первые дни с активными моментами (game/moments.ts) — одной строкой, что ловить днём.
    if (momentTip) box.append(el('div', 'ui-muted', t('moment.morning')));
    if (weekly) {
      box.append(el('b', 'ui-goals-week', t('weekly.title', { day: weeklyUntil(state) })));
      for (const c of weekly.challenges as Challenge[]) {
        const text = t(WEEKLY_TEXT[c.kind], { n: c.target, product: c.product ? productLabel(c.product) : '' });
        const r = el('div', 'ui-row');
        r.append(el('span', '', `${c.done ? '✅' : '•'} ${text}`), el('b', 'ui-goal-reward', `+${c.reward} 💰`));
        box.append(r);
        if (!c.done) {
          const bar = el('div', 'ui-goal-bar');
          const fill = el('div');
          fill.style.width = `${Math.min(100, Math.round((c.progress / Math.max(1, c.target)) * 100))}%`;
          bar.append(fill);
          box.append(bar, el('div', 'ui-item-sub', `${c.progress} / ${c.target}`));
        }
      }
    }
    return [box];
  };

  const rankBox = (state: StoreState) => {
    const n = rankOf(state.totalRevenue);
    const box = el('div', 'ui-box');
    box.append(
      el('b', '', t('rank.title', { name: rankName(n, t) })),
      el(
        'div',
        'ui-muted',
        t('rank.progress', { n: state.totalRevenue, next: rankThreshold(n + 1), bonus: Math.round(n * RANK_GUESTS * 100) }),
      ),
    );
    return box;
  };

  // ---------- Уголки: сладости, кофе, печь, кот и улучшения ----------

  /** «Уголки» — сеткой плиток: состояние видно сразу, подробности и покупки — по нажатию. */
  const extrasTab = (state: StoreState): HTMLElement[] => {
    const rack = rackOf(state);
    const cap = rackCapacity(state);
    const coffee = hasUpgrade(state, 'coffee');
    const oven = hasUpgrade(state, 'oven');
    const owned = LISTED_UPGRADES.filter((id) => hasUpgrade(state, id)).length;
    const tiles: Tile[] = [
      { id: 'rack', icon: 'assets/candy_rack.png', title: t('rack.title'), status: `${rack.stock}/${cap}`, alert: rack.stock <= cap / 3, details: () => [rackBox(getState())] },
      {
        id: 'radio',
        icon: '📻',
        title: t('radio.title'),
        status: hasRadio(state) ? `${STATION_INFO[stationOf(state)].icon} ${t(STATION_INFO[stationOf(state)].nameKey)}` : `${RADIO_PRICE} 💰`,
        details: () => [radioBox(getState())],
      },
      {
        id: 'coffee',
        icon: '☕',
        title: t('coffee.title'),
        status: coffee ? t('corner.cups', { n: cupsOf(state), max: CUPS_MAX }) : '🔒',
        alert: coffee && (cupsOf(state) < 8 || !staffOf(state, 'barista')),
        details: () => [coffeeBox(getState())],
      },
      {
        id: 'oven',
        icon: '🍞',
        title: t('oven.title'),
        status: oven ? t(`bake.${bakeModeOf(state)}` as TextKey) : '🔒',
        alert: oven && !staffOf(state, 'baker'),
        details: () => [ovenBox(getState())],
      },
      ...(kitchenOpen(state)
        ? [
            {
              id: 'kitchen',
              icon: '🍲',
              title: t('kitchen.title'),
              status: `${portionsTotal(state)}/${foodSlots(state)}`,
              // Витрина пуста и повара нет — сегодня кухне нечего продавать.
              alert: portionsTotal(state) === 0 && !kitchenWorking(state),
              details: () => kitchenBox(getState()),
            },
          ]
        : []),
      {
        id: 'cat',
        icon: '🐱',
        title: state.cat?.name ?? t('corner.cat'),
        status: !state.cat ? '—' : catAway(state) ? t('corner.catAway') : fedToday(state) ? t('corner.catFed') : t('corner.catHungry'),
        alert: Boolean(state.cat) && !catAway(state) && !fedToday(state),
        details: () => [catBox(getState())],
      },
      {
        id: 'watch',
        icon: '🐕',
        title: t('watch.title'),
        status: [securityOf(state).dog ? '🐕' : '', hasWatchman(state) ? '🔦' : ''].join(' ').trim() || '—',
        details: () => [securityBox(getState())],
      },
      { id: 'upgrades', icon: '⭐', title: t('upgrade.title'), status: `${owned}/${LISTED_UPGRADES.length}`, details: () => [upgradesBox(getState())] },
    ];
    return [
      tileGrid(tiles, openCorner, (id, show) => {
        // Явно, а не «наоборот»: закрытие ждёт конца анимации, а за это время могли раскрыть другую плитку.
        if (show) openCorner = id;
        else if (openCorner === id) openCorner = null;
        render();
      }),
    ];
  };

  /**
   * Кухня (kitchen.ts): кто готовит — повар весь день или ты сам утром, как торговали вчера,
   * меню дня для повара и рецепты с кнопкой «приготовить сейчас».
   */
  const kitchenBox = (state: StoreState): HTMLElement[] => {
    if (!kitchenOpen(state)) return [];
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('kitchen.title')), el('div', 'ui-muted', t('kitchen.note', { n: portionsTotal(state), max: foodSlots(state) })));
    const shelf = el('div', 'ui-item');
    const shelfImg = el('img', 'ui-item-art');
    shelfImg.src = sheetPng(foodSprite(state));
    shelfImg.alt = '';
    shelf.append(shelfImg, el('div', 'ui-item-sub', t('kitchen.shelf', { name: t(GEAR.foodShelf.models[gearTier(state, 'foodShelf')].nameKey), n: portionsTotal(state), max: foodSlots(state) })));
    box.append(shelf);
    const chef = staffOf(state, 'cook');
    const who = chef ? t(isAbsent(state, chef) ? 'kitchen.chefOff' : 'kitchen.chef', { name: memberName(chef) }) : t('kitchen.noChef');
    // Кто готовит — главное правило кухни: строкой на виду, а не за «❔».
    box.append(el('div', 'ui-note', who));
    // Повар на смене: что кухня сама закупит при открытии и почём (деньги — из кассы магазина).
    const list = (items: Partial<Record<ProductId, number>>) =>
      Object.entries(items)
        .filter(([, n]) => (n ?? 0) > 0)
        .map(([p, n]) => `${PRODUCTS[p as ProductId].icon}×${n}`)
        .join(' ');
    if (kitchenWorking(state)) {
      const order = morningOrder(state);
      const cost = orderCost(order);
      box.append(el('div', 'ui-item-sub', cost ? t('kitchen.order', { items: list(order), cost }) : t('kitchen.orderNone')));
      if (cost > state.money) box.append(el('div', 'ui-item-sub', t('kitchen.orderBroke', { cost })));
    }
    const pantry = list(Object.fromEntries(PRODUCT_IDS.map((p) => [p, pantryOf(state, p)])));
    if (pantry) box.append(el('div', 'ui-item-sub', t('kitchen.pantry', { items: pantry })));
    const reports = state.reports ?? [];
    const last = reports[reports.length - 1]?.kitchen;
    if (last) box.append(el('div', 'ui-item-sub', t('kitchen.yesterday', { sold: last.sold, missed: Math.max(0, last.wanted - last.sold), spoiled: last.spoiled })));
    if (last?.spent) box.append(el('div', 'ui-item-sub', t('kitchen.yesterdaySpent', { n: last.spent })));
    // Меню дня — только для повара: сам готовишь — сам и выбираешь кнопками ниже.
    if (chef) {
      const auto = menuAuto(state);
      const chips = el('div', 'ui-chips');
      chips.append(button(t('kitchen.auto'), () => update(toggleMenu(getState(), null)), `ui-chip${auto ? ' active' : ''}`));
      for (const id of DISH_IDS) {
        const on = !auto && cookMenu(state).includes(id);
        chips.append(button(`${DISHES[id].icon} ${t(`dish.${id}` as TextKey)}`, () => update(toggleMenu(getState(), id)), `ui-chip${on ? ' active' : ''}`));
      }
      box.append(el('h3', '', t('kitchen.menu')), chips, el('div', 'ui-muted', t(auto ? 'kitchen.autoNote' : 'kitchen.menuNote')));
    }
    box.append(el('h3', '', t('kitchen.recipes')));
    for (const id of DISH_IDS) {
      const d = DISHES[id];
      const row = el('div', 'ui-item');
      const body = el('div');
      const name = el('div', 'ui-item-name', t(`dish.${id}` as TextKey));
      name.append(el('span', 'ui-tag', `${d.price} 💰`));
      const needs = Object.entries(d.needs).map(([p, n]) => `${PRODUCTS[p as ProductId].icon}×${n}`).join(' ');
      const hot = d.hot ? `🔥 ${t('kitchen.hot')} · ` : '';
      body.append(name, el('div', 'ui-item-sub', `${hot}${needs} → ${dishPortions(state, id)} · ${t('kitchen.ready', { n: portionsOf(state, id) })}`));
      const actions = el('div', 'ui-item-actions');
      actions.append(button(t('kitchen.cook', { n: dishPortions(state, id) }), () => update(cook(getState(), id), 'success'), 'ui-chip', !canCook(state, id)));
      row.append(el('div', 'ui-ad-icon', d.icon), body, actions);
      box.append(row);
    }
    return [box];
  };

  const rackBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const rack = rackOf(state);
    const cap = rackCapacity(state);
    const free = cap - rack.stock;
    box.append(el('b', '', t('rack.title')), el('div', 'ui-muted', t('rack.note', { price: CANDY_PRICE, cost: CANDY_COST })));
    const amounts = [...new Set([Math.min(6, free), free])].filter((n) => n > 0);
    const actions: HTMLElement[] = amounts.map((n) =>
      button(t('rack.refill', { n, cost: n * CANDY_COST }), () => update(refillRack(getState(), n), 'success'), 'ui-chip', state.money < n * CANDY_COST),
    );
    if (!free) actions.push(el('span', 'ui-tag', t('rack.full')));
    box.append(artRow('candy_rack', { name: t('rack.stock', { n: rack.stock, max: cap }), actions }));
    const next = nextRack(state);
    if (next) {
      box.append(
        artRow('candy', {
          name: t('rack.upgrade', { cap: next.capacity, p: Math.round(next.chance * 100) }),
          price: next.cost,
          actions: [button(t('rack.buy'), () => update(upgradeRack(getState()), 'success'), 'ui-chip', state.money < next.cost)],
        }),
      );
    } else box.append(el('div', 'ui-muted', t('rack.max')));
    return box;
  };

  const coffeeBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('coffee.title')));
    if (!hasUpgrade(state, 'coffee')) {
      box.append(el('div', 'ui-muted', t('coffee.locked')));
      return box;
    }
    const chance = Math.min(0.6, COFFEE_CHANCE * WEATHER_EFFECTS[weatherFor(state.day)].coffee * (hasUpgrade(state, 'coffeeTables') ? TABLES_COFFEE : 1));
    box.append(el('div', 'ui-muted', t('coffee.note', { price: coffeePrice(state), cost: CUP_COST, n: Math.max(2, Math.round(1 / chance)) })));
    const free = CUPS_MAX - cupsOf(state);
    const amounts = [...new Set([Math.min(10, free), free])].filter((n) => n > 0);
    const actions = amounts.map((n) =>
      button(t('coffee.buy', { n, cost: n * CUP_COST }), () => update(buyCups(getState(), n), 'success'), 'ui-chip', state.money < n * CUP_COST),
    );
    const row = artRow(coffeeSprite(state), { name: t('coffee.cups', { n: cupsOf(state), max: CUPS_MAX }), actions });
    row.querySelector('.ui-item-actions')?.classList.add('stack');
    box.append(row);
    box.append(...staffNeed(state, 'barista', 'coffee.noBarista'));
    return box;
  };

  const ovenBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('oven.title')));
    box.append(
      el('div', 'ui-muted', hasUpgrade(state, 'oven') ? t('oven.note', { n: ovenBatch(state), cost: ovenBatchCost(state), s: ovenBake(state) }) : t('oven.locked')),
    );
    if (hasUpgrade(state, 'oven')) box.append(...staffNeed(state, 'baker', 'oven.noBaker'), ...bakeModeBox(state));
    if (hasUpgrade(state, 'oven')) box.append(...brandBox(state));
    return box;
  };

  /** Сколько хлеба печь: по спросу (меньше порчи), сколько влезет или не печь — закупать самому. */
  const bakeModeBox = (state: StoreState): HTMLElement[] => {
    const mode = bakeModeOf(state);
    const chips = el('div', 'ui-chips');
    for (const m of BAKE_MODES) chips.append(button(t(`bake.${m}` as TextKey), () => update(setBakeMode(getState(), m)), `ui-chip${m === mode ? ' active' : ''}`));
    return [el('h3', '', t('bake.title')), chips, el('div', 'ui-muted', t(`bake.${mode}Note` as TextKey))];
  };

  /** Кафе «Пончик» по соседству: предложение договора на неделю или как идёт текущий. */
  const cafeBox = (state: StoreState): HTMLElement[] => {
    const cafe = cafeOf(state);
    const list = (items: Partial<Record<ProductId, number>>) =>
      Object.entries(items)
        .map(([id, n]) => `${PRODUCTS[id as ProductId].icon}×${n}`)
        .join(' ');
    const box = el('div', 'ui-box');
    if (cafe.offer) {
      const loyal = cafeLoyalty(state);
      box.append(
        el('b', '', t('cafe.offerTitle')),
        el('div', '', t('cafe.offer', { list: list(cafe.offer.items), pay: cafe.offer.pay, days: CAFE_DAYS })),
        el('div', 'ui-muted', t('cafe.offerNote', { misses: CAFE_MISSES })),
        ...(loyal ? [el('div', 'ui-note', t('cafe.loyal', { n: Math.round(loyal * 100) }))] : []),
      );
      const chips = el('div', 'ui-chips');
      chips.append(
        button(t('cafe.accept'), () => update(answerCafe(getState(), true), 'success'), 'ui-chip'),
        button(t('cafe.decline'), () => update(answerCafe(getState(), false)), 'ui-chip'),
      );
      box.append(chips);
      return [box];
    }
    if (!cafe.deal) return [];
    const ok = cafeCanDeliver(state);
    const status = el('div', 'ui-note', ok ? t('cafe.ready') : t('cafe.short'));
    if (!ok) status.style.color = '#b13e53';
    box.append(
      el('b', '', t('cafe.dealTitle', { n: cafeDaysLeft(state) })),
      el('div', 'ui-muted', t('cafe.deal', { list: list(cafe.deal.items), pay: cafe.deal.pay })),
      status,
    );
    return [box];
  };

  /** Своя марка «От бабушки»: ступени с новыми рецептами (после лучшей печи). */
  const brandBox = (state: StoreState): HTMLElement[] => {
    const out: HTMLElement[] = [el('h3', '', t('brand.title'))];
    if (!brandAvailable(state)) return [...out, el('div', 'ui-muted', `🔒 ${t('brand.locked')}`)];
    out.push(el('div', 'ui-muted', t('brand.note', { n: Math.round(BRAND_DEMAND_STEP * 100) })));
    const level = brandLevel(state);
    OWN_PRODUCTS.forEach((pid, i) => {
      const open = i < level;
      const next = i === level;
      out.push(
        artRow(`item_${pid}`, {
          name: t(`brand.level${i + 1}` as TextKey),
          sub: t('brand.batch', { n: BRAND_BATCH, cost: brandBatchCost(pid) }),
          actions: open
            ? [el('span', 'ui-tag', t('brand.done'))]
            : next
              ? [button(t('brand.open', { cost: BRAND_COSTS[i] }), () => update(buyBrandLevel(getState()), 'success'), 'ui-chip', state.money < BRAND_COSTS[i])]
              : [],
        }),
      );
    });
    if (level >= BRAND_MAX) out.push(el('div', 'ui-note', t('brand.max')));
    return out;
  };

  /** Красная строка, если в пекарне или кофейне некому работать. */
  const staffNeed = (state: StoreState, role: 'baker' | 'barista', key: TextKey): HTMLElement[] => {
    if (staffOf(state, role)) return [];
    const line = el('div', 'ui-note', t(key));
    line.style.color = '#b13e53';
    return [line];
  };

  /** Кот: сытость, удача, кормление и лежанки. */
  const catBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const cat = state.cat;
    if (!cat) {
      box.append(el('b', '', '🐱'), el('div', 'ui-muted', state.day < CAT_FROM_DAY ? t('cat.none', { n: CAT_FROM_DAY }) : t('cat.later')));
      return box;
    }
    const luck = Math.round((cat.bed ? CAT_BEDS[cat.bed].luck : CAT_BASE_LUCK) * 100);
    const status = catAway(state) ? t('cat.away') : fedToday(state) ? t('cat.fed', { n: luck }) : t('cat.hungry', { n: Math.round(luck / 2) });
    const fed = fedToday(state);
    box.append(
      artRow(catAway(state) ? 'cat' : 'cat_sit', {
        name: `🐱 ${cat.name}`,
        sub: status,
        actions: [button(fed ? t('cat.fedDone') : t('cat.feed', { n: FEED_COST }), () => update(feedCat(getState()), 'success'), 'ui-chip', fed || state.money < FEED_COST)],
      }),
      el('div', 'ui-decor-kind', t('cat.bed.title')),
    );
    for (const id of CAT_BED_IDS) {
      const bed = CAT_BEDS[id];
      const owned = cat.beds.includes(id);
      const active = cat.bed === id;
      const action = active
        ? el('span', 'ui-tag', '✓')
        : owned
          ? button(t('decor.put'), () => update(setBed(getState(), id)), 'ui-chip')
          : button(t('upgrade.buy'), () => update(buyBed(getState(), id), 'success'), 'ui-chip', state.money < bed.price);
      box.append(
        artRow(bed.texture, {
          name: t(bed.nameKey),
          price: owned ? undefined : bed.price,
          sub: t('cat.bed.luck', { n: Math.round(bed.luck * 100) }),
          actions: [action],
        }),
      );
    }
    box.append(el('div', 'ui-muted', t('cat.starsSoon')));
    return box;
  };

  /** Рыжий кот у входа: оставить и назвать или отказаться (спросит через неделю). */
  const catOfferBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const names = t('cat.names').split(',');
    const input = el('input', 'ui-input');
    input.value = names[state.day % names.length];
    input.maxLength = CAT_NAME_MAX;
    const art = el('img', 'ui-item-art');
    art.src = sheetPng('cat_sit');
    art.alt = '';
    art.style.cssText = 'width:64px;height:72px;display:block;margin:4px auto';
    box.append(
      el('h3', '', t('cat.offer.title')),
      art,
      el('p', '', t('cat.offer.text')),
      el('div', 'ui-muted', t('cat.offer.note', { n: FEED_COST })),
      el('b', '', t('cat.offer.name')),
      input,
      button(t('cat.offer.yes'), () => update(adoptCat(getState(), input.value || names[0]), 'success')),
      button(t('cat.offer.no'), () => update(declineCat(getState())), 'ui-btn secondary'),
    );
    return box;
  };

  // ---------- Долги, банкротство и новая игра ----------

  /** Новая игра: сохранить и перезапустить — сцена соберётся с нуля. */
  const restart = () => {
    track('restart', getState().day);
    saveGame(restartGame(getState()));
    // Новую игру сразу в облако, иначе при запуске подхватилась бы старая.
    const reload = () => location.reload();
    setTimeout(reload, 3000);
    void flushCloud().finally(reload);
  };

  /** Бонусы наследия: уровень каждого и что даёт; в окне продажи — кнопки «+1». */
  const perkRows = (state: StoreState, onBuy?: (id: PerkId) => void): HTMLElement[] =>
    PERK_IDS.map((id) => {
      const level = perkLevel(state, id);
      const value = { capital: level * CAPITAL_STEP, fame: (level * FAME_STEP).toFixed(1), suppliers: Math.round(level * SUPPLIERS_STEP * 100), crowd: Math.round(level * CROWD_STEP * 100), mentor: level }[id];
      const row = el('div', 'ui-item');
      const body = el('div');
      const name = el('div', 'ui-item-name', t(`legacy.perk.${id}` as TextKey));
      name.append(el('span', 'ui-tag', `${level}/${PERKS[id].max}`));
      body.append(name, el('div', 'ui-item-sub', level ? t(`legacy.perk.${id}.desc` as TextKey, { n: value }) : '—'));
      row.append(el('div', 'ui-ad-icon', PERKS[id].icon), body);
      if (onBuy) {
        const cost = perkCost(state, id);
        const actions = el('div', 'ui-item-actions');
        actions.append(button(cost === null ? t('legacy.max') : t('legacy.buy', { n: cost }), () => onBuy(id), 'ui-chip', cost === null || legacyOf(state).points < cost));
        row.append(actions);
      }
      return row;
    });

  /** Продажа: окно с бонусами наследия, потом — новый магазин с нуля. */
  const sellFlow = () => {
    let sold = sellBusiness(getState());
    if (!sold) return;
    track('sell', sold.day, salePoints(sold));
    const { card, close } = openModal();
    const render = () => {
      const list = el('div', 'ui-box');
      list.append(
        ...perkRows(sold!, (id) => {
          sold = buyPerk(sold!, id) ?? sold;
          render();
        }),
      );
      card.replaceChildren(
        el('h2', '', t('legacy.shop.title')),
        el('div', 'ui-note', t('legacy.points', { n: legacyOf(sold!).points })),
        el('div', 'ui-muted', t('legacy.shop.note')),
        list,
        button(t('legacy.shop.start'), () => {
          close();
          saveGame(restartGame(sold!));
          const reload = () => location.reload();
          setTimeout(reload, 3000);
          void flushCloud().finally(reload);
        }),
        button(t('legacy.shop.cancel'), close, 'ui-btn secondary'),
      );
    };
    render();
  };

  /** «Наследие» в профиле: поколение и бонусы; универмаг после сюжета можно продать. */
  const legacyBox = (state: StoreState): HTMLElement[] => {
    const legacy = legacyOf(state);
    if (!legacy.gen && !canSell(state)) return [];
    const box = el('div', 'ui-box');
    if (legacy.gen) box.append(el('b', '', t('legacy.title', { n: legacy.gen + 1 })), ...perkRows(state), el('div', 'ui-muted', t('legacy.points', { n: legacy.points })));
    if (canSell(state)) {
      box.append(
        el('h3', '', t('legacy.sell.title')),
        el('div', 'ui-muted', t('legacy.sell.note', { n: salePoints(state) })),
        button(t('legacy.sell.button', { n: salePoints(state) }), sellFlow, 'ui-btn'),
      );
    }
    return [box];
  };

  /** Что останется после новой игры. */
  const keepsLine = (state: StoreState) =>
    el('div', 'ui-note', t('restart.keeps', { decor: premiumDecor(state).length, ach: state.achievements.length }));

  /** Личные рекорды (переживают новую игру). */
  const recordsBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('records.title')));
    const records = state.records ?? {};
    if (!Object.keys(records).length) {
      box.append(el('div', 'ui-muted', t('records.empty')));
      return box;
    }
    for (const id of RECORD_IDS) {
      const best = records[id];
      if (!best) continue;
      const r = el('div', 'ui-row');
      const value = best.day ? t('records.value', { n: best.n, day: best.day }) : String(best.n);
      r.append(el('span', '', `${RECORD_ICONS[id]} ${t(`records.${id}` as TextKey)}`), el('b', '', value));
      box.append(r);
    }
    if (state.runs) box.append(el('div', 'ui-muted', t('records.runs', { n: state.runs })));
    return box;
  };

  /** Красная строка утром, пока долг выше предела. */
  const debtLine = (state: StoreState): HTMLElement[] => {
    if (!state.debtWarning) return [];
    const line = el('div', 'ui-note', t('bankrupt.line', { debt: state.debt, limit: debtLimit(state), n: daysUntilBill(state.day) }));
    line.style.color = '#b13e53';
    return [line];
  };

  const bankLetterBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(
      el('h3', '', t('bankrupt.letter.title')),
      el('p', '', t('bankrupt.letter.text', { debt: state.debt, limit: debtLimit(state), n: daysUntilBill(state.day) })),
      el('div', 'ui-muted', t('bankrupt.letter.how')),
      button(t('bankrupt.letter.ok'), () => update(seeDebtWarning(getState()))),
    );
    return box;
  };

  const rescueBox = (state: StoreState, paid: number) =>
    dialogBox({
      portrait: 'portrait_grandma_sad',
      name: t(CHARACTERS.grandma.nameKey),
      text: `«${t('bankrupt.grandma', { n: paid })}»`,
      pitch: VOICE.grandma,
      after: [el('div', 'ui-note', t('bankrupt.grandma.note', { debt: state.debt, limit: debtLimit(state) }))],
      nextLabel: t('bankrupt.grandma.ok'),
      onNext: () => update(seeGrandmaRescue(getState())),
    });

  /** Магазин закрыт за долги: итоги игры и кнопка «Начать заново». */
  const closedBox = (state: StoreState) => {
    const box = el('div', 'ui-box ui-closed');
    box.append(
      el('h2', '', t('bankrupt.closed.title')),
      el('p', '', t('bankrupt.closed.text')),
      el(
        'div',
        'ui-muted',
        t('bankrupt.closed.stats', {
          days: state.day,
          revenue: state.totalRevenue,
          served: state.lifetime?.served ?? 0,
          name: t(STORE_LEVELS[state.level].nameKey),
        }),
      ),
      keepsLine(state),
      button(`🔄 ${t('restart.button')}`, restart),
    );
    return box;
  };

  /** Подтверждение новой игры по кнопке в профиле. */
  const restartBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const yes = button(t('restart.yes'), restart, 'ui-btn danger');
    box.append(
      el('h3', '', t('restart.title')),
      el('p', '', t('restart.text')),
      keepsLine(state),
      yes,
      button(t('restart.no'), () => {
        confirmRestart = false;
        render();
      }, 'ui-btn secondary'),
    );
    return box;
  };

  /** Радио: купить приёмник и выбрать волну. */
  const radioBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('radio.title')), el('div', 'ui-muted', t('radio.note')));
    if (!hasRadio(state)) {
      box.append(button(t('radio.buy', { price: RADIO_PRICE }), () => update(buyRadio(getState()), 'success'), 'ui-btn secondary', state.money < RADIO_PRICE));
      return box;
    }
    const now = stationOf(state);
    const chips = el('div', 'ui-chips');
    for (const id of STATIONS) {
      const info = STATION_INFO[id];
      chips.append(button(`${info.icon} ${t(info.nameKey)}`, () => update(setStation(getState(), id)), `ui-chip${now === id ? ' active' : ''}`));
    }
    box.append(chips, el('div', 'ui-note', t(STATION_INFO[now].descKey)));
    return box;
  };

  /** Напротив открылся новый конкурент (Эдуард — своей репликой, остальные — в новостях района) или мы его победили. */
  const eduardNewsBox = (news: EduardNews) => {
    const info = EDUARD_STAGES[news.stage];
    const name = t(info.nameKey);
    const onNext = () => update(seeEduardNews(getState()), news.kind === 'beaten' ? 'success' : 'tap');
    if (news.kind === 'beaten')
      return dialogBox({
        caption: t('boss.news'),
        portrait: info.eduard ? 'portrait_eduard_sad' : 'portrait_anchor_happy',
        name: info.eduard ? t('eduard.name') : t('bigday.anchor'),
        text: t('boss.beaten', { name, reward: info.reward }),
        pitch: info.eduard ? VOICE.eduard : 520,
        after: [el('div', 'ui-note', t('boss.beatenHint'))],
        nextLabel: t('boss.hooray'),
        onNext,
      });
    const effect = t('eduard.effect', { n: Math.round(info.pull * 100), r: EDUARD_LOYAL_RATING, goal: info.rating, d: BOSS_DAYS, reward: info.reward });
    return dialogBox({
      caption: info.eduard ? name : t('boss.news'),
      portrait: info.eduard ? (news.stage === EDUARD_MAX ? 'portrait_eduard_happy' : 'portrait_eduard') : 'portrait_anchor_surprised',
      name: info.eduard ? t('eduard.name') : t('bigday.anchor'),
      text: info.eduard ? `«${t(info.lineKey)}»` : t(info.lineKey),
      pitch: info.eduard ? VOICE.eduard : 520,
      after: [el('div', 'ui-note', effect)],
      nextLabel: t('eduard.ok'),
      onNext,
    });
  };

  /** Новости про «Гигант»: стройка, открытие, победа или поражение — ведущая и картинка «в эфире». */
  const giantNewsBox = (state: StoreState, phase: GiantPhase) => {
    const giant = giantOf(state)!;
    const params = {
      n: phase === 'build' ? GIANT_BUILD_DAYS : phase === 'lost' ? GIANT_REMATCH_DAYS : GIANT_BATTLE_DAYS,
      target: giant.target,
      revenue: giant.revenue,
      reward: giantReward(state),
      r: GIANT_RATING,
      fame: Math.round((GIANT_FAME - 1) * 100),
    };
    return dialogBox({
      caption: t('bigday.caption'),
      art: `assets/news_giant_${phase}.png`,
      portrait: phase === 'won' ? 'portrait_anchor_happy' : phase === 'lost' ? 'portrait_anchor_sad' : 'portrait_anchor_surprised',
      name: t('bigday.anchor'),
      text: t(`giant.${phase}.news` as TextKey, params),
      pitch: 520,
      after: [el('div', 'ui-note', t(`giant.${phase}.hint` as TextKey, params))],
      nextLabel: t(phase === 'won' ? 'giant.hooray' : 'bigday.ok'),
      onNext: () => update(seeGiantNews(getState()), phase === 'won' ? 'success' : 'tap'),
    });
  };

  // ---------- «Папа и Соня» ----------

  /** Сцена сюжета: место действия, реплики по одной; в конце последней — слова благодарности. */
  const dramaBox = (scene: DramaScene) => {
    const line = scene.lines[Math.min(dramaLine, scene.lines.length - 1)];
    const last = dramaLine >= scene.lines.length - 1;
    const after = last && isLastScene(scene) ? [el('div', 'ui-note', t('drama.end'))] : [];
    return dialogBox({
      caption: t(scene.place),
      art: scene.art && dramaLine === 0 ? `assets/${scene.art}.png` : undefined,
      portrait: `portrait_${line.who}${line.mood ? `_${line.mood}` : ''}`,
      name: t(CHARACTERS[line.who].nameKey),
      // Мысли (в скобках) — без кавычек.
      text: t(line.key).startsWith('(') || t(line.key) === '…' ? t(line.key) : `«${t(line.key)}»`,
      pitch: VOICE[line.who],
      after,
      nextLabel: t('drama.next'),
      onNext: () => {
        if (!last) {
          dramaLine++;
          render();
          return;
        }
        dramaLine = 0;
        update(seeDrama(getState(), todayLocal()));
      },
    });
  };

  // ---------- Конкурсы «Лучший магазин…» ----------

  const contestName = (tier: number) => t(`contest.name.${tierKey(tier)}` as TextKey) + legendNumber(tier);
  const cupTexture = (tier: number) => `cup_${tierKey(tier)}`;

  /** Ведущая объявляет конкурс: что оценят и сколько нужно. */
  const contestAnnounceBox = (c: ContestState) =>
    dialogBox({
      caption: t('bigday.caption'),
      art: 'assets/news_contest.png',
      portrait: 'portrait_anchor_happy',
      name: t('bigday.anchor'),
      text: t('contest.announce', { name: contestName(c.tier) }),
      pitch: 520,
      after: [
        el(
          'div',
          'ui-note',
          t('contest.announce.hint', { r: contestRating(c.tier), target: c.target, p: Math.round(CONTEST_UNHAPPY * 100), e: CONTEST_EMPTY }),
        ),
      ],
      nextLabel: t('contest.letsgo'),
      onNext: () => update(seeAnnounce(getState()), 'success'),
    });

  /** Неделя конкурса: как идут дела по каждой оценке. */
  const contestBox = (state: StoreState): HTMLElement[] => {
    const c = contestOf(state);
    if (!c || c.phase !== 'run') return [];
    const box = el('div', 'ui-box');
    const need = contestRating(c.tier);
    const ok = (pass: boolean, text: string) => el('div', '', `${pass ? '✅' : '•'} ${text}`);
    box.append(el('b', '', t('contest.box.title', { name: contestName(c.tier), n: state.day - c.since + 1, of: CONTEST_DAYS })));
    if (juryDay(state)) box.append(el('div', 'ui-note', t('contest.box.jury')));
    box.append(
      ok(state.rating >= need, t('contest.box.rating', { r: state.rating.toFixed(1), need })),
      ok(c.revenue >= c.target, t('contest.box.revenue', { n: c.revenue, target: c.target })),
      ok(c.unhappy <= Math.max(3, Math.round(c.served * CONTEST_UNHAPPY)), t('contest.box.happy', { u: c.unhappy, s: c.served, p: Math.round(CONTEST_UNHAPPY * 100) })),
      ok(c.empty <= CONTEST_EMPTY, t('contest.box.shelves', { n: c.empty, max: CONTEST_EMPTY })),
      el('div', 'ui-muted', t('contest.box.need', { n: CONTEST_NEED })),
    );
    return [box];
  };

  /** Первая победа — финал истории: после новости по очереди говорят герои. */
  const FINALE: { who: CharacterId; key: TextKey; mood: 'happy' | 'surprised' }[] = [
    { who: 'grandma', key: 'contest.finale.1', mood: 'happy' },
    { who: 'valya', key: 'contest.finale.2', mood: 'happy' },
    { who: 'marat', key: 'contest.finale.3', mood: 'happy' },
    { who: 'eduard', key: 'contest.finale.4', mood: 'surprised' },
    { who: 'grandma', key: 'contest.finale.5', mood: 'happy' },
  ];

  /** Итоги конкурса: новость ведущей, оценки жюри, награда; первая победа — церемония. */
  const contestResultBox = (r: ContestResult) => {
    const finale = r.won && r.tier === 0;
    const done = () => {
      finaleLine = 0;
      update(seeResult(getState()), r.won ? 'success' : 'tap');
    };
    // Если история «Папа и Соня» рассказана — Соня тоже на церемонии, перед последними словами бабушки.
    const lines = dramaDone(getState())
      ? [...FINALE.slice(0, -1), { who: 'sonya' as const, key: 'contest.finale.sonya' as TextKey, mood: 'happy' as const }, FINALE[FINALE.length - 1]]
      : FINALE;
    if (finale && finaleLine > 0) {
      const line = lines[finaleLine - 1];
      const last = finaleLine >= lines.length;
      return dialogBox({
        caption: t('contest.finale.caption'),
        art: last ? 'assets/news_contest_won.png' : undefined,
        portrait: `portrait_${line.who}_${line.mood}`,
        name: t(CHARACTERS[line.who].nameKey),
        text: `«${t(line.key)}»`,
        pitch: VOICE[line.who],
        after: last ? [el('div', 'ui-note', t('contest.finale.end'))] : [],
        nextLabel: last ? t('contest.thanks') : t('story.next'),
        onNext: () => {
          if (last) return done();
          finaleLine++;
          render();
        },
      });
    }
    const marks = el('div', 'ui-note');
    marks.append(...CRITERIA.map((k) => el('div', '', `${r.passed[k] ? '✅' : '❌'} ${t(`contest.crit.${k}` as TextKey)}`)));
    const after: HTMLElement[] = [marks];
    if (r.won) {
      after.push(el('div', 'ui-note', t('contest.won.reward', { prize: r.prize, next: contestName(r.tier + 1), n: CONTEST_EVERY_WON })));
    }
    return dialogBox({
      caption: t('bigday.caption'),
      art: `assets/news_contest_${r.won ? 'won' : 'lost'}.png`,
      portrait: r.won ? 'portrait_anchor_happy' : 'portrait_anchor_sad',
      name: t('bigday.anchor'),
      text: t(r.won ? 'contest.won.news' : 'contest.lost.news', { name: contestName(r.tier), n: CONTEST_EVERY_LOST }),
      pitch: 520,
      after,
      nextLabel: finale ? t('story.next') : t(r.won ? 'giant.hooray' : 'bigday.ok'),
      onNext: () => {
        if (!finale) return done();
        finaleLine = 1;
        render();
      },
    });
  };

  /** Кубки в профиле: звание и все победы. */
  const trophiesBox = (state: StoreState): HTMLElement[] => {
    const wins = contestOf(state)?.wins ?? 0;
    if (!wins) return [];
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('contest.trophies')), el('div', '', t('contest.title', { name: contestName(wins - 1) })));
    for (let tier = wins - 1; tier >= 0; tier--) {
      box.append(artRow(cupTexture(tier), { name: contestName(tier), sub: t('contest.trophy.sub'), actions: [] }));
    }
    return [box];
  };

  /** Утро после ночных воров: участковый рассказывает, что случилось. */
  const burglaryBox = (news: BurglaryNews) => {
    const state = getState();
    const lost = [
      ...news.goods.map((g) => `${g.n}× ${productLabel(g.id)}`),
      ...(news.cash ? [t('watch.stolen.cash', { n: news.cash })] : []),
    ];
    const after: HTMLElement[] = [];
    if (news.outcome === 'stolen') {
      if (news.dogSlept) after.push(el('div', 'ui-note', t('watch.stolen.dogSlept')));
      else if (!hasWatchman(state)) after.push(el('div', 'ui-note', t('watch.stolen.hint')));
    }
    const art = { stolen: 'burglary', dog: 'dog', watchman: 'watchman' }[news.outcome];
    return dialogBox({
      art: `assets/news_${art}.png`,
      portrait: news.outcome === 'stolen' ? 'portrait_police_surprised' : 'portrait_police_happy',
      name: t('who.police'),
      text:
        news.outcome === 'stolen'
          ? t('watch.stolen.news', { goods: lost.join(', ') || t('watch.stolen.nothing'), repair: news.repair })
          : news.outcome === 'dog'
            ? t('watch.dog.news')
            : t('watch.watchman.news', { n: news.bounty }),
      pitch: 300,
      after,
      nextLabel: t(news.outcome === 'stolen' ? 'watch.ok' : 'watch.hooray'),
      onNext: () => update(seeBurglaryNews(getState()), news.outcome === 'stolen' ? 'tap' : 'success'),
    });
  };

  /** Ночная охрана во вкладке «Уголки»: шанс воров, пёс Бобик и ночной сторож. */
  const securityBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const security = securityOf(state);
    const chance = burglaryChance(state, state.day + 1);
    box.append(el('b', '', `🐕 ${t('watch.title')}`));
    box.append(el('div', 'ui-muted', state.day + 1 < DOG_FROM_DAY ? t('watch.calm') : t('watch.note', { p: Math.round(chance * 100) })));
    if (gearTier(state, 'cameras') > 0) box.append(el('div', 'ui-muted', t('watch.cameras')));
    const dog = security.dog;
    box.append(
      artRow('bobik_sit0', {
        name: t('watch.dog.name'),
        price: dog ? undefined : DOG_PRICE,
        sub: dog ? t('watch.dog.home', { n: dog.since, k: security.scared ?? 0, f: DOG_FOOD }) : t('watch.dog.desc', { f: DOG_FOOD }),
        actions: dog
          ? [el('span', 'ui-tag', '✓')]
          : [button(t('watch.dog.adopt'), () => update(adoptDog(getState()), 'success'), 'ui-chip', state.money < DOG_PRICE || state.day < DOG_FROM_DAY)],
      }),
    );
    const on = hasWatchman(state);
    box.append(
      artRow('watchman_card', {
        name: t('watch.watchman.name'),
        sub: on
          ? t('watch.watchman.on', { k: security.caught ?? 0, w: WATCHMAN_WAGE })
          : t('watch.watchman.desc', { b: WATCHMAN_BOUNTY, w: WATCHMAN_WAGE }),
        actions: [button(t(on ? 'watch.watchman.fire' : 'watch.watchman.hire'), () => update(setWatchman(getState(), !on)), 'ui-chip')],
      }),
    );
    return box;
  };

  /** «Гигант» за дорогой: сколько до открытия, как идёт битва, что помогает удержать покупателей. */
  const giantBox = (state: StoreState): HTMLElement[] => {
    const giant = giantOf(state);
    if (!giant || giant.phase === 'won') return [];
    const box = el('div', 'ui-box');
    if (giant.phase === 'build') {
      const left = GIANT_BUILD_DAYS - (state.day - giant.since);
      box.append(el('b', '', t('giant.box.build', { n: left })), el('div', 'ui-muted', t('giant.box.prepare')));
      return [box];
    }
    if (giant.phase === 'lost') {
      const left = GIANT_REMATCH_DAYS - (state.day - giant.since);
      box.append(el('b', '', t('giant.box.lost', { p: Math.round(giantPull(state) * 100), n: left })), el('div', 'ui-muted', t('giant.box.prepare')));
      return [box];
    }
    const dayN = state.day - giant.since + 1;
    box.append(
      el('b', '', t('giant.box.battle', { n: dayN, of: GIANT_BATTLE_DAYS })),
      el('div', '', t('giant.box.revenue', { n: giant.revenue, target: giant.target })),
      el('div', '', t('giant.box.rating', { r: state.rating.toFixed(1), need: GIANT_RATING })),
      el('div', 'ui-muted', t('giant.box.pull', { p: Math.round(giantPull(state) * 100) })),
    );
    const d = giantDefense(state);
    const chip = (ok: boolean, key: TextKey) => el('span', ok ? 'ui-chip' : 'ui-chip ui-chip-off', `${ok ? '✓' : '•'} ${t(key)}`);
    const chips = el('div', 'ui-chips');
    chips.append(chip(d.rating, 'giant.def.rating'), chip(d.ad, 'giant.def.ad'), chip(d.loyalty, 'giant.def.loyalty'), chip(d.brand, 'giant.def.brand'));
    box.append(chips);
    return [box];
  };

  /** Магазин Эдуарда по соседству (после сюжета): сколько гостей уводит и когда вырастет. */
  const eduardBox = (state: StoreState): HTMLElement[] => {
    const stage = eduardStage(state);
    // По сюжету напротив «МегаМарт» — к нему тоже можно заглянуть.
    if (stage === null) {
      if (!onBoss || eduardLook(state) !== 'mega') return [];
      const mega = el('div', 'ui-box');
      mega.append(button(t('rival.boss'), () => {
        endTour();
        close();
        onBoss();
      }, 'ui-btn secondary'));
      return [mega];
    }
    const box = el('div', 'ui-box');
    const since = state.eduard?.since ?? state.day;
    // Напротив пусто: скоро новый конкурент — или всех уже победили.
    if (!bossActive(state)) {
      box.append(el('div', 'ui-muted', stage < EDUARD_MAX ? t('eduard.next', { d: Math.max(1, since + EDUARD_GROWTH_DAYS - state.day) }) : t('eduard.top')));
      return [box];
    }
    const info = EDUARD_STAGES[stage];
    box.append(
      el('b', '', t('eduard.title', { name: t(info.nameKey) })),
      el('div', 'ui-muted', t(eduardPull(state) < info.pull ? 'eduard.box' : 'eduard.boxFull', { n: Math.round(eduardPull(state) * 100), r: EDUARD_LOYAL_RATING, max: Math.round(info.pull * 100) })),
      el('div', 'ui-note', t('boss.goal', { goal: info.rating, d: BOSS_DAYS, n: state.eduard?.streak ?? 0 })),
    );
    // Заглянуть к нему через дорогу и немного похулиганить (game/rival.ts) — без сервера.
    if (onBoss) {
      box.append(button(t('rival.boss'), () => {
        endTour();
        close();
        onBoss();
      }, 'ui-btn secondary'));
    }
    return [box];
  };

  /** Улучшения магазина: касса, кофемашина, печь, ночная смена. */
  const upgradesBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('upgrade.title')));
    for (const id of LISTED_UPGRADES) {
      const up = UPGRADES[id];
      const owned = hasUpgrade(state, id);
      const row = el('div', 'ui-item');
      row.append(el('div', 'ui-ad-icon', up.icon));
      const body = el('div');
      const name = el('div', 'ui-item-name', t(up.nameKey));
      if (!owned) name.append(el('span', 'ui-tag', `${up.price} 💰`));
      // Купленное раньше, чем порог подняли (доставка, «Уценка»), — работает, «нужно помещение» не пишем.
      const sub = !owned && state.level < up.minLevel ? t('upgrade.needLevel', { name: t(STORE_LEVELS[up.minLevel].nameKey) }) : t(up.descKey);
      body.append(name, el('div', 'ui-item-sub', sub));
      const actions = el('div', 'ui-item-actions');
      actions.append(
        owned
          ? el('span', 'ui-tag', t('upgrade.owned'))
          : button(
              t('upgrade.buy'),
              () => update(buyUpgrade(getState(), id), 'success'),
              'ui-chip',
              state.level < up.minLevel || state.money < up.price || Boolean(up.needs && !hasUpgrade(state, up.needs)),
            ),
      );
      row.append(body, actions);
      box.append(row);
    }
    return box;
  };

  /** Банк: взять кредит (один за раз) или вернуть досрочно. */
  const bankBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('bank.title')));
    const loan = state.loan;
    if (loan) {
      box.append(el('div', 'ui-note', t('bank.current', { left: loan.left, pay: loan.payment })));
      const chips = el('div', 'ui-chips');
      for (const n of [...new Set([Math.min(500, loan.left), loan.left])]) {
        chips.append(button(t('bank.repay', { n }), () => update(repayLoan(getState(), n), 'success'), 'ui-chip', state.money < n));
      }
      box.append(chips);
      return box;
    }
    box.append(el('div', 'ui-muted', t('bank.note', { pct: Math.round(LOAN_INTEREST * 100), m: LOAN_MONTHS })));
    for (const n of loanOptions(state)) {
      box.append(button(t('bank.take', { n, total: loanTotal(n), pay: loanPayment(n) }), () => update(takeLoan(getState(), n), 'success'), 'ui-btn secondary'));
    }
    return box;
  };

  /** Картинка модели в списке оборудования (у кого нет своей картинки — значок). */
  const gearArt = (state: StoreState, id: GearId, tier: number): string | null => {
    // Кассу показываем крупным планом: сам стол слишком длинный для строки.
    const at = { ...state, gear: { ...state.gear, [id]: tier } };
    const art: Partial<Record<GearId, string>> = {
      register: `counter_icon${tier}`,
      bin: tier ? `bin_t${tier}_0` : 'bin0',
      bargain: `bargain_shelf${tier}`,
      coffee: coffeeSprite(at),
      oven: ovenSprite(at),
      // Транспорт курьера: велосипед и мопед сбоку, фургончик — значком (сверху он как все машины).
      courier: ['bike', 'scooter', 'ico_van'][tier],
      stove: stoveSprite(at),
      foodShelf: foodSprite(at),
    };
    return art[id] ?? null;
  };

  /** Оборудование: по строке на каждую линейку — что стоит, на что поменять, что это даст. */
  /** Кассы: места под них даёт помещение, сами кассы — покупаются по одной, когда очередь того стоит. */
  const registersBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const n = registerCount(state);
    const slots = registerSlots(state);
    const price = nextRegisterPrice(state);
    box.append(el('b', '', t('registers.title')), el('div', 'ui-muted', t('registers.note')));
    const actions = price === null ? [] : [button(t('registers.buy', { cost: price }), () => update(buyRegister(getState()), 'success'), 'ui-chip', state.money < price)];
    const model = GEAR.register.models[gearTier(state, 'register')];
    const sub = `${t(model.nameKey)} · ${price !== null ? t('registers.free', { n: slots - n }) : nextRegisterCount(state) && (nextRegisterCount(state) ?? 0) > slots ? t('registers.full') : t('registers.max')}`;
    box.append(artRow(gearArt(state, 'register', gearTier(state, 'register')) ?? 'counter0', { name: t('registers.count', { n, max: slots }), sub, actions }));
    // Открытые кассы зовут гостей (lanes.ts): сколько уже дают и сколько даст следующая касса с кассиром.
    const till = withNextTill(state);
    const now = Math.round(guestsToday(state) * (1 - 1 / laneGuests(state)));
    box.append(
      helpRow(t('lanes.now', { n: openRegisters(state), g: now }), t('lanes.note')),
      ...(till ? [el('div', 'ui-muted', t('lanes.nextTill', { g: guestsGain(state, till) }))] : []),
    );
    return box;
  };

  /** Кассы самообслуживания (lanes.ts): сколько стоит, поставить ещё, сменить модель — и сколько гостей это даст. */
  const kiosksBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const n = kioskCount(state);
    const slots = kioskSlots(state);
    box.append(el('b', '', t('kiosks.title')), el('div', 'ui-muted', t('kiosks.note')));
    const tierIndex = kioskTierIndex(state);
    const tier = kioskTier(state);
    const texture = ['kiosk', 'kiosk1', 'kiosk2'][tierIndex];
    if (!slots && !n) {
      const from = KIOSKS_BY_LEVEL.findIndex((k) => k > 0);
      box.append(artRow(texture, { name: t('kiosks.count', { n: 0, max: 0 }), sub: t('kiosks.locked', { name: t(STORE_LEVELS[from].nameKey) }), actions: [] }));
      return box;
    }
    const price = nextKioskPrice(state);
    const bought = price === null ? null : buyKiosk({ ...state, money: Math.max(state.money, price) });
    // «В новом помещении будет ещё» — только если там правда больше мест (у гипермаркета — столько же, сколько у универмага).
    const more = nextStoreLevel(state) && KIOSKS_BY_LEVEL[Math.min(state.level + 1, KIOSKS_BY_LEVEL.length - 1)] > slots;
    const free = price !== null ? t('kiosks.free', { n: slots - n }) : more ? t('kiosks.full') : t('kiosks.max');
    const gain = bought ? ` · ${t('lanes.gain', { g: guestsGain(state, bought) })}` : '';
    // Место у правой стены заняла полка или вещь (своя расстановка) — сначала переставить.
    const blocked = price !== null && !kioskSpotFree(state, n);
    const actions = price === null ? [] : [button(t('kiosks.buy', { cost: price }), () => update(buyKiosk(getState()), 'success'), 'ui-chip', blocked || state.money < price)];
    box.append(artRow(texture, { name: t('kiosks.count', { n, max: slots }), sub: blocked ? t('kiosks.blocked') : `${free}${gain}`, actions }));
    const model = (k: typeof tier) =>
      t('kiosks.model', { name: t(k.nameKey), max: k.maxItems, s: k.item.toFixed(1), err: Math.round(k.error * 100), skip: +(k.skip * 100).toFixed(1) });
    box.append(el('div', 'ui-item-sub', model(tier)));
    const next = nextKioskTier(state);
    if (next) {
      const locked = state.level < next.minLevel;
      const up = locked ? null : upgradeKiosks({ ...state, money: Math.max(state.money, next.price) });
      const sub = locked ? t('kiosks.upgradeLocked', { name: t(STORE_LEVELS[next.minLevel].nameKey) }) : `${model(next)}${up && n ? ` · ${t('lanes.gain', { g: guestsGain(state, up) })}` : ''}`;
      const actions = locked ? [] : [button(t('kiosks.upgrade', { cost: next.price }), () => update(upgradeKiosks(getState()), 'success'), 'ui-chip', !n || state.money < next.price)];
      box.append(artRow(['kiosk', 'kiosk1', 'kiosk2'][KIOSK_TIERS.indexOf(next)], { name: t(next.nameKey), sub, actions }));
    } else box.append(el('div', 'ui-muted', t('kiosks.best')));
    return box;
  };

  const gearBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('gear.title')), el('div', 'ui-muted', t('gear.note')));
    for (const id of GEAR_IDS) {
      const gear = GEAR[id];
      const tier = gearTier(state, id);
      const now = gear.models[tier];
      const next = nextGear(state, id);
      const needs = gear.needs && !hasUpgrade(state, gear.needs);
      const row = el('div', 'ui-item');
      const texture = gearArt(state, id, next && !needs ? tier + 1 : tier);
      if (texture) {
        const img = el('img', 'ui-item-art');
        img.src = sheetPng(texture);
        img.alt = '';
        row.append(img);
      } else row.append(el('div', 'ui-ad-icon', gear.icon));
      const body = el('div');
      const name = el('div', 'ui-item-name', t(gear.nameKey));
      const actions = el('div', 'ui-item-actions');
      if (needs) {
        body.append(name, el('div', 'ui-item-sub', t(`gear.needs.${gear.needs}` as TextKey)));
      } else if (!next) {
        body.append(name, el('div', 'ui-item-sub', `${t(now.nameKey)} — ${t(now.effectKey)}`));
        actions.append(el('span', 'ui-tag', t('gear.max')));
      } else {
        name.append(el('span', 'ui-tag', `${next.price} 💰`));
        const locked = state.level < next.minLevel;
        body.append(
          name,
          el('div', 'ui-item-sub', t('gear.upgrade', { from: t(now.nameKey), to: t(next.nameKey) })),
          el('div', 'ui-item-sub', locked ? t('upgrade.needLevel', { name: t(STORE_LEVELS[next.minLevel].nameKey) }) : t(next.effectKey)),
        );
        actions.append(
          button(t('gear.buy'), () => update(upgradeGear(getState(), id), 'success'), 'ui-chip', !gearAvailable(state, id) || state.money < next.price),
        );
      }
      row.append(body, actions);
      box.append(row);
    }
    return box;
  };

  /**
   * Реклама: карточка на каждый вид — иконка, что даёт, цена и кнопка. Сверху — сколько гостей
   * добавляет уже запущенная; у остальных — сколько прибавят к ней (следующая работает слабее).
   */
  const adsBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('ads.title')), el('div', 'ui-muted', t('ads.note', { n: MAX_ADS })));
    const running = activeAds(state);
    const pct = (x: number) => Math.round(x * 100);
    if (running.length) box.append(el('div', 'ui-note', t('ads.now', { n: pct(adBoost(state) - 1), list: running.map((a) => a.icon).join(' ') })));
    for (const id of AD_IDS) {
      const ad = ADS[id];
      const block = adBlock(state, id);
      const row = el('div', `ui-item${block === 'level' ? ' ui-locked' : ''}`);
      row.append(el('div', 'ui-ad-icon', ad.icon));
      const body = el('div');
      const name = el('div', 'ui-item-name', t(ad.nameKey));
      if (block !== 'level') name.append(el('span', 'ui-tag', `${adPrice(state, id)} 💰`));
      const sub =
        block === 'running'
          ? t('ads.active', { n: adUntil(state, id) ?? state.day })
          : block === 'level'
            ? t('upgrade.needLevel', { name: t(STORE_LEVELS[ad.minLevel].nameKey) })
            : t(ad.descKey);
      body.append(name, el('div', 'ui-item-sub', sub));
      // С уже запущенной рекламой эта прибавит меньше, чем одна, — честно показываем сколько.
      if (running.length && !block) body.append(el('div', 'ui-item-sub', t('ads.stack', { n: pct(adGain(state, id)) })));
      // До покупки — сколько гостей в день прибавит (от сегодняшнего потока).
      if (block === null || block === 'money') body.append(el('div', 'ui-item-sub', t('ads.guests', { n: adExtraGuests(state, id) })));
      if (block === 'full') body.append(el('div', 'ui-item-sub', t('ads.full', { n: MAX_ADS })));
      const action = button(block === 'running' ? '✓' : t('ads.order'), () => update(buyAd(getState(), id), 'success'), 'ui-chip', Boolean(block));
      const actions = el('div', 'ui-item-actions');
      if (block !== 'level') actions.append(action);
      row.append(body, actions);
      box.append(row);
    }
    return box;
  };

  /**
   * Друзья в игре: кто они, твой код, добавить друга по коду (подходит и тем, кто уже играл),
   * пригласить новичка. С друзьями: заходят покупателями, работают у тебя, ходишь к ним в гости.
   */
  let friendMsg = '';
  const friendsBox = (): HTMLElement[] => {
    const info = visitsInfo();
    const box = el('div', 'ui-box ui-friends');
    box.append(el('b', '', `🏠 ${t('friends.title')}`), el('div', '', t('friends.what')));
    if (!info) {
      box.append(el('div', 'ui-note', t('friends.offline')));
      return [box];
    }
    if (!info.friends.length) box.append(el('div', 'ui-note', t('friends.none')));
    for (const f of info.friends.slice(0, 10)) {
      const row = el('div', 'ui-row');
      row.append(
        el('span', '', `👋 ${f.name} · ${t(STORE_LEVELS[Math.min(f.level, STORE_LEVELS.length - 1)].nameKey)}`),
        ...(onVisit ? [button(t('visitShop.go'), () => {
          close();
          onVisit(f.id, f.name);
        }, 'ui-chip')] : []),
      );
      box.append(row);
    }
    // Свой код — продиктовать или переслать другу.
    const mine = el('div', 'ui-row');
    mine.append(
      el('span', '', t('friends.code', { code: info.code })),
      button(t('friends.copy'), () => {
        void navigator.clipboard?.writeText(info.code).then(() => {
          friendMsg = t('friends.copied');
          render();
        }).catch(() => undefined);
      }, 'ui-chip'),
    );
    const input = el('input', 'ui-input');
    input.placeholder = t('friends.enter');
    input.maxLength = 12;
    const add = button(t('friends.add'), () => {
      const code = input.value.trim();
      if (!code) return;
      add.disabled = true;
      void addFriend(code).then((res) => {
        friendMsg = res.ok ? t('friends.added', { name: res.name ?? '' }) : t(`friends.err.${res.error ?? 'offline'}` as TextKey);
        update(getState(), res.ok ? 'success' : 'error');
      });
    }, 'ui-chip');
    const adding = el('div', 'ui-row');
    adding.append(input, add);
    box.append(mine, adding);
    if (friendMsg) box.append(el('div', 'ui-note', friendMsg));
    box.append(button(`📨 ${t('friends.invite')}`, () => void inviteFriends(t('social.share')), 'ui-btn secondary'));
    return [box];
  };

  /** Что нового в игре: один раз, с кнопками прямо к новинкам. */
  const whatsNewBox = (state: StoreState): HTMLElement[] => {
    if ((state.whatsNew ?? 0) >= WHATS_NEW) return [];
    const box = el('div', 'ui-box ui-duel');
    box.append(el('b', '', `✨ ${t('news.title')}`));
    for (const key of WHATS_NEW_LINES) box.append(el('div', '', t(key)));
    const row = el('div', 'ui-row');
    // Кассы самообслуживания и сменщик — во вкладке «Развитие» и «Персонал».
    // Новичку нового начала вкладки открываются по очереди — кнопки только к уже открытым.
    if (tabOpen(state, 'grow'))
      row.append(button(`🏗 ${t('tab.grow')}`, () => {
        tab = 'grow';
        update({ ...getState(), whatsNew: WHATS_NEW });
      }, 'ui-chip'));
    if (tabOpen(state, 'staff'))
      row.append(button(`🧑‍💼 ${t('tab.staff')}`, () => {
        tab = 'staff';
        update({ ...getState(), whatsNew: WHATS_NEW });
      }, 'ui-chip'));
    box.append(row, button(t('news.ok'), () => update({ ...getState(), whatsNew: WHATS_NEW }), 'ui-btn secondary'));
    return [box];
  };

  /** «Пригласи друзей»: ссылка через «Поделиться» Telegram, награда за каждого, кто начал играть. */
  const inviteBox = (): HTMLElement[] => {
    const info = socialInfo();
    if (!info) return [];
    const board = el('div', 'ui-box');
    board.append(button(t('board.open'), () => showLeaderboard(onRival && ((key, name) => {
      endTour();
      close();
      onRival(key, name);
    }), { level: getState().level }), 'ui-btn'));
    const box = el('div', 'ui-box');
    box.append(el('b', '', `🤝 ${t('social.title')}`), el('div', 'ui-muted', t('social.note', { n: INVITE_REWARD, g: WELCOME_GIFT })));
    if (info.friends) box.append(el('div', 'ui-muted', t('social.count', { n: info.friends })));
    box.append(button(t('social.invite'), () => void inviteFriends(t('social.share')), 'ui-btn'));
    if (info.unclaimed) {
      const claim = button(t('social.claim', { n: info.unclaimed, r: INVITE_REWARD, sum: info.unclaimed * INVITE_REWARD }), () => {
        claim.disabled = true;
        void claimFriends().then((n) => {
          const now = getState();
          update(n ? { ...now, money: now.money + n * INVITE_REWARD } : now, n ? 'success' : 'tap');
        });
      }, 'ui-btn');
      box.append(claim);
    }
    return [board, box];
  };

  const decorBox = (state: StoreState) =>
    foldBox('decor', t('decor.title'), (box) => {
      box.append(el('div', 'ui-muted', t('decor.note')));
      // Эксклюзив пропуска — свой сезон и уже забранное; подарки за поддержку — только полученные.
      const shown = (d: DecorItem) =>
        state.decor.owned.includes(d.id) || (d.season === undefined ? !d.support : d.season === state.pass?.season);
      for (const kind of DECOR_KINDS) {
        const items = DECOR.filter((d) => d.kind === kind && shown(d));
        if (!items.length) continue;
        box.append(el('div', 'ui-decor-kind', t(`decor.kind.${kind}` as TextKey)));
        const grid = el('div', 'ui-decor-grid');
        grid.append(decorCard(state, kind, null));
        for (const item of items) grid.append(decorCard(state, kind, item));
        box.append(grid);
      }
    });

  /** Картинка вещи: краска, плитка пола/стены или сам предмет. */
  const decorPreview = (item: DecorItem | null, kind: DecorKind, big = false) => {
    const preview = el('div', `ui-decor-preview${big ? ' big' : ''}${item && kind === 'sign' ? ' wide' : ''}`);
    if (!item) preview.textContent = '↺';
    else if (item.color !== undefined) {
      const hex = `#${item.color.toString(16).padStart(6, '0')}`;
      preview.style.background = `url(${sheetPng('wall')}) 0 0 / 32px 64px, ${hex}`;
      preview.style.backgroundBlendMode = 'multiply';
    } else if (kind === 'floor' || kind === 'wall') {
      preview.style.backgroundImage = `url(${sheetAsset(`assets/${item.texture}.png`)})`;
      if (kind === 'wall') preview.style.backgroundSize = big ? '64px 128px' : '32px 64px';
      else if (big) preview.style.backgroundSize = item.id === 'floor_gold' || item.id === 'floor_noir' ? '128px 128px' : '64px 64px';
    } else {
      const img = el('img');
      img.src = sheetAsset(`assets/${item.texture}.png`);
      img.alt = '';
      preview.append(img);
    }
    return preview;
  };

  /** Карточка оформления: превью, название и что будет по нажатию (купить, поставить, уже стоит). */
  const decorCard = (state: StoreState, kind: DecorKind, item: DecorItem | null) => {
    const owned = !item || state.decor.owned.includes(item.id);
    const trying = Boolean(item && state.decor.trial?.id === item.id && state.decor.trial.day === state.day);
    const active = trying || (item ? state.decor.active[kind] === item.id : !state.decor.active[kind]);
    const premium = Boolean(item && (item.stars !== undefined || item.pack !== undefined));
    // Праздничную вещь не купить — её дарят открытки (game/live.ts); по нажатию — откуда она.
    const holiday = Boolean(item?.holiday);
    const canBuy = item?.price !== undefined && state.money >= item.price;
    const card = button(
      '',
      () => {
        if (item && premium && !owned) {
          premiumDecorModal(item);
          return;
        }
        if (item && holiday && !owned) {
          holidayDecorModal(item);
          return;
        }
        if (item && (item.season !== undefined || item.support) && !owned) {
          exclusiveDecorModal(item);
          return;
        }
        if (active) return;
        if (owned) update(setDecor(getState(), kind, item?.id ?? null));
        else if (item) update(buyDecor(getState(), item.id), 'success');
      },
      `ui-decor${active ? ' active' : ''}${premium || item?.season !== undefined || item?.support ? ' premium' : ''}`,
      !owned && !premium && !holiday && !canBuy,
    );
    const status = trying
      ? `👀 ${t('decor.trying')}`
      : active
        ? `✓ ${t('decor.on')}`
        : owned
          ? t('decor.put')
          : item?.price !== undefined
            ? `${item.price} 💰`
            : item?.holiday
              ? t(WEEK_IDS.includes(item.holiday as WeekId) ? 'decor.weekEarn' : 'decor.holidayEarn')
              : item?.season !== undefined
                ? t('decor.seasonEarn')
                : item?.support
                  ? t('decor.supportEarn')
              : `⭐ ${item?.stars ?? (item?.pack ? STAR_PACKS[item.pack]?.stars : 0) ?? 0}`;
    card.append(decorPreview(item, kind), el('div', 'ui-decor-name', item ? t(item.nameKey) : t('decor.none')), el('div', 'ui-decor-status', status));
    return card;
  };

  /**
   * Премиальная вещь: крупно, цена в звёздах, «Купить» и бесплатная примерка на день. Вещь из
   * набора (STAR_PACKS) покупается всем набором — в окне сказано, что в него входит.
   */
  const premiumDecorModal = (item: DecorItem) => {
    const { card: modal, close } = openModal();
    const state = getState();
    const note = el('div', 'ui-muted');
    const pack = item.pack ? STAR_PACKS[item.pack] : undefined;
    modal.append(
      el('h2', '', t(item.nameKey)),
      decorPreview(item, item.kind, true),
      el(
        'div',
        'ui-muted',
        pack ? t('decor.packNote', { pack: t(pack.nameKey), items: pack.items.map((id) => t(decorItem(id).nameKey)).join(', ') }) : t('decor.premiumNote'),
      ),
      note,
    );
    const buy = button(t('decor.buyStars', { n: pack?.stars ?? item.stars ?? 0 }), () => {
      buy.disabled = true;
      note.textContent = t('decor.paying');
      void buyWithStars(item.pack ?? item.id).then(async (result) => {
        if (result === 'paid') {
          // Оплата прошла — вещь (или весь набор) сразу в магазине; сервер подтвердит при следующем запуске.
          close();
          update(grantDecor(getState(), pack ? pack.items : [item.id]), 'success');
          void flushCloud();
          return;
        }
        buy.disabled = false;
        note.textContent = t(result === 'unavailable' ? 'decor.starsOff' : result === 'cancelled' ? 'decor.payCancelled' : 'decor.payFailed');
        if (result === 'unavailable') haptic.error();
      });
    });
    buy.classList.add('ui-btn-stars');
    modal.append(buy);
    if (canTry(state, item.id)) {
      modal.append(
        button(
          t('decor.try'),
          () => {
            close();
            update(tryDecor(getState(), item.id));
          },
          'ui-btn secondary',
        ),
      );
    } else if ((state.decor.tried ?? []).includes(item.id)) modal.append(el('div', 'ui-muted', t('decor.triedAlready')));
    modal.append(button(t('decor.close'), close, 'ui-btn secondary'));
    if (!starsAvailable()) note.textContent = t('decor.starsOff');
  };

  /**
   * Эксклюзив пропуска или подарок за поддержку, которых ещё нет: крупно и откуда они берутся.
   * Эксклюзив своего сезона можно один раз примерить на день — как премиальное.
   */
  const exclusiveDecorModal = (item: DecorItem) => {
    const { card: modal, close } = openModal();
    const state = getState();
    const current = item.season !== undefined && item.season === state.pass?.season;
    const text = item.support
      ? t('decor.supportNote')
      : current
        ? t('decor.seasonNote', { n: item.season!, l: EXCLUSIVE_LEVELS[item.kind] ?? 0 })
        : t('decor.seasonGone');
    modal.append(el('h2', '', t(item.nameKey)), decorPreview(item, item.kind, true), el('div', 'ui-muted', text));
    if (current && canTry(state, item.id)) {
      modal.append(button(t('decor.try'), () => {
        close();
        update(tryDecor(getState(), item.id));
      }, 'ui-btn secondary'));
    } else if (current && (state.decor.tried ?? []).includes(item.id)) modal.append(el('div', 'ui-muted', t('decor.triedAlready')));
    modal.append(button(t('decor.close'), close, 'ui-btn secondary'));
  };

  /** Праздничная вещь, которой ещё нет: крупно и откуда она берётся (открытки праздника). */
  const holidayDecorModal = (item: DecorItem) => {
    const { card: modal, close } = openModal();
    modal.append(
      el('h2', '', t(item.nameKey)),
      decorPreview(item, item.kind, true),
      el('div', 'ui-muted', t(WEEK_IDS.includes(item.holiday as WeekId) ? 'decor.weekNote' : 'decor.holidayNote', { when: t(`decor.holidayWhen.${item.holiday}` as TextKey) })),
      button(t('decor.close'), close, 'ui-btn secondary'),
    );
  };

  /** Альбом коллекций (ui/album.ts): книга с наборами; прежний альбом редких гостей — её первая страница. */
  const albumBox = (state: StoreState) => albumButton(state, () => showAlbum(getState, setState, render));

  // ---------- Сюжет и события ----------

  /** Сводка утра одной аккуратной плашкой. */
  const infos = (...lines: HTMLElement[]) => {
    const box = el('div', 'ui-infos');
    box.append(...lines);
    return box;
  };

  /** Карточка «Новое»: одна механика за раз, показывается один раз. */
  const tipBox = (state: StoreState): HTMLElement[] => {
    const tip = pendingTip(state);
    if (!tip) return [];
    const box = el('div', 'ui-box ui-tip');
    box.append(
      el('b', '', `${t('tip.new')}: ${TIP_ICONS[tip]} ${t(`tip.${tip}.title` as TextKey)}`),
      el('div', '', t(`tip.${tip}.text` as TextKey)),
      button(t('tip.ok'), () => update(seeTip(getState(), tip)), 'ui-chip'),
    );
    return [box];
  };

  /** «Главное на сегодня»: что нужно сделать утром — с кнопкой прямо в строке. */
  const todoBox = (state: StoreState) => {
    const box = el('div', 'ui-box ui-todo');
    box.append(el('b', '', t('todo.title')));
    const row = (text: string, action?: HTMLElement) => {
      const r = el('div', 'ui-todo-row');
      r.append(el('span', '', text));
      if (action) r.append(action);
      box.append(r);
    };
    const sellable = sellableProducts(state);
    // Пустые полки, когда на складе есть их товар.
    const emptyWithStock = sellable.filter((id) => onShelves(state, id) === 0 && warehouseOf(state, id) > 0 && state.shelves.some((sh) => canPlace(id, sh) && shelfFree(sh) > 0));
    if (emptyWithStock.length) {
      row(
        t('todo.stock', { list: emptyWithStock.map((id) => PRODUCTS[id].icon).join('') }),
        button(t('todo.stockBtn'), () => {
          let next = getState();
          next.shelves.forEach((_, i) => (next = moveToShelf(next, i).state));
          update(next, 'success');
        }, 'ui-chip'),
      );
    }
    // Мало товара на сегодня: меньше, чем примерно разберут за день.
    const perProduct = (guestsToday(state) * 1.5) / Math.max(1, sellable.length);
    const low = sellable.filter((id) => onShelves(state, id) + warehouseOf(state, id) < perProduct * 0.6);
    if (low.length) {
      row(
        t('todo.low', { list: low.map((id) => PRODUCTS[id].icon).join('') }),
        button(t('todo.lowBtn'), () => {
          tab = 'buy';
          slideTab = true;
          render();
        }, 'ui-chip'),
      );
    }
    const expiring = surplus(state).count;
    if (expiring) row(t('todo.expiring', { n: expiring }), button(t('todo.expiringBtn'), () => update(surplus(getState()).state, 'success'), 'ui-chip'));
    state.shelves.forEach((sh, i) => {
      if (!sh.broken) return;
      const cost = fridgeRepairCost(state.level);
      row(t('todo.fridge', { shelf: t(SHELF_KINDS[sh.kind].nameKey) }), button(t('todo.fridgeBtn', { n: cost }), () => update(repairShelf(getState(), i), 'success'), 'ui-chip', state.money < cost));
    });
    if (state.cat && !fedToday(state)) {
      row(t('todo.cat', { name: state.cat.name }), button(t('todo.catBtn', { n: FEED_COST }), () => update(feedCat(getState()), 'success'), 'ui-chip', state.money < FEED_COST));
    }
    const rack = rackOf(state);
    const rackFree = rackCapacity(state) - rack.stock;
    if (rack.stock <= rackCapacity(state) / 3 && rackFree > 0) {
      row(t('todo.rack', { n: rack.stock }), button(t('todo.rackBtn', { n: rackFree * CANDY_COST }), () => update(refillRack(getState(), rackFree), 'success'), 'ui-chip', state.money < rackFree * CANDY_COST));
    }
    if (hasUpgrade(state, 'coffee') && cupsOf(state) < 8) {
      const n = CUPS_MAX - cupsOf(state);
      row(t('todo.cups', { n: cupsOf(state) }), button(t('todo.cupsBtn', { n, cost: n * CUP_COST }), () => update(buyCups(getState(), n), 'success'), 'ui-chip', state.money < n * CUP_COST));
    }
    // Молочка уже продаётся, а ларя нет — подсказка поставить ларь с мороженым.
    if (state.level >= 1 && state.shelves.some((s) => s.kind === 'dairy') && !state.shelves.some((s) => s.kind === 'icebox')) {
      const price = SHELF_KINDS.icebox.price;
      row(t('goods.soon'), button(t('shelves.buy', { name: '🍦', cost: price }), () => update(buyShelf(getState(), 'icebox'), 'success'), 'ui-chip', state.money < price));
    }
    if (box.children.length === 1) box.append(el('div', 'ui-muted', t('todo.done')));
    return box;
  };

  const deliveryLine = (): HTMLElement[] => {
    if (!delivered.length) return autoLine();
    const got = delivered.filter((d) => d.qty > 0);
    const lines: HTMLElement[] = [];
    if (got.length) {
      lines.push(
        el('div', 'ui-muted', t('contract.delivered', { list: got.map((d) => `${PRODUCTS[d.pid].icon}×${d.qty}`).join(' '), cost: got.reduce((sum, d) => sum + d.cost, 0) })),
      );
    }
    if (delivered.some((d) => d.skipped)) lines.push(el('div', 'ui-note', t('contract.skipped')));
    return [...lines, ...autoLine()];
  };

  /** Строка сводки утра: что автозаказ уже купил (подробно и с отменой — во вкладке закупки). */
  const autoLine = (): HTMLElement[] => {
    const state = getState();
    const today = state.autoOrder?.today;
    if (!autoActive(state) || today?.day !== state.day || today.canceled || !today.lines.length) return [];
    return [el('div', 'ui-muted', t('auto.delivered', { list: today.lines.map((l) => `${PRODUCTS[l.pid].icon}×${l.qty}`).join(' '), cost: today.spent }))];
  };

  const fairLine = (state: StoreState): HTMLElement[] => {
    if (isFairDay(state.day)) return [el('div', 'ui-note', t('fair.today'))];
    const n = daysToFair(state.day);
    return n > 0 && n <= 2 ? [el('div', 'ui-muted', t('fair.soon', { n }))] : [];
  };

  const promoLine = (state: StoreState): HTMLElement[] => {
    const promo = activePromo(state);
    return promo ? [el('div', 'ui-muted', t('promo.active', { product: productLabel(promo.product), kind: t(`promo.kind.${promo.kind}` as TextKey) }))] : [];
  };

  /** Испытания недели: прогресс каждой цели и награда. */
  const goalLine = (state: StoreState) => {
    const chapter = currentChapter(state);
    const text = chapter
      ? t('story.goalLine', { title: t(chapter.titleKey), goal: t(warmKey(state, chapter.goalKey), chapter.progress(state)) })
      : t('story.free');
    return el('div', 'ui-note', text);
  };

  const storyBox = (state: StoreState, kind: 'intro' | 'outro', chapter: Chapter) => {
    const lines = kind === 'intro' ? chapter.intro : chapter.outro;
    const current = lines[Math.min(storyLine, lines.length - 1)];
    const speaker = CHARACTERS[current.who];
    const last = storyLine >= lines.length - 1;
    const key = warmKey(state, current.key);
    const mood = key !== current.key ? 'happy' : current.mood;
    const after: HTMLElement[] = [];
    if (last && kind === 'intro') after.push(el('div', 'ui-note', `🎯 ${t(warmKey(state, chapter.goalKey), chapter.progress(state))}`));
    if (last && kind === 'outro') {
      const reward = [
        chapter.reward.money ? `+${chapter.reward.money} 💰` : '',
        chapter.reward.rating ? `+${chapter.reward.rating}★` : '',
      ]
        .filter(Boolean)
        .join(' ');
      after.push(el('div', 'ui-note', t('story.reward', { reward })));
    }
    // Картинка — на первой реплике главы и на последней реплике финала.
    const art = kind === 'intro' ? (storyLine === 0 ? chapter.introArt : undefined) : last ? chapter.outroArt : undefined;
    return dialogBox({
      caption: t('story.chapter', { n: state.story.chapter + 1, title: t(chapter.titleKey) }),
      art,
      // Новичку о бабушкином долге — тёплой семейной историей, с улыбкой (firstday.ts warmKey).
      portrait: `portrait_${current.who}${mood ? `_${mood}` : ''}`,
      name: t(speaker.nameKey),
      text: `«${t(key)}»`,
      pitch: VOICE[current.who],
      after,
      nextLabel: t('story.next'),
      onNext: () => {
        if (!last) {
          storyLine++;
          render();
          return;
        }
        storyLine = 0;
        if (kind === 'intro') track('chapter_intro', getState().day, getState().story.chapter + 1);
        // Глава пройдена — награда под заставку «монетка» в тональности музыки.
        const done = kind === 'outro';
        update(done ? finishChapter(getState()) : finishIntro(getState()), done ? 'success' : 'tap', done && music.sting('coin'));
        if (kind === 'intro') onStoryDone?.();
      },
    });
  };

  const eventBox = (state: StoreState, event: MorningEvent) => {
    const box = el('div', 'ui-box');
    const answer = (accept: boolean) => update(answerEvent(getState(), accept), accept ? 'success' : 'tap');
    switch (event.kind) {
      case 'order': {
        const client = CLIENTS[event.client];
        const have = warehouseOf(state, event.product) + onShelves(state, event.product);
        box.append(
          el('h3', '', `🍽 ${t('event.order.title')}`),
          who(CLIENT_PORTRAIT[event.client], el('b', '', t(client.nameKey))),
          el('p', '', `«${t(client.askKey, { qty: event.qty, product: productLabel(event.product), pay: event.pay })}»`),
          el('div', 'ui-muted', `${t('buy.inWarehouse', { n: have })} · ${t('event.order.note')}`),
          button(t('event.order.accept'), () => answer(true)),
          button(t('event.order.decline'), () => answer(false), 'ui-btn secondary'),
        );
        break;
      }
      case 'deal': {
        const free = warehouseCapacity(state) - warehouseCount(state);
        box.append(
          el('h3', '', `💸 ${t('event.deal.title')}`),
          el(
            'p',
            '',
            t('event.deal.text', {
              supplier: t(SUPPLIERS[event.supplier].nameKey),
              qty: event.qty,
              product: productLabel(event.product),
              price: event.price,
            }),
          ),
          el('div', 'ui-muted', t('warehouse.capacity', { n: warehouseCount(state), max: warehouseCapacity(state) })),
          button(t('event.deal.accept'), () => answer(true), 'ui-btn', free <= 0 || state.money < event.price),
          button(t('event.deal.decline'), () => answer(false), 'ui-btn secondary'),
        );
        break;
      }
      case 'fridgeBroken':
        box.append(
          el('h3', '', `🔧 ${t('event.fridge.title')}`),
          el('p', '', t('event.fridge.text', { shelf: t(SHELF_KINDS[state.shelves[event.shelf].kind].nameKey) })),
          button(t('event.fridge.repair', { cost: event.cost }), () => answer(true), 'ui-btn', state.money < event.cost),
          button(t('event.fridge.later'), () => answer(false), 'ui-btn secondary'),
          el('div', 'ui-muted', t('event.fridge.laterNote')),
        );
        break;
      case 'sick': {
        const m = staffOf(state, event.role);
        box.append(
          el('h3', '', `🤒 ${t('event.sick.title')}`),
          el('p', '', t('event.sick.text', { name: m ? memberName(m) : '', role: t(STAFF_ROLES[event.role].nameKey) })),
          button(t('event.ok'), () => answer(true)),
        );
        break;
      }
      case 'priceWar': {
        const running = Boolean(activeAd(state));
        const adCost = adPrice(state, 'banner');
        const reply = (answer: 'match' | 'ad' | 'wait') => update(answerWar(getState(), event, answer), answer === 'wait' ? 'tap' : 'success');
        box.append(
          el('h3', '', `⚔️ ${t('event.war.title')}`),
          who('eduard_angry', el('b', '', t(CHARACTERS.eduard.nameKey))),
          el('p', '', t('event.war.text', { product: productLabel(event.product), price: event.price })),
          el('div', 'ui-muted', t('event.war.note', { n: event.days, mine: state.prices[event.product] })),
          button(t('event.war.match', { price: event.price }), () => reply('match')),
          el('div', 'ui-muted', t('event.war.matchHint')),
          button(running ? t('event.war.adRunning') : t('event.war.ad', { price: adCost }), () => reply('ad'), 'ui-btn', !running && state.money < adCost),
          el('div', 'ui-muted', t('event.war.adHint')),
          button(t('event.war.wait'), () => reply('wait'), 'ui-btn secondary'),
          el('div', 'ui-muted', t('event.war.waitHint')),
        );
        break;
      }
      case 'poach': {
        const m = staffOf(state, event.role);
        const name = m ? memberName(m) : '';
        box.append(
          el('h3', '', `🕴️ ${t('event.poach.title')}`),
          who('eduard_happy', el('b', '', t(CHARACTERS.eduard.nameKey))),
          el('p', '', t('event.poach.text', { name, wage: event.wage })),
          el('div', 'ui-muted', t('event.poach.note', { name, role: t(STAFF_ROLES[event.role].nameKey), now: m?.wage ?? 0 })),
          button(t('event.poach.keep', { wage: event.wage }), () => answer(true)),
          button(t('event.poach.let'), () => answer(false), 'ui-btn secondary'),
        );
        break;
      }
      case 'dayOff':
      case 'goHome': {
        const m = staffOf(state, event.role);
        const name = m ? memberName(m) : '';
        const role = t(STAFF_ROLES[event.role].nameKey);
        const reason = t(`event.${event.kind}.reason${event.reason}` as TextKey);
        box.append(
          el('h3', '', `${event.kind === 'dayOff' ? '🏖' : '🏠'} ${t(`event.${event.kind}.title` as TextKey)}`),
          el('p', '', t(`event.${event.kind}.text` as TextKey, { name, role, reason })),
        );
        if (event.kind === 'dayOff' && m && isTired(m)) box.append(el('div', 'ui-note', t('event.dayOff.tired', { n: m.streak ?? 0 })));
        box.append(
          el('div', 'ui-muted', t('event.personal.note')),
          button(t(`event.${event.kind}.yes` as TextKey), () => answer(true)),
          button(t(`event.${event.kind}.no` as TextKey), () => answer(false), 'ui-btn secondary'),
        );
        break;
      }
      case 'bill':
        box.append(
          el('h3', '', `🧾 ${t(`event.bill.${event.reason}.title` as TextKey)}`),
          el('p', '', t(`event.bill.${event.reason}.text` as TextKey, { n: event.amount })),
          el('div', 'ui-muted', t('event.bill.note', { p: DEBT_PAYMENT })),
          button(t('event.bill.pay', { n: event.amount }), () => answer(true), 'ui-btn', state.money < event.amount),
          button(t('event.bill.debt'), () => answer(false), 'ui-btn secondary'),
        );
        break;
      case 'snitch':
        box.append(
          el('h3', '', `📮 ${t('event.snitch.title')}`),
          who('eduard_angry', el('b', '', t(CHARACTERS.eduard.nameKey))),
          el('p', '', t('event.snitch.text')),
          button(t('event.ok'), () => answer(true)),
        );
        break;
      case 'inspection':
        box.append(
          el('h3', '', `📋 ${t('event.inspection.title')}`),
          el('p', '', t('event.inspection.text')),
          button(t('event.ok'), () => answer(true)),
        );
        break;
    }
    return box;
  };

  // ---------- Персонал ----------

  const quitBox = (quit: StaffMember[]) => {
    const box = el('div', 'ui-box');
    box.append(el('h3', '', `😤 ${t('staffTab.quitTitle')}`));
    for (const m of quit) box.append(el('p', '', t('staffTab.quitText', { name: memberName(m), role: t(STAFF_ROLES[m.role].nameKey) })));
    box.append(button(t('staffTab.ok'), () => update({ ...getState(), quitNotice: undefined })));
    return box;
  };

  const raiseBox = (m: StaffMember) => {
    const box = el('div', 'ui-box');
    box.append(
      el('h3', '', `💬 ${t('staffTab.raiseTitle')}`),
      el(
        'p',
        '',
        t('staffTab.raiseText', {
          name: memberName(m),
          role: t(STAFF_ROLES[m.role].nameKey),
          from: m.wage,
          to: m.raiseAsk ?? m.wage,
        }),
      ),
      el('div', 'ui-muted', `${'★'.repeat(m.skill).padEnd(3, '☆')} · ${t('staffTab.months', { n: m.months })}`),
      button(t('staffTab.raiseYes', { n: m.raiseAsk ?? m.wage }), () => update(answerRaise(getState(), m.role, true), 'success')),
      el('div', 'ui-muted', t('staffTab.raiseYesHint')),
      button(t('staffTab.raiseNo'), () => update(answerRaise(getState(), m.role, false), 'error'), 'ui-btn secondary'),
      el('div', 'ui-muted', t('staffTab.raiseNoHint')),
    );
    return box;
  };

  /** Кассир: сколько покупателей в день пробьёт (с терминалом — быстрее). */
  const isCashier = (m: StaffMember) => isCashierRole(m.role);
  const perDay = (state: StoreState, m: StaffMember) => servePerDay(withUpgrades(state, cashierScan(m)));
  const traitLine = (m: StaffMember) => {
    const stars = '★'.repeat(m.skill).padEnd(3, '☆');
    const trait = m.trait ? ` · ${t(TRAITS[m.trait].nameKey)}: ${t(TRAITS[m.trait].descKey)}` : '';
    const speed = isCashier(m) ? ` · ${t('staffTab.perDay', { n: perDay(getState(), m) })}` : '';
    return `${stars}${speed}${trait}`;
  };

  /** Хозяин: уровень за обслуженных покупателей и навыки, в которые вкладывают очки. */
  /** Хозяин: уровень, навыки рядом значков (нажать — описание и «Изучить»), скорость за кассой. */
  const ownerBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const next = nextLevelXp(state);
    const points = skillPoints(state);
    const lvl = ownerLevel(state.ownerServed);
    const scanNext = ownerNextLevelAt(state.ownerServed);
    const scan = ownerScan(state.ownerServed);
    box.append(
      el('b', '', t('skill.title', { n: ownerLevelOf(state) })),
      el('div', 'ui-item-sub', `${t('staffTab.ownerSkill')} ${'★'.repeat(lvl).padEnd(5, '☆')} · ${t('staffTab.ownerPerDay', { n: servePerDay(withUpgrades(state, ownerTiming(state))) })}`),
      // Первая касса — его: кассиры за остальными, сменщик — за его кассой, пока он в зале (подробности — за «❔»).
      el('div', 'ui-item-sub', t('staffTab.ownerTill')),
      el('div', 'ui-muted', t('staffTab.ownerTillNote')),
      ...(staffOf(state, 'cashier') ? [el('div', 'ui-note', t('staffTab.reliefOn'))] : []),
      el('div', 'ui-muted', next === null ? t('skill.xpMax', { xp: ownerXp(state) }) : t('skill.xp', { xp: ownerXp(state), next })),
      el(
        'div',
        'ui-muted',
        scanNext === null
          ? t('staffTab.ownerSkillMax', { s: scan.item.toFixed(2) })
          : t('staffTab.ownerSkillNext', { n: state.ownerServed, next: scanNext, s: scan.item.toFixed(2) }),
      ),
    );
    if (points) box.append(el('div', 'ui-note', t('skill.points', { n: points })));
    const row = el('div', 'ui-skill-row');
    for (const id of SKILL_IDS) {
      const skill = SKILLS[id];
      const level = skillLevel(state, id);
      row.append(
        button(`${skill.icon}${'●'.repeat(level)}${'○'.repeat(SKILL_MAX - level)}`, () => {
          openSkill = openSkill === id ? null : id;
          render();
        }, `ui-chip ui-skill-chip${openSkill === id ? ' active' : ''}${points && level < SKILL_MAX ? ' hot' : ''}`),
      );
    }
    box.append(row);
    const open = SKILL_IDS.find((id) => id === openSkill);
    if (open) {
      const skill = SKILLS[open];
      const level = skillLevel(state, open);
      const detail = el('div', 'ui-skill-detail');
      detail.append(el('b', '', t(skill.nameKey)), el('div', 'ui-item-sub', t(skill.descKey)));
      if (level < SKILL_MAX) detail.append(button(t('skill.learn'), () => update(learnSkill(getState(), open), 'success'), 'ui-chip', points <= 0));
      box.append(detail);
    }
    return box;
  };

  /** Карьера в карточке сотрудника: с какого дня, опыт и путь до звания, «сотрудник месяца», короткая история. */
  const careerLines = (state: StoreState, m: StaffMember): HTMLElement[] => {
    const c = careerOf(m, state.day);
    const next = nextRank(m);
    const left = xpToNext(m, state.day);
    const out: HTMLElement[] = [el('div', 'ui-item-sub', `${t('career.xp', { n: Math.floor(c.xp) })} · ${t('career.hired', { day: c.hired })}`)];
    if (next && left !== null) out.push(el('div', 'ui-muted', left > 0 ? t('career.next', { rank: t(rankKey(m, next)), n: left }) : t('career.ready')));
    if (c.best) out.push(el('div', 'ui-note', t('career.bestCount', { n: c.best })));
    const log = (c.log ?? []).slice().reverse();
    if (log.length) {
      const list = el('div', 'ui-career-log');
      list.append(el('b', '', t('career.log')), ...log.map((n) => el('div', 'ui-muted', t(`career.log.${n.kind}` as TextKey, { day: n.day }))));
      out.push(list);
    }
    return out;
  };

  /** Сотрудник одной строкой: роль, имя, полоска усталости, метки; действия — по нажатию. */
  const staffRow = (state: StoreState, m: StaffMember): HTMLElement => {
    const box = el('div', 'ui-box ui-staff');
    const streak = m.streak ?? 0;
    const tags: string[] = [];
    if (isAbsent(state, m)) tags.push(t('staffTab.tagOff'));
    else if (isTired(m)) tags.push(t('staffTab.tagTired'));
    if (m.upset) tags.push(t('staffTab.tagUpset'));
    if (isCashier(m) && m.trait === 'slowpoke') tags.push(t('staffTab.tagSlow'));
    const head = button('', () => {
      openStaff = openStaff === m.role ? null : m.role;
      render();
    }, 'ui-staff-head');
    const bar = el('div', 'ui-bar ui-staff-bar');
    const fill = el('div', 'ui-bar-fill');
    const tired = Math.min(1, streak / EXHAUSTED_DAYS);
    fill.style.width = `${Math.round(tired * 100)}%`;
    fill.style.background = tired >= 1 ? '#e43b44' : isTired(m) ? '#feae34' : '#63c74d';
    bar.append(fill);
    const name = el('span', 'ui-staff-name');
    // Звание (game/career.ts) — золотой нашивкой рядом с именем, как на плече в зале.
    const rank = m.career?.rank;
    name.append(
      el('b', '', memberName(m)),
      ...(rank ? [el('span', `ui-rank ui-rank-${rank}`, rank === 'admin' ? '▮▮' : '▮')] : []),
      el('span', 'ui-item-sub', ` · ${rank ? t(rankKey(m, rank)) : t(STAFF_ROLES[m.role].nameKey)} · ${t('staffTab.wage', { n: m.wage })}`),
    );
    head.append(name, bar, ...(tags.length ? [el('span', 'ui-staff-tags', tags.join(' '))] : []));
    box.append(head);
    if (openStaff !== m.role) return box;
    box.append(
      el('div', 'ui-muted', t(STAFF_ROLES[m.role].descKey)),
      el('div', 'ui-item-sub', traitLine(m)),
      el('div', 'ui-item-sub', m.months ? t('staffTab.months', { n: m.months }) : t('staffTab.new')),
      ...careerLines(state, m),
    );
    if (m.upset) box.append(el('div', 'ui-note', t('staffTab.upset')));
    const actions = el('div', 'ui-chips');
    // Люди устают: неделя без выходных — работают медленнее. Выходной можно дать заранее.
    if (isAbsent(state, m)) box.append(el('div', 'ui-note', t('staffTab.offToday')));
    else if (m.offDay === state.day + 1) box.append(el('div', 'ui-note', t(streak >= EXHAUSTED_DAYS ? 'staffTab.exhausted' : 'staffTab.offTomorrow')));
    else {
      box.append(el('div', isTired(m) ? 'ui-note' : 'ui-item-sub', isTired(m) ? t('staffTab.tired', { n: streak }) : t('staffTab.streak', { n: streak })));
      actions.append(button(t('staffTab.giveOff'), () => update(giveDayOff(getState(), m.role)), 'ui-chip'));
    }
    // «Тормоз» за кассой упирает весь магазин в потолок — предупредить и предложить курсы.
    if (isCashier(m) && m.trait === 'slowpoke') {
      const warn = el('div', 'ui-note', t('staffTab.slowWarn', { n: perDay(state, m) }));
      warn.style.color = '#b13e53';
      box.append(warn);
    }
    const cost = trainingCost(m);
    if (cost !== null)
      actions.append(button(m.skill < 3 ? t('staffTab.train', { n: cost }) : t('staffTab.fixSlow', { n: cost }), () => update(train(getState(), m.role), 'success'), 'ui-chip', state.money < cost));
    actions.append(button(t('staffTab.fire'), () => {
      openStaff = null;
      update(fire(getState(), m.role));
    }, 'ui-chip'));
    box.append(actions);
    return box;
  };

  const staffTab = (state: StoreState): HTMLElement[] => {
    const limit = staffLimit(state);
    const out: HTMLElement[] = [
      ownerBox(state),
      helpRow(`👥 ${t('staffTab.count', { n: state.staff.length, max: limit })}`, t('staffTab.wageNote')),
    ];
    if (state.staff.length === 0) out.push(el('div', 'ui-note', t('staffTab.none')));
    for (const m of state.staff) out.push(staffRow(state, m));
    // Карьера: когда следующий «сотрудник месяца», кто на доске почёта, кто правит филиалом.
    if (state.staff.length && state.career?.since !== undefined) out.push(el('div', 'ui-muted', t('career.nextBest', { n: Math.max(1, BEST_EVERY - (state.day - state.career.since)) })));
    const plaques = state.career?.plaques ?? [];
    if (plaques.length) out.push(el('div', 'ui-muted', t('career.board', { names: plaques.slice().reverse().map((p) => memberName({ name: p.name, friend: p.friend ? { name: p.friend } : undefined })).join(', ') })));
    const head = state.branch && state.career?.head;
    if (head) out.push(el('div', 'ui-note', t('career.head', { name: memberName(head), day: head.since, p: Math.round(BRANCH_HEAD_BONUS * 100) })));

    const full = state.staff.length >= limit;
    const hiring: HTMLElement[] = [helpRow(t('staffTab.searchShort', { cost: JOB_AD_COST }), t('staffTab.searchNote', { cost: JOB_AD_COST }))];
    const roles = el('div', 'ui-chips');
    const locked: string[] = [];
    for (const role of STAFF_ROLE_IDS) {
      // Кассир на кассу, которой ещё нет в помещении, — не показываем (сменщик — за кассу хозяина, она
      // есть всегда). Место под следующую кассу уже есть, а саму не поставили — подскажем, где.
      if (isCashierRole(role) && registerOfRole(role) >= registerCount(state)) {
        if (registerOfRole(role) === registerCount(state) && registerOfRole(role) < registerSlots(state)) locked.push(t('staffTab.needsRegister', { role: t(STAFF_ROLES[role].nameKey) }));
        continue;
      }
      // Менеджер — только в большом магазине: пока рано, подскажем, где появится.
      // Сменщик, нанятый ещё в ларьке, работает — замок с подсказкой ему ни к чему.
      if (!roleOpen(state, role) && staffOf(state, role)) continue;
      if (!roleOpen(state, role)) {
        const { minLevel = 0, needs, nameKey } = STAFF_ROLES[role];
        // Пекарь, бариста и повар — когда во флигеле открыты пекарня, кофейня и кухня.
        if (state.level < minLevel) locked.push(t('staffTab.lockedRole', { role: t(nameKey), name: t(STORE_LEVELS[minLevel].nameKey) }));
        else if (needs) locked.push(t(needs === 'oven' ? 'staffTab.needsOven' : needs === 'coffee' ? 'staffTab.needsCoffee' : 'staffTab.needsKitchen', { role: t(nameKey) }));
        continue;
      }
      const searched = state.jobSearch?.day === state.day && state.jobSearch.role === role;
      roles.append(
        button(
          t(STAFF_ROLES[role].nameKey),
          () => update(startJobSearch(getState(), role)),
          `ui-chip${searched ? ' active' : ''}`,
          Boolean(staffOf(state, role)) || full || (!searched && state.money < JOB_AD_COST)
        ),
      );
    }
    hiring.push(roles, ...locked.map((line) => el('div', 'ui-muted', `🔒 ${line}`)));
    out.push(foldBox('hire', `➕ ${t('staffTab.search')}`, (body) => body.append(...hiring)));

    // Друзья из Telegram (кто играет и связан приглашениями) — тоже кандидаты: опытнее и дешевле.
    const friendsOpen = state.jobSearch?.day === state.day ? friendCandidates(state, state.jobSearch.role, visitsInfo()?.friends ?? []) : [];
    const candidates = [...friendsOpen, ...currentCandidates(state)];
    if (state.jobSearch?.day === state.day) {
      out.push(el('h3', '', t('staffTab.candidates', { role: t(STAFF_ROLES[state.jobSearch.role].nameKey) })));
      if (candidates.length === 0) out.push(el('div', 'ui-note', t('staffTab.noCandidates')));
      if (!friendsOpen.length && !friendCandidates(state, state.jobSearch.role, visitsInfo()?.friends ?? []).length) out.push(el('div', 'ui-muted', t('staffTab.noFriends')));
    }
    for (const c of candidates) {
      const box = el('div', 'ui-box');
      const head = el('div', 'ui-row');
      const taken = Boolean(staffOf(state, c.role));
      head.append(
        el('b', '', memberName(c)),
        button(
          taken ? t('staffTab.roleTaken') : full ? t('staffTab.full') : t('staffTab.hire'),
          () => update(hire(getState(), c), 'success'),
          'ui-chip',
          taken || full,
        ),
      );
      box.append(head, el('div', 'ui-muted', c.friend ? t('staffTab.friend') : traitLine(c)), el('div', '', t('staffTab.wage', { n: c.wage })));
      out.push(box);
    }
    return out;
  };

  // ---------- Магазин: помещение, кредит, счета ----------

  /** Строка под заголовком: когда счета и сколько примерно. */
  const billForecast = (state: StoreState) => {
    const daysLeft = daysUntilBill(state.day);
    const sum = billTotal(monthlyBill(state));
    const text = daysLeft === 0 ? t('morning.billsTonight', { sum }) : t('morning.bills', { n: daysLeft, sum });
    const line = el('div', 'ui-muted', text);
    if (daysLeft <= 1 && state.money < sum) line.style.color = '#b13e53';
    return line;
  };

  // ---------- Магазин: помещение, долг, расходы ----------

  /** «Поддержать автора» (ui/support.ts): скромная строчка среди настроек профиля. */
  const supportBox = () => {
    const box = el('div', 'ui-box');
    box.append(button(t('support.open'), () => showSupport(getState, update), 'ui-btn secondary'));
    return box;
  };

  /** Профиль (кнопка 🏆 в заголовке): достижения, звание, наследие, друзья, альбом, настройки. */
  const profileTab = (state: StoreState): HTMLElement[] => {
    const replay = el('div', 'ui-box');
    replay.append(
      helpRow(t('tour.replayTitle'), t('tour.replayNote')),
      // Заново — пошаговое обучение: закупка, открытие, касса, полка и «Зал» (game/tutorial.ts).
      button(`👵 ${t('tour.replay')}`, () => {
        tab = 'buy';
        scrolledLesson = '';
        track('tut_replay', getState().day);
        update(tutReplay(getState()));
      }, 'ui-btn secondary'),
    );
    // В самом низу — начать игру заново (с подтверждением).
    const again = el('div', 'ui-box');
    again.append(
      helpRow(t('restart.button'), t('restart.note')),
      button(`🔄 ${t('restart.button')}`, () => {
        confirmRestart = true;
        render();
      }, 'ui-btn secondary'),
    );
    // Графика: обычная или лёгкая (для слабых телефонов). Холст меняется со следующего запуска.
    const gfx = el('div', 'ui-box');
    const lite = liteMode();
    const chips = el('div', 'ui-chips');
    for (const on of [false, true])
      chips.append(
        button(t(on ? 'lite.on' : 'lite.off'), () => {
          setLiteMode(on);
          render();
        }, `ui-chip${lite === on ? ' active' : ''}`),
      );
    gfx.append(el('b', '', `🖥 ${t('lite.title')}`), el('div', 'ui-muted', t('lite.note')), chips);
    // Звук: быстрое «без звука» и ползунки громкости по каналам (ui/audio.ts).
    const sounds = audioBox(() => getState().day, render);
    // Своё название магазина — на вывеске на крыше.
    const named = el('div', 'ui-box');
    const input = el('input', 'ui-input');
    input.maxLength = SHOP_NAME_MAX;
    input.placeholder = t(STORE_LEVELS[state.level].nameKey);
    input.value = state.shopName ?? '';
    named.append(
      el('b', '', `🪧 ${t('shopName.title')}`),
      input,
      button(t('shopName.save'), () => update({ ...getState(), shopName: input.value.trim().slice(0, SHOP_NAME_MAX) || undefined }, 'success'), 'ui-chip'),
    );
    // В новом начале обход вкладок не показывают сразу — первую неделю он повыше, на виду.
    const early = state.onboarding === 'play' && state.day <= 7;
    return [
      achievementsButton(state),
      albumBox(state),
      ...(early ? [replay] : []),
      ...friendsBox(),
      named,
      sounds,
      gfx,
      supportBox(),
      rankBox(state),
      ...legacyBox(state),
      ...inviteBox(),
      ...guildBox(state),
      ...trophiesBox(state),
      recordsBox(state),
      ...keepsakeBox(state),
      ...(early ? [] : [replay]),
      again,
    ];
  };

  /**
   * Филиал в здании «Гиганта» (branch.ts). Пока закрыт — чего не хватает (победить «Гигант», стать
   * универмагом); виден, только когда «Гигант» уже в истории магазина. После
   * покупки — вчерашний и недельный доход и четыре направления улучшений с ценой и прибавкой.
   */
  const branchBox = (state: StoreState): HTMLElement[] => {
    const lock = branchLock(state);
    const branch = branchOf(state);
    // До «Гиганта» о здании за дорогой молчим: там ещё сквер, рано раскрывать сюжет.
    if (!branch && !state.giant) return [];
    const box = el('div', 'ui-box');
    const name = branchSignName(state, t('branch.defaultName'));
    box.append(el('b', '', `🏬 ${t('branch.title')}`));
    const art = el('img');
    // После переезда в гипермаркет филиал — в старом магазине через дорогу.
    art.src = sheetPng(branchInOldShop(state) ? 'branch_old' : 'giant_branch');
    art.alt = '';
    art.style.cssText = `display: block; width: 100%; max-width: 300px; margin: 6px auto; image-rendering: pixelated;${branch ? '' : ' filter: grayscale(0.8) opacity(0.75);'}`;
    if (!branch) {
      if (lock) {
        box.append(art, el('div', 'ui-muted', `🔒 ${t(lock === 'giant' ? 'branch.lock.giant' : 'branch.lock.level')}`));
        return [box];
      }
      box.append(art, el('div', '', t('branch.offer', { name })), el('div', 'ui-muted', t('branch.preview', { n: Math.round(branchUsual({ ...state, branch: { since: state.day } })) })));
      if (state.debt > 0) box.append(el('div', 'ui-note', t('branch.needNoDebt')));
      box.append(
        button(
          t('branch.buy', { n: BRANCH_PRICE }),
          () => {
            const bought = buyBranch(getState());
            if (!bought) return;
            track('branch', bought.day, BRANCH_PRICE);
            toast('assets/ico_shop.png', t('branch.bought'), t('branch.boughtText', { name }));
            update(bought, 'success');
          },
          'ui-btn',
          state.debt > 0 || state.money < BRANCH_PRICE,
        ),
      );
      return [box];
    }
    box.append(art, el('div', 'ui-item-name', t('branch.name', { name })));
    if (branchInOldShop(state)) box.append(el('div', 'ui-muted', t('branch.oldShop')));
    if (branch.last) box.append(el('div', '', t('branch.last', { n: branch.last.income })));
    box.append(
      el('div', 'ui-muted', t('branch.week', { n: branchWeek(state), total: branch.earned ?? 0 })),
      el('div', 'ui-muted', t('branch.usual', { n: branchUsual(state), p: Math.round(branchShare(state) * 100) })),
      el('div', 'ui-muted', t('branch.note')),
      ...(state.career?.head ? [el('div', 'ui-note', t('career.head', { name: memberName(state.career.head), day: state.career.head.since, p: Math.round(BRANCH_HEAD_BONUS * 100) }))] : []),
    );
    for (const id of BRANCH_TRACK_IDS) {
      const info = BRANCH_TRACKS[id];
      const tier = branchTier(state, id);
      const next = nextBranchTier(state, id);
      const row = el('div', 'ui-item');
      row.append(el('div', 'ui-ad-icon', info.icon));
      const body = el('div');
      const title = el('div', 'ui-item-name', t(info.nameKey));
      const actions = el('div', 'ui-item-actions');
      // Ступени — точками: сколько сделано из скольких.
      title.append(el('span', 'ui-tag', '●'.repeat(tier) + '○'.repeat(info.tiers.length - tier)));
      if (!next) {
        body.append(title, el('div', 'ui-item-sub', t('branch.done', { name: t(info.tiers[tier - 1].nameKey) })));
        actions.append(el('span', 'ui-tag', t('branch.max')));
      } else {
        body.append(
          title,
          el('div', 'ui-item-sub', t('branch.step', { name: t(next.nameKey), n: tier + 1, of: info.tiers.length })),
          el('div', 'ui-item-sub', t('branch.gain', { n: branchGain(state, id) })),
        );
        actions.append(button(`${next.price} 💰`, () => update(upgradeBranch(getState(), id), 'success'), 'ui-chip', state.money < next.price));
      }
      row.append(body, actions);
      box.append(row);
    }
    return [box];
  };

  /** Развитие: помещение и расширение, кассы, оборудование, реклама, оформление, банк, счета. */
  const growTab = (state: StoreState): HTMLElement[] => {
    const level = storeLevel(state);
    const next = nextStoreLevel(state);
    const out: HTMLElement[] = [];

    const current = el('div', 'ui-box');
    current.append(
      el('b', '', t('store.current', { name: t(level.nameKey) })),
      el('div', 'ui-muted', t('store.stats', { slots: level.slots, wh: level.warehouse, r: registerCount(state), g: level.guests })),
    );
    const reviews = state.reviews?.length ? [button(t('review.title'), () => showReviews(getState().reviews), 'ui-btn secondary')] : [];
    out.push(current, button(t('report.button'), () => showReport(getState()), 'ui-btn secondary'), ...reviews);

    // Карточка «Одному не справиться» — в первый раз, когда игрок без персонала смотрит на расширение
    // в четвёртое помещение и дальше (утром она появилась бы только с 20-го дня). Уже висит сверху утра —
    // второй раз не повторяем.
    if (soloExpandRisk(state) && !state.seenTips?.includes('alone') && pendingTip(state) !== 'alone') {
      const tip = el('div', 'ui-box ui-tip');
      tip.append(
        el('b', '', `${TIP_ICONS.alone} ${t('tip.alone.title')}`),
        el('div', '', t('tip.alone.text')),
        button(t('tip.ok'), () => update(seeTip(getState(), 'alone')), 'ui-chip'),
      );
      out.push(tip);
    }

    const grow = el('div', 'ui-box');
    // Переезд в гипермаркет — своя карточка: здание «Гиганта» и что станет со старым магазином.
    const hyper = state.level + 1 === HYPER_LEVEL;
    const hyperArt = (locked: boolean) => {
      const img = el('img');
      img.src = sheetPng('giant_branch');
      img.alt = '';
      img.style.cssText = `display: block; width: 100%; max-width: 300px; margin: 6px auto; image-rendering: pixelated;${locked ? ' filter: grayscale(0.8) opacity(0.75);' : ''}`;
      return img;
    };
    if (!next && hyper && state.giant) {
      // Закрыт до филиала; до «Гиганта» о здании за дорогой молчим, как и в «Филиале».
      // «Гигант» ещё не побеждён — сначала он (как и у «Филиала»), потом филиал, потом переезд.
      const lock = state.giant.phase !== 'won' ? 'giant' : hyperLock(state);
      grow.append(el('b', '', `🏬 ${t('hyper.title')}`), hyperArt(true), el('div', '', `🔒 ${t(lock === 'giant' ? 'hyper.lock.giant' : 'hyper.lock.branch')}`));
    } else if (!next) {
      grow.append(el('div', 'ui-muted', t('store.max')));
    } else {
      if (hyper) {
        grow.append(
          el('b', '', `🏬 ${t('hyper.title')}`),
          hyperArt(false),
          el('div', '', t('hyper.offer', { slots: next.slots, wh: next.warehouse, g: next.guests, rent: next.rent })),
          // Не в «?»: что станет со старым магазином — главное в этой карточке.
          el('div', '', t('hyper.branch', { name: branchSignName(state, t('branch.defaultName')) })),
        );
      } else {
        grow.append(
          el('b', '', t('store.next', { name: t(next.nameKey) })),
          el('div', 'ui-muted', t('store.nextStats', { slots: next.slots, wh: next.warehouse, r: nextRegisterCount(state) ?? registerSlots(state), g: next.guests, rent: next.rent })),
        );
      }
      if (state.debt > 0) grow.append(el('div', 'ui-note', t('store.needNoDebt')));
      // Без персонала дальше третьего помещения — в убыток: сказать прямо, у самой кнопки.
      if (soloExpandRisk(state)) {
        const solo = el('div', 'ui-note', t('store.soloWarn'));
        solo.style.color = '#b13e53';
        grow.append(solo);
      }
      // После стройки может не хватить на ближайшие счета — предупредить заранее. Первый счёт после
      // переезда — по старой аренде («новоселье», economy.ts), свет и холодильники — уже новые.
      const billAfter = billTotal(monthlyBill({ ...state, level: state.level + 1, movedFrom: state.movedFrom ?? state.level }));
      if (state.debt === 0 && state.money >= next.cost && state.money - next.cost < billAfter) {
        const warn = el('div', 'ui-note', t('store.billWarn', { left: state.money - next.cost, bill: billAfter, n: daysUntilBill(state.day) }));
        warn.style.color = '#b13e53';
        grow.append(warn);
      }
      grow.append(
        button(
          t(hyper ? 'hyper.move' : 'store.expand', { cost: next.cost }),
          () => {
            const grown = expandStore(getState());
            if (grown) track('level_up', grown.day, grown.level);
            update(grown, 'success');
          },
          'ui-btn secondary',
          state.debt > 0 || next.cost > state.money,
        ),
      );
    }
    out.push(grow, registersBox(state), kiosksBox(state), gearBox(state), adsBox(state), decorBox(state), ...eduardBox(state), ...branchBox(state), ...hoodBox(state, getState, update), bankBox(state));

    const debt = el('div', 'ui-box');
    if (state.debt > 0) {
      debt.append(
        el('b', '', t('debt.title', { n: state.debt })),
        el('div', 'ui-muted', t('debt.note', { p: DEBT_PAYMENT })),
        el('div', 'ui-muted', t('debt.limit', { n: debtLimit(state) })),
      );
      const chips = el('div', 'ui-chips');
      for (const amount of [100, state.debt]) {
        if (amount === 100 && state.debt <= 100) continue;
        chips.append(
          button(t('debt.pay', { n: amount }), () => update(payDebt(getState(), amount), 'success'), 'ui-chip', state.money < amount),
        );
      }
      debt.append(chips);
    } else {
      debt.append(el('b', '', t('debt.none')));
    }
    out.push(debt);

    const bill = monthlyBill(state);
    const daysLeft = daysUntilBill(state.day);
    const costs = el('div', 'ui-box');
    costs.append(
      el('b', '', t('bills.title')),
      el(
        'div',
        'ui-muted',
        daysLeft === 0 ? t('bills.tonight', { m: monthOf(state.day) }) : t('bills.when', { m: monthOf(state.day), n: daysLeft }),
      ),
    );
    const row = (label: string, value: number | string) => {
      const r = el('div', 'ui-row');
      r.append(el('span', '', label), el('span', '', typeof value === 'number' ? `${value} 💰` : value));
      costs.append(r);
    };
    if (bill.housewarming) costs.append(el('div', 'ui-note', t('bills.housewarming')));
    row(t('bills.rent'), bill.rent);
    row(t('bills.utilities'), bill.utilities);
    row(t('bills.power'), bill.power);
    row(t('bills.salaries'), state.staff.length ? bill.salaries : t('bills.noStaff'));
    if (bill.debt) row(t('bills.debt'), bill.debt);
    if (bill.loan) row(t('bills.loan'), bill.loan);
    row(t('bills.total'), billTotal(bill));
    out.push(costs);
    return out;
  };

  // ---------- Цены ----------

  /** Карточки цен: открытые товары — с ценой и полоской спроса, закрытые — серые, с подсказкой, как открыть. */
  const pricesTab = (state: StoreState): HTMLElement[] => {
    const sellable = sellableProducts(state);
    // Сначала то, что сейчас продаётся; закрытые товары — внизу.
    const order = [...PRODUCT_IDS.filter((pid) => sellable.includes(pid)), ...PRODUCT_IDS.filter((pid) => !sellable.includes(pid))];
    return order.map((pid) => {
      const product = PRODUCTS[pid];
      const card = el('div', 'ui-price');
      const icon = el('img', 'ui-price-icon');
      icon.src = sheetPng(`item_${pid}`);
      icon.alt = '';
      const info = el('div', 'ui-price-info');
      info.append(el('b', '', t(product.nameKey)));
      if (!sellable.includes(pid)) {
        card.classList.add('ui-price-locked');
        // Сезонный товар вне сезона — «только летом», иначе — какая полка нужна.
        const why = !ownProductOpen(state, pid)
          ? t('prices.brand')
          : productAvailable(pid, state.day)
            ? t('prices.locked', { shelf: t(SHELF_KINDS[product.category].nameKey) })
            : `${t(`goods.${pid}` as TextKey)} · ${t('goods.in', { n: daysUntilSeason(pid, state.day) })}`;
        info.append(el('div', 'ui-muted', `🔒 ${why}`));
        card.append(icon, info);
        return card;
      }
      const price = state.prices[pid];
      const demand = buyChance(price, product.basePrice);
      const bar = el('div', 'ui-bar');
      const fill = el('div', 'ui-bar-fill');
      fill.style.width = `${Math.min(100, Math.round(demand * 80))}%`;
      fill.style.background = demand >= 0.7 ? '#63c74d' : demand >= 0.4 ? '#feae34' : '#e43b44';
      bar.append(fill);
      info.append(
        bar,
        el('div', 'ui-muted', t('prices.line', { p: Math.round(demand * 100), n: product.basePrice, m: price - product.cost })),
      );
      // Акция дня: −20% или «2 по цене 1» (одна на день; повторное нажатие отменяет).
      const promo = activePromo(state);
      const promoRow = el('div', 'ui-chips ui-promo');
      for (const kind of ['discount', 'bogo'] as PromoKind[]) {
        const on = promo?.product === pid && promo.kind === kind;
        // «2 по цене 1» в убыток (пара дешевле двух закупок) не предлагаем; уже поставленную можно снять.
        if (kind === 'bogo' && !on && price < 2 * product.cost) continue;
        promoRow.append(button(`🏷 ${t(`promo.${kind}` as TextKey)}`, () => update(setPromo(getState(), pid, kind)), `ui-chip${on ? ' active' : ''}`));
      }
      info.append(promoRow);
      const change = (delta: number) => () => update(setPrice(getState(), pid, getState().prices[pid] + delta));
      const chips = el('div', 'ui-chips');
      chips.append(button('−', change(-PRICE_STEP), 'ui-chip'), el('b', 'ui-price-value', `${price} 💰`), button('+', change(PRICE_STEP), 'ui-chip'));
      card.append(icon, info, chips);
      return card;
    });
  };

  render();
}
