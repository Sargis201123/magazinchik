import { rhythmSeconds, beltPlan } from '../src/game/tillRhythm';
import { checkoutSeconds } from '../src/game/economy';
for (const item of [1.3, 1.0, 0.85, 0.72, 0.6, 0.48, 0.4, 0.3, 0.2]) {
  const t = { item, pay: item * 0.7 };
  const rows = [1, 1.4, 2, 3, 4].map((n) => `${n}: ${(rhythmSeconds(t, n) / checkoutSeconds(t, n)).toFixed(2)}/${(rhythmSeconds(t, n, 1) / checkoutSeconds(t, n)).toFixed(2)}`);
  console.log(item, JSON.stringify(beltPlan(t, 1.4)), rows.join(' | '));
}
