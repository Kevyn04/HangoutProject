package com.hangout.hangoutbackend;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserFollowRepository extends JpaRepository<UserFollow, Long> {
    List<UserFollow> findByFollower(String follower);
    List<UserFollow> findByFollowee(String followee);
    Optional<UserFollow> findByFollowerAndFollowee(String follower, String followee);
    long countByFollowee(String followee);
    long countByFollower(String follower);
}
