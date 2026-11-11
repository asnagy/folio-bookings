package org.folio.bookingsbl.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Feign client for mod-inventory — used to look up item details and
 * determine whether a recall is needed before a booking is created.
 */
@FeignClient(name = "mod-inventory", url = "${okapi.url}", configuration = OkapiClientConfig.class)
public interface InventoryClient {

  @GetMapping("/inventory/items/{id}")
  ItemDto getItem(@PathVariable UUID id);

  @GetMapping("/inventory/items")
  ItemsCollection getItemsByBarcode(@RequestParam String query);

  /** Batch lookup, used to show live item status. */
  @GetMapping("/inventory/items")
  ItemsCollection getItems(@RequestParam("query") String query, @RequestParam("limit") int limit);

  @GetMapping("/holdings-storage/holdings/{id}")
  FlagDto getHoldings(@PathVariable UUID id);

  @GetMapping("/instance-storage/instances/{id}")
  FlagDto getInstance(@PathVariable UUID id);

  // ---- inner DTOs ----

  /** Holdings or instance record, of which only the booking flag is needed. */
  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class FlagDto {
    private Boolean suppressFromBooking;
  }

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class ItemDto {
    private String id;
    private String barcode;
    private String title;
    private StatusDto status;
    private String callNumber;
    private CallNumberDto effectiveCallNumberComponents;
    private String effectiveLocationId;
    private String holdingsRecordId;
    private String instanceId;
    private Boolean suppressFromBooking;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CallNumberDto {
      private String callNumber;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StatusDto {
      private String name;
    }
  }

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class ItemsCollection {
    private List<ItemDto> items;
    private int totalRecords;
  }
}
