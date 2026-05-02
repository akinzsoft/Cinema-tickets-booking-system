import { jest, describe, it, expect } from '@jest/globals';

import TicketService     from '../src/pairtest/TicketService.js';
import TicketTypeRequest from '../src/pairtest/lib/TicketTypeRequest.js';
import InvalidPurchaseException from '../src/pairtest/lib/InvalidPurchaseException.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const adult  = (n) => new TicketTypeRequest('ADULT',  n);
const child  = (n) => new TicketTypeRequest('CHILD',  n);
const infant = (n) => new TicketTypeRequest('INFANT', n);

function makeService() {
  const paymentService     = { makePayment: jest.fn() };
  const reservationService = { reserveSeat: jest.fn() };
  const ticketService      = new TicketService(paymentService, reservationService);
  return { ticketService, paymentService, reservationService };
}

// ─── TicketTypeRequest (template-provided, constraints say do not modify) ────

describe('TicketTypeRequest', () => {
  it('stores type and quantity correctly', () => {
    const req = new TicketTypeRequest('ADULT', 3);
    expect(req.getTicketType()).toBe('ADULT');
    expect(req.getNoOfTickets()).toBe(3);
  });

  it('throws TypeError for an unrecognised ticket type', () => {
    expect(() => new TicketTypeRequest('VIP', 1)).toThrow(TypeError);
  });

  it('throws TypeError when noOfTickets is not an integer', () => {
    expect(() => new TicketTypeRequest('ADULT', 1.5)).toThrow(TypeError);
    expect(() => new TicketTypeRequest('ADULT', '3')).toThrow(TypeError);
  });

  it('accepts all three valid ticket types', () => {
    ['ADULT', 'CHILD', 'INFANT'].forEach((type) => {
      expect(() => new TicketTypeRequest(type, 1)).not.toThrow();
    });
  });
});

// ─── Account ID validation ────────────────────────────────────────────────────
// Spec: "All accounts with an id greater than zero are valid."

describe('Account ID validation', () => {
  it('throws InvalidPurchaseException for account ID of zero', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(0, adult(1)))
      .toThrow(InvalidPurchaseException);
  });

  it('throws InvalidPurchaseException for a negative account ID', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(-1, adult(1)))
      .toThrow(InvalidPurchaseException);
  });

  it('throws InvalidPurchaseException for a non-integer account ID', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1.5, adult(1)))
      .toThrow(InvalidPurchaseException);
  });

  it('accepts the minimum valid account ID of 1', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(1))).not.toThrow();
  });

  it('accepts a large valid account ID', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(999999, adult(1))).not.toThrow();
  });

  it('does not call any service when the account ID is invalid', () => {
    const { ticketService, paymentService, reservationService } = makeService();
    try { ticketService.purchaseTickets(0, adult(1)); } catch { /* expected */ }
    expect(paymentService.makePayment).not.toHaveBeenCalled();
    expect(reservationService.reserveSeat).not.toHaveBeenCalled();
  });
});

// ─── Request argument validation ──────────────────────────────────────────────

describe('Request argument validation', () => {
  it('throws when no ticket requests are supplied at all', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1))
      .toThrow(InvalidPurchaseException);
  });

  it('throws when a plain object is passed instead of a TicketTypeRequest', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, { type: 'ADULT', n: 1 }))
      .toThrow(InvalidPurchaseException);
  });

  it('throws when null is passed as a request', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, null))
      .toThrow(InvalidPurchaseException);
  });

  it('throws when all requests individually carry zero tickets (nothing to purchase)', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(0)))
      .toThrow(InvalidPurchaseException);
  });

  // TicketTypeRequest only validates Number.isInteger — negative integers pass
  // its constructor. TicketService must reject them to prevent negative payments.
  it('throws when a request has a negative noOfTickets', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(-1)))
      .toThrow(InvalidPurchaseException);
  });

  it('throws when one of several requests has a negative noOfTickets', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(5), child(-1)))
      .toThrow(InvalidPurchaseException);
  });

  it('does not call any service when requests contain a negative quantity', () => {
    const { ticketService, paymentService, reservationService } = makeService();
    try { ticketService.purchaseTickets(1, adult(-1)); } catch { /* expected */ }
    expect(paymentService.makePayment).not.toHaveBeenCalled();
    expect(reservationService.reserveSeat).not.toHaveBeenCalled();
  });
});

