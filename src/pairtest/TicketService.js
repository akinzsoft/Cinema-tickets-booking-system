import TicketTypeRequest from './lib/TicketTypeRequest.js';
import InvalidPurchaseException from './lib/InvalidPurchaseException.js';
import TicketPaymentService from '../thirdparty/paymentgateway/TicketPaymentService.js';
import SeatReservationService from '../thirdparty/seatbooking/SeatReservationService.js';

const MAX_TICKETS = 25;
const TICKET_PRICE = { ADULT: 25, CHILD: 15, INFANT: 0 };

export default class TicketService {
  #paymentService;
  #reservationService;

  constructor(
    paymentService = new TicketPaymentService(),
    reservationService = new SeatReservationService(),
  ) {
    this.#paymentService = paymentService;
    this.#reservationService = reservationService;
  }

  purchaseTickets(accountId, ...ticketTypeRequests) {
    this.#validateAccountId(accountId);
    this.#validateRequests(ticketTypeRequests);

    const counts = this.#countByType(ticketTypeRequests);
    this.#validateBusinessRules(counts);

    const totalAmount = this.#calculateTotalAmount(counts);
    const totalSeats  = this.#calculateTotalSeats(counts);

    this.#paymentService.makePayment(accountId, totalAmount);
    this.#reservationService.reserveSeat(accountId, totalSeats);
  }

  // ─── Private validation ─────────────────────────────────────────────────────

  /**
   * All accounts with an ID greater than zero are valid (per spec).
   */
  #validateAccountId(accountId) {
    if (!Number.isInteger(accountId) || accountId <= 0) {
      throw new InvalidPurchaseException(
        `Invalid account ID: ${accountId}. Must be a positive integer greater than zero.`,
      );
    }
  }

  /**
   * Every argument must be a TicketTypeRequest instance.
   * TicketTypeRequest only guards that noOfTickets is an integer; it permits
   * negative values, so we must also reject those here.
   */
  #validateRequests(requests) {
    if (!requests || requests.length === 0) {
      throw new InvalidPurchaseException(
        'At least one TicketTypeRequest must be provided.',
      );
    }

    for (const request of requests) {
      if (!(request instanceof TicketTypeRequest)) {
        throw new InvalidPurchaseException(
          'All ticket requests must be instances of TicketTypeRequest.',
        );
      }

      if (request.getNoOfTickets() < 0) {
        throw new InvalidPurchaseException(
          `Number of tickets cannot be negative. ` +
          `Received ${request.getNoOfTickets()} for type ${request.getTicketType()}.`,
        );
      }
    }
  }

  /**
   * Enforces all business rules derived from the specification:
   *
   *  1. At least one ticket must be purchased.
   *  2. No more than 25 tickets per transaction.
   *  3. Child / Infant tickets require at least one Adult ticket.
   *  4. Infants sit on an Adult's lap, so infants cannot outnumber adults.
   */
  #validateBusinessRules({ ADULT, CHILD, INFANT }) {
    const total = ADULT + CHILD + INFANT;

    if (total <= 0) {
      throw new InvalidPurchaseException(
        'At least one ticket must be purchased.',
      );
    }

    if (total > MAX_TICKETS) {
      throw new InvalidPurchaseException(
        `A maximum of ${MAX_TICKETS} tickets can be purchased at a time. Requested: ${total}.`,
      );
    }

    if (ADULT === 0) {
      throw new InvalidPurchaseException(
        'Child and Infant tickets cannot be purchased without at least one Adult ticket.',
      );
    }

    if (INFANT > ADULT) {
      throw new InvalidPurchaseException(
        `Number of Infants (${INFANT}) cannot exceed number of Adults (${ADULT}). ` +
        `Each Infant must sit on an Adult's lap.`,
      );
    }
  }

  // ─── Private calculation helpers ────────────────────────────────────────────

  /**
   * Aggregates ticket counts by type across all requests.
   * Multiple requests for the same type are summed together.
   * @returns {{ ADULT: number, CHILD: number, INFANT: number }}
   */
  #countByType(requests) {
    const counts = { ADULT: 0, CHILD: 0, INFANT: 0 };
    for (const request of requests) {
      counts[request.getTicketType()] += request.getNoOfTickets();
    }
    return counts;
  }

  /**
   * Infants are free (£0). Total = (adults × £25) + (children × £15).
   */
  #calculateTotalAmount({ ADULT, CHILD, INFANT }) {
    return (
      ADULT  * TICKET_PRICE.ADULT  +
      CHILD  * TICKET_PRICE.CHILD  +
      INFANT * TICKET_PRICE.INFANT
    );
  }

  /**
   * Infants are not allocated seats — they sit on an Adult's lap.
   * Seats reserved = Adults + Children only.
   */
  #calculateTotalSeats({ ADULT, CHILD }) {
    return ADULT + CHILD;
  }
}
