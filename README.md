# Cinema Tickets Coding Exercise

## Overview
This project is an implementation of the `TicketService` for the DWP Cinema Tickets coding exercise.

This solution focuses on clean code, separation of concerns, and comprehensive validation in line with the provided requirements.

The solution processes ticket purchase requests, validates them against business rules, calculates total payment, and reserves the correct number of seats using provided third-party services.

---

## Tech Stack
- JavaScript (Node.js)
- Jest (for unit testing)

---

## How to Run

### Install dependencies
```bash
npm install
```

### Run tests
```bash
npm test
```

---

## Implementation Summary

The `TicketService`:
- Validates ticket purchase requests
- Calculates total payment
- Calculates number of seats to reserve
- Calls:
  - `TicketPaymentService` for payment
  - `SeatReservationService` for seat booking

---

## Business Rules Implemented

### Ticket types:
- INFANT (£0)
- CHILD (£15)
- ADULT (£25)

### Rules enforced:
- Maximum of **25 tickets per purchase**
- **At least one Adult ticket required** if purchasing Child or Infant tickets
- Infants do not pay and do not get a seat
- Multiple ticket types can be purchased together

---

## Validation Rules

The following are treated as invalid requests:
- Account ID ≤ 0
- No tickets requested
- Total tickets exceed 25
- Child or Infant tickets requested without an Adult ticket

### Additional Assumption
Infants cannot exceed the number of Adults (as each infant must sit on an adult’s lap).

This assumption is not explicitly stated in the requirements but has been implemented for logical consistency.

---

## Calculations

### Payment
Only Adult and Child tickets contribute to payment:
Total = (Adult × £25) + (Child × £15)

### Seat Reservation
Only Adult and Child tickets require seats:
Seats = Adult + Child

---

## Testing

Implemented using **Jest**.

Covers:
- Valid purchase scenarios
- Invalid input handling
- Edge cases (limits, missing adults, etc.)
- Correct payment and seat calculations

All tests pass, covering core scenarios, edge cases, and validation rules.

---

## Design Decisions

- `TicketTypeRequest` treated as immutable
- Validation logic separated for clarity
- Clean, readable, and reusable code structure
- Focus on maintainability and testability

---

## Submission Notes

- Code is original and written specifically for this exercise
- No modifications made to:
  - `TicketService` interface
  - `thirdparty.*` packages
- Solution is ready for review and discussion
