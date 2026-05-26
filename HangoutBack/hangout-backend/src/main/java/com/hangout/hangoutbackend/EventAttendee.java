package com.hangout.hangoutbackend;

import jakarta.persistence.*;

@Entity
@Table(name = "event_attendee")
public class EventAttendee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long eventId;
    private String username;

    public EventAttendee() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}
