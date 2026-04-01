package com.hangout.hangoutbackend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findTop100ByBubbleIdAndChannelIdOrderByIdAsc(Long bubbleId, Integer channelId);

    @Query("SELECT DISTINCT m.channelId FROM ChatMessage m WHERE m.bubbleId = :bubbleId ORDER BY m.channelId ASC")
    List<Integer> findDistinctChannelsByBubbleId(@Param("bubbleId") Long bubbleId);
}
