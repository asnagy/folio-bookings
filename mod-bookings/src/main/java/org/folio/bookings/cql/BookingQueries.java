package org.folio.bookings.cql;

import org.folio.bookings.entity.BookingEntity;
import org.folio.bookings.entity.BookingItemEntity;
import org.folio.bookings.entity.EventEntity;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/** Queryable CQL indexes for the booking and booking-item search endpoints. */
public final class BookingQueries {

  private static final Map<String, CqlField> BOOKING_FIELDS = Map.ofEntries(
    Map.entry("id", CqlField.of("id", UUID.class)),
    Map.entry("userId", CqlField.of("userId", UUID.class)),
    Map.entry("status", CqlField.of("status", BookingEntity.BookingStatus.class)),
    Map.entry("startDate", CqlField.of("startDate", OffsetDateTime.class)),
    Map.entry("endDate", CqlField.of("endDate", OffsetDateTime.class)),
    Map.entry("notes", CqlField.of("notes", String.class)),
    Map.entry("pickupServicePointId", CqlField.of("pickupServicePointId", UUID.class)),
    Map.entry("eventId", CqlField.of("eventId", UUID.class)),
    Map.entry("delivered", CqlField.of("delivered", Boolean.class)),
    Map.entry("deliveryLocation", CqlField.of("deliveryLocation", String.class)),
    Map.entry("itemId", CqlField.of("bookingItems.itemId", UUID.class)),
    Map.entry("itemBarcode", CqlField.of("bookingItems.itemBarcode", String.class)),
    Map.entry("itemTitle", CqlField.of("bookingItems.itemTitle", String.class)),
    Map.entry("callNumber", CqlField.of("bookingItems.callNumber", String.class)));

  private static final Map<String, String> BOOKING_SORT = Map.of(
    "startDate", "startDate", "endDate", "endDate", "status", "status", "notes", "notes",
    "userId", "userId", "createdDate", "createdDate");

  private static final Map<String, CqlField> ITEM_FIELDS = Map.ofEntries(
    Map.entry("id", CqlField.of("id", UUID.class)),
    Map.entry("bookingId", CqlField.of("booking.id", UUID.class)),
    Map.entry("itemId", CqlField.of("itemId", UUID.class)),
    Map.entry("itemBarcode", CqlField.of("itemBarcode", String.class)),
    Map.entry("itemTitle", CqlField.of("itemTitle", String.class)),
    Map.entry("callNumber", CqlField.of("callNumber", String.class)),
    Map.entry("recallStatus", CqlField.of("recallStatus", BookingItemEntity.RecallStatus.class)),
    Map.entry("userId", CqlField.of("booking.userId", UUID.class)),
    Map.entry("status", CqlField.of("booking.status", BookingEntity.BookingStatus.class)),
    Map.entry("startDate", CqlField.of("booking.startDate", OffsetDateTime.class)),
    Map.entry("endDate", CqlField.of("booking.endDate", OffsetDateTime.class)),
    Map.entry("eventId", CqlField.of("booking.eventId", UUID.class)),
    Map.entry("pickupServicePointId", CqlField.of("booking.pickupServicePointId", UUID.class)));

  private static final Map<String, String> ITEM_SORT = Map.of(
    "itemBarcode", "itemBarcode", "itemTitle", "itemTitle", "callNumber", "callNumber",
    "recallStatus", "recallStatus",
    "startDate", "booking.startDate", "endDate", "booking.endDate", "status", "booking.status");

  private static final Map<String, CqlField> EVENT_FIELDS = Map.ofEntries(
    Map.entry("id", CqlField.of("id", UUID.class)),
    Map.entry("name", CqlField.of("name", String.class)),
    Map.entry("description", CqlField.of("description", String.class)),
    Map.entry("startDate", CqlField.of("startDate", OffsetDateTime.class)),
    Map.entry("endDate", CqlField.of("endDate", OffsetDateTime.class)));

  private static final Map<String, String> EVENT_SORT = Map.of(
    "name", "name", "startDate", "startDate", "endDate", "endDate");

  private BookingQueries() {
  }

  public static Specification<BookingEntity> bookingSpec(String cql) {
    return CqlQuery.toSpecification(cql, BOOKING_FIELDS, "bookingItems");
  }

  public static Sort bookingSort(String cql) {
    return CqlQuery.toSort(cql, BOOKING_SORT, Sort.by("startDate").ascending());
  }

  public static Specification<BookingItemEntity> itemSpec(String cql) {
    return CqlQuery.toSpecification(cql, ITEM_FIELDS, "__unused__");
  }

  public static Sort itemSort(String cql) {
    return CqlQuery.toSort(cql, ITEM_SORT, Sort.by("booking.startDate").ascending());
  }

  public static Specification<EventEntity> eventSpec(String cql) {
    return CqlQuery.toSpecification(cql, EVENT_FIELDS, "__unused__");
  }

  public static Sort eventSort(String cql) {
    return CqlQuery.toSort(cql, EVENT_SORT, Sort.by("name").ascending());
  }
}
