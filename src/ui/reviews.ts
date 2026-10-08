import { t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import { isGood, type Review } from '../game/reviews';
import { button, el, openModal } from './dom';

/** Карточки отзывов: звёзды, текст и кто написал. */
export function reviewCards(reviews: Review[]): HTMLElement[] {
  const authors = t('review.authors').split(',');
  return reviews.map((r) => {
    const card = el('div', `ui-review ${r.topic === 'quiet' ? '' : isGood(r.topic) ? 'good' : 'bad'}`);
    card.append(
      el('div', 'ui-review-stars', '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars)),
      el('div', 'ui-review-text', `«${t(`review.${r.topic}.${r.variant}` as TextKey)}»`),
      el('div', 'ui-review-who', `— ${authors[r.author % authors.length]}`),
    );
    return card;
  });
}

/** Доска отзывов у входа: что писали посетители вчера. */
export function showReviews(reviews: Review[] | undefined): void {
  const { card, close } = openModal();
  card.append(el('h2', '', t('review.title')));
  if (reviews?.length) card.append(...reviewCards(reviews));
  else card.append(el('div', 'ui-note', t('review.empty')));
  card.append(button('OK', close));
}
