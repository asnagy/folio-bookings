package org.folio.bookingsbl.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Permissions of the calling user, as provided by the platform in X-Okapi-Permissions
 * (the handlers list the override permissions under "permissionsDesired").
 *
 * If the header is absent altogether (a local development gateway) the check passes unless
 * bookings.require-permission-header=true, which production deployments should set.
 */
@Component
public class CallerPermissions {

  public static final String OVERRIDE_AVAILABILITY = "bookings.override-availability";
  public static final String OVERRIDE_LIMIT = "bookings.override-limit";

  private final boolean requireHeader;

  public CallerPermissions(@Value("${bookings.require-permission-header:false}") boolean requireHeader) {
    this.requireHeader = requireHeader;
  }

  public boolean has(String permission) {
    var attributes = RequestContextHolder.getRequestAttributes();
    if (!(attributes instanceof ServletRequestAttributes servletAttributes)) {
      return !requireHeader;
    }
    HttpServletRequest request = servletAttributes.getRequest();
    String header = request.getHeader("X-Okapi-Permissions");
    if (header == null) {
      return !requireHeader;
    }
    return parse(header).contains(permission);
  }

  static Set<String> parse(String header) {
    String trimmed = header.trim();
    if (trimmed.startsWith("[")) {
      trimmed = trimmed.substring(1, trimmed.endsWith("]") ? trimmed.length() - 1 : trimmed.length());
    }
    return Arrays.stream(trimmed.split(","))
      .map(s -> s.trim().replaceAll("^\"|\"$", ""))
      .filter(s -> !s.isEmpty())
      .collect(Collectors.toSet());
  }
}
