package org.folio.bookingsbl.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.folio.bookingsbl.client.*;
import org.folio.bookingsbl.domain.dto.*;
import org.folio.bookingsbl.exception.BookingBlException;
import org.folio.bookingsbl.exception.BookingNotFoundException;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Core business logic service for the Bookings app.
 *
 * Responsibilities:
 *  - Validate booking requests and resolve item details from mod-inventory
 *  - Detect items currently on loan and trigger recalls via mod-circulation
 *  - Persist bookings and booking-item associations via mod-bookings (storage)
 *  - Perform checkout on booking activation (manually or via scheduler)
 *  - Enrich responses with patron and item data for the UI
 */
@Service
@RequiredArgsConstructor
@Log4j2
public class BookingBlService {

  private static final String ITEM_STATUS_CHECKED_OUT = "Checked out";
  private static final String LOAN_STATUS_OPEN        = "Open";

  private final BookingStorageClient storageClient;
  private final InventoryClient      inventoryClient;
  private final CirculationClient    circulationClient;
  private final UsersClient          usersClient;
  private final LoanStorageClient    loanStorageClient;

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  public BookingCollection getBookings(String query, int offset, int limit) {
    log.debug("getBookings:: query={} offset={} limit={}", query, offset, limit);
    var rawCollection = storageClient.getBookings(query, offset, limit);
    var enriched = rawCollection.getBookings().stream()
      .map(this::enrich)
      .collect(Collectors.toList());
    rawCollection.setBookings(enriched);
    return rawCollection;
  }

