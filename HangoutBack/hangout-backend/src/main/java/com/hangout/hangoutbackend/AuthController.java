package com.hangout.hangoutbackend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder(10);

    private final UserRepository userRepository;
    private final RateLimiterService rateLimiter;

    public AuthController(UserRepository userRepository, RateLimiterService rateLimiter) {
        this.userRepository = userRepository;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, String>> signup(@RequestBody Map<String, String> body,
                                                       HttpServletRequest request) {
        // 3 signups per IP per 10 minutes
        if (!rateLimiter.isAllowed("signup:" + request.getRemoteAddr(), 3, 10 * 60_000L))
            return ResponseEntity.status(429).body(Map.of("error", "Too many requests. Try again later."));

        String username = body.get("username");
        String password = body.get("password");

        if (username == null || username.isBlank() || password == null || password.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));

        username = username.trim();

        if (!InputValidator.isValidUsername(username))
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Username must be 3–20 characters (letters, numbers, underscores only)"));

        if (!InputValidator.isValidPassword(password))
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Password must be 8–72 characters"));

        if (userRepository.findByUsername(username).isPresent())
            return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));

        User user = new User(username, BCRYPT.encode(password));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Account created", "username", user.getUsername()));
    }

    @PostMapping("/signin")
    public ResponseEntity<Map<String, String>> signin(@RequestBody Map<String, String> body,
                                                       HttpServletRequest request) {
        // 5 attempts per IP per minute
        if (!rateLimiter.isAllowed("signin:" + request.getRemoteAddr(), 5, 60_000L))
            return ResponseEntity.status(429).body(Map.of("error", "Too many login attempts. Wait a minute."));

        String username = body.get("username");
        String password = body.get("password");

        if (username == null || username.isBlank() || password == null || password.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));

        return userRepository.findByUsername(username.trim())
                .filter(user -> BCRYPT.matches(password, user.getPassword()))
                .map(user -> ResponseEntity.ok(Map.of("message", "Signed in", "username", user.getUsername())))
                .orElse(ResponseEntity.status(401).body(Map.of("error", "Invalid username or password")));
    }

    @PostMapping("/push-token")
    public ResponseEntity<Map<String, String>> savePushToken(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String token = body.get("token");
        if (username == null || token == null)
            return ResponseEntity.badRequest().body(Map.of("error", "username and token required"));
        if (token.length() > 200)
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid token"));
        return userRepository.findByUsername(username)
                .map(user -> {
                    user.setPushToken(token);
                    userRepository.save(user);
                    return ResponseEntity.ok(Map.of("message", "Token saved"));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
