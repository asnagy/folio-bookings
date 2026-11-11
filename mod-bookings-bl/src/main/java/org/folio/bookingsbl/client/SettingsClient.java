package org.folio.bookingsbl.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.UUID;

/** Feign client for mod-settings, where the Bookings settings are stored (scope "mod-bookings"). */
@FeignClient(name = "mod-settings", url = "${okapi.url}", configuration = OkapiClientConfig.class)
public interface SettingsClient {

  @GetMapping("/settings/entries")
  SettingsCollection getEntries(@RequestParam("query") String query, @RequestParam("limit") int limit);

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class SettingsCollection {
    private List<Entry> items;
  }

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class Entry {
    private UUID id;
    private String scope;
    private String key;
    private JsonNode value;
  }
}
