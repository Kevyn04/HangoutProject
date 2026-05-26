package com.hangout.hangoutbackend;

import org.springframework.stereotype.Service;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple fixed-window rate limiter — no external dependency.
 * Key format: "<action>:<identifier>"  e.g. "signin:192.168.1.1"
 */
@Service
public class RateLimiterService {

    // value: [hitCount, windowStartMillis]
    private final ConcurrentHashMap<String, long[]> buckets = new ConcurrentHashMap<>();

    public boolean isAllowed(String key, int maxRequests, long windowMillis) {
        long now = System.currentTimeMillis();
        long[] bucket = buckets.compute(key, (k, v) -> {
            if (v == null || now - v[1] > windowMillis) {
                return new long[]{1, now};
            }
            v[0]++;
            return v;
        });
        return bucket[0] <= maxRequests;
    }
}
