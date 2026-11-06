package org.folio.bookingsbl.client;

import feign.RequestInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Collections;

/**
 * Feign client configuration that propagates the incoming X-Okapi-* headers
 * (tenant, token, user id, request id, ...) and the session cookie/bearer token on every outbound cross-module call,
 * as required by the FOLIO platform. This module has no database, so it reads the
 * headers directly from the current HTTP request instead of folio-spring-base.
 */
public class OkapiClientConfig {

  @Bean
  public RequestInterceptor okapiHeadersInterceptor() {
    return requestTemplate -> {
      var attributes = RequestContextHolder.getRequestAttributes();
      if (!(attributes instanceof ServletRequestAttributes servletAttributes)) {
        return;
      }
      HttpServletRequest request = servletAttributes.getRequest();
      for (String name : Collections.list(request.getHeaderNames())) {
        var lower = name.toLowerCase();
        // X-Okapi-* carry tenant/token; the cookie and bearer token carry the signed-in session
        // on gateways that authenticate that way
        if (lower.startsWith("x-okapi-") || lower.equals("cookie") || lower.equals("authorization")) {
          requestTemplate.header(name, Collections.list(request.getHeaders(name)));
        }
      }
    };
  }
}
