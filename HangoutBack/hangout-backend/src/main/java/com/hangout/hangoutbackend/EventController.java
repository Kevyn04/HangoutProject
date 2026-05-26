package com.hangout.hangoutbackend;

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

    public EventController(EventRepository eventRepository,
                           EventAttendeeRepository attendeeRepository) {
        this.eventRepository = eventRepository;
        this.attendeeRepository = attendeeRepository;
    }

    @GetMapping("/events")
    public List<Event> getEvents() {
        return eventRepository.findAll();
    }

    @PostMapping("/events")
    public Event createEvent(@RequestBody Event event) {
        return eventRepository.save(event);
    }

    @PutMapping("/events/{id}")
    public ResponseEntity<Event> updateEvent(@PathVariable Long id, @RequestBody Event updated) {
        return eventRepository.findById(id)
                .map(event -> {
                    event.setTitle(updated.getTitle());
                    event.setLocation(updated.getLocation());
                    event.setTime(updated.getTime());
                    event.setCreatedBy(updated.getCreatedBy());
                    event.setLatitude(updated.getLatitude());
                    event.setLongitude(updated.getLongitude());
                    return ResponseEntity.ok(eventRepository.save(event));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/events/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        if (eventRepository.existsById(id)) {
            eventRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
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
    public ResponseEntity<Map<String, Object>> joinEvent(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
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
    public ResponseEntity<Map<String, Object>> leaveEvent(
            @PathVariable Long id,
            @PathVariable String username) {
        if (!eventRepository.existsById(id)) return ResponseEntity.notFound().build();
        attendeeRepository.deleteByEventIdAndUsername(id, username);
        Map<String, Object> m = new HashMap<>();
        m.put("attendeeCount", attendeeRepository.countByEventId(id));
        m.put("isAttending", false);
        return ResponseEntity.ok(m);
    }
}
