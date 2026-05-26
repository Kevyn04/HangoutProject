package com.hangout.hangoutbackend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/pages")
public class PageController {

    private final PageRepository pageRepository;
    private final PageFollowerRepository followerRepository;
    private final EventRepository eventRepository;
    private final BubbleRepository bubbleRepository;

    public PageController(PageRepository pageRepository,
                          PageFollowerRepository followerRepository,
                          EventRepository eventRepository,
                          BubbleRepository bubbleRepository) {
        this.pageRepository = pageRepository;
        this.followerRepository = followerRepository;
        this.eventRepository = eventRepository;
        this.bubbleRepository = bubbleRepository;
    }

    // ── List all pages ────────────────────────────────────────────────

    @GetMapping
    public List<Map<String, Object>> getPages(@RequestParam(required = false) String username) {
        return pageRepository.findAll().stream().map(p -> toMap(p, username)).toList();
    }

    // ── Create page ───────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<?> createPage(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        if (name == null || name.isBlank() || name.length() > 100)
            return ResponseEntity.badRequest().body(Map.of("error", "Page name must be 1–100 characters"));

        String description = body.get("description");
        if (description != null && description.length() > 500)
            return ResponseEntity.badRequest().body(Map.of("error", "Description too long (max 500)"));

        String avatarColor = body.get("avatarColor");
        if (avatarColor != null && !InputValidator.isValidHexColor(avatarColor))
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid avatar colour (use #rrggbb)"));

        String createdBy = body.get("createdBy");
        if (createdBy != null && !pageRepository.findByCreatedBy(createdBy).isEmpty())
            return ResponseEntity.status(409).body(Map.of("error", "You already have a page"));

        Page page = new Page();
        page.setName(name.trim());
        page.setDescription(description);
        page.setCategory(body.get("category"));
        page.setCreatedBy(createdBy);
        page.setAvatarColor(avatarColor != null ? avatarColor : "#7c3aed");
        Page saved = pageRepository.save(page);
        return ResponseEntity.ok(toMap(saved, createdBy));
    }

    // ── Get page detail ───────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getPage(@PathVariable Long id,
                                                        @RequestParam(required = false) String username) {
        return pageRepository.findById(id)
                .map(p -> ResponseEntity.ok(toMap(p, username)))
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Follow / unfollow ─────────────────────────────────────────────

    @PostMapping("/{id}/follow")
    public ResponseEntity<?> toggleFollow(@PathVariable Long id,
                                           @RequestBody Map<String, String> body) {
        String username = body.get("username");
        if (username == null || username.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "username required"));

        return pageRepository.findById(id).map(page -> {
            Optional<PageFollower> existing = followerRepository.findByPageIdAndUsername(id, username);
            boolean nowFollowing;
            if (existing.isPresent()) {
                followerRepository.delete(existing.get());
                nowFollowing = false;
            } else {
                PageFollower pf = new PageFollower();
                pf.setPageId(id);
                pf.setUsername(username);
                followerRepository.save(pf);
                nowFollowing = true;
            }
            long count = followerRepository.countByPageId(id);
            return ResponseEntity.ok(Map.<String, Object>of(
                    "following", nowFollowing,
                    "followerCount", count
            ));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Page content (events + bubbles by creator) ────────────────────

    @GetMapping("/{id}/content")
    public ResponseEntity<Map<String, Object>> getContent(@PathVariable Long id) {
        return pageRepository.findById(id).map(page -> {
            String creator = page.getCreatedBy();
            List<Event> events = eventRepository.findAll().stream()
                    .filter(e -> creator.equals(e.getCreatedBy()))
                    .toList();
            List<Bubble> bubbles = bubbleRepository.findAll().stream()
                    .filter(b -> creator.equals(b.getCreatedBy()) && !Boolean.TRUE.equals(b.getIsSecret()))
                    .toList();
            return ResponseEntity.ok(Map.<String, Object>of("events", events, "bubbles", bubbles));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Pages followed by a user ──────────────────────────────────────

    @GetMapping("/following")
    public List<Map<String, Object>> getFollowing(@RequestParam String username) {
        List<Long> ids = followerRepository.findByUsername(username).stream()
                .map(PageFollower::getPageId).toList();
        return pageRepository.findAllById(ids).stream()
                .map(p -> toMap(p, username)).toList();
    }

    // ── Helper ────────────────────────────────────────────────────────

    private Map<String, Object> toMap(Page p, String username) {
        long followers = followerRepository.countByPageId(p.getId());
        boolean following = username != null &&
                followerRepository.findByPageIdAndUsername(p.getId(), username).isPresent();
        Map<String, Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("name", p.getName());
        m.put("description", p.getDescription() != null ? p.getDescription() : "");
        m.put("category", p.getCategory() != null ? p.getCategory() : "");
        m.put("createdBy", p.getCreatedBy() != null ? p.getCreatedBy() : "");
        m.put("avatarColor", p.getAvatarColor() != null ? p.getAvatarColor() : "#7c3aed");
        m.put("followerCount", followers);
        m.put("following", following);
        return m;
    }
}
