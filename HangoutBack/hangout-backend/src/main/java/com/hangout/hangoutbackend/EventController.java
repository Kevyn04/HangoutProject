package com.hangout.hangoutbackend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class EventController {

    private final EventRepository eventRepository;
    private final EventAttendeeRepository attendeeRepository;
    private final RateLimiterService rateLimiter;

    public EventController(EventRepository eventRepository,
                           EventAttendeeRepository attendeeRepository,
                           RateLimiterService rateLimiter) {
        this.eventRepository = eventRepository;
        this.attendeeRepository = attendeeRepository;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/events")
    public List<Event> getEvents() {
        return eventRepository.findAll();
    }

    @PostMapping("/events")
    public ResponseEntity<?> createEvent(@RequestBody Event event) {
        if (event.getTitle() == null || event.getTitle().isBlank() || event.getTitle().length() > 100)
            return ResponseEntity.badRequest().body(Map.of("error", "Title must be 1–100 characters"));
        if (event.getLocation() != null && event.getLocation().length() > 200)
            return ResponseEntity.badRequest().body(Map.of("error", "Location too long (max 200)"));
        return ResponseEntity.ok(eventRepository.save(event));
    }

    @PutMapping("/events/{id}")
    public ResponseEntity<?> updateEvent(@PathVariable Long id,
                                          @RequestBody Event updated) {
        if (updated.getTitle() == null || updated.getTitle().isBlank() || updated.getTitle().length() > 100)
            return ResponseEntity.badRequest().body(Map.of("error", "Title must be 1–100 characters"));
        if (updated.getLocation() != null && updated.getLocation().length() > 200)
            return ResponseEntity.badRequest().body(Map.of("error", "Location too long (max 200)"));

        return eventRepository.findById(id)
                .map(event -> {
                    // Only the creator may update
                    if (!event.getCreatedBy().equals(updated.getCreatedBy()))
                        return ResponseEntity.status(403).<Event>build();
                    event.setTitle(updated.getTitle());
                    event.setLocation(updated.getLocation());
                    event.setTime(updated.getTime());
                    event.setLatitude(updated.getLatitude());
                    event.setLongitude(updated.getLongitude());
                    return ResponseEntity.ok(eventRepository.save(event));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/events/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id,
                                             @RequestParam String username) {
        return eventRepository.findById(id).map(event -> {
            if (!event.getCreatedBy().equals(username))
                return ResponseEntity.status(403).<Void>build();
            eventRepository.deleteById(id);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Attendance ────────────────────────────────────────────────────

    @GetMapping("/events/{id}/attendance")
    public ResponseEntity<Map<String, Object>> getAttendance(
            @PathVariable Long id,
            @RequestParam(required = false) String viewer) {
        if (!eventRepository.existsById(id)) return ResponseEntity.notFound().build();
        Map<String, Object> m = new HashMap<>();
        m.put("attendeeCount", attendeeRepository.countByEventId(id));
        m.put("isAttending", viewer != null &&
                attendeeRepository.findByEventIdAndUsername(id, viewer).isPresent());
        return ResponseEntity.ok(m);
    }

    @PostMapping("/events/{id}/attend")
    public ResponseEntity<?> joinEvent(@PathVariable Long id,
                                        @RequestBody Map<String, String> body,
                                        HttpServletRequest request) {
        // 10 join/leave actions per IP per minute
        if (!rateLimiter.isAllowed("attend:" + request.getRemoteAddr(), 10, 60_000L))
            return ResponseEntity.status(429).body(Map.of("error", "Too many requests"));

        String username = body.get("username");
        if (username == null || !eventRepository.existsById(id))
            return ResponseEntity.badRequest().build();
        if (attendeeRepository.findByEventIdAndUsername(id, username).isEmpty()) {
            EventAttendee a = new EventAttendee();
            a.setEventId(id);
            a.setUsername(username);
            attendeeRepository.save(a);
        }
        Map<String, Object> m = new HashMap<>();
        m.put("attendeeCount", attendeeRepository.countByEventId(id));
        m.put("isAttending", true);
        return ResponseEntity.ok(m);
    }

    @DeleteMapping("/events/{id}/attend/{username}")
    @Transactional
    public ResponseEntity<Map<String, Object>> leaveEvent(@PathVariable Long id,
                                                           @PathVariable String username) {
        if (!eventRepository.existsById(id)) return ResponseEntity.notFound().build();
        attendeeRepository.deleteByEventIdAndUsername(id, username);
        Map<String, Object> m = new HashMap<>();
        m.put("attendeeCount", attendeeRepository.countByEventId(id));
        m.put("isAttending", false);
        return ResponseEntity.ok(m);
    }
}
