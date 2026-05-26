package com.hangout.hangoutbackend;

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

    // key = "bubbleId:username", value = lastTypedAt millis
    private final ConcurrentHashMap<String, Long> typingMap = new ConcurrentHashMap<>();

    public BubbleController(BubbleRepository bubbleRepository,
                            BubbleMemberRepository memberRepository,
                            ChatMessageRepository chatRepository,
                            UserRepository userRepository,
                            NotificationService notificationService) {
        this.bubbleRepository = bubbleRepository;
        this.memberRepository = memberRepository;
        this.chatRepository = chatRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    // ── Bubble CRUD ────────────────────────────────────────────────────

    @GetMapping("/bubbles")
    public List<Bubble> getBubbles() {
        return bubbleRepository.findAll();
    }

    @PostMapping("/bubbles")
    public Bubble createBubble(@RequestBody Bubble bubble) {
        Bubble saved = bubbleRepository.save(bubble);
        // Create a BubbleMember record for the creator so they appear in the visual container
        if (saved.getCreatedBy() != null &&
                memberRepository.findByBubbleIdAndUsername(saved.getId(), saved.getCreatedBy()).isEmpty()) {
            BubbleMember bm = new BubbleMember();
            bm.setBubbleId(saved.getId());
            bm.setUsername(saved.getCreatedBy());
            bm.setChannelId(1);
            bm.setShareLocation(false);
            memberRepository.save(bm);
        }
        return saved;
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

                            // Notify bubble creator
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
            // Auto-heal: ensure the host always has a BubbleMember record
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
        ChatMessage saved = chatRepository.save(msg);

        // Notify other members in the same channel
        String sender = (String) body.get("username");
        int channelId = saved.getChannelId() != null ? saved.getChannelId() : 1;
        String preview = saved.getMessage();
        if (preview != null && preview.length() > 60) preview = preview.substring(0, 60) + "…";
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
