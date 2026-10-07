export const ru = {
  'title': 'Магазинчик',
  'hud.day': 'День {n}',
  'hud.rating': 'Рейтинг',
  'product.bread': 'Хлеб',
  'product.milk': 'Молоко',
  'product.apples': 'Яблоки',
  'hint.serve': 'Нажми на кассу, чтобы обслужить покупателя',
  'popup.leftAngry': 'Ушёл без покупки!',
  'popup.noStock': 'Нет товара',
  'summary.title': 'Итоги дня {n}',
  'summary.revenue': 'Выручка',
  'summary.served': 'Обслужено',
  'summary.lost': 'Ушли недовольными',
  'summary.restock': 'Закупить товар ({cost})',
  'summary.next': 'Следующий день',
  'summary.notEnough': 'Не хватает денег',
  'story.intro':
    'Бабушка оставила тебе старый ларёк на углу... и небольшой долг. Пора открывать двери!',
  'story.start': 'Открыть магазин',
} as const;

export type TextKey = keyof typeof ru;
