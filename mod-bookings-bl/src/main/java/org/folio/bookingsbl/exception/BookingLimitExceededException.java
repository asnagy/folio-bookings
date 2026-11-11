package org.folio.bookingsbl.exception;

/** The patron already has as many active and future bookings as their patron group allows. */
public class BookingLimitExceededException extends RuntimeException {

  private final int limit;
  private final int current;
  private final boolean overridable;

  public BookingLimitExceededException(int limit, int current, boolean overridable) {
    super("The patron already has " + current + " active or future booking" + (current == 1 ? "" : "s")
      + "; the limit for their patron group is " + limit);
    this.limit = limit;
    this.current = current;
    this.overridable = overridable;
  }

  public int getLimit() {
    return limit;
  }

  public int getCurrent() {
    return current;
  }

  /** False when the settings do not allow the limit to be overridden by anyone. */
  public boolean isOverridable() {
    return overridable;
  }
}
