// OfferPill.tsx — Colored pill for an offer (same style as mediator pills)

import { readableTextColor } from './MultiSelect';
import type { Offer } from '../domain/types';

interface Props {
  offer: Offer | undefined;
  /** Optional id for tests/targeting. */
  id?: string;
}

/**
 * Small colored pill showing the offer name, colored with the offer color
 * and a readable text color (same visual language as mediator pills).
 */
export default function OfferPill({ offer, id }: Props) {
  if (!offer) return null;
  const bg = offer.color || '#2c6e49';
  return (
    <span className="offer-pill" id={id} style={{ background: bg, color: readableTextColor(bg) }}>
      {offer.name}
    </span>
  );
}