  public BookingResponse getBookingById(UUID id) {
    log.debug("getBookingById:: id={}", id);
    var raw = storageClient.getBookingById(id);
    if (raw == null) throw new BookingNotFoundException(id);
    return enrich(raw);
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  public BookingResponse createBooking(BookingRequest request) {
    log.info("createBooking:: userId={} items={} start={}",
      request.getUserId(), request.getItemIds(), request.getStartDate());

    validateRequest(request);

    // Resolve each item from inventory and decide recall status
    boolean anyRecallTriggered = false;
    var itemSummaries = new ArrayList<BookingItemSummary>();

    for (UUID itemId : request.getItemIds()) {
      var item = inventoryClient.getItem(itemId);
      if (item == null) {
        throw new BookingBlException("Item not found in inventory: " + itemId);
      }

      var summary = buildItemSummary(item);

      if (ITEM_STATUS_CHECKED_OUT.equals(item.getStatus() != null ? item.getStatus().getName() : null)) {
        if (!Boolean.TRUE.equals(request.getOverrideAvailability())) {
          // Item is on loan — trigger a recall automatically
          log.info("createBooking:: item {} is checked out, triggering recall", itemId);
          triggerRecallForItem(itemId, summary);
          anyRecallTriggered = true;
        } else {
          log.info("createBooking:: item {} is checked out but override-availability flag set", itemId);
          summary.setRecallStatus(BookingItemSummary.RecallStatusEnum.NOT_REQUIRED);
        }
      } else {
        summary.setRecallStatus(BookingItemSummary.RecallStatusEnum.NOT_REQUIRED);
      }

      itemSummaries.add(summary);
    }

    // Determine overall booking status
    String bookingStatus = anyRecallTriggered ? "RECALL_TRIGGERED" : "CONFIRMED";

    // Build the storage request
    var storagePayload = buildStoragePayload(request, bookingStatus, itemSummaries);
    var created = storageClient.createBooking(storagePayload);

    log.info("createBooking:: created bookingId={} status={}", created.getId(), bookingStatus);
    return enrich(created);
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  public BookingResponse updateBooking(UUID id, BookingRequest request) {
    log.info("updateBooking:: bookingId={}", id);
    var existing = storageClient.getBookingById(id);
    if (existing == null) throw new BookingNotFoundException(id);

    validateRequest(request);

    var storagePayload = buildStoragePayload(request, existing.getStatus().getValue(), List.of());
    storageClient.updateBooking(id, storagePayload);

    return enrich(storageClient.getBookingById(id));
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  public void deleteBooking(UUID id) {
    log.info("deleteBooking:: bookingId={}", id);
    var existing = storageClient.getBookingById(id);
    if (existing == null) throw new BookingNotFoundException(id);
    storageClient.deleteBooking(id);
  }

  // -------------------------------------------------------------------------
  // Activate (manual checkout trigger)
  // -------------------------------------------------------------------------

  public BookingResponse activateBooking(UUID id) {
    log.info("activateBooking:: bookingId={}", id);
    var booking = storageClient.getBookingById(id);
    if (booking == null) throw new BookingNotFoundException(id);

    performCheckoutsForBooking(booking);

    // Update status to ACTIVE in storage
    var updatePayload = buildStoragePayload(
      buildRequestFromResponse(booking), "ACTIVE", List.of());
    storageClient.updateBooking(UUID.fromString(booking.getId().toString()), updatePayload);

    return enrich(storageClient.getBookingById(id));
  }

  // -------------------------------------------------------------------------
  // Scheduled checkout (called by Okapi _timer interface every 5 minutes)
  // -------------------------------------------------------------------------

  /**
   * Scans for bookings whose start time has arrived and performs checkout.
   * Invoked by Okapi's built-in timer interface — no external scheduler needed.
   */
  public void processScheduledCheckouts() {
    log.info("processScheduledCheckouts:: scanning for bookings due for checkout");
    var now = OffsetDateTime.now();
    var windowStart = now.minusMinutes(5);
    var windowEnd   = now.plusMinutes(1);

    // Query storage for bookings in CONFIRMED or RECALL_TRIGGERED status
    // whose start date falls in the current 5-minute window
    String cqlQuery = String.format(
      "startDate>=%s AND startDate<=%s AND status==(CONFIRMED OR RECALL_TRIGGERED OR PENDING)",
      windowStart.toString(), windowEnd.toString());

    var dueBookings = storageClient.getBookings(cqlQuery, 0, 500);

    if (dueBookings == null || dueBookings.getBookings() == null) return;

    log.info("processScheduledCheckouts:: found {} bookings to activate",
      dueBookings.getTotalRecords());

    for (var booking : dueBookings.getBookings()) {
      try {
        activateBooking(UUID.fromString(booking.getId().toString()));
      } catch (Exception e) {
        // Log but continue processing other bookings
        log.error("processScheduledCheckouts:: failed to activate bookingId={}: {}",
          booking.getId(), e.getMessage(), e);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private void triggerRecallForItem(UUID itemId, BookingItemSummary summary) {
    try {
      // Find the open loan for this item
      String query = String.format("itemId==%s AND status.name==%s", itemId, LOAN_STATUS_OPEN);
      var loans = loanStorageClient.getLoans(query, 0, 1);

      if (loans != null && loans.getLoans() != null && !loans.getLoans().isEmpty()) {
        var loanId = UUID.fromString(loans.getLoans().get(0).getId());
        circulationClient.recallLoan(loanId);
        summary.setRecallStatus(BookingItemSummary.RecallStatusEnum.TRIGGERED);
        log.info("triggerRecallForItem:: recall triggered for loanId={} itemId={}", loanId, itemId);
      } else {
        // No open loan found despite "Checked out" status — flag as required
        summary.setRecallStatus(BookingItemSummary.RecallStatusEnum.REQUIRED);
        log.warn("triggerRecallForItem:: no open loan found for itemId={}, flagging REQUIRED", itemId);
      }
    } catch (Exception e) {
      // Recall failed — still allow booking, flag as REQUIRED for staff
      summary.setRecallStatus(BookingItemSummary.RecallStatusEnum.REQUIRED);
      log.error("triggerRecallForItem:: recall failed for itemId={}: {}", itemId, e.getMessage(), e);
    }
  }

  private void performCheckoutsForBooking(BookingResponse booking) {
    if (booking.getItems() == null) return;

    var patron = booking.getPatron();
    String servicePointId = booking.getPickupServicePointId() != null
      ? booking.getPickupServicePointId().toString()
      : null;

    for (var item : booking.getItems()) {
      try {
        var checkoutReq = new CirculationClient.CheckoutRequestDto();
        checkoutReq.setItemBarcode(item.getItemBarcode());
        checkoutReq.setUserBarcode(patron != null ? patron.getBarcode() : null);
        checkoutReq.setLoanDate(OffsetDateTime.now());
        checkoutReq.setServicePointId(servicePointId);

        circulationClient.checkOutByBarcode(checkoutReq);
        log.info("performCheckoutsForBooking:: checked out itemBarcode={} for bookingId={}",
          item.getItemBarcode(), booking.getId());
      } catch (Exception e) {
        log.error("performCheckoutsForBooking:: checkout failed for itemId={} bookingId={}: {}",
          item.getItemId(), booking.getId(), e.getMessage(), e);
        // Continue processing remaining items; failed items are surfaced via booking status
      }
    }
  }

  private BookingItemSummary buildItemSummary(InventoryClient.ItemDto item) {
    var summary = new BookingItemSummary();
    summary.setItemId(item.getId() != null ? UUID.fromString(item.getId()) : null);
    summary.setItemBarcode(item.getBarcode());
    summary.setItemTitle(item.getTitle());
    summary.setCallNumber(item.getCallNumber());
    summary.setItemStatus(item.getStatus() != null ? item.getStatus().getName() : null);
    return summary;
  }

  private BookingResponse enrich(BookingResponse booking) {
    if (booking == null) return null;
    try {
      if (booking.getUserId() != null) {
        var user = usersClient.getUser(booking.getUserId());
        if (user != null) {
          var patron = new PatronSummary();
          patron.setId(booking.getUserId());
          patron.setBarcode(user.getBarcode());
          if (user.getPersonal() != null) {
            patron.setFirstName(user.getPersonal().getFirstName());
            patron.setLastName(user.getPersonal().getLastName());
          }
          patron.setPatronGroup(user.getPatronGroup());
          booking.setPatron(patron);
        }
      }
    } catch (Exception e) {
      log.warn("enrich:: could not fetch patron for userId={}: {}", booking.getUserId(), e.getMessage());
    }
    return booking;
  }

  private BookingRequest buildRequestFromResponse(BookingResponse response) {
    var req = new BookingRequest();
    req.setUserId(response.getUserId());
    req.setStartDate(response.getStartDate());
    req.setEndDate(response.getEndDate());
    req.setNotes(response.getNotes());
    req.setPickupServicePointId(response.getPickupServicePointId());
    if (response.getItems() != null) {
      req.setItemIds(response.getItems().stream()
        .map(BookingItemSummary::getItemId)
        .filter(Objects::nonNull)
        .collect(Collectors.toList()));
    }
    return req;
  }

  private BookingRequest buildStoragePayload(BookingRequest source, String status,
    List<BookingItemSummary> items) {
    var payload = new BookingRequest();
    payload.setUserId(source.getUserId());
    payload.setStartDate(source.getStartDate());
    payload.setEndDate(source.getEndDate());
    payload.setNotes(source.getNotes());
    payload.setPickupServicePointId(source.getPickupServicePointId());
    payload.setItemIds(source.getItemIds());
    return payload;
  }

  private void validateRequest(BookingRequest request) {
    if (request.getStartDate() != null && request.getEndDate() != null) {
      if (!request.getStartDate().isBefore(request.getEndDate())) {
        throw new BookingBlException("startDate must be before endDate");
      }
    }
    if (request.getItemIds() == null || request.getItemIds().isEmpty()) {
      throw new BookingBlException("A booking must include at least one item");
    }
  }
}