// ─── Maximum 25 tickets per purchase ─────────────────────────────────────────
// Spec: "Only a maximum of 25 tickets that can be purchased at a time."

describe('Maximum 25 tickets per purchase', () => {
  it('accepts exactly 25 tickets', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(25))).not.toThrow();
  });

  it('throws for 26 tickets', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(26)))
      .toThrow(InvalidPurchaseException);
  });

  it('applies the limit across all ticket types combined', () => {
    const { ticketService } = makeService();
    // 20 + 3 + 3 = 26
    expect(() => ticketService.purchaseTickets(1, adult(20), child(3), infant(3)))
      .toThrow(InvalidPurchaseException);
  });

  it('applies the limit when the same type is sent in multiple requests', () => {
    const { ticketService } = makeService();
    // adult(13) + adult(13) = 26 adults
    expect(() => ticketService.purchaseTickets(1, adult(13), adult(13)))
      .toThrow(InvalidPurchaseException);
  });
});

// ─── Adult requirement ────────────────────────────────────────────────────────
// Spec: "Child and Infant tickets cannot be purchased without purchasing an Adult ticket."

describe('Child and Infant tickets require at least one Adult', () => {
  it('throws for Child-only purchase', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, child(2)))
      .toThrow(InvalidPurchaseException);
  });

  it('throws for Infant-only purchase', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, infant(1)))
      .toThrow(InvalidPurchaseException);
  });

  it('throws for Child + Infant purchase with no Adult', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, child(1), infant(1)))
      .toThrow(InvalidPurchaseException);
  });

  it('accepts Adult-only purchase', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(2))).not.toThrow();
  });

  it('accepts Adult + Child purchase', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(1), child(2))).not.toThrow();
  });

  it('accepts Adult + Infant purchase', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(2), infant(2))).not.toThrow();
  });

  it('accepts Adult + Child + Infant purchase', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(2), child(1), infant(2))).not.toThrow();
  });

  it('does not call any service when there is no Adult', () => {
    const { ticketService, paymentService, reservationService } = makeService();
    try { ticketService.purchaseTickets(1, child(2)); } catch { /* expected */ }
    expect(paymentService.makePayment).not.toHaveBeenCalled();
    expect(reservationService.reserveSeat).not.toHaveBeenCalled();
  });
});

// ─── Infant lap rule ──────────────────────────────────────────────────────────
// Spec: "Infants do not pay for a ticket and are not allocated a seat.
//        They will be sitting on an Adult's lap."

describe('Infants must not outnumber Adults (each sits on a lap)', () => {
  it('throws when infants outnumber adults', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(1), infant(2)))
      .toThrow(InvalidPurchaseException);
  });

  it('accepts equal numbers of Infants and Adults', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(3), infant(3))).not.toThrow();
  });

  it('accepts fewer Infants than Adults', () => {
    const { ticketService } = makeService();
    expect(() => ticketService.purchaseTickets(1, adult(4), infant(1))).not.toThrow();
  });
});

// ─── Correct payment amount ───────────────────────────────────────────────────
// Spec prices: ADULT £25 | CHILD £15 | INFANT £0

