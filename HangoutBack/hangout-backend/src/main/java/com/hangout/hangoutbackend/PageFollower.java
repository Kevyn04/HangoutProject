package com.hangout.hangoutbackend;

import jakarta.persistence.*;

@Entity
@Table(name = "page_follower")
public class PageFollower {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long pageId;
    private String username;

    public PageFollower() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getPageId() { return pageId; }
    public void setPageId(Long pageId) { this.pageId = pageId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}
