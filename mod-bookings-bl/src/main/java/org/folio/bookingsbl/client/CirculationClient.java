package org.folio.bookingsbl.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Feign client for mod-circulation.
 * Used to:
 *  1. Trigger a recall on an active loan when an item is booked while on loan.
 *  2. Perform a checkout at booking activation time.
 */
@FeignClient(name = "mod-circulation", url = "${okapi.url}", configuration = OkapiClientConfig.class)
public interface CirculationClient {

  /**
   * Perform a checkout. Called at booking start time by the scheduler,
   * or immediately when staff manually activate a booking.
   */
  @PostMapping("/circulation/check-out-by-barcode")
  CheckoutResponseDto checkOutByBarcode(@RequestBody CheckoutRequestDto request);

  /**
   * Create a Recall request on an item. In FOLIO a recall is a request of type "Recall";
   * mod-circulation then shortens the due date of the open loan.
   */
  @PostMapping("/circulation/requests")
  RecallResponseDto createRecallRequest(@RequestBody RecallRequestDto request);

  // ---- inner DTOs ----

  @Data
  class RecallRequestDto {
    private String requestType = "Recall";
    private String requestLevel = "Item";
    private String fulfillmentPreference = "Hold Shelf";
    private String itemId;
    private String instanceId;
    private String holdingsRecordId;
    private String requesterId;
    private String pickupServicePointId;
    private OffsetDateTime requestDate;
  }

  @Data
  class CheckoutRequestDto {
    private String itemBarcode;
    private String userBarcode;
    private OffsetDateTime loanDate;
    private String servicePointId;
  }

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class CheckoutResponseDto {
    private String id;
    private String itemId;
    private String userId;
    private String status;
    private String action;
  }

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class RecallResponseDto {
    private String id;
    private String action;
    private String status;
  }
}
