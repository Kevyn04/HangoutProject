package com.hangout.hangoutbackend;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PageFollowerRepository extends JpaRepository<PageFollower, Long> {
    List<PageFollower> findByPageId(Long pageId);
    Optional<PageFollower> findByPageIdAndUsername(Long pageId, String username);
    long countByPageId(Long pageId);
    List<PageFollower> findByUsername(String username);
}
