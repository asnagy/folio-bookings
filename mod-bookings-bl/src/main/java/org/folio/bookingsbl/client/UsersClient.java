package org.folio.bookingsbl.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Feign client for mod-users — used to fetch patron details
 * for enriching booking responses displayed in the UI.
 */
@FeignClient(name = "mod-users", url = "${okapi.url}", configuration = OkapiClientConfig.class)
public interface UsersClient {

  @GetMapping("/users/{id}")
  UserDto getUser(@PathVariable UUID id);

  // ---- inner DTOs ----

  @Data
  @JsonIgnoreProperties(ignoreUnknown = true)
  class UserDto {
    private String id;
    private String barcode;
    private PersonalDto personal;
    private String patronGroup;
    private boolean active;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PersonalDto {
      private String firstName;
      private String lastName;
      private String email;
    }
  }
}
