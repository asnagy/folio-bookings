package org.folio.bookings.mapper;

import org.folio.bookings.domain.dto.Booking;
import org.folio.bookings.entity.BookingEntity;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring",
  nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface BookingMapper {

  @Mapping(target = "bookingItems", ignore = true)
  BookingEntity toEntity(Booking dto);

  Booking toDto(BookingEntity entity);

  List<Booking> toDtoList(List<BookingEntity> entities);

  @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
  @Mapping(target = "id", ignore = true)
  @Mapping(target = "bookingItems", ignore = true)
  void updateEntityFromDto(Booking dto, @MappingTarget BookingEntity entity);
}
