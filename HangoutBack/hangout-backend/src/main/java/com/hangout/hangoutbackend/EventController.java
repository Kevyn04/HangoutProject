package com.hangout.hangoutbackend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
public class EventController {

    private final EventRepository eventRepository;

    public EventController(EventRepository eventRepository) {
        this.eventRepository = eventRepository;
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
}
