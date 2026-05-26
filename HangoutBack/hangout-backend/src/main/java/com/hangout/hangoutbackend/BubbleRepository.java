package com.hangout.hangoutbackend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface BubbleRepository extends JpaRepository<Bubble, Long> {

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM bubble_members WHERE bubble_id = ?1 AND username = ?2", nativeQuery = true)
    void removeMember(Long bubbleId, String username);
}
