package org.folio.bookings.mapper;

import org.folio.bookings.domain.dto.Booking;
import org.folio.bookings.entity.BookingEntity;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring", uses = BookingItemMapper.class,
  nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface BookingMapper {

  /** Items are attached by the service so that each item points back at its booking. */
  @Mapping(target = "bookingItems", ignore = true)
  BookingEntity toEntity(Booking dto);

  @Mapping(source = "bookingItems", target = "items")
  @Mapping(source = "createdDate", target = "metadata.createdDate")
  @Mapping(source = "createdByUserId", target = "metadata.createdByUserId")
  @Mapping(source = "updatedDate", target = "metadata.updatedDate")
  @Mapping(source = "updatedByUserId", target = "metadata.updatedByUserId")
  Booking toDto(BookingEntity entity);

  List<Booking> toDtoList(List<BookingEntity> entities);

  @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
  @Mapping(target = "id", ignore = true)
  @Mapping(target = "bookingItems", ignore = true)
  void updateEntityFromDto(Booking dto, @MappingTarget BookingEntity entity);
}
