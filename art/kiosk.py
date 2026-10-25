"""Кассы самообслуживания у правой стены (src/game/lanes.ts, KIOSK_TIERS) — три модели, вид спереди сверху:

  kiosk   30×44 — простой киоск: стойка, сенсорный экран, окошко сканера, картридер;
  kiosk1  30×44 — со сканером: стеклянный стол сканера с красным крестом, лампа-маячок на штанге,
                  принтер чеков, площадка для пакета сбоку;
  kiosk2  30×44 — с весами и камерой: экран побольше, купол камеры над маячком, весы с пакетом,
                  оранжевая полоса бренда.

Экран у всех моделей на одном месте (x 7…22, y 6…15) — игра зажигает над ним подсветку при пробивке
(StoreScene, KIOSK_SCREEN). Детализация двойная, как у всех спрайтов (sprites.py, DETAIL).

    python3 art/kiosk.py
"""

from premium import H, lit
from sprites import Canvas, shadowed

BODY = H("#dfe6ef")
BODY_HI = H("#ffffff")
BODY_LO = H("#a9b6c9")
BODY_DK = H("#5a6988")
BEZEL = H("#262b44")
SCREEN = H("#124e89")
SCREEN_HI = H("#0099db")
GLOW = H("#2ce8f5")
GO = H("#63c74d")
RED = H("#e43b44")
STEEL = H("#c0cbdc")
GLASS = H("#3a4466")
TEAL = H("#2ce8f5")
ORANGE = H("#f77622")
PAPER = H("#ead4aa")
PAPER_LO = H("#c28569")


def screen(c, x, y, w, h, big=False):
    """Сенсорный экран: рамка, синий фон с бликом, «шапка», строки списка и зелёная кнопка «Оплатить»."""
    c.round_rect(x - 1, y - 1, w + 2, h + 2, BEZEL, r=1)
    c.rect(x, y, w, h, SCREEN)
    c.hline(x, y, w, SCREEN_HI)
    c.rect(x + 1, y + 1, w - 2, 1, lit(SCREEN_HI, 0.3))
    for i, n in enumerate((w - 6, w - 8, w - 5) if big else (w - 6, w - 8)):
        c.hline(x + 2, y + 3 + 2 * i, n, lit(SCREEN, 0.45))
        c.px(x + w - 3, y + 3 + 2 * i, GLOW)
    c.rect(x + w - 7, y + h - 3, 5, 2, GO)
    c.hline(x + w - 7, y + h - 3, 5, lit(GO, 0.4))
    # Блик по стеклу наискосок.
    c.px(x + 1, y + h - 2, lit(SCREEN, 0.25))
    c.px(x + 2, y + h - 3, lit(SCREEN, 0.25))


def body(c, accent=None):
    """Стойка: светлый корпус с объёмом (свет слева), тёмный цоколь, полоса цвета модели."""
    c.round_rect(5, 4, 20, 36, BODY, r=2)
    c.vline(6, 5, 34, BODY_HI)
    c.vline(23, 5, 34, BODY_LO)
    c.vline(24, 6, 32, BODY_DK)
    # Цоколь.
    c.rect(4, 38, 22, 4, BEZEL)
    c.hline(5, 38, 20, BODY_DK)
    if accent:
        c.rect(7, 35, 16, 2, accent)
        c.hline(7, 35, 16, lit(accent, 0.35))


def scanner_window(c):
    """Окошко сканера на передней панели: тёмное стекло и красная полоса луча."""
    c.rect(8, 22, 14, 6, BODY_DK)
    c.rect(9, 23, 12, 4, GLASS)
    c.hline(9, 25, 12, RED)
    c.px(14, 24, lit(RED, 0.4))


def card_reader(c, x, y):
    c.rect(x, y, 4, 5, BEZEL)
    c.hline(x, y, 4, BODY_DK)
    c.px(x + 1, y + 1, GO)
    c.hline(x + 1, y + 3, 2, GLASS)


def kiosk0():
    c = Canvas(30, 44)
    body(c)
    screen(c, 7, 6, 16, 10)
    scanner_window(c)
    card_reader(c, 17, 29)
    # Решётка динамика и щель для монет.
    for x in (9, 11, 13):
        c.px(x, 30, BODY_LO)
        c.px(x, 32, BODY_LO)
    c.outline("k")
    return c


def pole(c, light):
    """Штанга с маячком над экраном: зелёный — свободно (игра рисует подсветку экрана отдельно)."""
    c.vline(21, 0, 5, BODY_DK)
    c.rect(20, 0, 3, 2, light)
    c.px(20, 0, lit(light, 0.5))


def glass_scanner(c):
    """Стеклянный стол сканера, выдвинутый вперёд: блестящая рамка, стекло и красный крест лучей."""
    c.rect(6, 20, 18, 7, STEEL)
    c.hline(6, 20, 18, BODY_HI)
    c.rect(8, 21, 14, 5, GLASS)
    c.hline(8, 23, 14, RED)
    c.vline(15, 21, 5, RED)
    c.px(15, 23, lit(RED, 0.6))
    c.hline(6, 26, 18, BODY_DK)


def bag_shelf(c, scale=False):
    """Площадка для пакета справа: стальная полочка, на весах — с табло; на ней бумажный пакет."""
    c.rect(24, 22, 5, 3, STEEL if not scale else BODY_LO)
    c.hline(24, 22, 5, BODY_HI)
    # Кронштейн к корпусу.
    c.px(24, 25, BODY_DK)
    c.px(25, 25, BODY_DK)
    c.px(24, 26, BODY_DK)
    # Пакет.
    c.rect(24, 16, 5, 6, PAPER)
    c.vline(28, 16, 6, PAPER_LO)
    c.hline(24, 16, 5, lit(PAPER, 0.3))
    c.px(25, 15, PAPER_LO)
    c.px(27, 15, PAPER_LO)
    if scale:
        # Табло весов на торце площадки.
        c.hline(26, 23, 2, GO)


def receipt(c):
    """Принтер чеков: щель и высунувшийся чек."""
    c.rect(9, 29, 7, 2, BEZEL)
    c.rect(11, 31, 3, 3, BODY_HI)
    c.px(12, 32, BODY_LO)


def kiosk1():
    c = Canvas(30, 44)
    body(c, TEAL)
    pole(c, GO)
    screen(c, 7, 6, 16, 10)
    glass_scanner(c)
    receipt(c)
    card_reader(c, 18, 28)
    bag_shelf(c)
    c.outline("k")
    return c


def kiosk2():
    c = Canvas(30, 44)
    body(c, ORANGE)
    pole(c, GO)
    # Купол камеры на штанге — чуть левее маячка.
    c.rect(16, 1, 4, 3, BEZEL)
    c.px(17, 2, SCREEN_HI)
    c.px(18, 2, lit(SCREEN_HI, 0.5))
    screen(c, 6, 5, 18, 12, big=True)
    glass_scanner(c)
    receipt(c)
    card_reader(c, 18, 28)
    bag_shelf(c, scale=True)
    c.outline("k")
    return c


def main():
    for name, draw in (("kiosk", kiosk0), ("kiosk1", kiosk1), ("kiosk2", kiosk2)):
        shadowed(draw(), 15, 41, 11, 2).save(name)


if __name__ == "__main__":
    main()
