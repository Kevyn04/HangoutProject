package com.hangout.hangoutbackend;

import java.util.Set;

public final class InputValidator {

    private InputValidator() {}

    // Username: 3-20 chars, letters/numbers/underscores only
    public static boolean isValidUsername(String s) {
        return s != null && s.matches("[a-zA-Z0-9_]{3,20}");
    }

    // Password: 8-72 chars (BCrypt hard limit is 72)
    public static boolean isValidPassword(String s) {
        return s != null && s.length() >= 8 && s.length() <= 72;
    }

    // Hex colour: #rrggbb
    public static boolean isValidHexColor(String s) {
        return s != null && s.matches("^#[0-9a-fA-F]{6}$");
    }

    public static boolean isWithinLength(String s, int max) {
        return s != null && !s.isBlank() && s.length() <= max;
    }

    public static boolean isNullOrWithinLength(String s, int max) {
        return s == null || s.length() <= max;
    }

    private static final Set<String> ALLOWED_REASON_TAGS = Set.of(
            "Great vibes ✨", "Fun host 🎤", "Very welcoming 🤝", "Punctual ⏰",
            "Good energy ⚡", "Would hang again 🔄", "Made it memorable 🎉", "Chill person 😎"
    );

    public static boolean isValidRatingReason(String s) {
        return s == null || ALLOWED_REASON_TAGS.contains(s);
    }
}
