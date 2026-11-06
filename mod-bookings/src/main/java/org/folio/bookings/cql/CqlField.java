package org.folio.bookings.cql;

/**
 * Describes one queryable CQL index: the entity attribute path it maps to and its Java type.
 * Paths may cross one association, e.g. {@code bookingItems.itemBarcode}.
 */
public record CqlField(String path, Class<?> type) {

  public static CqlField of(String path, Class<?> type) {
    return new CqlField(path, type);
  }
}
