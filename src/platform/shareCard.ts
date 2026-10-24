// Карточка итогов дня для сторис: картинка 1080×1920 — снимок магазина, выручка, гости, рейтинг
// и ссылка «сыграй со мной». Сервер (api/_lib/card.ts) хранит её по ссылке: Telegram берёт её
// для истории; где истории недоступны (компьютер) — окно «Поделиться» с карточкой и кнопкой
// «Играть», а в старом Telegram бот присылает карточку в чат, чтобы переслать друзьям.

import { getLang, t } from '../i18n';
import { inviteLink, post } from './social';
import { canShareMessage, canShareStory, shareMessage, shareStory, telegramInitData } from './telegram';

export interface CardData {
  day: number;
  /** Название помещения: «Ларёк» … «Универмаг». */
  shop: string;
  revenue: number;
  week: number;
  served: number;
  rating: number;
}

const W = 1080;
const H = 1920;
const FONT = '"Nunito Variable", "Nunito", system-ui, sans-serif';
const fmt = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Нарисовать карточку (shot — снимок магазина перед закрытием, если есть). */
export function drawCard(data: CardData, shot: CanvasImageSource | null, link: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2b2340');
  bg.addColorStop(1, '#141019');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Полосатый навес, как над входом в магазин.
  for (let x = 0; x < W; x += 90) {
    g.fillStyle = (x / 90) % 2 ? '#f4efe0' : '#e43b44';
    g.fillRect(x, 0, 90, 70);
  }
  g.textAlign = 'center';
  g.fillStyle = '#feae34';
  g.font = `900 112px ${FONT}`;
  g.fillText(t('title.name'), W / 2, 220);
  g.fillStyle = '#f4efe0';
  g.font = `700 52px ${FONT}`;
  g.fillText(t('share.card.sub', { shop: data.shop, n: data.day }), W / 2, 300);
  // Снимок магазина: середина кадра, где зал.
  const box = { x: 60, y: 360, w: W - 120, h: 860 };
  roundRect(g, box.x - 8, box.y - 8, box.w + 16, box.h + 16, 36);
  g.fillStyle = '#feae34';
  g.fill();
  g.save();
  roundRect(g, box.x, box.y, box.w, box.h, 30);
  g.clip();
  g.fillStyle = '#3a4a2e';
  g.fillRect(box.x, box.y, box.w, box.h);
  if (shot) {
    const sw = (shot as HTMLImageElement).width;
    const sh = (shot as HTMLImageElement).height;
    const scale = Math.max(box.w / sw, box.h / sh);
    const cw = box.w / scale;
    const ch = box.h / scale;
    g.imageSmoothingEnabled = false;
    g.drawImage(shot, (sw - cw) / 2, Math.max(0, sh * 0.42 - ch / 2), cw, ch, box.x, box.y, box.w, box.h);
  }
  g.restore();
  // Плитки с цифрами.
  const tiles: [string, string][] = [
    [`💰 ${fmt(data.revenue)}`, t('share.card.revenue')],
    [`📈 ${fmt(data.week)}`, t('share.card.week')],
    [`🙂 ${fmt(data.served)}`, t('share.card.served')],
    [`★ ${data.rating.toFixed(1)}`, t('share.card.rating')],
  ];
  tiles.forEach(([value, label], i) => {
    const x = 60 + (i % 2) * 490;
    const y = 1270 + Math.floor(i / 2) * 230;
    roundRect(g, x, y, 470, 200, 28);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `900 76px ${FONT}`;
    g.fillText(value, x + 235, y + 100);
    g.fillStyle = '#c0b8d0';
    g.font = `700 38px ${FONT}`;
    g.fillText(label, x + 235, y + 160);
  });
  g.fillStyle = '#feae34';
  g.font = `800 46px ${FONT}`;
  g.fillText(t('share.card.call'), W / 2, 1800);
  if (link) {
    g.fillStyle = '#c0b8d0';
    g.font = `700 36px ${FONT}`;
    g.fillText(link.replace('https://', ''), W / 2, 1860);
  }
  return canvas;
}

/** JPEG в base64 (без «data:…»), не больше лимита сервера. */
function toBase64(canvas: HTMLCanvasElement): string {
  for (const q of [0.85, 0.72, 0.6, 0.45]) {
    const data = canvas.toDataURL('image/jpeg', q).split(',')[1] ?? '';
    if (data.length < 900_000) return data;
  }
  return '';
}

export type ShareResult = 'story' | 'message' | 'cancelled' | 'chat' | 'download' | 'failed';

/**
 * Поделиться итогами: история Telegram; без историй — окно «Поделиться» с карточкой, а если и его
 * нет — карточка в чат с ботом; вне Telegram — скачать.
 */
export async function shareDay(data: CardData, shot: CanvasImageSource | null): Promise<ShareResult> {
  await document.fonts?.ready;
  const link = inviteLink();
  const canvas = drawCard(data, shot, link);
  const initData = telegramInitData();
  if (!initData) {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.9);
    a.download = `magazinchik-day-${data.day}.jpg`;
    a.click();
    return 'download';
  }
  const image = toBase64(canvas);
  if (!image) return 'failed';
  const text = t('share.story', { link });
  const story = canShareStory();
  // Окно «Поделиться» готовит сервер; не выйдет у него — сам пришлёт карточку в чат (send).
  const share = !story && canShareMessage();
  const res = await post<{ url?: string; sent?: boolean; prepared?: string }>('/api/card', {
    initData,
    image,
    ...(story ? {} : { send: true, caption: text }),
    ...(share ? { share: true, lang: getLang() } : {}),
  });
  if (!res?.url) return 'failed';
  if (story && shareStory(res.url, text.slice(0, 200))) return 'story';
  if (res.prepared) return (await shareMessage(res.prepared)) ? 'message' : 'cancelled';
  return res.sent ? 'chat' : 'failed';
}
