package com.hangout.hangoutbackend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserRepository userRepository;

    public AuthController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, String>> signup(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        }

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));
        }

        User user = new User(username.trim(), password);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Account created", "username", user.getUsername()));
    }

    @PostMapping("/signin")
    public ResponseEntity<Map<String, String>> signin(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        }

        return userRepository.findByUsername(username)
                .filter(user -> user.getPassword().equals(password))
                .map(user -> ResponseEntity.ok(Map.of("message", "Signed in", "username", user.getUsername())))
                .orElse(ResponseEntity.status(401).body(Map.of("error", "Invalid username or password")));
    }

    @PostMapping("/push-token")
    public ResponseEntity<Map<String, String>> savePushToken(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String token = body.get("token");
        if (username == null || token == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "username and token required"));
        }
        return userRepository.findByUsername(username)
                .map(user -> {
                    user.setPushToken(token);
                    userRepository.save(user);
                    return ResponseEntity.ok(Map.of("message", "Token saved"));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
