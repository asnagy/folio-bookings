package org.folio.bookingsbl.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Booking as stored by mod-bookings (the storage module), including its items. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class StorageBooking {
  private UUID id;
  private UUID userId;
  private OffsetDateTime startDate;
  private OffsetDateTime endDate;
  private String status;
  private String notes;
  private UUID pickupServicePointId;
  private Boolean delivered;
  private String deliveryLocation;
  private UUID pickupByUserId;
  private UUID eventId;
  private List<StorageBookingItem> items = new ArrayList<>();
  private Metadata metadata;

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class Metadata {
    private OffsetDateTime createdDate;
    private UUID createdByUserId;
    private OffsetDateTime updatedDate;
    private UUID updatedByUserId;
  }
}
