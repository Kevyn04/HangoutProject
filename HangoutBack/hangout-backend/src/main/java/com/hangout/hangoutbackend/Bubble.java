package com.hangout.hangoutbackend;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
public class Bubble {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String description;
    private String createdBy;
    private String type;
    private String meetTime;
    private Integer maxMembers;
    private Double latitude;
    private Double longitude;
    private Boolean isSecret;
    private String revealAt;

    @ElementCollection
    @CollectionTable(name = "bubble_members", joinColumns = @JoinColumn(name = "bubble_id"))
    @Column(name = "username")
    private List<String> members = new ArrayList<>();

    public Bubble() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getMeetTime() { return meetTime; }
    public void setMeetTime(String meetTime) { this.meetTime = meetTime; }

    public Integer getMaxMembers() { return maxMembers; }
    public void setMaxMembers(Integer maxMembers) { this.maxMembers = maxMembers; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Boolean getIsSecret() { return isSecret; }
    public void setIsSecret(Boolean isSecret) { this.isSecret = isSecret; }

    public String getRevealAt() { return revealAt; }
    public void setRevealAt(String revealAt) { this.revealAt = revealAt; }

    public List<String> getMembers() { return members; }
    public void setMembers(List<String> members) { this.members = members; }
}
