package com.hangout.hangoutbackend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserRepository userRepository;
    private final BubbleRepository bubbleRepository;
    private final BubbleMemberRepository memberRepository;
    private final UserFollowRepository followRepository;
    private final UserRatingRepository ratingRepository;

    public UserController(UserRepository userRepository,
                          BubbleRepository bubbleRepository,
                          BubbleMemberRepository memberRepository,
                          UserFollowRepository followRepository,
                          UserRatingRepository ratingRepository) {
        this.userRepository = userRepository;
        this.bubbleRepository = bubbleRepository;
        this.memberRepository = memberRepository;
        this.followRepository = followRepository;
        this.ratingRepository = ratingRepository;
    }

    // ── Profile ───────────────────────────────────────────────────────

    @GetMapping("/{username}")
    public ResponseEntity<Map<String, Object>> getProfile(
            @PathVariable String username,
            @RequestParam(required = false) String viewer) {

        return userRepository.findByUsername(username).map(user -> {
            Map<String, Object> m = buildProfile(user, viewer);
            return ResponseEntity.ok(m);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{username}")
    public ResponseEntity<?> updateProfile(
            @PathVariable String username,
            @RequestBody Map<String, String> body) {

        // Caller must supply their own username in the body to prevent casual spoofing
        String callerUsername = body.get("username");
        if (callerUsername == null || !callerUsername.equals(username))
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));

        // Validate bio length
        String bio = body.get("bio");
        if (bio != null && bio.length() > 300)
            return ResponseEntity.badRequest().body(Map.of("error", "Bio too long (max 300 characters)"));

        // Validate avatar colour
        String avatarColor = body.get("avatarColor");
        if (avatarColor != null && !InputValidator.isValidHexColor(avatarColor))
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid avatar colour (use #rrggbb)"));

        return userRepository.findByUsername(username).map(user -> {
            if (bio != null) user.setBio(bio);
            if (avatarColor != null) user.setAvatarColor(avatarColor);
            if (body.containsKey("profileEmoji")) user.setProfileEmoji(body.get("profileEmoji"));
            userRepository.save(user);
            return ResponseEntity.ok(buildProfile(user, username));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Bubbles ───────────────────────────────────────────────────────

    @GetMapping("/{username}/bubbles")
    public ResponseEntity<Map<String, Object>> getUserBubbles(@PathVariable String username) {
        List<Bubble> created = bubbleRepository.findAll().stream()
                .filter(b -> username.equals(b.getCreatedBy()))
                .toList();

        List<Long> joinedIds = memberRepository.findByUsername(username).stream()
                .map(BubbleMember::getBubbleId).toList();
        List<Bubble> joined = bubbleRepository.findAllById(joinedIds).stream()
                .filter(b -> !username.equals(b.getCreatedBy())).toList();

        return ResponseEntity.ok(Map.of("created", created, "joined", joined));
    }

    // ── Follow / Unfollow ─────────────────────────────────────────────

    @PostMapping("/{username}/follow")
    public ResponseEntity<?> toggleFollow(
            @PathVariable String username,
            @RequestBody Map<String, String> body) {

        String follower = body.get("follower");
        if (follower == null || follower.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "follower required"));
        if (follower.equals(username))
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot follow yourself"));

        // Verify the follower actually exists
        if (userRepository.findByUsername(follower).isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "User not found"));

        Optional<UserFollow> existing = followRepository.findByFollowerAndFollowee(follower, username);
        boolean nowFollowing;
        if (existing.isPresent()) {
            followRepository.delete(existing.get());
            nowFollowing = false;
        } else {
            UserFollow uf = new UserFollow();
            uf.setFollower(follower);
            uf.setFollowee(username);
            followRepository.save(uf);
            nowFollowing = true;
        }
        return ResponseEntity.ok(Map.<String, Object>of(
                "following", nowFollowing,
                "followerCount", followRepository.countByFollowee(username)
        ));
    }

    // ── Ratings ───────────────────────────────────────────────────────

    @GetMapping("/{username}/can-rate")
    public ResponseEntity<Map<String, Object>> canRate(
            @PathVariable String username,
            @RequestParam String raterUsername) {

        if (raterUsername.equals(username))
            return ResponseEntity.ok(Map.<String, Object>of("canRate", false, "reason", "self"));

        boolean alreadyRated = ratingRepository.existsByRaterUsernameAndRatedUsername(raterUsername, username);
        if (alreadyRated)
            return ResponseEntity.ok(Map.<String, Object>of("canRate", false, "reason", "already_rated"));

        Set<Long> raterBubbles = memberRepository.findByUsername(raterUsername).stream()
                .map(BubbleMember::getBubbleId).collect(Collectors.toSet());
        Set<Long> ratedBubbles = memberRepository.findByUsername(username).stream()
                .map(BubbleMember::getBubbleId).collect(Collectors.toSet());
        raterBubbles.retainAll(ratedBubbles);

        if (raterBubbles.isEmpty())
            return ResponseEntity.ok(Map.<String, Object>of("canRate", false, "reason", "no_shared_bubble"));

        return ResponseEntity.ok(Map.<String, Object>of("canRate", true, "reason", "ok",
                "sharedBubbleId", raterBubbles.iterator().next()));
    }

    @PostMapping("/{username}/rate")
    public ResponseEntity<?> submitRating(
            @PathVariable String username,
            @RequestBody Map<String, Object> body) {

        String raterUsername = (String) body.get("raterUsername");
        int rating = body.get("rating") != null ? ((Number) body.get("rating")).intValue() : 0;
        String reason = (String) body.get("reason");

        if (raterUsername == null || rating < 1 || rating > 5)
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid rating (1–5 required)"));
        if (raterUsername.equals(username))
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot rate yourself"));
        if (!InputValidator.isValidRatingReason(reason))
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid reason tag"));
        if (ratingRepository.existsByRaterUsernameAndRatedUsername(raterUsername, username))
            return ResponseEntity.badRequest().body(Map.of("error", "already_rated"));

        // Verify rater exists
        if (userRepository.findByUsername(raterUsername).isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "Rater not found"));

        Set<Long> raterBubbles = memberRepository.findByUsername(raterUsername).stream()
                .map(BubbleMember::getBubbleId).collect(Collectors.toSet());
        Set<Long> ratedBubbles = memberRepository.findByUsername(username).stream()
                .map(BubbleMember::getBubbleId).collect(Collectors.toSet());
        raterBubbles.retainAll(ratedBubbles);
        if (raterBubbles.isEmpty())
            return ResponseEntity.status(403).body(Map.of("error", "no_shared_bubble"));

        UserRating ur = new UserRating();
        ur.setRatedUsername(username);
        ur.setRaterUsername(raterUsername);
        ur.setRating(rating);
        ur.setReason(reason);
        ur.setBubbleId(raterBubbles.iterator().next());
        ratingRepository.save(ur);

        return ResponseEntity.ok(buildRatingSummary(username));
    }

    @GetMapping("/{username}/ratings")
    public ResponseEntity<Map<String, Object>> getRatings(@PathVariable String username) {
        return ResponseEntity.ok(buildRatingSummary(username));
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private Map<String, Object> buildProfile(User user, String viewer) {
        long followers = followRepository.countByFollowee(user.getUsername());
        long following = followRepository.countByFollower(user.getUsername());
        boolean isFollowing = viewer != null &&
                followRepository.findByFollowerAndFollowee(viewer, user.getUsername()).isPresent();

        Map<String, Object> ratingSummary = buildRatingSummary(user.getUsername());

        Map<String, Object> m = new HashMap<>();
        m.put("username", user.getUsername());
        m.put("bio", user.getBio() != null ? user.getBio() : "");
        m.put("avatarColor", user.getAvatarColor() != null ? user.getAvatarColor() : "#7c3aed");
        m.put("profileEmoji", user.getProfileEmoji() != null ? user.getProfileEmoji() : "");
        m.put("followerCount", followers);
        m.put("followingCount", following);
        m.put("isFollowing", isFollowing);
        m.put("avgRating", ratingSummary.get("avgRating"));
        m.put("ratingCount", ratingSummary.get("ratingCount"));
        return m;
    }

    private Map<String, Object> buildRatingSummary(String username) {
        List<UserRating> ratings = ratingRepository.findByRatedUsername(username);
        double avg = ratings.stream().mapToInt(UserRating::getRating).average().orElse(0.0);
        avg = Math.round(avg * 10.0) / 10.0;

        Map<String, Long> reasonCounts = ratings.stream()
                .filter(r -> r.getReason() != null)
                .collect(Collectors.groupingBy(UserRating::getReason, Collectors.counting()));

        List<Map<String, Object>> reasons = reasonCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> Map.<String, Object>of("reason", e.getKey(), "count", e.getValue()))
                .toList();

        return Map.of(
                "avgRating", avg,
                "ratingCount", (long) ratings.size(),
                "reasons", reasons
        );
    }
}
