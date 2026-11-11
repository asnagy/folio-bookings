package org.folio.bookingsbl.service;

import java.util.Map;

/**
 * Effective Bookings settings, with defaults applied.
 *
 * @param defaultBookingLimit   max active + future bookings for patron groups without their own limit; null = unlimited
 * @param limitsByPatronGroup   patron group id to limit
 * @param allowLimitOverride    whether authorised staff may exceed the limit at all
 * @param recallLeadDays        days before a booking starts that recalls are sent
 * @param checkoutLeadMinutes   minutes before the start time that items are checked out
 */
public record BookingSettings(
  Integer defaultBookingLimit,
  Map<String, Integer> limitsByPatronGroup,
  boolean allowLimitOverride,
  int recallLeadDays,
  int checkoutLeadMinutes
) {

  public static final String SCOPE = "mod-bookings";
  public static final String KEY_LIMITS = "limits";
  public static final String KEY_TIMING = "timing";
  public static final int DEFAULT_RECALL_LEAD_DAYS = 3;

  public static BookingSettings defaults() {
    return new BookingSettings(null, Map.of(), true, DEFAULT_RECALL_LEAD_DAYS, 0);
  }

  /** The limit that applies to a patron group, or null when the group is unlimited. */
  public Integer limitFor(String patronGroupId) {
    if (patronGroupId != null && limitsByPatronGroup.containsKey(patronGroupId)) {
      return limitsByPatronGroup.get(patronGroupId);
    }
    return defaultBookingLimit;
  }
}
