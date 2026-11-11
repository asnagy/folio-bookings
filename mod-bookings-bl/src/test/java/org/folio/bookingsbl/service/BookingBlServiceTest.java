package org.folio.bookingsbl.service;

import org.folio.bookingsbl.client.*;
import org.folio.bookingsbl.domain.dto.BookingRequest;
import org.folio.bookingsbl.exception.BookingBlException;
import org.folio.bookingsbl.exception.BookingForbiddenException;
import org.folio.bookingsbl.exception.BookingLimitExceededException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingBlServiceTest {

  private static final UUID USER_ID = UUID.randomUUID();
  private static final UUID ITEM_ID = UUID.randomUUID();
  private static final UUID HOLDINGS_ID = UUID.randomUUID();
  private static final UUID INSTANCE_ID = UUID.randomUUID();
  private static final UUID SERVICE_POINT_ID = UUID.randomUUID();
  private static final String GROUP = "group-a";

  @Mock private BookingStorageClient storageClient;
  @Mock private InventoryClient inventoryClient;
  @Mock private CirculationClient circulationClient;
  @Mock private UsersClient usersClient;
  @Mock private SettingsService settingsService;
  @Mock private CallerPermissions callerPermissions;
  @InjectMocks private BookingBlService service;

  private InventoryClient.ItemDto item;

  @BeforeEach
  void setUp() {
    item = new InventoryClient.ItemDto();
    item.setId(ITEM_ID.toString());
    item.setBarcode("B-1");
    item.setHoldingsRecordId(HOLDINGS_ID.toString());
    item.setInstanceId(INSTANCE_ID.toString());
    setStatus("Available");
    when(inventoryClient.getItem(ITEM_ID)).thenReturn(item);
    when(inventoryClient.getHoldings(any())).thenReturn(new InventoryClient.FlagDto());
    when(inventoryClient.getInstance(any())).thenReturn(new InventoryClient.FlagDto());

    var user = new UsersClient.UserDto();
    user.setId(USER_ID.toString());
    user.setPatronGroup(GROUP);
    when(usersClient.getUser(USER_ID)).thenReturn(user);

    when(settingsService.getSettings()).thenReturn(BookingSettings.defaults());
    when(callerPermissions.has(anyString())).thenReturn(true);
    when(storageClient.getBookings(any(), anyInt(), anyInt())).thenReturn(new StorageBookingCollection());
    when(storageClient.createBooking(any())).thenAnswer(inv -> {
      StorageBooking created = inv.getArgument(0);
      created.setId(UUID.randomUUID());
      return created;
    });
  }

  private void setStatus(String name) {
    var status = new InventoryClient.ItemDto.StatusDto();
    status.setName(name);
    item.setStatus(status);
  }

  private static BookingRequest request(OffsetDateTime start) {
    var request = new BookingRequest();
    request.setUserId(USER_ID);
    request.setStartDate(start);
    request.setEndDate(start.plusDays(1));
    request.setPickupServicePointId(SERVICE_POINT_ID);
    request.setItemIds(List.of(ITEM_ID));
    return request;
  }

  private static BookingRequest requestInDays(int days) {
    return request(OffsetDateTime.now().plusDays(days));
  }

  private static BookingSettings settings(Integer defaultLimit, Map<String, Integer> byGroup, boolean override) {
    return new BookingSettings(defaultLimit, byGroup, override, 3, 0);
  }

  private static StorageBooking existingBooking(String status) {
    var booking = new StorageBooking();
    booking.setId(UUID.randomUUID());
    booking.setStatus(status);
    return booking;
  }

  private void existingBookings(StorageBooking... bookings) {
    var collection = new StorageBookingCollection();
    collection.setBookings(List.of(bookings));
    collection.setTotalRecords(bookings.length);
    when(storageClient.getBookings(contains("userId=="), anyInt(), anyInt())).thenReturn(collection);
  }

  // ---- booking limit ----

  @Test
  void createBooking_whenPatronIsAtTheirGroupLimit_isRejected() {
    when(settingsService.getSettings()).thenReturn(settings(null, Map.of(GROUP, 2), true));
    existingBookings(existingBooking("CONFIRMED"), existingBooking("ACTIVE"));

    var ex = assertThrows(BookingLimitExceededException.class, () -> service.createBooking(requestInDays(5)));

    assertEquals(2, ex.getLimit());
    assertEquals(2, ex.getCurrent());
    assertTrue(ex.isOverridable());
    verify(storageClient, never()).createBooking(any());
  }

  @Test
  void createBooking_doesNotCountCancelledOrCompletedBookings() {
    when(settingsService.getSettings()).thenReturn(settings(2, Map.of(), true));
    existingBookings(existingBooking("CONFIRMED"), existingBooking("CANCELLED"), existingBooking("COMPLETED"));

    assertDoesNotThrow(() -> service.createBooking(requestInDays(5)));
  }

  @Test
  void createBooking_usesDefaultLimitWhenGroupHasNone() {
    when(settingsService.getSettings()).thenReturn(settings(1, Map.of("other-group", 9), true));
    existingBookings(existingBooking("PENDING"));

    assertThrows(BookingLimitExceededException.class, () -> service.createBooking(requestInDays(5)));
  }

  @Test
  void createBooking_withoutAnyLimit_doesNotCountBookings() {
    assertDoesNotThrow(() -> service.createBooking(requestInDays(5)));

    verify(storageClient, never()).getBookings(contains("userId=="), anyInt(), anyInt());
  }

  @Test
  void createBooking_limitCanBeOverriddenWhenSettingsAllow() {
    when(settingsService.getSettings()).thenReturn(settings(1, Map.of(), true));
    existingBookings(existingBooking("CONFIRMED"));
    var request = requestInDays(5);
    request.setOverrideBookingLimit(true);

    assertDoesNotThrow(() -> service.createBooking(request));
  }

  @Test
  void createBooking_limitCannotBeOverriddenWhenSettingsForbidIt() {
    when(settingsService.getSettings()).thenReturn(settings(1, Map.of(), false));
    existingBookings(existingBooking("CONFIRMED"));
    var request = requestInDays(5);
    request.setOverrideBookingLimit(true);

    var ex = assertThrows(BookingLimitExceededException.class, () -> service.createBooking(request));
    assertFalse(ex.isOverridable());
  }

  @Test
  void createBooking_overrideWithoutPermission_isForbidden() {
    when(callerPermissions.has(CallerPermissions.OVERRIDE_LIMIT)).thenReturn(false);
    var request = requestInDays(5);
    request.setOverrideBookingLimit(true);

    assertThrows(BookingForbiddenException.class, () -> service.createBooking(request));
    verify(storageClient, never()).createBooking(any());
  }

  @Test
  void createBooking_availabilityOverrideWithoutPermission_isForbidden() {
    when(callerPermissions.has(CallerPermissions.OVERRIDE_AVAILABILITY)).thenReturn(false);
    var request = requestInDays(5);
    request.setOverrideAvailability(true);

    assertThrows(BookingForbiddenException.class, () -> service.createBooking(request));
  }

  // ---- recall lead time ----

  @Test
  void createBooking_itemOnLoanBeforeRecallWindow_isFlaggedButNotRecalledYet() {
    setStatus("Checked out");

    var response = service.createBooking(requestInDays(30));

    assertEquals("RECALL_REQUIRED", response.getStatus().getValue());
    verify(circulationClient, never()).createRecallRequest(any());
  }

  @Test
  void createBooking_itemOnLoanInsideRecallWindow_isRecalledImmediately() {
    setStatus("Checked out");

    var response = service.createBooking(requestInDays(1));

    assertEquals("RECALL_TRIGGERED", response.getStatus().getValue());
    verify(circulationClient).createRecallRequest(any());
  }

  @Test
  void createBooking_recallWindowFollowsTheSetting() {
    setStatus("Checked out");
    when(settingsService.getSettings()).thenReturn(new BookingSettings(null, Map.of(), true, 14, 0));

    service.createBooking(requestInDays(10));

    verify(circulationClient).createRecallRequest(any());
  }

  @Test
  void processScheduledRecalls_recallsItemsThatAreStillOnLoan() {
    setStatus("Checked out");
    var booking = bookingWithRecallRequired();
    var due = new StorageBookingCollection();
    due.setBookings(List.of(booking));
    when(storageClient.getBookings(contains("recallRequired==true"), anyInt(), anyInt())).thenReturn(due);

    service.processScheduledRecalls();

    verify(circulationClient).createRecallRequest(any());
    var updated = ArgumentCaptor.forClass(StorageBooking.class);
    verify(storageClient).updateBooking(eq(booking.getId()), updated.capture());
    assertEquals("TRIGGERED", updated.getValue().getItems().get(0).getRecallStatus());
    assertEquals("RECALL_TRIGGERED", updated.getValue().getStatus());
  }

  @Test
  void processScheduledRecalls_clearsItemsThatCameBack() {
    setStatus("Available");
    var booking = bookingWithRecallRequired();
    var due = new StorageBookingCollection();
    due.setBookings(List.of(booking));
    when(storageClient.getBookings(contains("recallRequired==true"), anyInt(), anyInt())).thenReturn(due);

    service.processScheduledRecalls();

    verify(circulationClient, never()).createRecallRequest(any());
    var updated = ArgumentCaptor.forClass(StorageBooking.class);
    verify(storageClient).updateBooking(eq(booking.getId()), updated.capture());
    assertEquals("NOT_REQUIRED", updated.getValue().getItems().get(0).getRecallStatus());
    assertEquals("CONFIRMED", updated.getValue().getStatus());
  }

  private StorageBooking bookingWithRecallRequired() {
    var booked = new StorageBookingItem();
    booked.setItemId(ITEM_ID);
    booked.setRecallStatus("REQUIRED");
    var booking = existingBooking("RECALL_REQUIRED");
    booking.setUserId(USER_ID);
    booking.setPickupServicePointId(SERVICE_POINT_ID);
    booking.setItems(List.of(booked));
    return booking;
  }

  // ---- checkout lead time ----

  @Test
  void processScheduledCheckouts_looksAheadByTheCheckoutLeadTime() {
    when(settingsService.getSettings()).thenReturn(new BookingSettings(null, Map.of(), true, 3, 30));
    var cql = ArgumentCaptor.forClass(String.class);
    var before = OffsetDateTime.now();

    service.processScheduledCheckouts();

    verify(storageClient).getBookings(cql.capture(), anyInt(), anyInt());
    var limit = OffsetDateTime.parse(cql.getValue().split("\"")[1]);
    // 30 minutes lead + the 1 minute baseline
    assertTrue(limit.isAfter(before.plusMinutes(30)));
    assertTrue(limit.isBefore(before.plusMinutes(32)));
  }

  // ---- suppress from booking ----

  @Test
  void createBooking_itemSuppressed_isRejected() {
    item.setSuppressFromBooking(true);

    var ex = assertThrows(BookingBlException.class, () -> service.createBooking(requestInDays(5)));
    assertTrue(ex.getMessage().contains("B-1"));
  }

  @Test
  void createBooking_holdingsSuppressed_isRejected() {
    var flag = new InventoryClient.FlagDto();
    flag.setSuppressFromBooking(true);
    when(inventoryClient.getHoldings(HOLDINGS_ID)).thenReturn(flag);

    assertThrows(BookingBlException.class, () -> service.createBooking(requestInDays(5)));
  }

  @Test
  void createBooking_instanceSuppressed_isRejected() {
    var flag = new InventoryClient.FlagDto();
    flag.setSuppressFromBooking(true);
    when(inventoryClient.getInstance(INSTANCE_ID)).thenReturn(flag);

    assertThrows(BookingBlException.class, () -> service.createBooking(requestInDays(5)));
  }

  @Test
  void createBooking_suppressedItemCanBeBookedWithOverride() {
    item.setSuppressFromBooking(true);
    var request = requestInDays(5);
    request.setOverrideAvailability(true);

    assertDoesNotThrow(() -> service.createBooking(request));
  }

  @Test
  void createBooking_whenFlagCannotBeRead_isNotTreatedAsSuppressed() {
    when(inventoryClient.getHoldings(any())).thenThrow(new RuntimeException("not found"));
    when(inventoryClient.getInstance(any())).thenThrow(new RuntimeException("not found"));

    assertDoesNotThrow(() -> service.createBooking(requestInDays(5)));
  }

  // ---- delivery ----

  @Test
  void createBooking_deliveredWithoutLocation_isRejected() {
    var request = requestInDays(5);
    request.setDelivered(true);

    assertThrows(BookingBlException.class, () -> service.createBooking(request));
  }

  @Test
  void createBooking_notDeliveredWithoutServicePoint_isRejected() {
    var request = requestInDays(5);
    request.setPickupServicePointId(null);

    assertThrows(BookingBlException.class, () -> service.createBooking(request));
  }

  @Test
  void createBooking_deliveredKeepsLocationAndDropsServicePoint() {
    var request = requestInDays(5);
    request.setDelivered(true);
    request.setDeliveryLocation("Room 204");

    service.createBooking(request);

    var stored = ArgumentCaptor.forClass(StorageBooking.class);
    verify(storageClient).createBooking(stored.capture());
    assertTrue(stored.getValue().getDelivered());
    assertEquals("Room 204", stored.getValue().getDeliveryLocation());
    assertNull(stored.getValue().getPickupServicePointId());
  }
}
