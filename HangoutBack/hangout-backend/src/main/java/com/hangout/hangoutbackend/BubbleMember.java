package com.hangout.hangoutbackend;

import jakarta.persistence.*;

@Entity
@Table(name = "bubble_member_detail")
public class BubbleMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long bubbleId;
    private String username;
    private Double latitude;
    private Double longitude;
    private Boolean shareLocation = false;
    private Integer channelId = 1;

    public BubbleMember() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getBubbleId() { return bubbleId; }
    public void setBubbleId(Long bubbleId) { this.bubbleId = bubbleId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Boolean getShareLocation() { return shareLocation; }
    public void setShareLocation(Boolean shareLocation) { this.shareLocation = shareLocation; }

    public Integer getChannelId() { return channelId; }
    public void setChannelId(Integer channelId) { this.channelId = channelId; }
}
