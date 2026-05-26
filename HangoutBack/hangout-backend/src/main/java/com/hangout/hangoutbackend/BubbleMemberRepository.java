package com.hangout.hangoutbackend;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface BubbleMemberRepository extends JpaRepository<BubbleMember, Long> {
    List<BubbleMember> findByBubbleId(Long bubbleId);
    Optional<BubbleMember> findByBubbleIdAndUsername(Long bubbleId, String username);
    long countByBubbleId(Long bubbleId);
    List<BubbleMember> findByUsername(String username);
}
