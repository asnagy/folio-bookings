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

  // ---- inner DTOs ----

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class ItemDto {
    private String id;
    private String barcode;
    private String title;
    private StatusDto status;
    private String callNumber;
    private String effectiveLocationId;
    private String holdingsRecordId;
    private String instanceId;

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
