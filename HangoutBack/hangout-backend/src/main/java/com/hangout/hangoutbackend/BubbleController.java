package com.hangout.hangoutbackend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@RestController
public class BubbleController {

    private final BubbleRepository bubbleRepository;
    private final BubbleMemberRepository memberRepository;
    private final ChatMessageRepository chatRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final RateLimiterService rateLimiter;

    // key = "bubbleId:username", value = lastTypedAt millis
    private final ConcurrentHashMap<String, Long> typingMap = new ConcurrentHashMap<>();

    public BubbleController(BubbleRepository bubbleRepository,
                            BubbleMemberRepository memberRepository,
                            ChatMessageRepository chatRepository,
                            UserRepository userRepository,
                            NotificationService notificationService,
                            RateLimiterService rateLimiter) {
        this.bubbleRepository = bubbleRepository;
        this.memberRepository = memberRepository;
        this.chatRepository = chatRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.rateLimiter = rateLimiter;
    }

    // ── Bubble CRUD ────────────────────────────────────────────────────

    @GetMapping("/bubbles")
    public List<Bubble> getBubbles() {
        return bubbleRepository.findAll();
    }

    @PostMapping("/bubbles")
    public ResponseEntity<?> createBubble(@RequestBody Bubble bubble) {
        if (bubble.getName() == null || bubble.getName().isBlank() || bubble.getName().length() > 100)
            return ResponseEntity.badRequest().body(Map.of("error", "Bubble name must be 1–100 characters"));
        if (bubble.getDescription() != null && bubble.getDescription().length() > 500)
            return ResponseEntity.badRequest().body(Map.of("error", "Description too long (max 500)"));

        Bubble saved = bubbleRepository.save(bubble);
        if (saved.getCreatedBy() != null &&
                memberRepository.findByBubbleIdAndUsername(saved.getId(), saved.getCreatedBy()).isEmpty()) {
            BubbleMember bm = new BubbleMember();
            bm.setBubbleId(saved.getId());
            bm.setUsername(saved.getCreatedBy());
            bm.setChannelId(1);
            bm.setShareLocation(false);
            memberRepository.save(bm);
        }
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/bubbles/{id}")
    public ResponseEntity<Void> deleteBubble(@PathVariable Long id,
                                              @RequestParam String username) {
        return bubbleRepository.findById(id).map(bubble -> {
            if (!bubble.getCreatedBy().equals(username))
                return ResponseEntity.status(403).<Void>build();
            bubbleRepository.deleteById(id);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
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

                            String creator = bubble.getCreatedBy();
                            if (creator != null && !creator.equals(username)) {
                                userRepository.findByUsername(creator).ifPresent(creatorUser ->
                                        notificationService.send(
                                                creatorUser.getPushToken(),
                                                bubble.getName(),
                                                "@" + username + " joined your bubble"
                                        )
                                );
                            }
                        }
                    }
                    return ResponseEntity.ok(bubble);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Leave ──────────────────────────────────────────────────────────

    @DeleteMapping("/bubbles/{id}/members/{username}")
    public ResponseEntity<Void> leaveBubble(@PathVariable Long id,
                                            @PathVariable String username) {
        if (!bubbleRepository.existsById(id)) return ResponseEntity.notFound().build();
        bubbleRepository.removeMember(id, username);
        memberRepository.findByBubbleIdAndUsername(id, username)
                .ifPresent(memberRepository::delete);
        return ResponseEntity.ok().build();
    }

    // ── Members ────────────────────────────────────────────────────────

    @GetMapping("/bubbles/{id}/members")
    public ResponseEntity<List<BubbleMember>> getMembers(@PathVariable Long id) {
        return bubbleRepository.findById(id).map(bubble -> {
            if (bubble.getCreatedBy() != null &&
                    memberRepository.findByBubbleIdAndUsername(id, bubble.getCreatedBy()).isEmpty()) {
                BubbleMember bm = new BubbleMember();
                bm.setBubbleId(id);
                bm.setUsername(bubble.getCreatedBy());
                bm.setChannelId(1);
                bm.setShareLocation(false);
                memberRepository.save(bm);
            }
            List<BubbleMember> members = memberRepository.findByBubbleId(id);
            members.forEach(m ->
                userRepository.findByUsername(m.getUsername())
                    .ifPresent(u -> m.setProfileEmoji(u.getProfileEmoji()))
            );
            return ResponseEntity.ok(members);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Location sharing ───────────────────────────────────────────────

    @PostMapping("/bubbles/{id}/location")
    public ResponseEntity<?> updateLocation(@PathVariable Long id,
                                             @RequestBody Map<String, Object> body,
                                             HttpServletRequest request) {
        String username = (String) body.get("username");
        if (username == null)
            return ResponseEntity.badRequest().body(Map.of("error", "username required"));

        // 30 location updates per user per minute
        if (!rateLimiter.isAllowed("location:" + username, 30, 60_000L))
            return ResponseEntity.status(429).body(Map.of("error", "Too many location updates"));

        Boolean shareLocation = (Boolean) body.get("shareLocation");
        Double latitude  = body.get("latitude")  != null ? ((Number) body.get("latitude")).doubleValue()  : null;
        Double longitude = body.get("longitude") != null ? ((Number) body.get("longitude")).doubleValue() : null;

        // Validate coordinate ranges
        if (latitude != null && (latitude < -90 || latitude > 90))
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid latitude"));
        if (longitude != null && (longitude < -180 || longitude > 180))
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid longitude"));

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
    public ResponseEntity<?> sendMessage(@PathVariable Long id,
                                          @RequestBody Map<String, Object> body,
                                          HttpServletRequest request) {
        if (!bubbleRepository.existsById(id)) return ResponseEntity.notFound().build();

        String username = (String) body.get("username");
        String message  = (String) body.get("message");

        if (username == null || username.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "username required"));

        // 20 messages per user per minute
        if (!rateLimiter.isAllowed("chat:" + username, 20, 60_000L))
            return ResponseEntity.status(429).body(Map.of("error", "Slow down — too many messages"));

        if (message == null || message.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Message cannot be empty"));
        if (message.length() > 500)
            return ResponseEntity.badRequest().body(Map.of("error", "Message too long (max 500 characters)"));

        ChatMessage msg = new ChatMessage();
        msg.setBubbleId(id);
        msg.setChannelId(body.get("channelId") != null
                ? ((Number) body.get("channelId")).intValue() : 1);
        msg.setUsername(username);
        msg.setMessage(message.trim());
        msg.setCreatedAt(Instant.now().toString());
        ChatMessage saved = chatRepository.save(msg);

        String sender = username;
        int channelId = saved.getChannelId() != null ? saved.getChannelId() : 1;
        String preview = saved.getMessage();
        if (preview.length() > 60) preview = preview.substring(0, 60) + "…";
        final String finalPreview = preview;

        bubbleRepository.findById(id).ifPresent(bubble -> {
            List<BubbleMember> channelMembers = memberRepository.findByBubbleId(id).stream()
                    .filter(m -> m.getChannelId() != null && m.getChannelId() == channelId)
                    .toList();
            for (BubbleMember member : channelMembers) {
                if (member.getUsername().equals(sender)) continue;
                userRepository.findByUsername(member.getUsername()).ifPresent(u ->
                        notificationService.send(
                                u.getPushToken(),
                                bubble.getName() + " · Ch " + channelId,
                                "@" + sender + ": " + finalPreview
                        )
                );
            }
        });

        return ResponseEntity.ok(saved);
    }

    // ── Typing indicators ──────────────────────────────────────────────

    @PostMapping("/bubbles/{id}/typing")
    public ResponseEntity<Void> setTyping(@PathVariable Long id,
                                          @RequestBody Map<String, String> body) {
        String username = body.get("username");
        if (username == null) return ResponseEntity.badRequest().build();
        // 60 typing pings per user per minute — effectively just 1/sec
        if (!rateLimiter.isAllowed("typing:" + username, 60, 60_000L))
            return ResponseEntity.status(429).build();
        typingMap.put(id + ":" + username, System.currentTimeMillis());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/bubbles/{id}/typing")
    public ResponseEntity<List<String>> getTypingUsers(@PathVariable Long id) {
        long cutoff = System.currentTimeMillis() - 4000;
        String prefix = id + ":";
        List<String> typing = typingMap.entrySet().stream()
                .filter(e -> e.getKey().startsWith(prefix) && e.getValue() > cutoff)
                .map(e -> e.getKey().substring(prefix.length()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(typing);
    }
}
