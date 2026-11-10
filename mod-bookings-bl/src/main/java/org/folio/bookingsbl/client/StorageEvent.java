package org.folio.bookingsbl.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Event as stored by mod-bookings; also used as the BL API shape for events. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class StorageEvent {
  private UUID id;
  private String name;
  private String description;
  private OffsetDateTime startDate;
  private OffsetDateTime endDate;

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class Collection {
    private List<StorageEvent> events = new ArrayList<>();
    private Integer totalRecords;
  }
}
