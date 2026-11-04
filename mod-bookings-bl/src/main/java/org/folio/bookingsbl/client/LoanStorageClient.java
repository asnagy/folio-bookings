package org.folio.bookingsbl.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Feign client for circulation-storage loan queries.
 * Used to find the active loan on an item so we can trigger a recall against it.
 */
@FeignClient(name = "loan-storage", url = "${okapi.url}", configuration = OkapiClientConfig.class)
public interface LoanStorageClient {

  /**
   * Query for the active (open) loan on a specific item.
   * Example query: itemId==<uuid> AND status.name==Open
   */
  @GetMapping("/loan-storage/loans")
  LoanCollection getLoans(@RequestParam String query,
                          @RequestParam(defaultValue = "0")  int offset,
                          @RequestParam(defaultValue = "1")  int limit);

  // ---- inner DTOs ----

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class LoanCollection {
    private List<LoanDto> loans;
    private int totalRecords;
  }

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class LoanDto {
    private String id;
    private String itemId;
    private String userId;
    private StatusDto status;
    private String action;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StatusDto {
      private String name;   // "Open" or "Closed"
    }
  }
}
