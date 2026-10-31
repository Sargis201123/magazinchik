// Кто поддержал автора (src/game/support.ts): для золотой таблички с именем в рейтинге (stats.ts).
// Источник правды — платежи самого бота в Telegram (ownedFrom): таблица лишь помнит итог, чтобы
// рейтинг не перебирал все платежи. Обновляется после оплаты (вебхук), при каждом восстановлении
// покупок (stars-owned) и после возврата звёзд (stars-refund) — возврат снимает табличку.
// Без базы D1 просто ничего не делает.

import { ready } from './social.js';
import { supportStars, type D1 } from './telegram.js';

/** Записать, сколько звёзд игрок сейчас дал на поддержку (0 — убрать). Пишем, только если поменялось. */
export async function syncSupporter(db: D1 | undefined, id: number, owned: string[], now = Date.now()): Promise<void> {
  if (!db) return;
  await ready(db);
  const stars = supportStars(owned);
  const row = await db.prepare('SELECT stars FROM supporters WHERE id = ?').bind(id).first<{ stars: number }>();
  if ((row?.stars ?? 0) === stars) return;
  if (stars) await db.prepare('INSERT OR REPLACE INTO supporters (id, stars, updated) VALUES (?, ?, ?)').bind(id, stars, now).run();
  else await db.prepare('DELETE FROM supporters WHERE id = ?').bind(id).run();
}

/** Только что оплатили поддержку (вебхук): поднять ступень, если она щедрее записанной. */
export async function addSupporter(db: D1 | undefined, id: number, stars: number, now = Date.now()): Promise<void> {
  if (!db || !stars) return;
  await ready(db);
  await db
    .prepare('INSERT INTO supporters (id, stars, updated) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET stars = MAX(stars, ?2), updated = ?3')
    .bind(id, stars, now)
    .run();
}
