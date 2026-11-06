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
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Core business logic for the Bookings app.
 *
 * <ul>
 *   <li>Validates booking requests and resolves item details from inventory</li>
 *   <li>Detects items currently on loan and triggers recalls (a Recall request in circulation)</li>
 *   <li>Persists bookings, with their items and status, through mod-bookings (storage)</li>
 *   <li>Performs checkout on booking activation (manually or from the scheduled timer)</li>
 *   <li>Enriches responses with patron details for the UI</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Log4j2
public class BookingBlService {

  private static final String ITEM_STATUS_CHECKED_OUT = "Checked out";
  private static final Set<String> FINAL_STATUSES = Set.of("ACTIVE", "COMPLETED", "CANCELLED");
  private static final UUID NO_USER = new UUID(0, 0);
  private static final Pattern PATRON_NAME_TERM = Pattern.compile("patronName=\"\\*([^*\"]*)\\*\"");
  private static final Pattern TITLE_TERM = Pattern.compile("\\btitle=\"");

  private final BookingStorageClient storageClient;
  private final InventoryClient      inventoryClient;
  private final CirculationClient    circulationClient;
  private final UsersClient          usersClient;

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  public BookingCollection getBookings(String query, int offset, int limit) {
    log.debug("getBookings:: query={} offset={} limit={}", query, offset, limit);
    var raw = storageClient.getBookings(translateQuery(query), offset, limit);
    var patrons = fetchPatrons(raw.getBookings().stream().map(StorageBooking::getUserId).collect(Collectors.toSet()));
    var result = new BookingCollection();
    result.setBookings(raw.getBookings().stream()
      .map(b -> toResponse(b, patrons.get(b.getUserId())))
      .collect(Collectors.toList()));
    result.setTotalRecords(raw.getTotalRecords());
    return result;
  }

  public BookingResponse getBookingById(UUID id) {
    log.debug("getBookingById:: id={}", id);
    return toResponse(loadBooking(id));
  }

  // -------------------------------------------------------------------------
  // Create / update / delete
  // -------------------------------------------------------------------------

  public BookingResponse createBooking(BookingRequest request) {
    log.info("createBooking:: userId={} items={} start={}",
      request.getUserId(), request.getItemIds(), request.getStartDate());
    validateRequest(request);

    var items = resolveItems(request, Map.of());
    var booking = new StorageBooking();
    applyRequest(booking, request);
    booking.setItems(items);
    booking.setStatus(computeStatus("PENDING", items));

    var created = storageClient.createBooking(booking);
    log.info("createBooking:: created bookingId={} status={}", created.getId(), created.getStatus());
    return toResponse(created);
  }

  public BookingResponse updateBooking(UUID id, BookingRequest request) {
    log.info("updateBooking:: bookingId={}", id);
    var existing = loadBooking(id);
    validateRequest(request);

    var existingByItemId = existing.getItems().stream()
      .filter(i -> i.getItemId() != null)
      .collect(Collectors.toMap(StorageBookingItem::getItemId, Function.identity(), (a, b) -> a));
    var items = resolveItems(request, existingByItemId);

    applyRequest(existing, request);
    existing.setItems(items);
    existing.setStatus(computeStatus(existing.getStatus(), items));
    storageClient.updateBooking(id, existing);

    return toResponse(loadBooking(id));
  }

  public void deleteBooking(UUID id) {
    log.info("deleteBooking:: bookingId={}", id);
    loadBooking(id);
    storageClient.deleteBooking(id);
  }

  // -------------------------------------------------------------------------
  // Activate (manual checkout trigger)
  // -------------------------------------------------------------------------

  public BookingResponse activateBooking(UUID id) {
    log.info("activateBooking:: bookingId={}", id);
    var booking = loadBooking(id);

    if (performCheckoutsForBooking(booking)) {
      booking.setStatus("ACTIVE");
    }
    // Persist per-item outcomes even when some checkouts failed, so the next attempt only retries those
    storageClient.updateBooking(id, booking);
    return toResponse(loadBooking(id));
  }

