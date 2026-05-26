package com.hangout.hangoutbackend;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
    private final RestTemplate restTemplate = new RestTemplate();

    public void send(String expoPushToken, String title, String body) {
        if (expoPushToken == null || expoPushToken.isBlank()) return;

        Map<String, Object> payload = Map.of(
                "to", expoPushToken,
                "title", title,
                "body", body,
                "sound", "default"
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Accept", "application/json");

        try {
            restTemplate.postForObject(
                    EXPO_PUSH_URL,
                    new HttpEntity<>(List.of(payload), headers),
                    String.class
            );
        } catch (Exception e) {
            System.err.println("Push notification failed: " + e.getMessage());
        }
    }
}
