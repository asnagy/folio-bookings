package org.folio.bookingsbl.client;

import feign.RequestInterceptor;
import lombok.RequiredArgsConstructor;
import org.folio.spring.FolioExecutionContext;
import org.springframework.context.annotation.Bean;

/**
 * Feign client configuration that propagates Okapi headers
 * (X-Okapi-Tenant, X-Okapi-Token, X-Okapi-Url) on every outbound
 * cross-module call, as required by the FOLIO platform.
 */
@RequiredArgsConstructor
public class OkapiClientConfig {

  private final FolioExecutionContext folioExecutionContext;

  @Bean
  public RequestInterceptor okapiHeadersInterceptor() {
    return requestTemplate -> {
      var headers = folioExecutionContext.getAllHeaders();
      if (headers != null) {
        headers.forEach((name, values) -> {
          if (name != null && name.toLowerCase().startsWith("x-okapi-")) {
            values.forEach(value -> requestTemplate.header(name, value));
          }
        });
      }
    };
  }
}