  // -------------------------------------------------------------------------
  // Scheduled checkout (called by the platform's _timer interface every 5 minutes)
  // -------------------------------------------------------------------------

  /**
   * Finds bookings whose start time has arrived and checks out their items. Bookings that could
   * not be fully checked out (for example an item still on loan) stay in their status and are
   * retried on the next tick.
   */
  public void processScheduledCheckouts() {
    log.info("processScheduledCheckouts:: scanning for bookings due for checkout");
    var cql = String.format(
      "startDate<=\"%s\" and status==(\"PENDING\" or \"CONFIRMED\" or \"RECALL_REQUIRED\" or \"RECALL_TRIGGERED\")",
      OffsetDateTime.now().plusMinutes(1));
    var due = storageClient.getBookings(cql, 0, 500);
    if (due == null || due.getBookings() == null) {
      return;
    }
    log.info("processScheduledCheckouts:: found {} bookings to activate", due.getTotalRecords());

    for (var booking : due.getBookings()) {
      try {
        activateBooking(booking.getId());
      } catch (Exception e) {
        log.error("processScheduledCheckouts:: failed to activate bookingId={}: {}",
          booking.getId(), e.getMessage(), e);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Item resolution, recall and checkout
  // -------------------------------------------------------------------------

  /** Resolves each requested item; items already in the booking keep their stored state. */
  private List<StorageBookingItem> resolveItems(BookingRequest request, Map<UUID, StorageBookingItem> existing) {
    var items = new ArrayList<StorageBookingItem>();
    for (UUID itemId : new LinkedHashSet<>(request.getItemIds())) {
      var known = existing.get(itemId);
      if (known != null) {
        items.add(known);
        continue;
      }
      var item = inventoryClient.getItem(itemId);
      if (item == null) {
        throw new BookingBlException("Item not found in inventory: " + itemId);
      }
      var booked = toStorageItem(item);
      if (ITEM_STATUS_CHECKED_OUT.equals(booked.getItemStatus())) {
        if (Boolean.TRUE.equals(request.getOverrideAvailability())) {
          log.info("resolveItems:: item {} is checked out but override-availability is set", itemId);
        } else {
          triggerRecall(item, request, booked);
        }
      }
      items.add(booked);
    }
    return items;
  }

  private StorageBookingItem toStorageItem(InventoryClient.ItemDto item) {
    var booked = new StorageBookingItem();
    booked.setItemId(UUID.fromString(item.getId()));
    booked.setItemBarcode(item.getBarcode());
    booked.setItemTitle(item.getTitle());
    booked.setCallNumber(item.getCallNumber());
    booked.setItemStatus(item.getStatus() != null ? item.getStatus().getName() : null);
    if (item.getInstanceId() != null) {
      booked.setInstanceId(UUID.fromString(item.getInstanceId()));
    }
    if (item.getHoldingsRecordId() != null) {
      booked.setHoldingsRecordId(UUID.fromString(item.getHoldingsRecordId()));
    }
    return booked;
  }

  /** Creates a Recall request on the item; if that fails the item is flagged REQUIRED for staff. */
  private void triggerRecall(InventoryClient.ItemDto item, BookingRequest request, StorageBookingItem booked) {
    try {
      var recall = new CirculationClient.RecallRequestDto();
      recall.setItemId(item.getId());
      recall.setInstanceId(item.getInstanceId());
      recall.setHoldingsRecordId(item.getHoldingsRecordId());
      recall.setRequesterId(request.getUserId().toString());
      recall.setPickupServicePointId(
        request.getPickupServicePointId() != null ? request.getPickupServicePointId().toString() : null);
      recall.setRequestDate(OffsetDateTime.now());
      circulationClient.createRecallRequest(recall);
      booked.setRecallStatus("TRIGGERED");
      log.info("triggerRecall:: recall request created for itemId={}", item.getId());
    } catch (Exception e) {
      booked.setRecallStatus("REQUIRED");
      log.error("triggerRecall:: recall failed for itemId={}: {}", item.getId(), e.getMessage(), e);
    }
  }

  /** Checks out every item that is not yet checked out to this booking. Returns true when all are. */
  private boolean performCheckoutsForBooking(StorageBooking booking) {
    String userBarcode = null;
    try {
      var user = usersClient.getUser(booking.getUserId());
      userBarcode = user != null ? user.getBarcode() : null;
    } catch (Exception e) {
      log.error("performCheckoutsForBooking:: cannot load patron {}: {}", booking.getUserId(), e.getMessage());
    }
    if (userBarcode == null) {
      log.error("performCheckoutsForBooking:: patron {} has no barcode; skipping checkout", booking.getUserId());
      return false;
    }

    boolean allCheckedOut = true;
    for (var item : booking.getItems()) {
      // Already checked out by this booking on an earlier attempt
      if (ITEM_STATUS_CHECKED_OUT.equals(item.getItemStatus()) && "NOT_REQUIRED".equals(item.getRecallStatus())) {
        continue;
      }
      try {
        var checkout = new CirculationClient.CheckoutRequestDto();
        checkout.setItemBarcode(item.getItemBarcode());
        checkout.setUserBarcode(userBarcode);
        checkout.setLoanDate(OffsetDateTime.now());
        checkout.setServicePointId(
          booking.getPickupServicePointId() != null ? booking.getPickupServicePointId().toString() : null);
        circulationClient.checkOutByBarcode(checkout);
        item.setItemStatus(ITEM_STATUS_CHECKED_OUT);
        item.setRecallStatus("NOT_REQUIRED");
        log.info("performCheckoutsForBooking:: checked out itemBarcode={} for bookingId={}",
          item.getItemBarcode(), booking.getId());
      } catch (Exception e) {
        allCheckedOut = false;
        log.error("performCheckoutsForBooking:: checkout failed for itemId={} bookingId={}: {}",
          item.getItemId(), booking.getId(), e.getMessage(), e);
      }
    }
    return allCheckedOut;
  }

  // -------------------------------------------------------------------------
  // Status and mapping helpers
  // -------------------------------------------------------------------------

  /** Recall states drive the status of bookings that have not started; final statuses never change. */
  private static String computeStatus(String current, List<StorageBookingItem> items) {
    if (current != null && FINAL_STATUSES.contains(current)) {
      return current;
    }
    if (items.stream().anyMatch(i -> "REQUIRED".equals(i.getRecallStatus()))) {
      return "RECALL_REQUIRED";
    }
    if (items.stream().anyMatch(i -> "TRIGGERED".equals(i.getRecallStatus()))) {
      return "RECALL_TRIGGERED";
    }
    return "CONFIRMED";
  }

  private static void applyRequest(StorageBooking booking, BookingRequest request) {
    booking.setUserId(request.getUserId());
    booking.setStartDate(request.getStartDate());
    booking.setEndDate(request.getEndDate());
    booking.setNotes(request.getNotes());
    booking.setPickupServicePointId(request.getPickupServicePointId());
  }

  private StorageBooking loadBooking(UUID id) {
    StorageBooking booking;
    try {
      booking = storageClient.getBookingById(id);
    } catch (feign.FeignException.NotFound e) {
      throw new BookingNotFoundException(id);
    }
    if (booking == null) {
      throw new BookingNotFoundException(id);
    }
    return booking;
  }

  /** Rewrites UI search terms into indexes the storage module understands. */
  String translateQuery(String query) {
    if (query == null) {
      return null;
    }
    // The UI searches "title"; in storage that is the booked item's title
    var translated = TITLE_TERM.matcher(query).replaceAll("itemTitle=\"");

    // Patron names live in mod-users: resolve matching users and search by their ids
    Matcher m = PATRON_NAME_TERM.matcher(translated);
    var sb = new StringBuilder();
    while (m.find()) {
      var term = m.group(1).replace("\"", "");
      m.appendReplacement(sb, Matcher.quoteReplacement(patronIdsClause(term)));
    }
    m.appendTail(sb);
    return sb.toString();
  }

  private String patronIdsClause(String term) {
    try {
      var found = usersClient.getUsers(String.format(
        "personal.lastName=\"*%s*\" or personal.firstName=\"*%s*\" or barcode==\"%s\" or username=\"*%s*\"",
        term, term, term, term), 50);
      var ids = found == null || found.getUsers() == null ? List.<String>of()
        : found.getUsers().stream().map(UsersClient.UserDto::getId).collect(Collectors.toList());
      if (ids.isEmpty()) {
        return "userId==\"" + NO_USER + "\"";
      }
      return "userId==(" + ids.stream().map(id -> "\"" + id + "\"").collect(Collectors.joining(" or ")) + ")";
    } catch (Exception e) {
      log.warn("patronIdsClause:: user lookup failed for '{}': {}", term, e.getMessage());
      return "userId==\"" + NO_USER + "\"";
    }
  }

  private Map<UUID, PatronSummary> fetchPatrons(Collection<UUID> userIds) {
    var patrons = new HashMap<UUID, PatronSummary>();
    for (UUID userId : userIds) {
      if (userId == null) continue;
      try {
        var user = usersClient.getUser(userId);
        if (user != null) {
          patrons.put(userId, toPatron(userId, user));
        }
      } catch (Exception e) {
        log.warn("fetchPatrons:: could not fetch patron for userId={}: {}", userId, e.getMessage());
      }
    }
    return patrons;
  }

  private static PatronSummary toPatron(UUID userId, UsersClient.UserDto user) {
    var patron = new PatronSummary();
    patron.setId(userId);
    patron.setBarcode(user.getBarcode());
    if (user.getPersonal() != null) {
      patron.setFirstName(user.getPersonal().getFirstName());
      patron.setLastName(user.getPersonal().getLastName());
    }
    patron.setPatronGroup(user.getPatronGroup());
    return patron;
  }

  private BookingResponse toResponse(StorageBooking booking) {
    return toResponse(booking, fetchPatrons(List.of(booking.getUserId())).get(booking.getUserId()));
  }

  private BookingResponse toResponse(StorageBooking b, PatronSummary patron) {
    var response = new BookingResponse();
    response.setId(b.getId());
    response.setUserId(b.getUserId());
    response.setPatron(patron);
    response.setStartDate(b.getStartDate());
    response.setEndDate(b.getEndDate());
    if (b.getStatus() != null) {
      response.setStatus(BookingResponse.StatusEnum.fromValue(b.getStatus()));
    }
    response.setNotes(b.getNotes());
    response.setPickupServicePointId(b.getPickupServicePointId());
    response.setItems(b.getItems().stream().map(BookingBlService::toSummary).collect(Collectors.toList()));
    if (b.getMetadata() != null) {
      var metadata = new Metadata();
      metadata.setCreatedDate(b.getMetadata().getCreatedDate());
      metadata.setCreatedByUserId(b.getMetadata().getCreatedByUserId());
      metadata.setUpdatedDate(b.getMetadata().getUpdatedDate());
      metadata.setUpdatedByUserId(b.getMetadata().getUpdatedByUserId());
      response.setMetadata(metadata);
    }
    return response;
  }

  private static BookingItemSummary toSummary(StorageBookingItem i) {
    var summary = new BookingItemSummary();
    summary.setId(i.getId());
    summary.setItemId(i.getItemId());
    summary.setItemBarcode(i.getItemBarcode());
    summary.setItemTitle(i.getItemTitle());
    summary.setCallNumber(i.getCallNumber());
    summary.setItemStatus(i.getItemStatus());
    if (i.getRecallStatus() != null) {
      summary.setRecallStatus(BookingItemSummary.RecallStatusEnum.fromValue(i.getRecallStatus()));
    }
    return summary;
  }

  private void validateRequest(BookingRequest request) {
    if (request.getStartDate() != null && request.getEndDate() != null
      && !request.getStartDate().isBefore(request.getEndDate())) {
      throw new BookingBlException("startDate must be before endDate");
    }
    if (request.getItemIds() == null || request.getItemIds().isEmpty()) {
      throw new BookingBlException("A booking must include at least one item");
    }
  }
}
