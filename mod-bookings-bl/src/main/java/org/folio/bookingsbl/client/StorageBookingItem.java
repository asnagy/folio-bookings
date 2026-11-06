package org.folio.bookingsbl.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.util.UUID;

/** Booked item as stored by mod-bookings. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class StorageBookingItem {
  private UUID id;
  private UUID bookingId;
  private UUID itemId;
  private UUID instanceId;
  private UUID holdingsRecordId;
  private String itemBarcode;
  private String itemTitle;
  private String callNumber;
  private String itemStatus;
  private String recallStatus = "NOT_REQUIRED";
}
