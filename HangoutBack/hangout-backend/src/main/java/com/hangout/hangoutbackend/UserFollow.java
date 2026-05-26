package com.hangout.hangoutbackend;

import jakarta.persistence.*;

@Entity
@Table(name = "user_follow")
public class UserFollow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String follower;
    private String followee;

    public UserFollow() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFollower() { return follower; }
    public void setFollower(String follower) { this.follower = follower; }

    public String getFollowee() { return followee; }
    public void setFollowee(String followee) { this.followee = followee; }
}
