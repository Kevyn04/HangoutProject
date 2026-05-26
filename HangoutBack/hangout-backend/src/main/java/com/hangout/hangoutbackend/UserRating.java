package com.hangout.hangoutbackend;

import jakarta.persistence.*;

@Entity
@Table(name = "user_rating")
public class UserRating {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String ratedUsername;
    private String raterUsername;   // stored but never exposed — keeps it anonymous
    private int rating;             // 1–5
    private String reason;
    private Long bubbleId;          // the bubble where they met

    public UserRating() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRatedUsername() { return ratedUsername; }
    public void setRatedUsername(String ratedUsername) { this.ratedUsername = ratedUsername; }

    public String getRaterUsername() { return raterUsername; }
    public void setRaterUsername(String raterUsername) { this.raterUsername = raterUsername; }

    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public Long getBubbleId() { return bubbleId; }
    public void setBubbleId(Long bubbleId) { this.bubbleId = bubbleId; }
}
