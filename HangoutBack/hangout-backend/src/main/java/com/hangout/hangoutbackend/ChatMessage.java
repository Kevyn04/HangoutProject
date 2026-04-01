package com.hangout.hangoutbackend;

import jakarta.persistence.*;

@Entity
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long bubbleId;
    private Integer channelId;
    private String username;

    @Column(columnDefinition = "TEXT")
    private String message;

    private String createdAt;

    public ChatMessage() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getBubbleId() { return bubbleId; }
    public void setBubbleId(Long bubbleId) { this.bubbleId = bubbleId; }

    public Integer getChannelId() { return channelId; }
    public void setChannelId(Integer channelId) { this.channelId = channelId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
