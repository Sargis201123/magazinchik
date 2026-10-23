// Ритм кадров: какие кадры экрана (метки requestAnimationFrame) пропускать, чтобы игра шла не чаще
// заданной частоты. Без внешних зависимостей — проверяется тестами (tests/pacing.test.ts).

/** Экран чаще ~77 Гц (90, 120, 144) — там игра рисует не больше 60 кадров. */
export const FAST_SCREEN_MS = 13;

export class Pacer {
  /** «Идеальный» момент последнего кадра игры: по нему держится ритм. */
  private last = -Infinity;
  private prev = -Infinity;
  /** Последние промежутки между кадрами экрана — по ним видно его частоту. */
  private gaps: number[] = [];
  /** Промежуток между кадрами экрана (медиана), мс. */
  screenMs = 1000 / 60;

  /**
   * Пора ли рисовать кадр игры в момент now (метка rAF), если кадры игры должны идти через interval мс
   * (0 — каждый кадр экрана). Берём кадр экрана, ближайший к очередному «идеальному» моменту (допуск —
   * полкадра экрана), а сам ритм ведём по идеальным моментам: на 120 Гц выходит ровно каждый второй
   * кадр, на 90 Гц — два из трёх, и в среднем ровно 60, как бы ни дрожали метки rAF.
   */
  step(now: number, interval: number): boolean {
    this.measure(now);
    if (interval <= 0) {
      this.last = now;
      return true;
    }
    const next = this.last + interval;
    if (now < next - this.screenMs / 2) return false;
    // Отстали больше чем на кадр (тормоз, вкладка спала) — ритм заново, без «догоняющей» пачки кадров.
    this.last = now - next > interval ? now : next;
    return true;
  }

  private measure(now: number): void {
    const gap = now - this.prev;
    this.prev = now;
    if (!(gap > 0 && gap < 250)) return;
    this.gaps.push(gap);
    if (this.gaps.length < 31) return;
    this.screenMs = [...this.gaps].sort((a, b) => a - b)[15];
    this.gaps = [];
  }
}
