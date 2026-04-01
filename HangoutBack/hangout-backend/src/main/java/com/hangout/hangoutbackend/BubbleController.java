package com.hangout.hangoutbackend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

@RestController
public class BubbleController {

    private final BubbleRepository bubbleRepository;
    private final BubbleMemberRepository memberRepository;
    private final ChatMessageRepository chatRepository;

    public BubbleController(BubbleRepository bubbleRepository,
                            BubbleMemberRepository memberRepository,
                            ChatMessageRepository chatRepository) {
        this.bubbleRepository = bubbleRepository;
        this.memberRepository = memberRepository;
        this.chatRepository = chatRepository;
    }

    // ── Bubble CRUD ────────────────────────────────────────────────────

    @GetMapping("/bubbles")
    public List<Bubble> getBubbles() {
        return bubbleRepository.findAll();
    }

    @PostMapping("/bubbles")
    public Bubble createBubble(@RequestBody Bubble bubble) {
        return bubbleRepository.save(bubble);
    }

    @DeleteMapping("/bubbles/{id}")
    public ResponseEntity<Void> deleteBubble(@PathVariable Long id) {
        if (!bubbleRepository.existsById(id)) return ResponseEntity.notFound().build();
        bubbleRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    // ── Join ───────────────────────────────────────────────────────────

    @PostMapping("/bubbles/{id}/join")
    public ResponseEntity<Bubble> joinBubble(@PathVariable Long id,
                                             @RequestBody Map<String, String> body) {
        String username = body.get("username");
        return bubbleRepository.findById(id)
                .map(bubble -> {
                    if (username != null && !bubble.getMembers().contains(username)) {
                        bubble.getMembers().add(username);
                        bubbleRepository.save(bubble);
                    }
                    // Create BubbleMember record if not exists
                    if (username != null) {
                        boolean exists = memberRepository
                                .findByBubbleIdAndUsername(id, username).isPresent();
                        if (!exists) {
                            long count = memberRepository.countByBubbleId(id);
                            int channelId = (int) (count / 20) + 1;
                            BubbleMember bm = new BubbleMember();
                            bm.setBubbleId(id);
                            bm.setUsername(username);
                            bm.setChannelId(channelId);
                            bm.setShareLocation(false);
                            memberRepository.save(bm);
                        }
                    }
                    return ResponseEntity.ok(bubble);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Members ────────────────────────────────────────────────────────

    @GetMapping("/bubbles/{id}/members")
    public ResponseEntity<List<BubbleMember>> getMembers(@PathVariable Long id) {
        if (!bubbleRepository.existsById(id)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(memberRepository.findByBubbleId(id));
    }

    // ── Location sharing ───────────────────────────────────────────────

    @PostMapping("/bubbles/{id}/location")
    public ResponseEntity<BubbleMember> updateLocation(@PathVariable Long id,
                                                        @RequestBody Map<String, Object> body) {
        String username = (String) body.get("username");
        Boolean shareLocation = (Boolean) body.get("shareLocation");
        Double latitude  = body.get("latitude")  != null ? ((Number) body.get("latitude")).doubleValue()  : null;
        Double longitude = body.get("longitude") != null ? ((Number) body.get("longitude")).doubleValue() : null;

        Optional<BubbleMember> opt = memberRepository.findByBubbleIdAndUsername(id, username);
        BubbleMember bm = opt.orElseGet(() -> {
            BubbleMember n = new BubbleMember();
            n.setBubbleId(id);
            n.setUsername(username);
            n.setChannelId(1);
            return n;
        });
        bm.setShareLocation(shareLocation != null && shareLocation);
        bm.setLatitude(shareLocation != null && shareLocation ? latitude : null);
        bm.setLongitude(shareLocation != null && shareLocation ? longitude : null);
        return ResponseEntity.ok(memberRepository.save(bm));
    }

    // ── Channels ───────────────────────────────────────────────────────

    @GetMapping("/bubbles/{id}/channels")
    public ResponseEntity<List<Integer>> getChannels(@PathVariable Long id) {
        List<BubbleMember> members = memberRepository.findByBubbleId(id);
        List<Integer> channels = members.stream()
                .map(BubbleMember::getChannelId)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
        return ResponseEntity.ok(channels);
    }

    @PostMapping("/bubbles/{id}/channel")
    public ResponseEntity<BubbleMember> switchChannel(@PathVariable Long id,
                                                       @RequestBody Map<String, Object> body) {
        String username  = (String) body.get("username");
        Integer channelId = body.get("channelId") != null
                ? ((Number) body.get("channelId")).intValue() : 1;

        Optional<BubbleMember> opt = memberRepository.findByBubbleIdAndUsername(id, username);
        BubbleMember bm = opt.orElseGet(() -> {
            BubbleMember n = new BubbleMember();
            n.setBubbleId(id);
            n.setUsername(username);
            return n;
        });
        bm.setChannelId(channelId);
        return ResponseEntity.ok(memberRepository.save(bm));
    }

    // ── Chat ───────────────────────────────────────────────────────────

    @GetMapping("/bubbles/{id}/messages")
    public ResponseEntity<List<ChatMessage>> getMessages(@PathVariable Long id,
                                                          @RequestParam(defaultValue = "1") Integer channel) {
        return ResponseEntity.ok(
                chatRepository.findTop100ByBubbleIdAndChannelIdOrderByIdAsc(id, channel));
    }

    @PostMapping("/bubbles/{id}/messages")
    public ResponseEntity<ChatMessage> sendMessage(@PathVariable Long id,
                                                    @RequestBody Map<String, Object> body) {
        if (!bubbleRepository.existsById(id)) return ResponseEntity.notFound().build();
        ChatMessage msg = new ChatMessage();
        msg.setBubbleId(id);
        msg.setChannelId(body.get("channelId") != null
                ? ((Number) body.get("channelId")).intValue() : 1);
        msg.setUsername((String) body.get("username"));
        msg.setMessage((String) body.get("message"));
        msg.setCreatedAt(Instant.now().toString());
        return ResponseEntity.ok(chatRepository.save(msg));
    }
}
