package org.folio.bookingsbl.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.folio.bookingsbl.service.BookingBlService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Timer endpoint invoked by Okapi's built-in _timer interface.
 * The ModuleDescriptor registers POST /bookings/scheduled/checkout
 * to be called every 5 minutes by the platform.
 *
 * This controller scans for bookings whose start time has arrived
 * and performs checkout via mod-circulation for all associated items.
 */
@RestController
@RequestMapping("/bookings/scheduled")
@RequiredArgsConstructor
@Log4j2
public class ScheduledCheckoutController {

  private final BookingBlService bookingBlService;

  @PostMapping("/checkout")
  public ResponseEntity<Void> runScheduledCheckout() {
    log.info("runScheduledCheckout:: timer invoked by Okapi");
    try {
      bookingBlService.processScheduledRecalls();
    } catch (Exception e) {
      log.error("runScheduledCheckout:: unhandled error during scheduled recalls: {}", e.getMessage(), e);
    }
    try {
      bookingBlService.processScheduledCheckouts();
    } catch (Exception e) {
      // Never return a non-200 to Okapi timer or it will stop retrying
      log.error("runScheduledCheckout:: unhandled error during scheduled checkout: {}", e.getMessage(), e);
    }
    return ResponseEntity.ok().build();
  }
}