describe('Correct payment amount passed to TicketPaymentService', () => {
  it('charges £25 for 1 Adult', () => {
    const { ticketService, paymentService } = makeService();
    ticketService.purchaseTickets(1, adult(1));
    expect(paymentService.makePayment).toHaveBeenCalledWith(1, 25);
  });

  it('charges £50 for 2 Adults', () => {
    const { ticketService, paymentService } = makeService();
    ticketService.purchaseTickets(1, adult(2));
    expect(paymentService.makePayment).toHaveBeenCalledWith(1, 50);
  });

  it('charges £40 for 1 Adult + 1 Child (25 + 15)', () => {
    const { ticketService, paymentService } = makeService();
    ticketService.purchaseTickets(1, adult(1), child(1));
    expect(paymentService.makePayment).toHaveBeenCalledWith(1, 40);
  });

  it('charges £25 for 1 Adult + 1 Infant — Infant is free', () => {
    const { ticketService, paymentService } = makeService();
    ticketService.purchaseTickets(1, adult(1), infant(1));
    expect(paymentService.makePayment).toHaveBeenCalledWith(1, 25);
  });

  it('calculates mixed basket correctly: 2 Adults + 3 Children + 1 Infant = £95', () => {
    const { ticketService, paymentService } = makeService();
    // 2×25 + 3×15 + 0 = 50 + 45 = 95
    ticketService.purchaseTickets(1, adult(2), child(3), infant(1));
    expect(paymentService.makePayment).toHaveBeenCalledWith(1, 95);
  });

  it('sums multiple requests of the same type: adult(1) + adult(1) = £50', () => {
    const { ticketService, paymentService } = makeService();
    ticketService.purchaseTickets(1, adult(1), adult(1));
    expect(paymentService.makePayment).toHaveBeenCalledWith(1, 50);
  });

  it('charges £625 for the maximum 25 Adults', () => {
    const { ticketService, paymentService } = makeService();
    ticketService.purchaseTickets(1, adult(25));
    expect(paymentService.makePayment).toHaveBeenCalledWith(1, 625);
  });
});

// ─── Correct seat reservation count ──────────────────────────────────────────
// Spec: "Infants do not pay for a ticket and are not allocated a seat."

describe('Correct seat count passed to SeatReservationService', () => {
  it('reserves 1 seat for 1 Adult', () => {
    const { ticketService, reservationService } = makeService();
    ticketService.purchaseTickets(1, adult(1));
    expect(reservationService.reserveSeat).toHaveBeenCalledWith(1, 1);
  });

  it('reserves 2 seats for 1 Adult + 1 Child', () => {
    const { ticketService, reservationService } = makeService();
    ticketService.purchaseTickets(1, adult(1), child(1));
    expect(reservationService.reserveSeat).toHaveBeenCalledWith(1, 2);
  });

  it('reserves only the Adult seat when an Infant is present — Infant has no seat', () => {
    const { ticketService, reservationService } = makeService();
    ticketService.purchaseTickets(1, adult(1), infant(1));
    expect(reservationService.reserveSeat).toHaveBeenCalledWith(1, 1);
  });

  it('reserves 5 seats for 2 Adults + 3 Children + 2 Infants', () => {
    const { ticketService, reservationService } = makeService();
    ticketService.purchaseTickets(1, adult(2), child(3), infant(2));
    expect(reservationService.reserveSeat).toHaveBeenCalledWith(1, 5);
  });

  it('reserves 25 seats for the maximum 25 Adults', () => {
    const { ticketService, reservationService } = makeService();
    ticketService.purchaseTickets(1, adult(25));
    expect(reservationService.reserveSeat).toHaveBeenCalledWith(1, 25);
  });
});

// ─── Account ID forwarded to both services ────────────────────────────────────

describe('Account ID is forwarded to both third-party services', () => {
  it('passes account ID to TicketPaymentService', () => {
    const { ticketService, paymentService } = makeService();
    ticketService.purchaseTickets(42, adult(1));
    expect(paymentService.makePayment).toHaveBeenCalledWith(42, expect.any(Number));
  });

  it('passes account ID to SeatReservationService', () => {
    const { ticketService, reservationService } = makeService();
    ticketService.purchaseTickets(42, adult(1));
    expect(reservationService.reserveSeat).toHaveBeenCalledWith(42, expect.any(Number));
  });
});

// ─── Service call ordering ────────────────────────────────────────────────────

describe('Payment is made before seats are reserved', () => {
  it('calls makePayment then reserveSeat — never the other way around', () => {
    const callOrder = [];
    const paymentService     = { makePayment: jest.fn(() => callOrder.push('payment')) };
    const reservationService = { reserveSeat: jest.fn(() => callOrder.push('reservation')) };
    const ticketService      = new TicketService(paymentService, reservationService);

    ticketService.purchaseTickets(1, adult(2), child(1));

    expect(callOrder).toEqual(['payment', 'reservation']);
  });
});
