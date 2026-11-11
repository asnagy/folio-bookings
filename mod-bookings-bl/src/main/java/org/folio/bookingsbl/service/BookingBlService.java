package org.folio.bookingsbl.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.folio.bookingsbl.client.*;
import org.folio.bookingsbl.domain.dto.*;
import org.folio.bookingsbl.exception.BookingBlException;
import org.folio.bookingsbl.exception.BookingForbiddenException;
import org.folio.bookingsbl.exception.BookingLimitExceededException;
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
  private final SettingsService      settingsService;
  private final CallerPermissions    callerPermissions;

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  public BookingCollection getBookings(String query, int offset, int limit) {
    log.debug("getBookings:: query={} offset={} limit={}", query, offset, limit);
    var raw = storageClient.getBookings(translateQuery(query), offset, limit);
    var patrons = fetchPatrons(raw.getBookings().stream().map(StorageBooking::getUserId).collect(Collectors.toSet()));
    var statuses = fetchLiveItemStatuses(raw.getBookings());
    var eventNames = fetchEventNames(raw.getBookings());
    var result = new BookingCollection();
    result.setBookings(raw.getBookings().stream()
      .map(b -> toResponse(b, patrons.get(b.getUserId()), statuses, eventNames))
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
    var settings = settingsService.getSettings();
    enforceOverridePermissions(request);
    enforceBookingLimit(request, null, settings);

    var items = resolveItems(request, Map.of(), settings);
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
    var settings = settingsService.getSettings();
    enforceOverridePermissions(request);
    if (!Objects.equals(existing.getUserId(), request.getUserId())) {
      // A different patron is taking over the booking: their limit applies
      enforceBookingLimit(request, id, settings);
    }

    var existingByItemId = existing.getItems().stream()
      .filter(i -> i.getItemId() != null)
      .collect(Collectors.toMap(StorageBookingItem::getItemId, Function.identity(), (a, b) -> a));
    var items = resolveItems(request, existingByItemId, settings);

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
    var settings = settingsService.getSettings();
    var cql = String.format(
      "startDate<=\"%s\" and status==(\"PENDING\" or \"CONFIRMED\" or \"RECALL_REQUIRED\" or \"RECALL_TRIGGERED\")",
      OffsetDateTime.now().plusMinutes(1L + settings.checkoutLeadMinutes()));
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
  // Scheduled recalls (called by the same timer, before checkouts)
  // -------------------------------------------------------------------------

  /**
   * Sends the recalls that were held back until "recall lead time" days before the booking starts.
   * Items that are no longer on loan need no recall; recalls that failed earlier are retried here.
   */
  public void processScheduledRecalls() {
    log.info("processScheduledRecalls:: scanning for bookings whose recall is due");
    var settings = settingsService.getSettings();
    var cql = String.format("recallRequired==true and startDate<=\"%s\" and status==\"RECALL_REQUIRED\"",
      OffsetDateTime.now().plusDays(settings.recallLeadDays()));
    var due = storageClient.getBookings(cql, 0, 500);
    if (due == null || due.getBookings() == null) {
      return;
    }
    for (var booking : due.getBookings()) {
      try {
        if (recallDueItems(booking)) {
          booking.setStatus(computeStatus("PENDING", booking.getItems()));
          storageClient.updateBooking(booking.getId(), booking);
        }
      } catch (Exception e) {
        log.error("processScheduledRecalls:: failed for bookingId={}: {}", booking.getId(), e.getMessage(), e);
      }
    }
  }

  /** Returns true when any item's recall state changed. */
  private boolean recallDueItems(StorageBooking booking) {
    boolean changed = false;
    for (var booked : booking.getItems()) {
      if (!"REQUIRED".equals(booked.getRecallStatus()) || booked.getItemId() == null) {
        continue;
      }
      var item = inventoryClient.getItem(booked.getItemId());
      if (item == null || !isCheckedOut(item)) {
        booked.setRecallStatus("NOT_REQUIRED"); // came back on its own, nothing to recall
        changed = true;
        continue;
      }
      triggerRecall(item, booking.getUserId(), booking.getPickupServicePointId(), booked);
      changed = changed || !"REQUIRED".equals(booked.getRecallStatus());
    }
    return changed;
  }

  private static boolean isCheckedOut(InventoryClient.ItemDto item) {
    return item.getStatus() != null && ITEM_STATUS_CHECKED_OUT.equals(item.getStatus().getName());
  }

  // -------------------------------------------------------------------------
  // Limits, permissions and suppression
  // -------------------------------------------------------------------------

  private void enforceOverridePermissions(BookingRequest request) {
    if (Boolean.TRUE.equals(request.getOverrideAvailability())
      && !callerPermissions.has(CallerPermissions.OVERRIDE_AVAILABILITY)) {
      throw new BookingForbiddenException("You do not have permission to override item availability");
    }
    if (Boolean.TRUE.equals(request.getOverrideBookingLimit())
      && !callerPermissions.has(CallerPermissions.OVERRIDE_LIMIT)) {
      throw new BookingForbiddenException("You do not have permission to override the booking limit");
    }
  }

  /**
   * Counts the patron's active and future bookings (not cancelled or completed, not yet ended) and
   * rejects the request when the limit for their patron group is reached.
   */
  private void enforceBookingLimit(BookingRequest request, UUID excludeBookingId, BookingSettings settings) {
    UsersClient.UserDto patron;
    try {
      patron = usersClient.getUser(request.getUserId());
    } catch (Exception e) {
      log.warn("enforceBookingLimit:: cannot load patron {}: {}", request.getUserId(), e.getMessage());
      return;
    }
    Integer limit = settings.limitFor(patron != null ? patron.getPatronGroup() : null);
    if (limit == null) {
      return;
    }
    var cql = String.format("userId==\"%s\" and endDate>=\"%s\"", request.getUserId(), OffsetDateTime.now());
    var existing = storageClient.getBookings(cql, 0, 500);
    long current = existing == null || existing.getBookings() == null ? 0 : existing.getBookings().stream()
      .filter(b -> !"CANCELLED".equals(b.getStatus()) && !"COMPLETED".equals(b.getStatus()))
      .filter(b -> !b.getId().equals(excludeBookingId))
      .count();
    if (current < limit) {
      return;
    }
    if (Boolean.TRUE.equals(request.getOverrideBookingLimit()) && settings.allowLimitOverride()) {
      log.info("enforceBookingLimit:: limit {} exceeded for userId={} but overridden", limit, request.getUserId());
      return;
    }
    throw new BookingLimitExceededException(limit, (int) current, settings.allowLimitOverride());
  }

  /**
   * An item is suppressed from booking when the flag is set on the item, its holdings record or its
   * instance. Records that cannot be read, or that do not know the flag, count as not suppressed.
   */
  private boolean isSuppressedFromBooking(InventoryClient.ItemDto item) {
    if (Boolean.TRUE.equals(item.getSuppressFromBooking())) {
      return true;
    }
    return flagged(() -> item.getHoldingsRecordId() == null ? null
        : inventoryClient.getHoldings(UUID.fromString(item.getHoldingsRecordId())), "holdings", item.getId())
      || flagged(() -> item.getInstanceId() == null ? null
        : inventoryClient.getInstance(UUID.fromString(item.getInstanceId())), "instance", item.getId());
  }

  private boolean flagged(java.util.function.Supplier<InventoryClient.FlagDto> lookup, String level, String itemId) {
    try {
      var record = lookup.get();
      return record != null && Boolean.TRUE.equals(record.getSuppressFromBooking());
    } catch (Exception e) {
      log.warn("isSuppressedFromBooking:: cannot read {} of item {}: {}", level, itemId, e.getMessage());
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Item resolution, recall and checkout
  // -------------------------------------------------------------------------

  /** Resolves each requested item; items already in the booking keep their stored state. */
  private List<StorageBookingItem> resolveItems(BookingRequest request, Map<UUID, StorageBookingItem> existing,
                                                BookingSettings settings) {
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
      boolean override = Boolean.TRUE.equals(request.getOverrideAvailability());
      if (!override && isSuppressedFromBooking(item)) {
        throw new BookingBlException("Item " + (item.getBarcode() != null ? item.getBarcode() : itemId)
          + " is suppressed from booking");
      }
      var booked = toStorageItem(item);
      // Live status is used only to decide on recall; it is never stored
      if (isCheckedOut(item)) {
        if (override) {
          log.info("resolveItems:: item {} is checked out but override-availability is set", itemId);
        } else if (!OffsetDateTime.now().plusDays(settings.recallLeadDays()).isBefore(request.getStartDate())) {
          // Already inside the recall lead time: recall now
          triggerRecall(item, request.getUserId(), request.getPickupServicePointId(), booked);
        } else {
          // Flagged for staff now; the scheduler sends the recall when the lead time is reached
          booked.setRecallStatus("REQUIRED");
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
    booked.setCallNumber(item.getEffectiveCallNumberComponents() != null
      ? item.getEffectiveCallNumberComponents().getCallNumber() : item.getCallNumber());
    if (item.getInstanceId() != null) {
      booked.setInstanceId(UUID.fromString(item.getInstanceId()));
    }
    if (item.getHoldingsRecordId() != null) {
      booked.setHoldingsRecordId(UUID.fromString(item.getHoldingsRecordId()));
    }
    return booked;
  }

  /** Creates a Recall request on the item; if that fails the item is flagged REQUIRED for staff. */
  private void triggerRecall(InventoryClient.ItemDto item, UUID userId, UUID pickupServicePointId,
                             StorageBookingItem booked) {
    try {
      var recall = new CirculationClient.RecallRequestDto();
      recall.setItemId(item.getId());
      recall.setInstanceId(item.getInstanceId());
      recall.setHoldingsRecordId(item.getHoldingsRecordId());
      recall.setRequesterId(userId.toString());
      recall.setPickupServicePointId(pickupServicePointId != null ? pickupServicePointId.toString() : null);
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
      if (item.getCheckedOutDate() != null) {
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
        item.setCheckedOutDate(OffsetDateTime.now());
        if (!"NOT_REQUIRED".equals(item.getRecallStatus())) {
          item.setRecallStatus("RETURNED");
        }
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
    boolean delivered = Boolean.TRUE.equals(request.getDelivered());
    booking.setDelivered(delivered);
    // Delivered bookings carry a free-text location; otherwise a service point is used
    booking.setDeliveryLocation(delivered ? request.getDeliveryLocation() : null);
    booking.setPickupServicePointId(delivered ? null : request.getPickupServicePointId());
    booking.setPickupByUserId(request.getPickupByUserId());
    booking.setEventId(request.getEventId());
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
    return toResponse(booking, fetchPatrons(List.of(booking.getUserId())).get(booking.getUserId()),
      fetchLiveItemStatuses(List.of(booking)), fetchEventNames(List.of(booking)));
  }

  /** Current item statuses from Inventory (one batched call); empty if Inventory cannot be reached. */
  private Map<UUID, String> fetchEventNames(Collection<StorageBooking> bookings) {
    var ids = bookings.stream().map(StorageBooking::getEventId).filter(java.util.Objects::nonNull)
      .distinct().map(UUID::toString).collect(Collectors.toList());
    Map<UUID, String> names = new java.util.HashMap<>();
    if (ids.isEmpty()) {
      return names;
    }
    try {
      var events = storageClient.getEvents("id==(" + String.join(" or ", ids) + ")", 0, ids.size());
      if (events != null && events.getEvents() != null) {
        events.getEvents().forEach(e -> names.put(e.getId(), e.getName()));
      }
    } catch (Exception e) {
      log.warn("fetchEventNames:: could not load events: {}", e.getMessage());
    }
    return names;
  }

  private Map<UUID, String> fetchLiveItemStatuses(Collection<StorageBooking> bookings) {
    var itemIds = bookings.stream().flatMap(b -> b.getItems().stream())
      .map(StorageBookingItem::getItemId).filter(Objects::nonNull).distinct()
      .collect(Collectors.toList());
    var statuses = new HashMap<UUID, String>();
    for (int from = 0; from < itemIds.size(); from += 50) {
      var chunk = itemIds.subList(from, Math.min(from + 50, itemIds.size()));
      try {
        var query = "id==(" + chunk.stream().map(id -> "\"" + id + "\"").collect(Collectors.joining(" or ")) + ")";
        var found = inventoryClient.getItems(query, chunk.size());
        if (found != null && found.getItems() != null) {
          for (var item : found.getItems()) {
            if (item.getStatus() != null) {
              statuses.put(UUID.fromString(item.getId()), item.getStatus().getName());
            }
          }
        }
      } catch (Exception e) {
        log.warn("fetchLiveItemStatuses:: could not load item statuses: {}", e.getMessage());
      }
    }
    return statuses;
  }

  private BookingResponse toResponse(StorageBooking b, PatronSummary patron, Map<UUID, String> itemStatuses,
                                     Map<UUID, String> eventNames) {
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
    response.setDelivered(Boolean.TRUE.equals(b.getDelivered()));
    response.setDeliveryLocation(b.getDeliveryLocation());
    response.setPickupByUserId(b.getPickupByUserId());
    response.setEventId(b.getEventId());
    response.setEventName(eventNames.get(b.getEventId()));
    response.setItems(b.getItems().stream().map(i -> toSummary(i, itemStatuses.get(i.getItemId()))).collect(Collectors.toList()));
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

  private static BookingItemSummary toSummary(StorageBookingItem i, String liveItemStatus) {
    var summary = new BookingItemSummary();
    summary.setId(i.getId());
    summary.setItemId(i.getItemId());
    summary.setInstanceId(i.getInstanceId());
    summary.setHoldingsRecordId(i.getHoldingsRecordId());
    summary.setItemBarcode(i.getItemBarcode());
    summary.setItemTitle(i.getItemTitle());
    summary.setCallNumber(i.getCallNumber());
    summary.setItemStatus(liveItemStatus);
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
    if (Boolean.TRUE.equals(request.getDelivered())) {
      if (request.getDeliveryLocation() == null || request.getDeliveryLocation().isBlank()) {
        throw new BookingBlException("A delivery location is required for a delivered booking");
      }
    } else if (request.getPickupServicePointId() == null) {
      throw new BookingBlException("A pickup service point is required when the booking is not delivered");
    }
  }
}
