package com.hangout.hangoutbackend;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EventAttendeeRepository extends JpaRepository<EventAttendee, Long> {
    long countByEventId(Long eventId);
    Optional<EventAttendee> findByEventIdAndUsername(Long eventId, String username);
    void deleteByEventIdAndUsername(Long eventId, String username);
}
